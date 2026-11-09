// Генератор русскоязычных постов для ЗУМЕРА через OpenRouter.
//
// Amy сама пишет драфты постов когда:
//   - очередь почти пустая (cron /api/cron/queue-refill)
//   - пользователь вызвал /generate в Telegram
//
// Каждый сгенерированный пост идёт в Telegram как pending_approval — публикация
// только после ручного ✅. До одобрения файл в queue/ НЕ создаётся (живёт в Redis).

import { listQueue, QueueItem } from './queue';
import {
  ContentGoal,
  GOAL_SPECS,
  pickNextGoal,
} from './content-strategy';
import {
  buildCastdevContextFromTemplate,
  loadFindings,
  pickModuleForDiscovery,
} from './castdev';
import { handleAt } from './brand-config';
import { searchLocalNewsCandidates, formatNewsCandidatesForPrompt, NewsSourceCandidate } from './news-search';

async function chat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens = 800
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY не задан');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-app.vercel.app',
      'X-Title': 'Threads Bot - generator',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.6',
      messages,
      max_tokens: maxTokens,
      temperature: 0.85,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t}`);
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

export interface GeneratedPost {
  goal: ContentGoal;
  castdev_module?: string;
  // Поле исторически называется text_en, но теперь содержит русский текст.
  // Имя оставлено для совместимости с существующей очередью и Telegram flow.
  text_en: string;
  suggested_filename: string;
  rationale: string;
  sources: NewsSourceCandidate[];
}

async function recentPostedItems(n = 14): Promise<QueueItem[]> {
  const items = await listQueue();
  const posted = items.filter(
    (i) => String(i.frontmatter.status ?? '').toLowerCase() === 'posted'
  );
  posted.sort((a, b) => {
    const ta = String(a.frontmatter.published_at ?? a.path);
    const tb = String(b.frontmatter.published_at ?? b.path);
    return tb.localeCompare(ta);
  });
  return posted.slice(0, n);
}

function buildRecentContext(recent: QueueItem[]): string {
  if (recent.length === 0) return '(нет данных о последних постах)';
  return recent
    .map((it, i) => {
      const goal = it.frontmatter.goal ?? '(не указан)';
      const text = (it.posts[0] ?? '').slice(0, 200);
      return `${i + 1}. [goal: ${goal}] ${text}…`;
    })
    .join('\n\n');
}

function extractRecentGoals(recent: QueueItem[]): ContentGoal[] {
  return recent
    .map((it) => String(it.frontmatter.goal ?? 'brand').toLowerCase() as ContentGoal)
    .filter((g): g is ContentGoal => g === 'subscribe' || g === 'discovery' || g === 'brand');
}

export async function generatePost(forceGoal?: ContentGoal): Promise<GeneratedPost> {
  const recent = await recentPostedItems(6);
  const recentGoals = extractRecentGoals(recent);
  const goal = forceGoal ?? pickNextGoal(recentGoals);
  const spec = GOAL_SPECS[goal];

  let castdevBlock = '';
  let castdevModuleId: string | undefined;
  if (goal === 'discovery') {
    const findings = await loadFindings();
    const castdevModule = pickModuleForDiscovery(findings);
    castdevModuleId = castdevModule.id;
    castdevBlock = `\n\n${await buildCastdevContextFromTemplate(findings)}`;
  }

  const recentBlock = buildRecentContext(recent).slice(0, 1800);
  let newsSources: NewsSourceCandidate[] = [];
  try { newsSources = await searchLocalNewsCandidates(); } catch (error) { console.warn('News discovery unavailable:', error); }
  newsSources = newsSources.slice(0, 4);\n  const newsBlock = formatNewsCandidatesForPrompt(newsSources).slice(0, 2200);

  const userPrompt = `
Напиши один оригинальный пост на русском для Threads-аккаунта ${handleAt()} проекта ЗУМЕР.

ЦЕЛЬ: ${goal}
${spec.description}
Структура: ${spec.structure}
Оптимизация: ${spec.optimize_for}
Не делай: ${spec.avoid.join('; ')}
Длина: ${spec.target_length_chars[0]}–${spec.target_length_chars[1]} символов.

РЕДАКЦИЯ И АУДИТОРИЯ
ЗУМЕР — молодёжное городское медиа Ставрополя, края и Северного Кавказа. Аудитория: молодые жители, соискатели, люди в поиске подработки и действующие курьеры. Рубрики: город и люди, события, городские проблемы, места и маршруты, работа, полезные инструкции, курьерская жизнь, новости, юмор.
Пост должен быть интересен сам по себе и иметь естественную связь с аудиторией. Не притягивай курьерскую тему искусственно и не делай каждый пост рекламой. Цель — доверие и интерес потенциальных курьеров, а не случайные просмотры.
Не выдумывай локальные факты, места, расписания, цены, условия Яндекс Еды, выплаты или личный опыт. Не обещай гарантированный доход и свободный график. Если нет подходящего проверяемого источника, выбери не новостной формат.

ГОЛОС
Живой русский язык, короткие фразы, наблюдательность, самоирония и естественный юмор. Молодёжная подача без искусственного сленга и официоза. Без длинного тире. Одна мысль на пост, 1–3 уместных эмодзи. Не копируй чужие публикации.

НОВОСТНЫЕ КАНДИДАТЫ
Это лишь обнаруженные публикации, не подтверждённые факты. Используй только реально подходящий материал; укажи его SOURCE_ID. Если ничего не подходит, source_ids: [].
${newsBlock}

ПОСЛЕДНИЕ ПОСТЫ (не повторяй темы и формулировки)
${recentBlock}
${castdevBlock}

Ответь строго JSON:
{
  "text_en": "готовый русский пост",
  "rationale": "кратко: рубрика, география и замысел",
  "source_ids": ["использованные SOURCE_ID или пустой массив"]
}
`.trim();

  const raw = await chat(
    [
      { role: 'system', content: 'Ты редактор молодёжного городского медиа ЗУМЕР. Пиши естественно по-русски, живо, честно и конкретно. Не выдумывай факты, источники и условия работы. Не обещай доход. Соблюдай редакционную цель: вовлекать релевантную аудиторию и постепенно знакомить её с курьерской профессией. Возвращай только запрошенный JSON.' },
      { role: 'user', content: userPrompt },
    ],
    900
  );

  let cleaned = raw.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) cleaned = fenced[1];
  let parsed: { text_en: string; rationale: string; source_ids?: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM вернул не-JSON: ${raw.slice(0, 300)}`);
  }

  const text = (parsed.text_en ?? '').trim().replace(/^[\"«']|[\"»']$/g, '');
  if (!text) throw new Error(`LLM вернул пустой text_en: ${raw.slice(0, 300)}`);

  const today = new Date().toISOString().slice(0, 10);
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .slice(0, 5)
    .join('-')
    .slice(0, 50)
    || 'untitled';
  const filename = `${today}-amy-${goal}.md`;

  return {
    goal,
    castdev_module: castdevModuleId,
    text_en: text,
    suggested_filename: filename,
    rationale: parsed.rationale ?? '',
    sources: newsSources.filter((source) => (parsed.source_ids ?? []).includes(source.id)),
  };
}

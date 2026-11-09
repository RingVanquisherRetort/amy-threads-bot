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
  DEFAULT_MIX,
} from './content-strategy';
import {
  buildCastdevContextFromTemplate,
  loadFindings,
  pickModuleForDiscovery,
} from './castdev';
import { getBrandVoicePrompt } from './brand';
import { handleAt } from './brand-config';

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
  const recent = await recentPostedItems(14);
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

  const recentBlock = buildRecentContext(recent);

  const userPrompt = `
Создай ОДИН оригинальный пост НА РУССКОМ ЯЗЫКЕ для Threads-аккаунта ${handleAt()} проекта ЗУМЕР.

ОБЯЗАТЕЛЬНО: итоговый текст публикации должен быть естественным русским текстом для аудитории Ставрополя, Ставропольского края и Северного Кавказа. Не пиши на английском. Не делай англоязычный пост и не переводи шаблонные англоязычные мысли. Пиши именно от редакции ЗУМЕРА, а не абстрактного международного аккаунта о курьерах.

# Тип поста: ${goal}
${spec.description}

## Структура
${spec.structure}

## Оптимизируем под
${spec.optimize_for}

## Чего НЕ делать
${spec.avoid.map((a) => `- ${a}`).join('\n')}

## Целевая длина первого поста
${spec.target_length_chars[0]}–${spec.target_length_chars[1]} символов.${castdevBlock}

## Последние ${recent.length} постов аккаунта (чтобы не повторяться по теме/хуку/деталям)
${recentBlock}

## Формат ответа — СТРОГО JSON
{
  "text_en": "готовый текст публикации НА РУССКОМ ЯЗЫКЕ, без кавычек",
  "rationale": "1-2 предложения на русском — почему такой пост, что именно ловим"
}

Перед ответом проверь: text_en написан по-русски, относится к темам и аудитории ЗУМЕРА, не содержит выдуманных условий Яндекс Еды и обещаний гарантированного дохода. Никаких пояснений вне JSON.
`.trim();

  const raw = await chat(
    [
      { role: 'system', content: await getBrandVoicePrompt() },
      { role: 'user', content: userPrompt },
    ],
    900
  );

  let cleaned = raw.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) cleaned = fenced[1];
  let parsed: { text_en: string; rationale: string };
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
  const filename = `${today}-amy-${goal}-${slug}.md`;

  return {
    goal,
    castdev_module: castdevModuleId,
    text_en: text,
    suggested_filename: filename,
    rationale: parsed.rationale ?? '',
  };
}

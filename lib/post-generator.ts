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

import { editorialDecision, type EditorialScore } from './editorial-score';

export interface EditorialEvaluation {
  score: EditorialScore;
  total: number;
  decision: 'publish_eligible' | 'revise' | 'reject';
  rationale: string;
  usedSourceIds: string[];
}

const EDITORIAL_KEYS: Array<keyof EditorialScore> = [
  'naturalness', 'engagement', 'brandVoice', 'originality',
  'usefulnessEmotion', 'seo', 'factualAccuracy',
];

/** Independent second-pass editorial review. Invalid or incomplete model output fails closed. */
export async function evaluateGeneratedPost(post: GeneratedPost): Promise<EditorialEvaluation> {
  const sourceList = post.sources.map((s) => ({ id: s.id, title: s.title, url: s.url, domain: s.domain }));
  const raw = await chat([
    {
      role: 'system',
      content: 'Ты независимый выпускающий редактор ЗУМЕРА. Проверяй факты строго. Кандидат новости не считается подтверждением факта: использованный источник должен прямо поддерживать утверждение. Не подтверждённые суммы, выплаты, условия Яндекс Еды, гарантии, личные истории и конкретные локальные факты являются критическими ошибками. Верни только JSON.',
    },
    {
      role: 'user',
      content: `Оцени этот пост по шкалам. Верни JSON с полями score (naturalness 0-20, engagement 0-20, brandVoice 0-20, originality 0-15, usefulnessEmotion 0-10, seo 0-10, factualAccuracy 0-5), rationale (до 200 символов), usedSourceIds (массив ID).
Пост: ${post.text_en}
Цель: ${post.goal}
Источники-кандидаты: ${JSON.stringify(sourceList)}
Правила: если пост содержит проверяемые новости/цены/расписания/правила/конкретные городские факты, но ни один переданный источник прямо их не подтверждает, factualAccuracy не выше 1. Если источник лишь кандидат/заголовок и не подтверждает утверждение, не считай его доказательством. Если есть выдуманная история от первого лица, обещание дохода, гарантии или неподтверждённые условия работы, factualAccuracy=0. Для явно условной художественной сценки или мнения без фактических заявлений можно оценить factualAccuracy до 5. usedSourceIds должны быть только из списка выше.`,
    },
  ], 350);

  let parsed: any;
  try {
    const clean = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Редакторская проверка вернула некорректный JSON; публикация запрещена');
  }
  if (!parsed?.score || !Array.isArray(parsed.usedSourceIds) || typeof parsed.rationale !== 'string') {
    throw new Error('Редакторская проверка вернула неполную структуру; публикация запрещена');
  }
  const score = {} as EditorialScore;
  for (const key of EDITORIAL_KEYS) {
    const value = parsed.score[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Редакторская оценка не содержит корректное поле ${key}`);
    }
    score[key] = value;
  }
  const allowedSources = new Set(post.sources.map((s) => s.id));
  const usedSourceIds = parsed.usedSourceIds.filter((id: unknown): id is string =>
    typeof id === 'string' && allowedSources.has(id)
  );
  if (usedSourceIds.length !== parsed.usedSourceIds.length) {
    throw new Error('Редакторская проверка сослалась на неизвестный источник; публикация запрещена');
  }
  const result = editorialDecision(score);
  return {
    score,
    total: result.total,
    decision: result.decision,
    rationale: parsed.rationale.slice(0, 200),
    usedSourceIds,
  };
}


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
  newsSources = newsSources.slice(0, 4);
  const newsBlock = formatNewsCandidatesForPrompt(newsSources).slice(0, 2200);

  const userPrompt = `
Напиши один оригинальный пост на русском для Threads-аккаунта ${handleAt()} проекта ЗУМЕР.

ЦЕЛЬ: ${goal}
${spec.description}
Структура: ${spec.structure}
Оптимизация: ${spec.optimize_for}
Не делай: ${spec.avoid.join('; ')}
Длина: ${spec.target_length_chars[0]}–${spec.target_length_chars[1]} символов.

РЕДАКЦИЯ И АУДИТОРИЯ
ЗУМЕР — молодёжное городское медиа о Ставрополе, Ставропольском крае и Северном Кавказе. Пиши для молодых жителей, соискателей, людей в поиске подработки и действующих курьеров.
ГЕОГРАФИЯ: называй конкретный город только если он прямо подтверждён источником или задан темой. Не пиши «любой город Северного Кавказа», «в каждом городе» и другие пустые обобщения. Если подтверждённой городской детали нет, делай универсальный пост без выдуманной локальной привязки.
Пиши так, чтобы публикация была интересна сама по себе. Связь с работой и курьерской профессией должна быть естественной, не искусственной. Не превращай каждый пост в рекламу.
Не выдумывай локальные факты, места, расписания, цены, условия Яндекс Еды, выплаты, личный опыт и сцены, будто автор сам был их участником. Не обещай гарантированный доход и свободный график. Если нет подходящего источника, выбирай вечнозелёную тему, наблюдение без ложного факта или обсуждение.
НЕ ПРИПИСЫВАЙ РАБОТЕ НЕПОДТВЕРЖДЁННЫЕ ПРЕИМУЩЕСТВА: не утверждай, что у курьеров нет дедлайнов, совещаний, контроля, начальников, стресса или что они сами выбирают график и темп, если это не подтверждено актуальными условиями. Не сравнивай профессии как объективный факт без источника. Для обсуждения используй субъективную формулировку или открытый вопрос, например: «Что для тебя важнее в работе: понятные задачи, самостоятельность или команда?» Не пиши от имени всех курьеров и не объясняй за них, почему они выбирают эту работу. Избегай рекламных финалов вроде «за этим сюда и приходят», если конкретная польза ЗУМЕРА не объяснена и не подтверждена.

ГОЛОС
Живой русский язык, короткие фразы, наблюдательность, самоирония и естественный юмор. Молодёжная подача без искусственного сленга и официоза. Запрещены длинное тире (—, –), шаблонные рекламные финалы и механические призывы «подписывайся». Используй дефис (-), запятые или перестраивай предложение. Одна мысль на пост, 0–2 уместных эмодзи. Не копируй чужие публикации.
КОНКРЕТИКА: избегай фраз вроде «самый долгий светофор», «город так, как его видят изнутри» и других красивых, но пустых обобщений. Лучше одна узнаваемая деталь, точная польза или оригинальная мысль.\nПРАВИЛО ХУДОЖЕСТВЕННЫХ И СОБИРАТЕЛЬНЫХ СЦЕНОК
Можно создавать короткие художественные или собирательные сценки для юмора и узнавания, но нельзя выдавать придуманные детали за наблюдённый факт, реальный случай или личный опыт курьера/редакции.
- Не утверждай, что конкретный лифт, домофон, адрес, клиент или заказ реально существует, если это не подтверждено.
- Если сценка вымышленная, подавай её как условную ситуацию: «представь», «бывает ощущение», «типичная ситуация из серии…», без ложного заявления о конкретном происшествии.
- Не перегружай сценку псевдоточными деталями (номер этажа, адрес, время, сумма), которые создают впечатление документального свидетельства.
- Реальные истории от курьеров используй только если они действительно предоставлены и разрешены к публикации; не сочиняй цитаты и героев.
- Для фактических городских постов, новостей, мест, цен, расписаний и правил нужна проверяемая ссылка. Если проверки нет, не оформляй текст как новость.
Перед выдачей спроси себя: читатель может принять эту деталь за реальный подтверждённый случай? Если да, переформулируй её как явно условную сценку или убери.

НОВОСТНЫЕ КАНДИДАТЫ
Это лишь обнаруженные публикации, не подтверждённые факты. Используй только реально подходящий материал; укажи его SOURCE_ID. Если ничего не подходит, source_ids: [].
${newsBlock}

ПОСЛЕДНИЕ ПОСТЫ (не повторяй темы и формулировки)
${recentBlock}
${castdevBlock}

Ответь строго JSON:
{
  "text_en": "готовый русский пост",
  "rationale": "одна короткая служебная строка: рубрика и причина выбора темы, до 120 символов",
  "source_ids": ["использованные SOURCE_ID или пустой массив"]
}
`.trim();

  const raw = await chat(
    [
      { role: 'system', content: 'Ты редактор молодёжного городского медиа ЗУМЕР. Пиши естественно по-русски, живо, честно и конкретно. Не выдумывай факты, источники и условия работы. Не обещай доход. Соблюдай редакционную цель: вовлекать релевантную аудиторию и постепенно знакомить её с курьерской профессией. Возвращай только запрошенный JSON.' },
      { role: 'user', content: userPrompt },
    ],
    400
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

  const text = (parsed.text_en ?? '').trim().replace(/^[\"«']|[\"»']$/g, '').replace(/[—–]/g, '-');
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

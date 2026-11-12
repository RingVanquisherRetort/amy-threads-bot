// Изолированный генератор контента ЗУМЕРА. Не использует конфигурацию Amy.
export async function generateZumerDraft(topic = ''): Promise<{ text: string; note: string }> {
  const key = process.env.ZUMER_OPENROUTER_API_KEY;
  if (!key) throw new Error('Не задан ZUMER_OPENROUTER_API_KEY в Vercel');
  const prompt = `
Ты - AI-маркетолог проекта ЗУМЕР, партнёрской программы по привлечению курьеров Яндекс Еды.
Напиши ОДИН готовый пост для Telegram-канала @zumer_rabota.

Голос бренда: молодёжный, живой, разговорный, с юмором и лёгкой иронией. Не официоз, не HR-объявление, не агрессивная реклама.
Цель: заинтересовать потенциальных курьеров, помочь разобраться в работе и постепенно привести к регистрации.
Пиши естественно, короткими абзацами. Не используй длинное тире. Не обещай гарантированный доход, не придумывай суммы заработка, тарифы, бонусы, графики, условия, сроки выплат и преимущества. Не выдавай неподтверждённые условия Яндекс Еды за факты. Если нужны детали условий, честно предложи уточнить их перед регистрацией.
Не делай каждый пост прямой рекламой. Чередуй полезный контент, ответы на вопросы новичков, юмор, разбор страхов, особенности профессии и мягкие приглашения узнать подробности.
Не используй Беларусь или Минск. Не выдумывай реальные истории от первого лица.
Тема/пожелание пользователя: ${topic || 'выбери актуальную тему для потенциального курьера, избегай повторяющихся рекламных клише'}.

Верни только JSON: {"text":"текст поста","note":"короткая рубрика и цель поста"}.
`.trim();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://zumer-rabota.ru',
      'X-Title': 'Zumer AI Content',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'Ты редактор ЗУМЕРА. Соблюдай фактическую точность и правила бренда. Верни только валидный JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 700,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`OpenRouter вернул ошибку ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: { text?: string; note?: string };
  try { parsed = JSON.parse(cleaned); } catch { throw new Error('AI вернул некорректный формат. Повтори команду /generate.'); }
  const text = String(parsed.text ?? '').trim().replace(/[—–]/g, '-');
  if (!text || text.length > 3500) throw new Error('AI вернул пустой или слишком длинный пост.');
  const risky = [/гарантир\w* доход/i, /гарантирован\w* заработ/i, /заработ\w* от \d/i, /до \d{1,3}[ .]?000\s*(₽|руб)/i];
  if (risky.some((pattern) => pattern.test(text))) {
    throw new Error('Черновик содержит неподтверждённое обещание или сумму. Не отправляю его на согласование. Повтори /generate.');
  }
  return { text, note: String(parsed.note ?? 'Черновик Зумера').slice(0, 180) };
}

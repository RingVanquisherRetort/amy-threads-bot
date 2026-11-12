// Отдельный Telegram-клиент проекта Зумер.
// Не использует TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID Amy.

function getZumerToken(): string {
  const token = process.env.ZUMER_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('ZUMER_TELEGRAM_BOT_TOKEN не задан');
  return token;
}

export async function sendZumerTelegram(
  chatId: string | number,
  text: string
): Promise<void> {
  const token = getZumerToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    cache: 'no-store',
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram Зумер: ${result.description ?? response.status}`);
  }
}

export async function sendZumerChannelMessage(text: string): Promise<void> {
  const channelId = process.env.ZUMER_TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('ZUMER_TELEGRAM_CHANNEL_ID не задан');
  await sendZumerTelegram(channelId, text);
}

// Отдельный Telegram-клиент проекта Зумер. Не использует токен Amy.
function getZumerToken(): string {
  const token = process.env.ZUMER_TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('ZUMER_TELEGRAM_BOT_TOKEN не задан');
  return token;
}

export interface ZumerButton { text: string; callback_data: string }

async function callTelegram(method: string, body: Record<string, unknown>): Promise<any> {
  const token = getZumerToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const result = await response.json() as { ok?: boolean; description?: string; result?: any };
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram Зумер: ${result.description ?? response.status}`);
  }
  return result.result;
}

export async function sendZumerTelegram(
  chatId: string | number,
  text: string,
  buttons?: ZumerButton[][]
): Promise<{ message_id: number }> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  return callTelegram('sendMessage', body) as Promise<{ message_id: number }>;
}

export async function editZumerTelegram(
  chatId: string | number,
  messageId: number,
  text: string,
  buttons: ZumerButton[][] = []
): Promise<void> {
  await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function answerZumerCallback(callbackQueryId: string, text: string): Promise<void> {
  await callTelegram('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

export async function sendZumerChannelMessage(text: string): Promise<void> {
  const channelId = process.env.ZUMER_TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('ZUMER_TELEGRAM_CHANNEL_ID не задан');
  await sendZumerTelegram(channelId, text);
}

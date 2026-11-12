import { NextResponse } from 'next/server';
import { sendZumerTelegram } from '@/lib/zumer-telegram';

export const dynamic = 'force-dynamic';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('setup') === '1') {
    return new Response(`<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Подключение Telegram Зумер</title>
<body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 20px">
<h2>Подключить Telegram Зумер</h2>
<p>Введи значение ZUMER_TELEGRAM_WEBHOOK_SECRET, сохранённое в Vercel. Оно отправится защищённым POST-запросом и не попадёт в адресную строку.</p>
<form method="post" action="/api/bot/zumer-webhook/setup">
<input type="password" name="secret" autocomplete="off" required style="box-sizing:border-box;width:100%;padding:14px;font-size:16px">
<button style="margin-top:16px;padding:14px 20px;font-size:16px">Подключить Telegram</button>
</form></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({
    ok: true,
    service: 'zumer-telegram-webhook',
    configured: Boolean(
      process.env.ZUMER_TELEGRAM_BOT_TOKEN &&
      process.env.ZUMER_TELEGRAM_WEBHOOK_SECRET
    ),
  });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ZUMER_TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token');

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) return NextResponse.json({ ok: true, ignored: true });

  try {
    if (text === '/start' || text.startsWith('/start ')) {
      await sendZumerTelegram(
        message.chat.id,
        'Привет! Это Зумер 👋\n\nЯ отдельный Telegram-бот проекта. Подключение готово, дальше добавим управление публикациями и контентом.'
      );
    } else if (text === '/help') {
      await sendZumerTelegram(
        message.chat.id,
        'Команды Зумера:\n/start - начать работу\n/help - помощь'
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[zumer-telegram-webhook]', error);
    return NextResponse.json({ ok: false, error: 'telegram_request_failed' }, { status: 502 });
  }
}

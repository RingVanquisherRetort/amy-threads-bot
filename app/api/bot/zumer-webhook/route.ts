import { NextResponse } from 'next/server';
import { sendZumerTelegram } from '@/lib/zumer-telegram';

export const dynamic = 'force-dynamic';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

export async function GET() {
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

import { NextResponse } from 'next/server';
import {
  answerZumerCallback,
  editZumerTelegram,
  sendZumerChannelMessage,
  sendZumerTelegram,
} from '@/lib/zumer-telegram';
import { generateZumerDraft } from '@/lib/zumer-content';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
}
interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: TelegramMessage;
  };
}

const NL = String.fromCharCode(10);

function verifyAdmin(chatId: number): boolean {
  return Boolean(process.env.ZUMER_TELEGRAM_ADMIN_CHAT_ID) &&
    String(chatId) === String(process.env.ZUMER_TELEGRAM_ADMIN_CHAT_ID);
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
    configured: Boolean(process.env.ZUMER_TELEGRAM_BOT_TOKEN && process.env.ZUMER_TELEGRAM_WEBHOOK_SECRET),
  });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ZUMER_TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try { update = await request.json() as TelegramUpdate; }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const handle = async () => {
    try {
      if (update.callback_query) {
        const cb = update.callback_query;
        const message = cb.message;
        if (!message || !verifyAdmin(message.chat.id) || !verifyAdmin(cb.from.id)) {
          await answerZumerCallback(cb.id, 'Нет доступа');
          return;
        }
        const data = cb.data ?? '';
        if (data === 'zumer:reject') {
          await editZumerTelegram(message.chat.id, message.message_id, 'Черновик отклонён. Ничего не опубликовано.');
          await answerZumerCallback(cb.id, 'Черновик отклонён');
          return;
        }
        if (data === 'zumer:approve') {
          const marker = 'ТЕКСТ ПОСТА:' + NL;
          const footer = NL + NL + 'Публиковать в @zumer_rabota?';
          const start = message.text?.indexOf(marker) ?? -1;
          const end = message.text?.lastIndexOf(footer) ?? -1;
          const post = start >= 0 && end > start
            ? message.text!.slice(start + marker.length, end).trim()
            : '';
          if (!post) {
            await answerZumerCallback(cb.id, 'Не удалось прочитать текст черновика');
            return;
          }
          await sendZumerChannelMessage(post);
          await editZumerTelegram(message.chat.id, message.message_id, 'Опубликовано в @zumer_rabota.' + NL + NL + post);
          await answerZumerCallback(cb.id, 'Опубликовано в канал');
        }
        return;
      }

      const message = update.message;
      const text = message?.text?.trim();
      if (!message || !text) return;

      if (text === '/start' || text.startsWith('/start ')) {
        await sendZumerTelegram(message.chat.id,
          ['Привет! Это Зумер 👋', '', 'Я AI-маркетолог проекта. Отправь /id, чтобы узнать свой Telegram ID. После настройки доступа сможешь вызывать /generate для создания черновиков.'].join(NL));
        return;
      }
      if (text === '/id') {
        await sendZumerTelegram(message.chat.id,
          ['Твой Telegram ID: ' + message.chat.id, 'Добавь это число в Vercel как ZUMER_TELEGRAM_ADMIN_CHAT_ID. Само число не является секретом.'].join(NL));
        return;
      }
      if (text === '/help') {
        await sendZumerTelegram(message.chat.id,
          ['Команды Зумера:', '/id - показать Telegram ID', '/generate - создать черновик поста', '/generate тема - написать пост на заданную тему', '', 'Публикация происходит только после твоего подтверждения.'].join(NL));
        return;
      }
      if (text === '/generate' || text.startsWith('/generate ')) {
        if (!verifyAdmin(message.chat.id)) {
          await sendZumerTelegram(message.chat.id, 'Генерация пока закрыта. Сначала настрой ZUMER_TELEGRAM_ADMIN_CHAT_ID в Vercel и попробуй снова.');
          return;
        }
        if (!process.env.ZUMER_OPENROUTER_API_KEY) {
          await sendZumerTelegram(message.chat.id, 'Не найден ключ генерации. Добавь ZUMER_OPENROUTER_API_KEY в Vercel → Settings → Environment Variables для Preview-ветки amy-2.0-foundation.');
          return;
        }
        await sendZumerTelegram(message.chat.id, 'Готовлю черновик Зумера. Это займёт немного времени...');
        const topic = text.slice('/generate'.length).trim();
        const draft = await generateZumerDraft(topic);
        const approvalText = [
          'ЧЕРНОВИК ЗУМЕРА',
          'Рубрика: ' + draft.note,
          '',
          'ТЕКСТ ПОСТА:',
          draft.text,
          '',
          'Публиковать в @zumer_rabota?',
        ].join(NL);
        await sendZumerTelegram(message.chat.id, approvalText, [[
          { text: 'Опубликовать', callback_data: 'zumer:approve' },
          { text: 'Отклонить', callback_data: 'zumer:reject' },
        ]]);
      }
    } catch (error) {
      console.error('[zumer-webhook]', error);
      const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
      if (chatId) {
        try { await sendZumerTelegram(chatId, 'Не удалось выполнить действие: ' + (error instanceof Error ? error.message : 'ошибка')); } catch {}
      }
    }
  };

  const waitUntil = (globalThis as any)?.[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil;
  if (typeof waitUntil === 'function') waitUntil(handle());
  else void handle();

  return NextResponse.json({ ok: true });
}

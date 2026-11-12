import { NextResponse } from 'next/server';
import { sendZumerChannelMessage } from '@/lib/zumer-telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(`<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тест публикации Зумер</title>
<body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 20px">
<h2>Тестовая публикация в канал Зумер</h2>
<p>Введи значение ZUMER_TELEGRAM_WEBHOOK_SECRET из Vercel. После нажатия бот отправит в канал одно тестовое сообщение.</p>
<form method="post">
<input type="password" name="secret" autocomplete="off" required style="box-sizing:border-box;width:100%;padding:14px;font-size:16px">
<button style="margin-top:16px;padding:14px 20px;font-size:16px">Отправить тестовый пост</button>
</form></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const expected = process.env.ZUMER_TELEGRAM_WEBHOOK_SECRET;
  const form = await request.formData();
  const supplied = form.get('secret');
  if (!expected || typeof supplied !== 'string' || supplied !== expected) {
    return new Response('Неверный секрет. Проверь значение в Vercel и попробуй снова.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  try {
    await sendZumerChannelMessage('🚀 Тестовая публикация Зумера!\n\nЕсли ты видишь это сообщение, бот успешно подключён к каналу и может публиковать посты.');
    return NextResponse.json({ ok: true, message: 'Тестовая публикация отправлена в канал @zumer_rabota.' });
  } catch (error) {
    console.error('[zumer-telegram-test]', error);
    return NextResponse.json({ ok: false, error: 'Не удалось отправить сообщение. Проверь права бота и настройки канала.' }, { status: 502 });
  }
}

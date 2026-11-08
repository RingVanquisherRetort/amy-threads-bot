import { NextResponse } from 'next/server';
import { setWebhook } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_WEBHOOK_SECRET is not configured' }, { status: 500 });
  }

  let supplied = '';
  try {
    const form = await req.formData();
    supplied = String(form.get('secret') ?? '');
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
  }

  if (supplied !== expected) {
    return new Response('Неверный секрет. Проверь значение в Vercel.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const webhookUrl = `${url.origin}/api/bot/telegram-webhook`;

  try {
    await setWebhook(webhookUrl, expected);
    return new Response(
      `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Telegram подключён</title><body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 20px"><h2>Telegram webhook подключён</h2><p>Теперь открой Telegram и отправь своему боту команду /help.</p><p>Адрес webhook: ${webhookUrl}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

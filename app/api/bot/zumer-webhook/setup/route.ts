import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const form = await request.formData();
  const submittedSecret = String(form.get('secret') ?? '');
  const expectedSecret = process.env.ZUMER_TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.ZUMER_TELEGRAM_BOT_TOKEN;

  if (!expectedSecret || submittedSecret !== expectedSecret) {
    return new Response('Неверный секрет. Проверь значение в Vercel.', { status: 401 });
  }
  if (!token) {
    return new Response('ZUMER_TELEGRAM_BOT_TOKEN не настроен.', { status: 500 });
  }

  const host = new URL(request.url);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const webhookUrl = new URL('/api/bot/zumer-webhook', host.origin);
  if (bypass) webhookUrl.searchParams.set('x-vercel-protection-bypass', bypass);

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl.toString(),
      secret_token: expectedSecret,
      allowed_updates: ['message', 'callback_query'],
    }),
    cache: 'no-store',
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !result.ok) {
    console.error('[zumer-webhook-setup]', result.description ?? response.status);
    return new Response('Telegram не принял webhook. Проверь настройки и повтори попытку.', { status: 502 });
  }

  return NextResponse.redirect(new URL('/api/bot/zumer-webhook', host.origin), 303);
}

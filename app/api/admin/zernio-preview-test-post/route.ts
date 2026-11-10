import { NextResponse } from 'next/server';
import { acquireLock, setWithTtl } from '@/lib/redis';
import { createThreadsPost } from '@/lib/zernio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEST_TEXT = 'Это тестовая публикация проекта Зумер 👋 Проверяем подключение Threads через Zernio. Скоро вернёмся с полезными новостями для курьеров.';

export async function POST() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'amy-2.0-foundation') {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    const locked = await acquireLock('amy2:diagnostics:zernio-test-post:2026-11-10', 86400);
    if (!locked) {
      return NextResponse.json({ ok: false, error: 'Тестовая публикация на сегодня уже запускалась. Повтор заблокирован.' }, { status: 409 });
    }

    try {
      const result = await createThreadsPost(TEST_TEXT);
      await setWithTtl('amy2:diagnostics:zernio-test-post:result:2026-11-10', {
        id: result.id, permalink: result.permalink, timestamp: result.timestamp,
      }, 86400);
      return NextResponse.json({ ok: true, text: TEST_TEXT, ...result }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      // Keep the one-shot lock: an uncertain provider response must never cause a duplicate public post.
      const message = error instanceof Error ? error.message : 'Zernio request failed';
      return NextResponse.json({ ok: false, error: message.slice(0, 300), retryBlocked: true }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Diagnostic failed';
    return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status: 500 });
  }
}

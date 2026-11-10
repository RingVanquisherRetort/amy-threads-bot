import { NextResponse } from 'next/server';
import { get, releaseLock } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'amy-2.0-foundation') {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const resultKey = 'amy2:diagnostics:zernio-test-post:result:2026-11-10';
  const lockKey = 'amy2:diagnostics:zernio-test-post:2026-11-10';

  try {
    const priorResult = await get<{ id?: string; permalink?: string; timestamp?: string }>(resultKey);
    if (priorResult) {
      return NextResponse.json({
        ok: true,
        unlocked: false,
        alreadyPublished: true,
        message: 'Предыдущая публикация уже подтверждена. Блокировку оставили, чтобы не создать дубль.',
        result: priorResult,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    await releaseLock(lockKey);
    return NextResponse.json({
      ok: true,
      unlocked: true,
      alreadyPublished: false,
      warning: 'Ключ результата отсутствует. Блокировка снята по запросу пользователя, но предыдущий ответ Zernio мог быть неопределённым.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unlock failed';
    return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status: 500 });
  }
}

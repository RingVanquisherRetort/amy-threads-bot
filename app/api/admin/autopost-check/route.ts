import { NextResponse } from 'next/server';
import { acquireLock, releaseLock, cmdRaw } from '@/lib/redis';
import { nextDraft } from '@/lib/queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Preview-only simulation. Reads the queue and exercises Redis locking with a
// unique diagnostic key. It never calls Zernio, Telegram, or changes queue files.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const key = `amy2:diagnostics:autopost-lock:${crypto.randomUUID()}`;
  let firstAcquire = false;
  let secondAcquireBlocked = false;
  let ttlSeconds: number | null = null;
  let released = false;
  let reacquireAfterRelease = false;

  try {
    const candidate = await nextDraft();
    firstAcquire = await acquireLock(key, 320);
    if (!firstAcquire) throw new Error('initial_lock_acquire_failed');

    secondAcquireBlocked = !(await acquireLock(key, 320));
    const ttl = await cmdRaw(['TTL', key]);
    ttlSeconds = Number(ttl);

    await releaseLock(key);
    released = (await cmdRaw(['EXISTS', key])) === 0 || Number(await cmdRaw(['EXISTS', key])) === 0;
    reacquireAfterRelease = await acquireLock(key, 320);

    const ok = firstAcquire && secondAcquireBlocked &&
      ttlSeconds !== null && ttlSeconds > 0 && ttlSeconds <= 320 &&
      released && reacquireAfterRelease;

    return NextResponse.json({
      service: 'autopost-safety-diagnostic',
      ok,
      checks: {
        queueRead: true,
        eligibleDraftFound: Boolean(candidate),
        candidatePath: candidate?.path ?? null,
        firstLockAcquired: firstAcquire,
        concurrentLockBlocked: secondAcquireBlocked,
        lockTtlSeconds: ttlSeconds,
        lockReleased: released,
        lockCanBeReacquired: reacquireAfterRelease,
        externalPublishCalled: false,
        queueModified: false
      }
    }, { status: ok ? 200 : 503 });
  } catch {
    try { await releaseLock(key); } catch {}
    return NextResponse.json({
      service: 'autopost-safety-diagnostic',
      ok: false,
      checks: { firstLockAcquired: firstAcquire, concurrentLockBlocked: secondAcquireBlocked, lockTtlSeconds: ttlSeconds },
      error: 'diagnostic_failed'
    }, { status: 503 });
  } finally {
    try { await releaseLock(key); } catch {}
  }
}

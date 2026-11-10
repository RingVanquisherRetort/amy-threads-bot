import { NextResponse } from 'next/server';
import { cmdRaw } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Preview-only diagnostic: writes one short-lived namespaced test key and removes it.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const key = `amy2:diagnostics:redis:${crypto.randomUUID()}`;
  const marker = `redis-check-${Date.now()}`;
  let writeOk = false;
  let readOk = false;
  let deleteOk = false;
  let absentAfterDelete = false;

  try {
    const pong = await cmdRaw(['PING']);
    if (pong !== 'PONG') throw new Error('ping_failed');

    const setResult = await cmdRaw(['SET', key, marker, 'EX', 60]);
    writeOk = setResult === 'OK';

    const value = await cmdRaw(['GET', key]);
    readOk = value === marker;

    const deleted = await cmdRaw(['DEL', key]);
    deleteOk = Number(deleted) === 1;

    const afterDelete = await cmdRaw(['GET', key]);
    absentAfterDelete = afterDelete === null;

    const ok = writeOk && readOk && deleteOk && absentAfterDelete;
    return NextResponse.json(
      { service: 'redis', ok, checks: { ping: true, write: writeOk, read: readOk, delete: deleteOk, absentAfterDelete } },
      { status: ok ? 200 : 503 },
    );
  } catch {
    // Best-effort cleanup; the 60-second TTL is a final safety net.
    try { await cmdRaw(['DEL', key]); } catch {}
    return NextResponse.json(
      { service: 'redis', ok: false, checks: { ping: true, write: writeOk, read: readOk, delete: deleteOk, absentAfterDelete }, error: 'redis_operation_failed' },
      { status: 503 },
    );
  }
}

import { NextResponse } from 'next/server';
import { cmdRaw } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Preview-only diagnostic: returns no credentials or stored data.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const result = await cmdRaw(['PING']);
    return NextResponse.json(
      { service: 'redis', ok: result === 'PONG', response: result === 'PONG' ? 'PONG' : 'unexpected_response' },
      { status: result === 'PONG' ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { service: 'redis', ok: false, response: 'connection_failed' },
      { status: 503 },
    );
  }
}

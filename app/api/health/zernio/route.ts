import { NextResponse } from 'next/server';
import { getThreadsAccountHealth } from '@/lib/zernio';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  try {
    const health = await getThreadsAccountHealth();
    return NextResponse.json({
      status: health.status,
      platform: health.platform,
      username: health.username,
      tokenValid: health.tokenStatus?.valid ?? null,
      tokenExpiresAt: health.tokenStatus?.expiresAt ?? null,
      canPost: health.permissions?.canPost ?? null,
      missingRequired: health.permissions?.missingRequired ?? [],
      issues: health.issues ?? [],
      recommendations: health.recommendations ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Zernio health check failed:', message);
    return NextResponse.json({ status: 'error', message }, { status: 502 });
  }
}

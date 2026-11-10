import { NextResponse } from 'next/server';
import { getThreadsAccountHealth } from '@/lib/zernio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Temporary, read-only diagnostic for the isolated Amy 2.0 Preview branch.
// Vercel Preview Authentication remains the access control; Production always returns 404.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'amy-2.0-foundation') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const health = await getThreadsAccountHealth();
    return NextResponse.json({
      ok: true,
      platform: health.platform ?? null,
      username: health.username ?? null,
      status: health.status ?? null,
      tokenValid: health.tokenStatus?.valid ?? null,
      tokenExpiresAt: health.tokenStatus?.expiresAt ?? null,
      canPost: health.permissions?.canPost ?? null,
      canFetchAnalytics: health.permissions?.canFetchAnalytics ?? null,
      missingRequired: health.permissions?.missingRequired ?? [],
      issues: health.issues ?? [],
      recommendations: health.recommendations ?? [],
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Zernio Preview diagnostic failed:', message);
    return NextResponse.json({
      ok: false,
      error: message.slice(0, 300),
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

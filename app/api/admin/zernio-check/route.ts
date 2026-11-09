import { NextResponse } from 'next/server';
import { getThreadsAccountHealth } from '@/lib/zernio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Preview-only, read-only account health check. Never returns credentials.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const account = await getThreadsAccountHealth();
    const tokenValid = account.tokenStatus?.valid;
    const canPost = account.permissions?.canPost;
    const ok = account.platform === 'threads' && account.status !== 'error' && tokenValid === true;
    return NextResponse.json({
      service: 'zernio',
      ok,
      platform: account.platform,
      accountStatus: account.status,
      tokenValid: tokenValid ?? null,
      canPost: canPost ?? null,
      canFetchAnalytics: account.permissions?.canFetchAnalytics ?? null,
      missingRequired: account.permissions?.missingRequired ?? [],
      issues: account.issues ?? [],
    }, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ service: 'zernio', ok: false, error: 'account_health_check_failed' }, { status: 503 });
  }
}

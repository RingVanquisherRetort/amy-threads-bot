// Legacy Threads Graph API token refresh is retired during the Zernio migration.
// Zernio manages the connected Threads account token; never refresh the old Meta token.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'paused',
    reason: 'legacy Meta token refresh is disabled; Zernio manages Threads authentication',
  });
}

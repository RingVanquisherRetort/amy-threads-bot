// Legacy scheduled-reply endpoint is intentionally disabled.
// Replies from Amy must be reviewed and sent manually by the account owner.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function verifyAuth(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    status: 'paused',
    reason: 'Replies require manual sending',
  });
}

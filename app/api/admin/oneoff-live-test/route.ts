import { NextRequest, NextResponse } from 'next/server';
import { setnx } from '@/lib/redis';
import { publishText } from '@/lib/threads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TEST_TEXT = 'У каждого есть знакомый, который говорит: «Ищу подработку», но дальше просмотра объявлений дело не идёт 😅\n\nБез осуждения, сами такие. Главное - однажды всё-таки начать.';

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'amy-2.0-foundation') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const secret = process.env.AMY_ONEOFF_TEST_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Reserve permanently before calling the external API. Even a timeout must
  // never cause an automatic retry that could publish a duplicate.
  try {
    const reserved = await setnx('amy2:oneoff-live-test:consumed', {
      reservedAt: new Date().toISOString(),
      text: TEST_TEXT,
      status: 'reserved',
    });
    if (!reserved) {
      return NextResponse.json({ error: 'already_consumed' }, { status: 409 });
    }

    const published = await publishText(TEST_TEXT);
    return NextResponse.json({
      ok: true,
      published: true,
      postId: published.id,
      permalink: published.permalink,
      timestamp: published.timestamp,
      text: TEST_TEXT,
      note: 'One-time lock remains consumed; no automatic retry is possible.',
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      published: 'unknown_or_failed',
      error: error instanceof Error ? error.message : 'publish_failed',
      note: 'One-time lock remains consumed to prevent accidental duplicate publishing.',
    }, { status: 502 });
  }
}

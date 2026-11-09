import { NextResponse } from 'next/server';
import { listQueue, markPosted, extractMediaForPost } from '@/lib/queue';
import { publishThread } from '@/lib/threads';
import { acquireLock, releaseLock, get, setWithTtl } from '@/lib/redis';
import { sendTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Deliberately allow exactly one approved first-test post. This route does not
// enable or invoke the general autopost cron.
const ALLOWED_FILE = 'queue/2026-11-09-amy-subscribe.md';
const LOCK_KEY = 'lock:zumer:first-test-post';
const POSTED_KEY = 'posted:zumer:first-test-post';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { confirm?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  if (body.confirm !== 'PUBLISH_ZUMER_FIRST_POST') {
    return NextResponse.json({ error: 'explicit_confirmation_required' }, { status: 400 });
  }

  const lock = await acquireLock(LOCK_KEY, 180).catch(() => false);
  if (!lock) return NextResponse.json({ status: 'busy' }, { status: 409 });

  try {
    const already = await get(POSTED_KEY).catch(() => null);
    if (already) return NextResponse.json({ status: 'already_published', result: already });

    const items = await listQueue();
    const item = items.find((entry) => entry.path === ALLOWED_FILE);
    if (!item) return NextResponse.json({ error: 'approved_file_not_found' }, { status: 404 });

    const status = String(item.frontmatter.status ?? '').toLowerCase();
    if (status !== 'draft') {
      return NextResponse.json({ error: 'file_not_in_draft_status', status }, { status: 409 });
    }
    if (item.posts.length !== 1 || !item.posts[0]) {
      return NextResponse.json({ error: 'expected_exactly_one_post' }, { status: 409 });
    }
    if (item.posts[0].length > 500) {
      return NextResponse.json({ error: 'post_exceeds_threads_limit' }, { status: 400 });
    }

    const media = [extractMediaForPost(item, 0)];
    const published = await publishThread(item.posts, media);
    const result = {
      file: item.path,
      post_id: published.id,
      permalink: published.permalink,
      published_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    await setWithTtl(POSTED_KEY, result, 30 * 24 * 3600);
    await markPosted(item, {
      post_id: published.id,
      permalink: published.permalink,
      published_at: result.published_at,
    });
    await sendTelegram(
      `<b>✅ Первый тестовый пост Zumer опубликован</b>\n<a href="${published.permalink}">Открыть в Threads</a>\nФайл: <code>${ALLOWED_FILE.split('/').pop()}</code>`,
      { disablePreview: true }
    ).catch(() => {});
    return NextResponse.json({ status: 'posted', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendTelegram(`<b>⚠️ Ошибка первой публикации Zumer</b>\n<pre>${message.slice(0, 500)}</pre>`).catch(() => {});
    return NextResponse.json({ status: 'error', message: message.slice(0, 500) }, { status: 500 });
  } finally {
    await releaseLock(LOCK_KEY).catch(() => {});
  }
}

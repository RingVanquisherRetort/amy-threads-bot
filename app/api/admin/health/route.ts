import { NextResponse } from 'next/server';
import { getThreadsAccountHealth } from '@/lib/zernio';
import { listQueue } from '@/lib/queue';
import { get } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const env = {
    zernioApiKey: Boolean(process.env.ZERNIO_API_KEY),
    zernioAccountId: Boolean(process.env.ZERNIO_ACCOUNT_ID),
    githubToken: Boolean(process.env.GITHUB_TOKEN),
    githubRepoOwner: Boolean(process.env.GITHUB_REPO_OWNER),
    githubRepoName: Boolean(process.env.GITHUB_REPO_NAME),
    redisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    redisToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    apifyToken: Boolean(process.env.APIFY_API_TOKEN),
  };

  const checks: Record<string, unknown> = {};

  const tasks = await Promise.allSettled([
    getThreadsAccountHealth(),
    listQueue(),
    get('amy:healthcheck'),
  ]);

  const [zernio, queue, redis] = tasks;

  checks.zernio = zernio.status === 'fulfilled'
    ? {
        ok: true,
        account: {
          platform: zernio.value.platform,
          username: zernio.value.username,
          status: zernio.value.status,
          tokenStatus: zernio.value.tokenStatus,
          permissions: zernio.value.permissions,
          issues: zernio.value.issues ?? [],
          recommendations: zernio.value.recommendations ?? [],
        },
      }
    : { ok: false, error: zernio.reason instanceof Error ? zernio.reason.message : String(zernio.reason) };

  checks.githubQueue = queue.status === 'fulfilled'
    ? {
        ok: true,
        files: queue.value.length,
        drafts: queue.value.filter(x => ['','draft'].includes(String(x.frontmatter.status ?? '').toLowerCase())).length,
        posted: queue.value.filter(x => String(x.frontmatter.status ?? '').toLowerCase() === 'posted').length,
        items: queue.value.map(x => ({ path: x.path, status: String(x.frontmatter.status ?? 'draft'), posts: x.posts.length })),
      }
    : { ok: false, error: queue.reason instanceof Error ? queue.reason.message : String(queue.reason) };

  checks.redis = redis.status === 'fulfilled'
    ? { ok: true, read: true }
    : { ok: false, error: redis.reason instanceof Error ? redis.reason.message : String(redis.reason) };

  const allRequiredEnv = env.zernioApiKey && env.zernioAccountId && env.githubToken &&
    env.githubRepoOwner && env.githubRepoName && env.redisUrl && env.redisToken;

  return NextResponse.json({
    status: allRequiredEnv && zernio.status === 'fulfilled' && queue.status === 'fulfilled' && redis.status === 'fulfilled'
      ? 'ok' : 'degraded',
    environment: env,
    checks,
    publishingPerformed: false,
  });
}

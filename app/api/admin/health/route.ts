import { NextResponse } from 'next/server';
import { cmdRaw } from '@/lib/redis';
import { listDir } from '@/lib/github';
import { getThreadsAccountHealth } from '@/lib/zernio';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const configured = {
    cronSecret: Boolean(process.env.CRON_SECRET),
    githubToken: Boolean(process.env.GITHUB_TOKEN),
    githubRepo: Boolean(process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME),
    githubBranch: Boolean(process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF),
    redisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    redisToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    openRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    zernioKey: Boolean(process.env.ZERNIO_API_KEY),
    zernioAccountId: Boolean(process.env.ZERNIO_ACCOUNT_ID),
    telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
  };

  const [redis, github, zernio] = await Promise.allSettled([
    cmdRaw(['PING']),
    listDir('queue'),
    getThreadsAccountHealth(),
  ]);

  const checks: Record<string, unknown> = {};
  checks.redis = redis.status === 'fulfilled'
    ? { ok: redis.value === 'PONG' }
    : { ok: false, error: String(redis.reason).slice(0, 240) };
  checks.githubQueueRead = github.status === 'fulfilled'
    ? { ok: true, queueFiles: github.value.filter((item) => item.type === 'file' && item.path.endsWith('.md')).length }
    : { ok: false, error: String(github.reason).slice(0, 240) };
  checks.zernio = zernio.status === 'fulfilled'
    ? {
        ok: true,
        platform: zernio.value.platform,
        status: zernio.value.status,
        username: zernio.value.username,
        tokenValid: zernio.value.tokenStatus?.valid,
        canPost: zernio.value.permissions?.canPost,
        canFetchAnalytics: zernio.value.permissions?.canFetchAnalytics,
        missingRequired: zernio.value.permissions?.missingRequired ?? [],
        issues: zernio.value.issues ?? [],
      }
    : { ok: false, error: String(zernio.reason).slice(0, 240) };

  const branch = process.env.GITHUB_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? null;
  const ready = Object.values(configured).every(Boolean) &&
    (checks.redis as {ok:boolean}).ok &&
    (checks.githubQueueRead as {ok:boolean}).ok &&
    (checks.zernio as {ok:boolean}).ok;

  return NextResponse.json({
    status: ready ? 'integrations_ready' : 'needs_configuration_or_repair',
    environment: process.env.VERCEL_ENV ?? 'unknown',
    branch,
    configured,
    checks,
    notes: [
      'This endpoint never returns secret values.',
      'A successful health check does not enable publishing.',
      'Replies remain manual-approval only.',
    ],
  });
}

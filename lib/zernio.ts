// Zernio API client for Threads. This module performs requests only when called.
// Publishing remains protected by the cron safety locks until migration is approved.

const API_BASE = 'https://zernio.com/api/v1';

function credentials() {
  const apiKey = process.env.ZERNIO_API_KEY;
  const accountId = process.env.ZERNIO_ACCOUNT_ID;
  if (!apiKey) throw new Error('ZERNIO_API_KEY не задан');
  if (!accountId) throw new Error('ZERNIO_ACCOUNT_ID не задан');
  return { apiKey, accountId };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = credentials();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    throw new Error(`Zernio ${init.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(data).slice(0, 1200)}`);
  }
  return data as T;
}


export async function getThreadsAccountHealth() {
  const { accountId } = credentials();
  return request<{
    accountId: string;
    platform: string;
    username?: string;
    status: string;
    tokenStatus?: { valid?: boolean; expiresAt?: string; expiresIn?: string };
    permissions?: { canPost?: boolean; canFetchAnalytics?: boolean; missingRequired?: string[] };
    issues?: string[];
    recommendations?: string[];
  }>(`/accounts/${encodeURIComponent(accountId)}/health`);
}

export interface ZernioPostResult {
  post: {
    _id: string;
    status: string;
    platforms?: Array<{
      platform: string;
      status: string;
      platformPostId?: string;
      platformPostUrl?: string | null;
      errorMessage?: string;
    }>;
  };
}

export interface ZernioComment {
  id: string;
  message?: string;
  createdTime?: string;
  from?: { id?: string; name?: string; username?: string; isOwner?: boolean };
  url?: string;
  parentId?: string;
  replies?: ZernioComment[];
}

export async function createThreadsPost(content: string, mediaItems: Array<{ type: 'image' | 'video'; url: string }> = [], threadItems?: Array<{ content: string; mediaItems?: Array<{ type: 'image' | 'video'; url: string }> }>) {
  const { accountId } = credentials();
  if (content.length > 500) throw new Error('Threads: текст превышает лимит 500 символов');
  const result = await request<ZernioPostResult>('/posts', {
    method: 'POST',
    body: JSON.stringify({
      content,
      ...(mediaItems.length ? { mediaItems } : {}),
      platforms: [{
        platform: 'threads',
        accountId,
        ...(threadItems ? { platformSpecificData: { threadItems } } : {}),
      }],
      publishNow: true,
    }),
  });
  const target = result.post?.platforms?.find((p) => p.platform === 'threads');
  if (!result.post?._id || result.post.status === 'failed' || target?.status === 'failed') {
    throw new Error(target?.errorMessage || 'Zernio не подтвердил публикацию Threads');
  }
  return { id: target?.platformPostId || result.post._id, zernioId: result.post._id, permalink: target?.platformPostUrl ?? '', timestamp: new Date().toISOString() };
}

export async function createThreadsComment(postId: string, text: string, commentId?: string): Promise<{ id: string; permalink: string }> {
  const { accountId } = credentials();
  if (text.length > 500) throw new Error('Threads: ответ превышает лимит 500 символов');
  const result = await request<{ id?: string; url?: string; comment?: ZernioComment }>(
    `/inbox/comments/${encodeURIComponent(postId)}`,
    { method: 'POST', headers: { 'Idempotency-Key': `zumer-${postId}-${commentId ?? 'top'}-${encodeURIComponent(text).slice(0, 80)}` }, body: JSON.stringify({ accountId, message: text, ...(commentId ? { commentId } : {}) }) },
  );
  const comment = result.comment;
  return { id: result.id ?? comment?.id ?? '', permalink: result.url ?? comment?.url ?? '' };
}

export async function getThreadsPostComments(postId: string, limit = 50) {
  const { accountId } = credentials();
  const query = new URLSearchParams({ accountId, limit: String(Math.min(100, Math.max(1, limit))) });
  const result = await request<{ comments?: ZernioComment[] }>(
    `/inbox/comments/${encodeURIComponent(postId)}?${query.toString()}`,
  );
  return (result.comments ?? []).filter((comment) => !comment.parentId);
}

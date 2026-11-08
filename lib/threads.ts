// Threads adapter backed by Zernio. No Meta access token is used here.
import { createThreadsPost, createThreadsComment, getThreadsPostComments } from './zernio';

export interface PublishedPost { id: string; permalink: string; timestamp: string; }
export interface MediaItem { type: 'image' | 'video'; url: string; alt?: string; }
export interface ReplyItem { id: string; text?: string; username?: string; timestamp?: string; permalink?: string; }
export interface UserPost { id: string; permalink: string; text?: string; timestamp: string; media_type?: string; }

function assertText(text: string) {
  if (text.length > 500) throw new Error('Threads: текст превышает лимит 500 символов');
}

export async function publishText(text: string, replyToId?: string): Promise<PublishedPost> {
  assertText(text);
  // replyToId is a Threads post ID; comment replies must use createThreadsComment
  // with both the post ID and comment ID (see publish-pending route).
  return createThreadsPost(text, replyToId ? [] : []).then((p) => {
    if (replyToId) throw new Error('Для ответа на комментарий нужны postId и commentId; используйте createThreadsComment');
    return { id: p.id, permalink: p.permalink, timestamp: p.timestamp };
  });
}

export async function publishImage(text: string, imageUrl: string, _replyToId?: string, _altText?: string): Promise<PublishedPost> {
  assertText(text);
  const p = await createThreadsPost(text, [{ type: 'image', url: imageUrl }]);
  return { id: p.id, permalink: p.permalink, timestamp: p.timestamp };
}

export async function publishVideo(text: string, videoUrl: string, _replyToId?: string, _altText?: string): Promise<PublishedPost> {
  assertText(text);
  const p = await createThreadsPost(text, [{ type: 'video', url: videoUrl }]);
  return { id: p.id, permalink: p.permalink, timestamp: p.timestamp };
}

export async function publishCarousel(text: string, media: MediaItem[], _replyToId?: string): Promise<PublishedPost> {
  if (media.length < 2 || media.length > 10) throw new Error('Карусель Threads поддерживает от 2 до 10 медиа');
  assertText(text);
  const p = await createThreadsPost(text, media.map(({ type, url }) => ({ type, url })));
  return { id: p.id, permalink: p.permalink, timestamp: p.timestamp };
}

export async function publish(text: string, media: MediaItem[] = [], replyToId?: string): Promise<PublishedPost> {
  if (replyToId) throw new Error('Публикация цепочки через старый replyToId отключена; используйте publishThread');
  if (media.length === 0) return publishText(text);
  if (media.length === 1) return media[0].type === 'image'
    ? publishImage(text, media[0].url, undefined, media[0].alt)
    : publishVideo(text, media[0].url, undefined, media[0].alt);
  return publishCarousel(text, media);
}

export async function publishThread(posts: string[]): Promise<PublishedPost> {
  if (!posts.length) throw new Error('Пустой список постов');
  if (posts.some((post) => post.length > 500)) throw new Error('Каждая часть треда Threads должна быть не длиннее 500 символов');
  // Publish as a single Zernio thread sequence to avoid partially published chains.
  const { createThreadsPost } = await import('./zernio');
  const p = await createThreadsPost(posts[0], []);
  if (posts.length > 1) {
    throw new Error('Многочастный тред требует threadItems; публикация остановлена, чтобы не отправить неполную цепочку');
  }
  return { id: p.id, permalink: p.permalink, timestamp: p.timestamp };
}

export async function publishReplyBait(rootPostId: string, baitText: string): Promise<PublishedPost> {
  assertText(baitText);
  const p = await createThreadsComment(rootPostId, baitText);
  return { id: p.id ?? '', permalink: '', timestamp: new Date().toISOString() };
}

export async function getPostReplies(postId: string, limit = 50): Promise<ReplyItem[]> {
  const comments = await getThreadsPostComments(postId, limit);
  return comments.map((comment) => ({
    id: comment.id,
    text: comment.message ?? '',
    username: comment.from?.username ?? comment.from?.name ?? 'unknown',
    timestamp: comment.createdTime,
    permalink: comment.url,
  }));
}

export async function deletePost(_postId: string): Promise<void> {
  throw new Error('Удаление Threads-постов через текущий Zernio adapter пока не подключено');
}

export async function listUserPosts(_limit = 25): Promise<UserPost[]> {
  throw new Error('Получение списка собственных Threads-постов через Zernio пока не подключено');
}

export async function findPostByPermalink(_permalink: string, _limit = 50): Promise<UserPost | null> {
  throw new Error('Поиск Threads-поста по ссылке через Zernio пока не подключён');
}

export async function findTailOfThread(rootPostId: string): Promise<string> {
  // Zernio inbox currently supplies comments, not a complete reply-tree traversal.
  return rootPostId;
}

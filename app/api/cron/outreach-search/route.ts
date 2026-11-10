import { NextResponse } from 'next/server';
import { searchThreadsPosts } from '@/lib/apify-threads';
import { generateOutreachReply } from '@/lib/outreach-generator';
import { sendTelegram } from '@/lib/telegram';
import { isThreadSeen, markThreadSeen, genOutreachJobId, saveOutreachJob, saveOutreachItem, type OutreachJob, type OutreachItem } from '@/lib/outreach';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// Only propose replies when the author explicitly mentions a supported city.
// This intentionally favors precision over recall: we cannot infer location
// reliably from a Threads profile or a generic Russian-language post.
const TARGET_CITY_PATTERNS = [
  /\\bкалининград(?:е|а|у|ом|ский|ская|ские)?\\b/i,
  /\\bекатеринбург(?:е|а|у|ом|ский|ская|ские)?\\b/i,
  /\\bуф(?:а|е|ы|у|ой|е)?\\b/i,
  /\\bставропол(?:ь|е|я|ю|ем|ьский|ьская)?\\b/i,
  /\\bнальчик(?:е|а|у|ом)?\\b/i,
  /\\bпятигорск(?:е|а|у|ом)?\\b/i,
];
const JOB_INTENT = /(?:ищу|ищем|нужна|нужен|нужно|подскажите|посоветуйте|где найти|кто знает|есть ли|хочу найти|ищет|ищут|интересует|рассмотрю|рассматриваю|требуется|нуждаюсь)[\\s\\S]{0,90}(?:работ[аыуе]|подработк[аыуе]|ваканси[яию]|заработок|курьер)|(?:работ[аыуе]|подработк[аыуе]|ваканси[яию]|курьер)[\\s\\S]{0,90}(?:ищу|ищем|нужна|нужен|подскажите|посоветуйте|где найти|хочу|интересует|рассмотрю)/i;
const EXCLUDED_INTENT = /(?:ищем сотрудников|ищем курьеров|требуется сотрудник|требуются сотрудники|набираем сотрудников|приглашаем на работу|вакансия открыта|удал[её]нн(?:ая|ую|ой) работ|онлайн.работ)/i;

function isRelevantCandidate(text: string): boolean {
  return TARGET_CITY_PATTERNS.some((pattern) => pattern.test(text)) &&
    JOB_INTENT.test(text) && !EXCLUDED_INTENT.test(text);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const job: OutreachJob = {
    id: genOutreachJobId(),
    topic: 'scheduled: последние 3 дня',
    status: 'processing',
    items_found: 0,
    items_approved: 0,
    items_published: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await saveOutreachJob(job);

  try {
    const posts = await searchThreadsPosts(null);
    const cutoff = Date.now() - MAX_AGE_MS;
    const own = (process.env.THREADS_USERNAME ?? '').toLowerCase().replace(/^@/, '');
    const freshPosts = posts
      .filter((post) => {
        const created = post.createdAt ? Date.parse(post.createdAt) : NaN;
        const author = (post.author?.username ?? '').toLowerCase().replace(/^@/, '');
        return !!post.id && !!post.url && !!post.text &&
          Number.isFinite(created) && created >= cutoff &&
          (!author || author !== own);
      })
      .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''));
    const relevant = freshPosts.filter((post) => isRelevantCandidate(post.text ?? ''));
    const fresh = relevant.slice(0, 6);

    let drafted = 0;
    let rejected = 0;
    let duplicates = 0;
    const notes: string[] = [];

    for (const post of fresh) {
      if (await isThreadSeen(String(post.id))) { duplicates++; continue; }
      const author = post.author?.username ?? 'unknown';
      const draft = await generateOutreachReply(post.text ?? '', author);
      if (draft.recommendation !== 'reply' || !draft.comment) {
        await markThreadSeen(String(post.id));
        rejected++;
        if (notes.length < 3) notes.push(`@${author}: ${draft.rationale || 'не подходит'}`);
        continue;
      }

      const item: OutreachItem = {
        id: `oi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        job_id: job.id,
        thread_id: String(post.id),
        thread_url: String(post.url),
        thread_author: author,
        thread_text: String(post.text).slice(0, 1800),
        thread_text_ru: String(post.text).slice(0, 1800),
        search_query: post.searchQuery ?? post.sourceInput ?? 'scheduled',
        tone: 'normal',
        comment_en: draft.comment,
        comment_ru: draft.comment,
        rationale: draft.rationale,
        status: 'awaiting_approval',
        corrections_ru: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveOutreachItem(item);
      await markThreadSeen(String(post.id));

      const original = item.thread_text.length > 550 ? item.thread_text.slice(0, 550) + '…' : item.thread_text;
      await sendTelegram(
        `<b>🧵 Amy нашла свежую ветку Threads</b>\n` +
        `Автор: <b>@${escapeHtml(author)}</b>\n` +
        `Дата: ${escapeHtml(post.createdAt ?? '')}\n` +
        `Активность: ♥ ${post.likeCount ?? 0} · ответы ${post.replyCount ?? 0}\n` +
        `<a href="${escapeHtml(item.thread_url)}">Открыть ветку</a>\n\n` +
        `<b>Публикация:</b>\n<blockquote>${escapeHtml(original)}</blockquote>\n\n` +
        `<b>Черновик ответа:</b>\n<blockquote>${escapeHtml(item.comment_ru)}</blockquote>\n` +
        `<i>${escapeHtml(item.rationale)}</i>\n\n⚠️ Не опубликовано. Ждёт твоего решения.`,
        { disablePreview: true, inlineKeyboard: [[
          { text: 'Открыть и ответить вручную', url: item.thread_url },
        ]] }
      );
      drafted++;
      if (drafted >= 4) break;
    }

    job.status = 'done';
    job.items_found = drafted;
    await saveOutreachJob(job);
    await sendTelegram(
      `<b>Ежедневный мониторинг Threads завершён</b>\n` +
      `Окно поиска: последние 3 дня\n` +
      `Получено от Apify: ${posts.length}\n` +
      `Свежих публикаций: ${freshPosts.length}; подходят по городу и запросу: ${relevant.length}\n` +
      `Черновиков: ${drafted}; отклонено AI: ${rejected}; дублей: ${duplicates}\n` +
      (notes.length ? `Причины пропуска: ${notes.map(escapeHtml).join('; ')}\n` : '') +
      (drafted ? 'Черновики отправлены выше. Публикация только вручную.' : 'Новых подходящих веток за этот запуск не найдено.')
    );
    return NextResponse.json({ ok: true, fetched: posts.length, fresh: freshPosts.length, relevant: relevant.length, shortlisted: fresh.length, drafted, rejected, duplicates });
  } catch (error) {
    job.status = 'failed';
    job.error = String(error).slice(0, 500);
    await saveOutreachJob(job);
    console.error('[outreach-search cron]', error);
    await sendTelegram(`<b>Ошибка мониторинга Threads</b>\n<pre>${escapeHtml(String(error).slice(0, 500))}</pre>`);
    return NextResponse.json({ error: 'outreach search failed' }, { status: 500 });
  }
}

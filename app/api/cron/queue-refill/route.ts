// Cron — поддерживает запас постов и по безопасному флагу кладёт генерации в очередь автоматически.
import { NextResponse } from 'next/server';
import { listQueue } from '@/lib/queue';
import { generatePost } from '@/lib/post-generator';
import { genDraftId, saveDraft, listPendingDrafts, PostDraft } from '@/lib/post-draft';
import { formatDraft } from '@/lib/format';
import { sendTelegram } from '@/lib/telegram';
import { putFile } from '@/lib/github';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const QUEUE_MIN = 5;
const GENERATE_BATCH = 2;

function verifyAuth(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return auth === `Bearer ${secret}`;
}

function normalizePost(text: string): string {
  return text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function buildQueueFilename(suggested: string, existingPaths: Set<string>, index: number): string {
  if (!existingPaths.has(`queue/${suggested}`)) return suggested;
  const suffix = `${Date.now().toString(36)}-${index + 1}`;
  return suggested.toLowerCase().endsWith('.md')
    ? `${suggested.slice(0, -3)}-${suffix}.md`
    : `${suggested}-${suffix}.md`;
}

function validateGeneratedText(text: string, existingPosts: Set<string>): string | null {
  const normalized = normalizePost(text);
  if (!normalized) return 'пустой текст';
  if (text.length > 500) return `длина ${text.length} символов, лимит Threads — 500`;
  if (/[—–]/.test(text)) return 'обнаружено длинное тире';
  if (existingPosts.has(normalized)) return 'точный дубль уже есть в очереди или архиве';
  return null;
}

export async function GET(req: Request) {
  if (!verifyAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const items = await listQueue();
  const drafts = items.filter((i) => {
    const status = String(i.frontmatter.status ?? '').toLowerCase();
    return status === '' || status === 'draft';
  });
  const pending = await listPendingDrafts();
  const totalUpcoming = drafts.length + pending.length;

  if (totalUpcoming >= QUEUE_MIN) {
    return NextResponse.json({
      status: 'ok',
      message: `В очереди ${drafts.length} драфтов + ${pending.length} ждут одобрения. Норм.`,
    });
  }

  const autoQueue = process.env.AUTO_QUEUE_GENERATED_DRAFTS === '1';
  const need = Math.min(GENERATE_BATCH, QUEUE_MIN - totalUpcoming);
  const generated: string[] = [];
  const rejected: string[] = [];
  const errors: string[] = [];
  const existingPaths = new Set(items.map((item) => item.path));
  const existingPosts = new Set(items.flatMap((item) => item.posts.map(normalizePost)).filter(Boolean));

  for (let i = 0; i < need; i++) {
    try {
      const gen = await generatePost();
      const rejection = validateGeneratedText(gen.text_en, existingPosts);
      if (rejection) {
        rejected.push(`${gen.goal}: ${rejection}`);
        continue;
      }

      if (autoQueue) {
        const filename = buildQueueFilename(gen.suggested_filename, existingPaths, i);
        const today = new Date().toISOString().slice(0, 10);
        const frontmatter = [
          '---',
          `created: ${today}`,
          `goal: ${gen.goal}`,
          ...(gen.castdev_module ? [`castdev_module: ${JSON.stringify(gen.castdev_module)}`] : []),
          'pillar: amy_generated',
          'status: draft',
          `notes: ${JSON.stringify((gen.rationale ?? '').slice(0, 180))}`,
          '---',
        ].join('\n');
        await putFile(`queue/${filename}`, `${frontmatter}\n\n## Пост 1\n\n${gen.text_en}\n`, `amy auto-queued: ${filename}`);
        existingPaths.add(`queue/${filename}`);
        existingPosts.add(normalizePost(gen.text_en));
        generated.push(`${gen.goal}: ${filename}`);
        await sendTelegram(
          `<b>🤖 Amy подготовила пост и добавила его в очередь</b>\\n` +
          `Файл: <code>${filename}</code>\\n` +
          `Рубрика: ${gen.goal}\\n\\n` +
          `<blockquote>${gen.text_en.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</blockquote>`,
          { disablePreview: true }
        );
      } else {
        const draft: PostDraft = {
          id: genDraftId(),
          goal: gen.goal,
          castdev_module: gen.castdev_module,
          text_en: gen.text_en,
          suggested_filename: gen.suggested_filename,
          rationale: gen.rationale,
          sources: gen.sources,
          corrections_ru: [],
          status: 'awaiting_approval',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await saveDraft(draft);
        const { text, keyboard } = formatDraft(draft);
        const sent = await sendTelegram(text, { disablePreview: true, inlineKeyboard: keyboard });
        draft.telegram_message_id = sent.message_id;
        await saveDraft(draft);
        generated.push(`${gen.goal}: ${gen.suggested_filename}`);
      }
    } catch (e: any) {
      errors.push(String(e).slice(0, 200));
    }
  }

  if (rejected.length > 0) {
    await sendTelegram(`<b>⚠️ Amy не добавила посты в очередь:</b>\\n<pre>${rejected.join('\\n')}</pre>`);
  }
  if (errors.length > 0) {
    await sendTelegram(`<b>⚠️ Ошибки при генерации:</b>\\n<pre>${errors.join('\\n')}</pre>`);
  }

  return NextResponse.json({
    status: autoQueue ? 'auto_queued' : 'generated',
    queue_drafts: drafts.length,
    pending_approval: pending.length,
    auto_queue_enabled: autoQueue,
    generated,
    rejected,
    errors,
  });
}

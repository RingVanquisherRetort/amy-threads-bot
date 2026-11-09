// Периодически публикует диалоги со status=scheduled_publish, у которых publish_at в прошлом.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyAuth(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Replies must remain manually sent by the owner. This cron is permanently
  // fail-closed; an environment flag must never turn reply auto-send on.
  return NextResponse.json({ status: 'paused', reason: 'Replies require manual sending' });

  const due = await listDuePublish();
  if (due.length === 0) return NextResponse.json({ published: 0 });

  let published = 0;
  const errors: string[] = [];

  for (const dialog of due) {
    try {
      const english = await translateToEnglish(dialog.draft_ru, {
        postText: dialog.post_text,
        replyText: dialog.reply_text_en,
        replyUsername: dialog.reply_username,
      });

      const postedReply = await createThreadsComment(dialog.post_id, english, dialog.root_reply_id);

      dialog.status = 'done';
      dialog.reply_text_en_final = english;
      await saveDialog(dialog);

      if (dialog.telegram_message_id) {
        const { text } = formatDialog(dialog);
        await editMessageText(
          dialog.telegram_message_id,
          text + `\n<a href="${postedReply.permalink}">открыть ответ в Threads</a>`,
          { inlineKeyboard: [] }
        );
      }
      published++;
    } catch (e: any) {
      console.error(`publish ${dialog.id} failed:`, e);
      errors.push(`${dialog.id}: ${String(e).slice(0, 200)}`);
    }
  }

  return NextResponse.json({ published, errors });
}

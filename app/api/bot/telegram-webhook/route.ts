// Webhook для Telegram-бота.
// Обрабатывает:
//   - Команды: /preview, /edit, /help, /generate
//   - Кнопки на диалогах с комментами (approve/edit/skip/cancel)
//   - Кнопки на правках поста (pe_publish / pe_more / pe_cancel)
//   - Текстовые сообщения: правка драфта коммента ИЛИ правка поста
import { NextResponse } from 'next/server';
import { handleAt } from '@/lib/brand-config';
import { answerCallbackQuery, editMessageText, sendTelegram, setWebhook } from '@/lib/telegram';
import { formatDialog, formatDraft, formatPostEdit, formatPreview } from '@/lib/format';
import {
  getDialog,
  saveDialog,
  getAwaitingCorrectionId,
  setAwaitingCorrectionId,
} from '@/lib/dialog';
import {
  getPostEdit,
  savePostEdit,
  genPostEditId,
  getAwaitingPostEditId,
  setAwaitingPostEditId,
  PostEdit,
} from '@/lib/post-edit';
import {
  getDraft,
  saveDraft,
  deleteDraft,
  getAwaitingDraftId,
  setAwaitingDraftId,
  PostDraft,
} from '@/lib/post-draft';
import { editPublishedPost, reviseDraft, reviseDraftPost } from '@/lib/openrouter';
import {
  collectWeeklyMetrics,
  analyzeArchive,
  appendConfirmedFindings,
  writeWeakSignals,
  CONFIRMED_THRESHOLD,
} from '@/lib/weekly-analysis';
import { listQueue } from '@/lib/queue';
import { deletePost, publishText } from '@/lib/threads';
import { generatePost } from '@/lib/post-generator';
import { generateOutreachReply } from '@/lib/outreach-generator';
import { searchThreadsPosts } from '@/lib/apify-threads';
import { putFile, getFile } from '@/lib/github';
import { downloadTelegramPhotoToRepo } from '@/lib/photo-upload';
import {
  PhotoPending,
  genPhotoPendingId,
  getPhotoPending,
  savePhotoPending,
  deletePhotoPending,
} from '@/lib/photo-pending';
import { publishImage } from '@/lib/threads';
import {
  getOutreachItem,
  saveOutreachItem,
  getAwaitingOutreachId,
  setAwaitingOutreachId,
  markThreadSeen,
  isThreadSeen,
  genOutreachJobId,
  saveOutreachJob,
  type OutreachJob,
  type OutreachItem,
} from '@/lib/outreach';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PUBLISH_DELAY_MIN = 5;

// Единый предохранитель для всех ручных кнопок публикации.
function isThreadsPublishingEnabled(): boolean {
  return process.env.ZERNIO_MIGRATION_COMPLETE === '1' && process.env.THREADS_AUTOPOST_PAUSED !== '1';
}

function verifyWebhookSecret(req: Request): boolean {
  const sent = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return sent === expected;
}

interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number };
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: TgPhotoSize[];
    document?: { file_id: string; mime_type?: string; file_name?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

// GET-ручка для ОДНОРАЗОВОЙ настройки webhook.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('setup') !== '1') {
    return NextResponse.json({
      ok: true,
      hint: 'Webhook endpoint is online. Setup requires the configured secret.',
    });
  }

  return new Response(`<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Подключение Telegram</title>
<body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 20px">
<h2>Подключить Telegram webhook</h2>
<p>Введи значение TELEGRAM_WEBHOOK_SECRET, сохранённое в Vercel. Оно отправится защищённым POST-запросом и не попадёт в адресную строку.</p>
<form method="post" action="/api/bot/telegram-webhook/setup">
<input type="password" name="secret" autocomplete="off" required style="box-sizing:border-box;width:100%;padding:14px;font-size:16px">
<button style="margin-top:16px;padding:14px 20px;font-size:16px">Подключить Telegram</button>
</form></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[telegram-webhook] rejected: secret mismatch or missing');
    return NextResponse.json({ error: 'bad secret' }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    console.warn('[telegram-webhook] rejected: invalid JSON');
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const allowedChat = String(process.env.TELEGRAM_CHAT_ID ?? '');
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? 0;
  const updateKind = update.callback_query ? 'callback_query' : update.message?.photo ? 'photo' : update.message?.text ? 'text' : 'other';
  console.info('[telegram-webhook] update received', {
    updateId: update.update_id,
    kind: updateKind,
    chatConfigured: Boolean(allowedChat),
    chatMatches: String(chatId) === allowedChat,
  });

  if (String(chatId) !== allowedChat) {
    console.warn('[telegram-webhook] ignored: chat id mismatch', {
      updateId: update.update_id,
      chatConfigured: Boolean(allowedChat),
      receivedChatId: String(chatId),
      configuredChatId: allowedChat || '(empty)',
    });
    return NextResponse.json({ ok: true, ignored: 'chat not allowed' });
  }

  const handle = async () => {
    try {
      if (update.callback_query) await handleCallback(update.callback_query);
      else if (update.message?.photo || update.message?.document) await handlePhoto(update.message);
      else if (update.message?.text) await handleMessage(update.message);
    } catch (e: any) {
      console.error('webhook handler error:', e);
      try {
        await sendTelegram(`<b>⚠️ Ошибка webhook'а:</b>\\n<pre>${String(e).slice(0, 600)}</pre>`);
      } catch {}
    }
  };

  const wu = (globalThis as any)?.[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil;
  if (typeof wu === 'function') {
    wu(handle());
  } else {
    void handle();
  }

  return NextResponse.json({ ok: true });
}

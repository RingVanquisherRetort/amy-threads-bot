import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { listQueue } from '@/lib/queue';
import { generatePost, evaluateGeneratedPost } from '@/lib/post-generator';
import { putFile } from '@/lib/github';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
}

function yaml(value: string): string {
  return JSON.stringify(value);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Generation is allowed only on the dedicated preview branch. This route never publishes.
  const branch = process.env.GITHUB_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? '';
  if (process.env.VERCEL_ENV === 'production' ||
      process.env.AMY2_GENERATION_ENABLED !== '1' ||
      branch !== 'amy-2.0-foundation') {
    return NextResponse.json({ status: 'paused', reason: 'Amy 2.0 generation is restricted to an explicitly enabled preview deployment' }, { status: 409 });
  }

  try {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const queue = await listQueue();
    const todays = queue.filter((item) =>
      item.frontmatter.amy2_editorial_decision === 'publish_eligible' &&
      String(item.frontmatter.created ?? '').startsWith(day)
    );
    if (todays.length >= 4) {
      return NextResponse.json({ status: 'daily_limit', count: todays.length });
    }

    const generated = await generatePost();
    const evaluation = await evaluateGeneratedPost(generated);

    if (evaluation.decision !== 'publish_eligible' || evaluation.total < 60 ||
        evaluation.score.factualAccuracy < 3) {
      return NextResponse.json({
        status: 'not_eligible',
        decision: evaluation.decision,
        score: evaluation.total,
        factualAccuracy: evaluation.score.factualAccuracy,
        rationale: evaluation.rationale,
      });
    }

    const normalized = generated.text_en.toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim();
    const fingerprint = createHash('sha256').update(normalized).digest('hex');
    const duplicate = queue.some((item) =>
      item.frontmatter.amy2_fingerprint === fingerprint ||
      (item.frontmatter.status === 'posted' &&
        (item.posts[0] ?? '').toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim() === normalized)
    );
    if (duplicate) return NextResponse.json({ status: 'duplicate_rejected' }, { status: 409 });

    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `${day}-amy2-${stamp}.md`;
    const path = `queue/${filename}`;
    const sourceUrls = generated.sources
      .filter((source) => evaluation.usedSourceIds.includes(source.id))
      .map((source) => source.url);

    const frontmatter = [
      '---',
      `created: ${day}`,
      `goal: ${generated.goal}`,
      'pillar: amy2_generated',
      'status: draft',
      'amy2_publish_eligible: true',
      'amy2_editorial_decision: publish_eligible',
      `amy2_editorial_score: ${evaluation.total}`,
      `amy2_factual_accuracy: ${evaluation.score.factualAccuracy}`,
      `amy2_fingerprint: ${fingerprint}`,
      `amy2_editorial_rationale: ${yaml(evaluation.rationale)}`,
      `amy2_evaluated_at: ${yaml(now.toISOString())}`,
      `amy2_source_urls: ${yaml(JSON.stringify(sourceUrls))}`,
      '---',
    ].join('\n');
    const body = `\n\n## Пост 1\n\n${generated.text_en}\n`;
    await putFile(path, frontmatter + body, `amy2: editorially approved ${filename}`);

    return NextResponse.json({
      status: 'queued',
      file: path,
      score: evaluation.total,
      factualAccuracy: evaluation.score.factualAccuracy,
      rationale: evaluation.rationale,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Amy 2.0 generation failed:', message);
    return NextResponse.json({ status: 'error', message: message.slice(0, 500) }, { status: 500 });
  }
}

// Performance Memory: snapshots and weekly learning summaries for Amy 2.0.
import { get, cmdRaw } from './redis';
import { saveExpiringMemory, withMemoryExpiry, isMemoryExpired } from './amy-retention';
import { listContentMemory } from './amy-content-memory';
import type { ContentMemoryRecord, LearningInsight, PostMetricsSnapshot } from './amy-memory-types';

type SnapshotInput = Omit<PostMetricsSnapshot, 'createdAt' | 'updatedAt' | 'expiresAt' | 'schemaVersion'>;
const SNAPSHOT_PREFIX = 'amy2:performance:';
const SNAPSHOT_INDEX = 'amy2:index:performance';
const INSIGHT_PREFIX = 'amy2:learning:';
const INSIGHT_INDEX = 'amy2:index:learning';

async function indexRecord(index: string, key: string, expiresAt: string): Promise<void> {
  const score = Date.parse(expiresAt);
  if (!Number.isFinite(score)) throw new Error('Invalid expiry date');
  await cmdRaw(['ZADD', index, score, key]);
}

async function indexedKeys(index: string, now = Date.now()): Promise<string[]> {
  await cmdRaw(['ZREMRANGEBYSCORE', index, '-inf', now]);
  return (await cmdRaw(['ZRANGEBYSCORE', index, now + 1, '+inf'])) as string[];
}

function assertId(id: string): void {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) throw new Error('Invalid memory id');
}

function assertMetric(value: number | undefined, field: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new RangeError(`${field} must be a non-negative number`);
  }
}

export async function savePerformanceSnapshot(input: SnapshotInput): Promise<PostMetricsSnapshot> {
  assertId(input.id);
  assertId(input.contentId);
  assertMetric(input.ageHours, 'ageHours');
  for (const field of ['views','likes','replies','reposts','quotes','profileVisits','linkClicks'] as const) {
    assertMetric(input[field], field);
  }
  const key = SNAPSHOT_PREFIX + input.id;
  const previous = await get<PostMetricsSnapshot>(key);
  const now = new Date().toISOString();
  const record = withMemoryExpiry({
    ...input,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: 2 as const,
  });
  await saveExpiringMemory(key as `amy2:${string}`, record);
  await indexRecord(SNAPSHOT_INDEX, key, record.expiresAt);
  return record;
}

export async function listPerformanceSnapshots(days = 30, limit = 500): Promise<PostMetricsSnapshot[]> {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const safeLimit = Math.max(1, Math.min(2000, Math.floor(limit)));
  const cutoff = Date.now() - safeDays * 86400000;
  const records: PostMetricsSnapshot[] = [];
  for (const key of await indexedKeys(SNAPSHOT_INDEX)) {
    const record = await get<PostMetricsSnapshot>(key);
    if (record?.kind === 'performance' && !isMemoryExpired(record.expiresAt) &&
        Date.parse(record.capturedAt) >= cutoff) records.push(record);
  }
  return records.sort((a,b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0,safeLimit);
}

export interface LearningGroupResult {
  dimension: 'category' | 'format' | 'city';
  value: string;
  sampleSize: number;
  averageEngagementRate: number;
  averageViews: number;
  evidenceContentIds: string[];
  confidence: number;
}

export interface WeeklyLearningReport {
  generatedAt: string;
  windowDays: number;
  minimumSampleSize: number;
  groups: LearningGroupResult[];
  recommendations: string[];
  limitations: string[];
}

function groupValue(record: ContentMemoryRecord, dimension: LearningGroupResult['dimension']): string | undefined {
  if (dimension === 'category') return record.category;
  if (dimension === 'format') return record.format;
  return record.city;
}

export async function buildWeeklyLearningReport(options: {
  windowDays?: number;
  minimumSampleSize?: number;
} = {}): Promise<WeeklyLearningReport> {
  const windowDays = Math.max(1, Math.min(30, Math.floor(options.windowDays ?? 7)));
  const minimumSampleSize = Math.max(2, Math.min(20, Math.floor(options.minimumSampleSize ?? 3)));
  const cutoff = Date.now() - windowDays * 86400000;
  const [contents, snapshots] = await Promise.all([
    listContentMemory(500),
    listPerformanceSnapshots(windowDays, 2000),
  ]);
  const contentById = new Map(contents.map(item => [item.id, item]));
  const byContent = new Map<string, PostMetricsSnapshot[]>();
  for (const snapshot of snapshots) {
    const list = byContent.get(snapshot.contentId) ?? [];
    list.push(snapshot);
    byContent.set(snapshot.contentId, list);
  }

  // Use the latest available snapshot per post. Missing views remain unknown, not zero.
  const observations: Array<{ content: ContentMemoryRecord; views: number; rate: number }> = [];
  for (const [contentId, items] of byContent) {
    const content = contentById.get(contentId);
    if (!content || Date.parse(content.createdAt) < cutoff) continue;
    const latest = items.sort((a,b) => b.capturedAt.localeCompare(a.capturedAt))[0];
    if (latest.views === undefined) continue;
    const interactions = (latest.likes ?? 0) + (latest.replies ?? 0) +
      (latest.reposts ?? 0) + (latest.quotes ?? 0);
    observations.push({ content, views: latest.views, rate: latest.views > 0 ? interactions / latest.views : 0 });
  }

  const groups: LearningGroupResult[] = [];
  for (const dimension of ['category','format','city'] as const) {
    const buckets = new Map<string, typeof observations>();
    for (const item of observations) {
      const value = groupValue(item.content, dimension);
      if (!value) continue;
      const bucket = buckets.get(value) ?? [];
      bucket.push(item);
      buckets.set(value, bucket);
    }
    for (const [value, bucket] of buckets) {
      if (bucket.length < minimumSampleSize) continue;
      groups.push({
        dimension,
        value,
        sampleSize: bucket.length,
        averageEngagementRate: bucket.reduce((sum,item) => sum + item.rate,0) / bucket.length,
        averageViews: bucket.reduce((sum,item) => sum + item.views,0) / bucket.length,
        evidenceContentIds: bucket.map(item => item.content.id),
        confidence: Math.min(0.95, bucket.length / (bucket.length + 5)),
      });
    }
  }

  const sorted = [...groups].sort((a,b) => b.averageEngagementRate - a.averageEngagementRate);
  const recommendations: string[] = [];
  if (observations.length < minimumSampleSize) {
    recommendations.push('Пока недостаточно публикаций со статистикой просмотров для надёжных выводов. Продолжать собирать данные.');
  } else if (sorted.length) {
    const best = sorted[0];
    recommendations.push(`Проверить дополнительными публикациями направление «${best.value}» (${best.dimension}): средняя вовлечённость ${(best.averageEngagementRate * 100).toFixed(1)}% на ${best.sampleSize} публикациях.`);
    const weakest = sorted[sorted.length - 1];
    if (sorted.length > 1 && weakest.value !== best.value) {
      recommendations.push(`Не сокращать резко направление «${weakest.value}»: сначала проверить гипотезу на новых публикациях, выборка пока ограничена.`);
    }
  }

  const limitations: string[] = [];
  if (!snapshots.length) limitations.push('Статистика ещё не поступала.');
  if (snapshots.some(item => item.views === undefined)) limitations.push('Часть записей не содержит просмотров и исключена из расчёта вовлечённости.');
  limitations.push('Отчёт показывает корреляции, а не доказывает причинность. Для сравнения времени публикации и конверсий нужны отдельные данные.');
  return { generatedAt: new Date().toISOString(), windowDays, minimumSampleSize, groups, recommendations, limitations };
}

export async function saveWeeklyLearningInsights(report: WeeklyLearningReport): Promise<LearningInsight[]> {
  const saved: LearningInsight[] = [];
  const now = new Date();
  for (const group of report.groups) {
    const dimension: LearningInsight['dimension'] = group.dimension === 'category' ? 'topic' : group.dimension === 'format' ? 'format' : 'city';
    const id = `${dimension}_${group.value.toLowerCase().replace(/[^a-z0-9_-]+/g,'_').slice(0,50)}_${report.generatedAt.slice(0,10).replace(/-/g,'')}`;
    assertId(id);
    const key = INSIGHT_PREFIX + id;
    const record = withMemoryExpiry({
      id,
      kind: 'learning' as const,
      dimension,
      statement: `Средняя вовлечённость ${(group.averageEngagementRate * 100).toFixed(1)}% на ${group.sampleSize} публикациях; средние просмотры ${group.averageViews.toFixed(1)}.`,
      sampleSize: group.sampleSize,
      confidence: group.confidence,
      evidenceContentIds: group.evidenceContentIds,
      calculatedAt: report.generatedAt,
      validUntil: new Date(now.getTime() + 7 * 86400000).toISOString(),
      status: 'active' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      schemaVersion: 2 as const,
    });
    await saveExpiringMemory(key as `amy2:${string}`, record);
    await indexRecord(INSIGHT_INDEX, key, record.expiresAt);
    saved.push(record);
  }
  return saved;
}

export async function listLearningInsights(limit = 100): Promise<LearningInsight[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const records: LearningInsight[] = [];
  for (const key of await indexedKeys(INSIGHT_INDEX)) {
    const record = await get<LearningInsight>(key);
    if (record?.kind === 'learning' && !isMemoryExpired(record.expiresAt)) records.push(record);
  }
  return records.sort((a,b) => b.calculatedAt.localeCompare(a.calculatedAt)).slice(0,safeLimit);
}

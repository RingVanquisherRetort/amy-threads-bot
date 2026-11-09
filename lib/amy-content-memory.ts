// CRUD для Content Memory и Trend Memory Amy 2.0.
// Хранилище изолировано в amy2:*; legacy queue/draft/outreach keys не читаются и не меняются.
import { get, keys } from './redis';
import { saveExpiringMemory, withMemoryExpiry, isMemoryExpired } from './amy-retention';
import type { ContentMemoryRecord, TrendMemoryRecord } from './amy-memory-types';

type ContentInput = Omit<ContentMemoryRecord, 'createdAt' | 'updatedAt' | 'expiresAt' | 'schemaVersion'>;
type TrendInput = Omit<TrendMemoryRecord, 'createdAt' | 'updatedAt' | 'expiresAt' | 'schemaVersion'>;

const CONTENT_PREFIX = 'amy2:content:';
const TREND_PREFIX = 'amy2:trend:';

function assertSafeId(id: string): void {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
    throw new Error('Memory id must contain only letters, numbers, underscore or hyphen');
  }
}

function assertScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${field} must be between 0 and 100`);
  }
}

function assertContent(record: ContentInput): void {
  if (!record.text.trim()) throw new Error('Content text cannot be empty');
  if (record.qualityScore !== undefined) assertScore(record.qualityScore, 'qualityScore');
}

function assertTrend(record: TrendInput): void {
  if (!record.topic.trim()) throw new Error('Trend topic cannot be empty');
  assertScore(record.relevanceScore, 'relevanceScore');
  assertScore(record.engagementPotential, 'engagementPotential');
}

export async function saveContentMemory(input: ContentInput): Promise<ContentMemoryRecord> {
  assertSafeId(input.id);
  assertContent(input);
  const key = CONTENT_PREFIX + input.id;
  const previous = await get<ContentMemoryRecord>(key);
  const now = new Date().toISOString();
  const record = withMemoryExpiry({
    ...input,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: 2 as const,
  });
  await saveExpiringMemory(key as `amy2:${string}`, record);
  return record;
}

export async function getContentMemory(id: string): Promise<ContentMemoryRecord | null> {
  assertSafeId(id);
  const record = await get<ContentMemoryRecord>(CONTENT_PREFIX + id);
  if (!record || record.kind !== 'content' || isMemoryExpired(record.expiresAt)) return null;
  return record;
}

export async function listContentMemory(limit = 100): Promise<ContentMemoryRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const recordKeys = await keys(CONTENT_PREFIX + '*');
  const records: ContentMemoryRecord[] = [];
  for (const key of recordKeys) {
    const record = await get<ContentMemoryRecord>(key);
    if (record?.kind === 'content' && !isMemoryExpired(record.expiresAt)) records.push(record);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, safeLimit);
}

export async function saveTrendMemory(input: TrendInput): Promise<TrendMemoryRecord> {
  assertSafeId(input.id);
  assertTrend(input);
  const key = TREND_PREFIX + input.id;
  const previous = await get<TrendMemoryRecord>(key);
  const now = new Date().toISOString();
  const record = withMemoryExpiry({
    ...input,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: 2 as const,
  });
  await saveExpiringMemory(key as `amy2:${string}`, record);
  return record;
}

export async function getTrendMemory(id: string): Promise<TrendMemoryRecord | null> {
  assertSafeId(id);
  const record = await get<TrendMemoryRecord>(TREND_PREFIX + id);
  if (!record || record.kind !== 'trend' || isMemoryExpired(record.expiresAt)) return null;
  return record;
}

export async function listTrendMemory(limit = 100): Promise<TrendMemoryRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const recordKeys = await keys(TREND_PREFIX + '*');
  const records: TrendMemoryRecord[] = [];
  for (const key of recordKeys) {
    const record = await get<TrendMemoryRecord>(key);
    if (record?.kind === 'trend' && !isMemoryExpired(record.expiresAt)) records.push(record);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, safeLimit);
}

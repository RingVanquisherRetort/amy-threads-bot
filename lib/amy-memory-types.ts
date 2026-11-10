// Типы данных для интеллектуальной памяти Amy 2.0.
// Все даты ISO-8601 UTC. Внешние идентификаторы Threads храним строками.
export type MemoryRecordStatus = 'active' | 'archived' | 'expired';
export interface MemoryRecordBase {
  id: string; createdAt: string; updatedAt: string; expiresAt: string;
  status: MemoryRecordStatus; schemaVersion: 2;
}
export interface ContentMemoryRecord extends MemoryRecordBase {
  kind: 'content'; text: string; city?: string; category: string; format: string;
  goal: string; qualityScore?: number;
  statusLabel: 'idea' | 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected';
  threadsPostId?: string; publishedAt?: string; rationale?: string; sourceIds?: string[];
}
export interface TrendMemoryRecord extends MemoryRecordBase {
  kind: 'trend'; topic: string; source: 'threads' | 'tiktok' | 'other';
  sourceUrl?: string; sourcePublishedAt?: string; relevanceScore: number;
  engagementPotential: number; adaptationAngle?: string; usedAt?: string;
}
export interface PostMetricsSnapshot extends MemoryRecordBase {
  kind: 'performance'; contentId: string; threadsPostId: string;
  capturedAt: string; ageHours: number; views?: number; likes?: number;
  replies?: number; reposts?: number; quotes?: number;
  profileVisits?: number; linkClicks?: number; unavailableMetrics?: string[];
}
export interface LearningInsight extends MemoryRecordBase {
  kind: 'learning'; dimension: 'topic' | 'format' | 'time' | 'city' | 'funnel';
  statement: string; sampleSize: number; confidence: number;
  evidenceContentIds: string[]; calculatedAt: string; validUntil: string;
}
export interface FunnelDailyRecord extends MemoryRecordBase {
  kind: 'funnel'; date: string; profileVisits?: number; linkClicks?: number;
  registrations?: number; activations?: number; revenueRub?: number;
  attribution: 'confirmed' | 'manual' | 'estimated' | 'unknown'; notes?: string;
}
export type AmyMemoryRecord = ContentMemoryRecord | TrendMemoryRecord | PostMetricsSnapshot | LearningInsight | FunnelDailyRecord;

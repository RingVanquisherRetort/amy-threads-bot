// Редакторская оценка Amy 2.0. Числовой балл сам по себе не публикует пост:
// операционный автопостинг остаётся под отдельным production safety guard.
import { AMY_CONFIG } from './amy-config';

export interface EditorialScore {
  naturalness: number;       // 0..20
  engagement: number;        // 0..20
  brandVoice: number;        // 0..20
  originality: number;       // 0..15
  usefulnessEmotion: number; // 0..10
  seo: number;               // 0..10
  factualAccuracy: number;   // 0..5
}

export type EditorialDecision = 'publish_eligible' | 'revise' | 'reject';

const MAX: Record<keyof EditorialScore, number> = {
  naturalness: 20, engagement: 20, brandVoice: 20, originality: 15,
  usefulnessEmotion: 10, seo: 10, factualAccuracy: 5,
};

export function totalEditorialScore(score: EditorialScore): number {
  for (const key of Object.keys(MAX) as Array<keyof EditorialScore>) {
    const value = score[key];
    if (!Number.isFinite(value) || value < 0 || value > MAX[key]) {
      throw new RangeError(`Invalid editorial score for ${key}: ${value}`);
    }
  }
  return Object.values(score).reduce((sum, value) => sum + value, 0);
}

export function editorialDecision(score: EditorialScore): {
  total: number;
  decision: EditorialDecision;
} {
  const total = totalEditorialScore(score);
  if (total < AMY_CONFIG.editorial.qualityBands.rejectBelow) {
    return { total, decision: 'reject' };
  }
  if (total < AMY_CONFIG.editorial.minimumQualityScore) {
    return { total, decision: 'revise' };
  }
  return { total, decision: 'publish_eligible' };
}

// Безопасная 90-дневная политика хранения Amy 2.0.
// Используется только для новых ключей amy2:*; существующие ключи не затрагиваются.
import { setWithTtl } from './redis';
import { AMY_CONFIG } from './amy-config';
const DAY_SECONDS = 24 * 60 * 60;
export const AMY_MEMORY_TTL_SECONDS = AMY_CONFIG.memory.retentionDays * DAY_SECONDS;
export function withMemoryExpiry<T extends { createdAt: string; updatedAt: string }>(
  record: T, now = new Date()
): T & { expiresAt: string } {
  return { ...record, expiresAt: new Date(now.getTime() + AMY_MEMORY_TTL_SECONDS * 1000).toISOString() };
}
/** Writes only to transient Amy 2.0 keys. Never use for persistent config or legacy keys. */
export async function saveExpiringMemory<T>(key: `amy2:${string}`, value: T): Promise<void> {
  if (!key.startsWith('amy2:') || key.startsWith('amy2:config') || key.startsWith('amy2:editorial:')) {
    throw new Error('TTL storage is restricted to transient amy2 memory records');
  }
  await setWithTtl(key, value, AMY_MEMORY_TTL_SECONDS);
}
export function isMemoryExpired(expiresAt: string, now = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

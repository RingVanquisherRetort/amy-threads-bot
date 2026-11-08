// Конфиг бренда ЗУМЕР. Значения из env имеют приоритет.
export const BRAND = {
  name: process.env.BRAND_NAME ?? 'ЗУМЕР',
  // Хэндл Threads нужно указать после уточнения аккаунта.
  handle: process.env.THREADS_USERNAME ?? 'your-brand-handle',
  site: process.env.BRAND_SITE ?? 'https://t.me/zumer_rabota',
  founder: process.env.BRAND_FOUNDER ?? '',
  oneLiner:
    process.env.BRAND_ONE_LINER ??
    'Партнёрский проект по привлечению и подключению курьеров к Яндекс Еде.',
} as const;

export const handleAt = () => `@${BRAND.handle}`;

// Amy 2.0: единая конфигурация редакции.
// Настройки бренда постоянные и не получают 90-дневный TTL.
export const AMY_CONFIG = {
  version: 2,
  brand: {
    publicName: 'Зумер',
    voice: 'youthful_humorous_bold_hybrid',
    geography: {
      mode: 'all_russia_with_priorities',
      priorityCities: ['Ставрополь','Пятигорск','Кисловодск','Махачкала','Каспийск','Дербент','Нальчик','Владикавказ','Черкесск','Грозный','Назрань','Ессентуки'],
      notes: 'Ставрополь первый; затем Пятигорск и Кисловодск; Махачкала после проверки возможности подключения курьеров; остальные города постепенно.',
      excludedRegions: ['Беларусь'],
    },
  },
  editorial: {
    topicSelection: 'autonomous',
    trendMonitoring: 'daily',
    visualMode: 'text',
    postsPerDayTarget: 4,
    minimumQualityScore: 60,
    qualityBands: { rejectBelow: 40, reviseBelow: 60, publishFrom: 60, excellentFrom: 85 },
    contentMix: { humor_observations: 0.35, courier_topics: 0.25, discussions_provocations: 0.20, brand_recruitment: 0.20 },
    repeatWindowDays: 7,
    trendLookbackDays: 3,
    publishingMode: 'auto_after_editorial_validation',
    commentsRequireManualApproval: true,
    incomeMessaging: {
      blanketBlock: false,
      note: 'Условные суммы разрешены только как явно гипотетические примеры, не статистика, не средний доход, не прогноз и не обещание. Не выдавать их за реальные тарифы, выплаты или официальные условия Яндекс Еды.',
    },
  },
  memory: {
    mode: 'intelligent',
    retentionDays: 90,
    persistentNamespaces: ['amy:config', 'amy:editorial:rules'],
  },
} as const;
export type AmyConfig = typeof AMY_CONFIG;
export type EditorialCategory = keyof typeof AMY_CONFIG.editorial.contentMix;

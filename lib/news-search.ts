// Поиск новостных кандидатов через GDELT DOC 2.0.
// Важно: результаты предназначены для редакционного обнаружения тем,
// а не являются подтверждением фактов или первоисточником.
export interface NewsSourceCandidate {
  id: string;
  title: string;
  url: string;
  domain: string;
  seenAt: string;
  language: string;
}

interface GdeltArticle {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  language?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

const GDELT_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseSeenDate(value?: string): string {
  if (!value) return '';
  const match = value.match(/^(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z?$/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]} UTC`;
}

export async function searchLocalNewsCandidates(): Promise<NewsSourceCandidate[]> {
  const query = '(Stavropol OR "Stavropol Krai" OR "North Caucasus") sourcelang:russian';
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: '12',
    timespan: '7d',
    sort: 'datedesc',
  });

  const response = await fetch(`${GDELT_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Zumer-Amy-NewsResearch/1.0' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GDELT search failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as GdeltResponse;
  const articles = Array.isArray(data.articles) ? data.articles : [];
  const seen = new Set<string>();

  return articles
    .filter((article) => {
      const url = String(article.url ?? '').trim();
      const title = String(article.title ?? '').trim();
      if (!url || !title || !isHttpUrl(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 8)
    .map((article, index) => ({
      id: `gdelt_${index + 1}`,
      title: String(article.title).slice(0, 240),
      url: String(article.url),
      domain: String(article.domain ?? new URL(String(article.url)).hostname),
      seenAt: parseSeenDate(article.seendate),
      language: String(article.language ?? ''),
    }));
}

export function formatNewsCandidatesForPrompt(items: NewsSourceCandidate[]): string {
  if (items.length === 0) return 'Свежие кандидаты не найдены. Не создавай новость на их основе.';
  return items.map((item) =>
    `[SOURCE_ID: ${item.id}] ${item.title}\nСайт: ${item.domain}; дата обнаружения: ${item.seenAt || 'не указана'}; язык: ${item.language || 'не указан'}\nURL: ${item.url}`
  ).join('\\n\\n');
}

export interface ApifyThreadPost {
  type?: string;
  id?: string;
  code?: string;
  url?: string;
  text?: string;
  createdAt?: string;
  author?: { username?: string; fullName?: string };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  searchQuery?: string | null;
  sourceInput?: string;
  searchQuery?: string | null;
}

const DEFAULT_QUERIES = [
  "ищу работу Ставрополь",
  "подработка Ставрополь",
  "работа курьером",
  "курьеры доставка",
  "ищу подработку",
  "работа Пятигорск",
  "работа Нальчик",
  "подработка Северный Кавказ",
];

export async function searchThreadsPosts(topic?: string | null): Promise<ApifyThreadPost[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN не задан в Vercel");

  const queries = topic?.trim()
    ? [topic.trim().slice(0, 100)]
    : DEFAULT_QUERIES;

  const response = await fetch(
    "https://api.apify.com/v2/acts/innolabs~threads-scraper/run-sync-get-dataset-items",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        searchQueries: queries,
        searchSort: "recent",
        maxPostsPerSource: 5,
        includeProfiles: false,
        includeReplies: false,
        maxItems: 35,
        proxyConfiguration: { useApifyProxy: true },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    }
  );

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Apify Threads search ${response.status}: ${details}`);
  }

  const data = (await response.json()) as ApifyThreadPost[];
  if (!Array.isArray(data)) throw new Error("Apify вернул неожиданный формат данных");
  return data.filter((item) => item && item.type === "post" && item.id && item.url && item.text);
}

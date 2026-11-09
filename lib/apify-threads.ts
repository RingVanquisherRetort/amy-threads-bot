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
  username?: string;
  fullName?: string;
  postId?: string;
  shortcode?: string;
  timestamp?: number;
}

// Сначала ищем людей с явным интересом к курьерской работе,
// затем локальную подработку. Общие запросы про удалённую работу убраны.
const DEFAULT_QUERIES = [
  "ищу работу курьером",
  "курьер Ставрополь",
  "подработка Ставрополь",
  "ищу подработку Ставрополь",
  "работа курьером Нальчик",
  "подработка Нальчик",
  "курьер Пятигорск",
  "подработка без опыта Ставрополь",
];

export async function searchThreadsPosts(topic?: string | null): Promise<ApifyThreadPost[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN не задан в Vercel");

  // Keep each synchronous actor run deliberately small: the webhook runs
  // inside a serverless request and must not wait on a large multi-query scrape.
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
        searchSort: "both",
        maxPostsPerSource: 25,
        includeProfiles: false,
        includeReplies: false,
        maxItems: 100,
        proxyConfiguration: { useApifyProxy: true },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    }
  );

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Apify Threads search ${response.status}: ${details}`);
  }

  const data = (await response.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(data)) throw new Error("Apify вернул неожиданный формат данных");

  // The actor's documented output has type/id/url/text, but tolerate
  // equivalent field names and top-level author fields to avoid silently
  // dropping valid public posts when the actor output schema evolves.
  const normalized: ApifyThreadPost[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const type = String(row.type ?? "post").toLowerCase();
    if (type !== "post") continue;

    const authorValue = row.author && typeof row.author === "object"
      ? row.author as Record<string, unknown>
      : {};
    const id = String(row.id ?? row.postId ?? row.threadId ?? "").trim();
    const code = String(row.code ?? row.shortcode ?? "").trim();
    const url = String(row.url ?? (code && row.username
      ? `https://www.threads.com/@${String(row.username).replace(/^@/, "")}/post/${code}`
      : "")).trim();
    const text = String(row.text ?? row.caption ?? row.content ?? "").trim();
    const rawDate = row.createdAt ?? (typeof row.timestamp === "number"
      ? new Date(row.timestamp * 1000).toISOString()
      : "");
    const createdAt = String(rawDate ?? "");
    const username = String(authorValue.username ?? row.username ?? row.authorUsername ?? "").replace(/^@/, "");

    if (!id || !url || !text) continue;
    normalized.push({
      type: "post",
      id,
      code,
      url,
      text,
      createdAt,
      author: { username, fullName: String(authorValue.fullName ?? row.fullName ?? "") },
      likeCount: Number(row.likeCount ?? 0) || 0,
      replyCount: Number(row.replyCount ?? 0) || 0,
      repostCount: Number(row.repostCount ?? 0) || 0,
      searchQuery: row.searchQuery == null ? null : String(row.searchQuery),
      sourceInput: row.sourceInput == null ? "" : String(row.sourceInput),
    });
  }
  console.info("[Apify Threads] dataset rows:", data.length, "normalized posts:", normalized.length,
    "sample keys:", Object.keys(data[0] ?? {}).slice(0, 24));
  return normalized;
}

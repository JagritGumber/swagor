const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const FETCH_TIMEOUT_MS = 10_000;

export type GdeltArticle = {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
};

export type NewsItem = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
};

export type NewsResponse = {
  query: string;
  results: NewsItem[];
};

/**
 * Search recent news via GDELT 2.0 DOC API. Completely free, no API key.
 * Feeds the watcher + daily planner with macro / protocol-specific news.
 *
 * Hardened against silent failures: a 10s timeout makes hangs visible
 * via AbortError; on empty results we log the raw response body so we
 * can tell genuine zero from response-shape mismatch. Earlier symptom
 * was 19 consecutive watcher ticks with newsCount=0 and no log signal.
 */
export async function searchNews(
  query: string,
  opts?: { maxResults?: number; days?: number }
): Promise<NewsResponse> {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: String(opts?.maxResults ?? 20),
    timespan: `${opts?.days ?? 7}d`,
    format: "json",
    sort: "datedesc",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${GDELT_URL}?${params}`, {
      signal: controller.signal,
      next: { revalidate: 600 },
      headers: { "User-Agent": "swagor-agent/0.1 (hackathon submission)" },
    });
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[news] GDELT fetch threw (query=${query.slice(0, 80)}): ${reason}`);
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    console.error(`[news] GDELT ${res.status} (query=${query.slice(0, 80)}): ${body.slice(0, 300)}`);
    throw new Error(`GDELT search failed: ${res.status}`);
  }
  const raw = await res.text();
  let data: { articles?: GdeltArticle[] } | null = null;
  try {
    data = JSON.parse(raw) as { articles?: GdeltArticle[] };
  } catch {
    console.error(`[news] GDELT returned non-JSON (query=${query.slice(0, 80)}): ${raw.slice(0, 300)}`);
    return { query, results: [] };
  }
  const articles = data.articles ?? [];
  if (articles.length === 0) {
    console.warn(`[news] GDELT returned 0 articles for query=${query.slice(0, 120)}. Raw head: ${raw.slice(0, 200)}`);
  }
  return {
    query,
    results: articles.map((a) => ({
      title: a.title,
      url: a.url,
      publishedAt: a.seendate,
      source: a.domain,
    })),
  };
}

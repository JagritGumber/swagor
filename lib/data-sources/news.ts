const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

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
 * Feeds the Graph Builder agent with current macro/protocol-specific news.
 *
 * Query supports GDELT operators (topic, near, sourcelang, sourcecountry).
 * Example: `perpetual OR "funding rate" OR liquidation` for a multi-keyword search.
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
  const res = await fetch(`${GDELT_URL}?${params}`, {
    next: { revalidate: 600 },
    // GDELT is fussy about User-Agent; set a real one.
    headers: { "User-Agent": "swagor-agent/0.1 (hackathon submission)" },
  });
  if (!res.ok) {
    throw new Error(`GDELT search failed: ${res.status}`);
  }
  const data = (await res.json()) as { articles?: GdeltArticle[] };
  const articles = data.articles ?? [];
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

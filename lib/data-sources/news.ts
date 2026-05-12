const TAVILY_URL = "https://api.tavily.com/search";

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
};

export type NewsResponse = {
  query: string;
  results: TavilyResult[];
};

/**
 * Search news with Tavily. Free tier = 1k searches/month.
 * Feeds the Graph Builder agent with current macro/protocol-specific news.
 */
export async function searchNews(
  query: string,
  opts?: { maxResults?: number; days?: number }
): Promise<NewsResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: opts?.maxResults ?? 10,
      days: opts?.days ?? 7,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status}`);
  }
  return res.json();
}

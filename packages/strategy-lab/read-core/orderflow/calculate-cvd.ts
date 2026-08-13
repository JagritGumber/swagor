import type { OrderflowBucket } from "@market-data/parquet/types";

export type CvdRead = {
  cvd: number;
  cvdHigh: number;
  cvdLow: number;
  cvdTrend: "rising" | "falling" | "flat";
  priceCvdDivergence: "bullish" | "bearish" | "none";
  lastPrice: number;
  firstPrice: number;
  priceChange: number;
};

export function calculateCvd(buckets: OrderflowBucket[]): CvdRead | null {
  if (buckets.length === 0) return null;

  let cvd = 0;
  let cvdHigh = 0;
  let cvdLow = 0;
  const firstPrice = buckets[0].open;
  let lastPrice = buckets[0].close;

  for (const bucket of buckets) {
    cvd += bucket.delta;
    if (cvd > cvdHigh) cvdHigh = cvd;
    if (cvd < cvdLow) cvdLow = cvd;
    lastPrice = bucket.close;
  }

  const priceChange = lastPrice - firstPrice;
  const cvdTrend = detectCvdTrend(buckets);
  const priceCvdDivergence = detectDivergence(buckets, priceChange, cvd);

  return {
    cvd,
    cvdHigh,
    cvdLow,
    cvdTrend,
    priceCvdDivergence,
    lastPrice,
    firstPrice,
    priceChange,
  };
}

function detectCvdTrend(buckets: OrderflowBucket[]): CvdRead["cvdTrend"] {
  if (buckets.length < 3) return "flat";
  const third = Math.floor(buckets.length / 3);
  let earlyCvd = 0;
  let midCvd = 0;
  let lateCvd = 0;
  for (let i = 0; i < third; i++) earlyCvd += buckets[i].delta;
  for (let i = third; i < third * 2; i++) midCvd += buckets[i].delta;
  for (let i = third * 2; i < buckets.length; i++) lateCvd += buckets[i].delta;
  if (lateCvd > midCvd && midCvd > earlyCvd) return "rising";
  if (lateCvd < midCvd && midCvd < earlyCvd) return "falling";
  return "flat";
}

function detectDivergence(
  buckets: OrderflowBucket[],
  priceChange: number,
  cvd: number,
): CvdRead["priceCvdDivergence"] {
  if (buckets.length < 2) return "none";
  if (priceChange > 0 && cvd < 0) return "bearish";
  if (priceChange < 0 && cvd > 0) return "bullish";
  return "none";
}

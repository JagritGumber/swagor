# BTCUSDT Rolling Narrative Parquet Replay

Range: 2025-05-01 to 2026-05-01  
Venue: Bybit trading BTCUSDT  
Data mode: monthly Parquet 1s orderflow buckets  
Narrative mode: rolling  
Branch: reader-rolling-narrative-parquet

## Result

The result is not good enough to treat as a working strategy. Rolling memory improved the May drawdown shape, but over one year it produced too few trades and the edge faded after the first two months.

| Month | Trades | Wins | Losses | Total R | Avg R | Max DD | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2025-05 | 8 | 6 | 2 | 5.9146 | 0.7393 | -1.0000 | CONTINUE |
| 2025-06 | 6 | 4 | 2 | 4.5892 | 0.7649 | -1.0000 | CONTINUE |
| 2025-07 | 2 | 0 | 2 | -2.0000 | -1.0000 | -2.0000 | COLLECT_MORE_DATA |
| 2025-08 | 2 | 0 | 2 | -2.0000 | -1.0000 | -2.0000 | COLLECT_MORE_DATA |
| 2025-09 | 3 | 1 | 2 | -0.7146 | -0.2382 | -1.0000 | COLLECT_MORE_DATA |
| 2025-10 | 8 | 6 | 2 | 1.5805 | 0.1976 | -1.0000 | CONTINUE |
| 2025-11 | 5 | 3 | 2 | 3.4373 | 0.6875 | -1.0000 | CONTINUE |
| 2025-12 | 3 | 1 | 2 | -0.7098 | -0.2366 | -1.0000 | COLLECT_MORE_DATA |
| 2026-01 | 5 | 3 | 2 | -0.0711 | -0.0142 | -1.2441 | KILL |
| 2026-02 | 3 | 1 | 2 | -0.6768 | -0.2256 | -1.0000 | COLLECT_MORE_DATA |
| 2026-03 | 2 | 0 | 2 | -2.0000 | -1.0000 | -2.0000 | COLLECT_MORE_DATA |
| 2026-04 | 2 | 0 | 2 | -2.0000 | -1.0000 | -2.0000 | COLLECT_MORE_DATA |

Aggregate from monthly runs:

| Trades | Wins | Losses | Total R | Avg R |
| ---: | ---: | ---: | ---: | ---: |
| 49 | 25 | 24 | 5.3493 | 0.1092 |

Month-level equity drawdown was approximately -5.4577R. Exact trade-level one-year drawdown was not measured because the state-preserving full-year replay timed out.

## Observations

- Rolling memory did reduce catastrophic invalidated-thesis damage compared with the original UTC May result.
- The yearly sample is still small at 49 trades.
- The strategy is front-loaded: May and June contributed 10.5038R, while July through April combined lost 5.1545R.
- Losses remained capped in most monthly runs, but the strategy stopped finding enough good opportunities.
- The current setup is not portfolio-ready. It needs either better re-entry/repair logic or a different reader trigger.

## Next Comparisons

Run the same May 2025 to April 2026 window for:

- `utc-day`
- `liquidity-session`

Use the same monthly Parquet store and record the same table before making strategy changes.

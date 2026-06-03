# BTCUSDT Narrative Mode Comparison

Range: 2025-05 to 2026-04
Bucket event mode: aggregate
Auction level candles: 240
Profile trade sample limit: default
Chunking: days

Passive BTC benchmark: 2025-05-01T00:00:00.000Z open 94118 to 2026-04-30T23:59:59.000Z close 76301, return -18.9305%.

Verdict: none of these modes is acceptable as-is. `rolling` is the least noisy but ends negative with too few trades after early months. `utc-day` and `liquidity-session` produce enough trades to judge, but their drawdowns and churn are too high for the reader goal.

## utc-day

| Month | Trades | Wins | Losses | Total R | Avg R | Max DD | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2025-05 | 75 | 39 | 36 | 0.7233 | 0.0096 | -10.7984 | ADJUST |
| 2025-06 | 57 | 31 | 26 | 5.0326 | 0.0883 | -10.9312 | ADJUST |
| 2025-07 | 55 | 28 | 27 | -0.2612 | -0.0047 | -5 | KILL |
| 2025-08 | 69 | 37 | 32 | 9.1057 | 0.132 | -5.3313 | ADJUST |
| 2025-09 | 46 | 26 | 20 | 13.5792 | 0.2952 | -5 | ADJUST |
| 2025-10 | 66 | 27 | 39 | -12.2364 | -0.1854 | -14.6374 | KILL |
| 2025-11 | 79 | 40 | 39 | 4.236 | 0.0536 | -8.6702 | ADJUST |
| 2025-12 | 60 | 23 | 37 | -8.0714 | -0.1345 | -9.7369 | KILL |
| 2026-01 | 50 | 22 | 28 | -3.1431 | -0.0629 | -9.5597 | KILL |
| 2026-02 | 62 | 25 | 37 | -5.2592 | -0.0848 | -16.2367 | KILL |
| 2026-03 | 65 | 25 | 40 | -10.6495 | -0.1638 | -11.7078 | KILL |
| 2026-04 | 63 | 33 | 30 | 4.7846 | 0.0759 | -5.6471 | ADJUST |

Aggregate: trades=747 wins=356 losses=391 totalR=-2.1594 avgR=-0.0029 monthLevelMaxDD=-35.1236

## rolling

| Month | Trades | Wins | Losses | Total R | Avg R | Max DD | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2025-05 | 7 | 5 | 2 | 3.4967 | 0.4995 | -1 | CONTINUE |
| 2025-06 | 7 | 5 | 2 | 2.9134 | 0.4162 | -1 | CONTINUE |
| 2025-07 | 5 | 3 | 2 | -0.3832 | -0.0766 | -1 | KILL |
| 2025-08 | 2 | 0 | 2 | -2 | -1 | -2 | COLLECT_MORE_DATA |
| 2025-09 | 7 | 5 | 2 | 3.2211 | 0.4602 | -2 | CONTINUE |
| 2025-10 | 5 | 3 | 2 | 0.401 | 0.0802 | -2 | CONTINUE |
| 2025-11 | 4 | 2 | 2 | -0.3533 | -0.0883 | -1 | COLLECT_MORE_DATA |
| 2025-12 | 3 | 1 | 2 | -1.267 | -0.4223 | -1.267 | COLLECT_MORE_DATA |
| 2026-01 | 3 | 1 | 2 | -0.827 | -0.2757 | -2 | COLLECT_MORE_DATA |
| 2026-02 | 2 | 0 | 2 | -2 | -1 | -2 | COLLECT_MORE_DATA |
| 2026-03 | 2 | 0 | 2 | -2 | -1 | -2 | COLLECT_MORE_DATA |
| 2026-04 | 2 | 0 | 2 | -2 | -1 | -2 | COLLECT_MORE_DATA |

Aggregate: trades=49 wins=25 losses=24 totalR=-0.7983 avgR=-0.0163 monthLevelMaxDD=-8.4473

## liquidity-session

| Month | Trades | Wins | Losses | Total R | Avg R | Max DD | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2025-05 | 94 | 47 | 47 | -0.7151 | -0.0076 | -12.6687 | KILL |
| 2025-06 | 68 | 34 | 34 | 1.0812 | 0.0159 | -17.6429 | ADJUST |
| 2025-07 | 74 | 35 | 39 | -6.0976 | -0.0824 | -8.9808 | KILL |
| 2025-08 | 93 | 47 | 46 | 7.6171 | 0.0819 | -6.9676 | ADJUST |
| 2025-09 | 54 | 29 | 25 | 10.1551 | 0.1881 | -6 | ADJUST |
| 2025-10 | 95 | 40 | 55 | -12.6268 | -0.1329 | -17.4728 | KILL |
| 2025-11 | 96 | 45 | 51 | 0.6175 | 0.0064 | -13.245 | ADJUST |
| 2025-12 | 76 | 33 | 43 | 4.102 | 0.054 | -9.2834 | ADJUST |
| 2026-01 | 71 | 32 | 39 | -1.1771 | -0.0166 | -14.5113 | KILL |
| 2026-02 | 83 | 34 | 49 | -2.9091 | -0.035 | -12.3829 | KILL |
| 2026-03 | 87 | 38 | 49 | -4.9818 | -0.0573 | -13.5385 | KILL |
| 2026-04 | 89 | 45 | 44 | 6.8208 | 0.0766 | -7.4352 | ADJUST |

Aggregate: trades=980 wins=459 losses=521 totalR=1.8862 avgR=0.0019 monthLevelMaxDD=-16.9753

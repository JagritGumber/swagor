# Reader After Learning Replay

| Case | Trades | Wins | Losses | Total R | Avg R |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 5 | 3 | 2 | -0.3832 | -0.0766 |
| Learned | 5 | 3 | 2 | -0.3832 | -0.0766 |
| Skipped | 0 | 0 | 0 | 0 | 0 |

## Trades

- kept: BTCUSDT#1@2025-07-01T08:48:00.000Z long R=-1; none
- kept: BTCUSDT#2@2025-07-02T19:05:00.000Z short R=1.0339; none
- kept: BTCUSDT#3@2025-07-03T01:45:00.000Z short R=0.2961; none
- kept-needs-more-sample: BTCUSDT#4@2025-07-03T20:49:00.000Z short R=n/a; trade still open
- kept-reduce-size-candidate: BTCUSDT#5@2025-07-05T05:58:00.000Z short R=0.2868; 1 full or partial losses | contains trades where price moved away from POC after entry | contains adverse first post-entry reads | contains size-down evidence from MAE or diagnostic labels | positive tape: 5 wins / 1 losses
- kept-reduce-size-candidate: BTCUSDT#6@2025-07-08T07:30:00.000Z short R=-1; 1 full or partial losses | contains trades where price moved away from POC after entry | contains adverse first post-entry reads | contains size-down evidence from MAE or diagnostic labels | positive tape: 5 wins / 1 losses

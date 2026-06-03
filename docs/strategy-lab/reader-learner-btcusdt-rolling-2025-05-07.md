# Reader Learner Report

Trades: 19
Wins: 13
Losses: 6
Total R: 6.0269
Average R: 0.3172
Win rate: 0.6842

## Playbook Lessons

None.

## Avoid Lessons

### avoid 4 trades 1/3 -2.2985R

```text
long|reversal-reclaim|value-low|support|failed-expansion|rejecting-below-value|poc-stable|value-stable|reversal-reclaim|long|absorption|sell-pressure|confirmed-absorption+large-print+sell-absorption+stalled-selling
```

Avg R: -0.5746
Reasons: only 4 judgeable trades; do not treat this as edge | negative expectancy: -2.2985R total | 3 full or partial losses | contains trades where price moved away from POC after entry | contains adverse first post-entry reads
Refs: BTCUSDT#5@2025-05-04T03:18:00.000Z, BTCUSDT#7@2025-05-04T10:55:00.000Z, BTCUSDT#1@2025-06-01T09:25:00.000Z, BTCUSDT#1@2025-07-01T08:48:00.000Z


## Scale Lessons

### reduce-size 8 trades 6/2 3.0649R

```text
short|reversal-reclaim|value-high|resistance|failed-expansion|rejecting-above-value|poc-stable|value-stable|reversal-reclaim|short|absorption|buy-pressure|buy-absorption+confirmed-absorption+large-print+stalled-buying
```

Avg R: 0.3831
Reasons: 2 full or partial losses | contains trades where price moved away from POC after entry | contains adverse first post-entry reads | contains size-down evidence from MAE or diagnostic labels | positive tape: 6 wins / 2 losses
Refs: BTCUSDT#1@2025-05-01T12:16:00.000Z, BTCUSDT#2@2025-05-02T14:23:00.000Z, BTCUSDT#3@2025-06-03T13:21:00.000Z, BTCUSDT#4@2025-06-03T13:50:00.000Z, BTCUSDT#5@2025-06-04T17:00:00.000Z, BTCUSDT#6@2025-06-05T04:00:00.000Z, BTCUSDT#5@2025-07-05T05:58:00.000Z, BTCUSDT#6@2025-07-08T07:30:00.000Z


## Sample Warnings

### avoid 4 trades 1/3 -2.2985R

```text
long|reversal-reclaim|value-low|support|failed-expansion|rejecting-below-value|poc-stable|value-stable|reversal-reclaim|long|absorption|sell-pressure|confirmed-absorption+large-print+sell-absorption+stalled-selling
```

Avg R: -0.5746
Reasons: only 4 judgeable trades; do not treat this as edge | negative expectancy: -2.2985R total | 3 full or partial losses | contains trades where price moved away from POC after entry | contains adverse first post-entry reads
Refs: BTCUSDT#5@2025-05-04T03:18:00.000Z, BTCUSDT#7@2025-05-04T10:55:00.000Z, BTCUSDT#1@2025-06-01T09:25:00.000Z, BTCUSDT#1@2025-07-01T08:48:00.000Z

### needs-more-sample 2 trades 2/0 4.0629R

```text
long|reversal-reclaim|value-low|support|failed-expansion|rejecting-below-value|poc-migrating-up|value-stable|reversal-reclaim|long|absorption|sell-pressure|confirmed-absorption+large-print+sell-absorption+stalled-selling
```

Avg R: 2.0315
Reasons: only 2 judgeable trades; do not treat this as edge | positive tape: 2 wins / 0 losses
Refs: BTCUSDT#3@2025-05-03T12:11:00.000Z, BTCUSDT#4@2025-05-03T17:22:00.000Z

### needs-more-sample 2 trades 1/1 0.0339R

```text
short|reversal-reclaim|value-high|resistance|failed-expansion|rejecting-above-value|poc-migrating-down|value-stable|reversal-reclaim|short|absorption|buy-pressure|buy-absorption+confirmed-absorption+large-print+stalled-buying
```

Avg R: 0.017
Reasons: only 2 judgeable trades; do not treat this as edge | 1 full or partial losses | contains trades where price moved away from POC after entry | contains adverse first post-entry reads | positive tape: 1 wins / 1 losses
Refs: BTCUSDT#7@2025-06-06T11:02:00.000Z, BTCUSDT#2@2025-07-02T19:05:00.000Z

### needs-more-sample 1 trades 1/0 0.5203R

```text
short|reversal-reclaim|value-high|resistance|failed-expansion|inside-value|poc-migrating-up|value-stable|reversal-reclaim|short|absorption|buy-pressure|buy-absorption+confirmed-absorption+large-print+stalled-buying
```

Avg R: 0.5203
Reasons: only 1 judgeable trades; do not treat this as edge | contains trades where price moved away from POC after entry | contains adverse first post-entry reads | positive tape: 1 wins / 0 losses
Refs: BTCUSDT#2@2025-06-01T20:35:00.000Z

### needs-more-sample 1 trades 1/0 0.3473R

```text
long|reversal-reclaim|value-low|support|failed-expansion|rejecting-below-value|poc-stable|value-stable|reversal-reclaim|long|absorption|sell-pressure|aggressive-absorption+sell-absorption+stalled-selling
```

Avg R: 0.3473
Reasons: only 1 judgeable trades; do not treat this as edge | positive tape: 1 wins / 0 losses
Refs: BTCUSDT#6@2025-05-04T03:46:00.000Z

### needs-more-sample 1 trades 1/0 0.2961R

```text
short|reversal-reclaim|value-high|resistance|failed-expansion|inside-value|poc-stable|value-expanding-up|reversal-reclaim|short|absorption|buy-pressure|buy-absorption+confirmed-absorption+large-print+stalled-buying
```

Avg R: 0.2961
Reasons: only 1 judgeable trades; do not treat this as edge | contains trades where price moved away from POC after entry | positive tape: 1 wins / 0 losses
Refs: BTCUSDT#3@2025-07-03T01:45:00.000Z


## Data Quality Lessons

### needs-more-sample 0 trades 0/0 0R

```text
short|reversal-reclaim|value-high|resistance|failed-expansion|rejecting-above-value|poc-migrating-down|value-expanding-down|reversal-reclaim|short|absorption|buy-pressure|aggressive-absorption+buy-absorption+stalled-buying
outcome: favorable-first-read|moved-away-from-poc|unjudgeable|untrusted-result+absorbed-but-no-rotation
```

Avg R: 0
Reasons: only 0 judgeable trades; do not treat this as edge | contains trades where price moved away from POC after entry
Refs: BTCUSDT#4@2025-07-03T20:49:00.000Z


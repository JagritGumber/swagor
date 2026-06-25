# Reader High-R Restart Baseline

This branch restarts reader work from the high-R hypothesis evidence instead of
the later over-guarded radar execution path.

Baseline source reports:

- `artifacts/reader-high-r-hypothesis-mine-2025-05-2025-10.md`
- `artifacts/reader-hypothesis-report-combined-2025-05-2025-10.md`
- `artifacts/reader-hypothesis-report-trend-pullback-2025-05-2025-10.md`
- `artifacts/reader-hypothesis-stability-combined-2025-05-2025-10.md`

Reference scorecard with 1bps round-trip cost:

| Family | Entries | W/L | Total R | Max DD |
| --- | ---: | ---: | ---: | ---: |
| VP active long, first reaction non-negative | 249 | 90/159 | +334.8423R | -18.6813R |
| VP trend-down active tape, 0.25R price follow | 140 | 57/83 | +229.5121R | -11.17R |
| Trend-pullback continuation, 0.25R price follow | 200 | 55/145 | +170.7344R | -27.386R |
| Trend-pullback long thin immediate baseline | 113 | 52/61 | +161.0835R | -31.7491R |
| VP confirmed absorption trend-down, 0.25R price follow | 41 | 23/18 | +140.906R | -4.1499R |

Rules for this restart:

- Hypothesis filters are research descriptors, not final reader rules.
- Numeric buckets such as invalidation bps, trade count bands, or confirmation R
  must not become executable reader behavior unless they are translated into a
  market-state reason.
- The next executable reader should be selected by reproducing the reports,
  reviewing monthly stability, and explaining the edge in reader language.

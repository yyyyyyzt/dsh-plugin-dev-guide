# Mock panel — simulated expert decisions

packets: 12; experts: E1, E2, E3, E4, E5, E6; findings judged by at least one expert: 162

| expert | findings | accept | reject | rewrite | accept rate | added | verdicts | = engine | = expected |
|---|---|---|---|---|---|---|---|---|---|
| E1 | 27 | 17 | 9 | 1 | 63.0% | 5 | 通过 3 / 建议整改 5 / 不通过 4 | 10/12 | 11/12 |
| E2 | 27 | 15 | 3 | 9 | 55.6% | 15 | 通过 0 / 建议整改 10 / 不通过 2 | 7/12 | 6/12 |
| E3 | 27 | 13 | 0 | 14 | 48.1% | 1 | 通过 3 / 建议整改 8 / 不通过 1 | 9/12 | 8/12 |
| E4 | 27 | 26 | 0 | 1 | 96.3% | 1 | 通过 4 / 建议整改 5 / 不通过 3 | 12/12 | 11/12 |
| E5 | 27 | 12 | 13 | 2 | 44.4% | 14 | 通过 1 / 建议整改 7 / 不通过 4 | 8/12 | 9/12 |
| E6 | 27 | 3 | 14 | 10 | 11.1% | 20 | 通过 0 / 建议整改 4 / 不通过 8 | 4/12 | 5/12 |

## By tier

| expert | hard accept | hybrid accept |
|---|---|---|
| E1 | 41.2% | 100.0% |
| E2 | 47.1% | 70.0% |
| E3 | 47.1% | 50.0% |
| E4 | 94.1% | 100.0% |
| E5 | 11.8% | 100.0% |
| E6 | 0.0% | 30.0% |

## By severity

| expert | blocker accept | major accept | minor accept |
|---|---|---|---|
| E1 | 100.0% | 66.7% | 37.5% |
| E2 | 75.0% | 66.7% | 25.0% |
| E3 | 25.0% | 73.3% | 12.5% |
| E4 | 100.0% | 93.3% | 100.0% |
| E5 | 100.0% | 40.0% | 25.0% |
| E6 | 75.0% | 0.0% | 0.0% |

## Agreement on the 27 findings judged by all experts

Fleiss κ (accept vs not) = 0.147 (P̄ 0.575, Pe 0.502, n=27)

## Rule-level acceptance (all experts)

| rule | tier | severity | n | accept | reject | rewrite | accept rate |
|---|---|---|---|---|---|---|---|
| DOC-005 | hard | major | 6 | 0 | 3 | 3 | 0.0% |
| DOC-010 | hard | minor | 12 | 2 | 4 | 6 | 16.7% |
| DOC-011 | hard | major | 12 | 2 | 5 | 5 | 16.7% |
| DOC-012 | hard | minor | 12 | 3 | 6 | 3 | 25.0% |
| INT-004 | hard | minor | 12 | 4 | 1 | 7 | 33.3% |
| DOC-001 | hard | major | 12 | 5 | 6 | 1 | 41.7% |
| INT-005 | hybrid | minor | 6 | 3 | 1 | 2 | 50.0% |
| INT-001 | hard | major | 18 | 12 | 6 | 0 | 66.7% |
| CAP-002 | hard | major | 6 | 4 | 1 | 1 | 66.7% |
| MON-001 | hybrid | minor | 6 | 4 | 0 | 2 | 66.7% |
| INT-003 | hybrid | major | 6 | 4 | 1 | 1 | 66.7% |
| CAP-001 | hybrid | blocker | 6 | 4 | 0 | 2 | 66.7% |
| CAP-006 | hard | major | 12 | 9 | 2 | 1 | 75.0% |
| CAP-005 | hybrid | major | 12 | 10 | 2 | 0 | 83.3% |
| SEC-002 | hybrid | blocker | 12 | 10 | 0 | 2 | 83.3% |
| SYN-001 | hybrid | major | 6 | 5 | 1 | 0 | 83.3% |
| SEC-004 | hybrid | blocker | 6 | 5 | 0 | 1 | 83.3% |

## What a memory layer would learn

- demote/suppress candidates (accept rate < 50%, n≥3): DOC-005 (0, n=6), DOC-010 (0.167, n=12), DOC-011 (0.167, n=12), DOC-012 (0.25, n=12), INT-004 (0.333, n=12), DOC-001 (0.417, n=12)
- stable rules (100% accepted, n≥3): none

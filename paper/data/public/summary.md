# Ablation summary

- dataset: `synthetic-v1-seed20261029` (100 solutions)
- rule pack: `capability-open-access.rules.yaml` (28 rules)
- judge: `flag` / model `none`; repetitions 3; minorThreshold 3
- generated: 2026-10-29T10:33:38.839Z in 4.5 s
| 配置 | judge | 重复 | P | R | F1 (95% CI) | R_w | 结论准确率 | 宏 F1 | κ | κ_w | 证据有效率 | 待人工覆盖 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B0 | flag/none | 3 | 0.275 | 0.186 | 0.222 ±0.000 [0.176, 0.267] | 0.162 | 28.0% | 0.275 | -0.043 | -0.059 | 100.0% | 0.0% |
| S-full | flag/none | 3 | 1.000 | 0.664 | 0.798 ±0.000 [0.762, 0.836] | 0.649 | 85.0% | 0.832 | 0.763 | 0.739 | 79.2% | 80.0% |
| S-verifier | flag/none | 3 | 1.000 | 0.664 | 0.798 ±0.000 [0.762, 0.836] | 0.649 | 85.0% | 0.832 | 0.763 | 0.739 | 79.2% | 80.0% |
| B1 | — | 0 | skipped: requires llm adapter (--adapter <module>) | | | | | | | | | |
| S-gate | — | 0 | skipped: requires llm adapter (--adapter <module>) | | | | | | | | | |
| S-policy | — | 0 | skipped: requires llm adapter (--adapter <module>) | | | | | | | | | |
| S-memory | — | 0 | skipped: online-only: no expert feedback in an offline dataset | | | | | | | | | |

与 S-full 的配对比较（按方案配对；Wilcoxon 符号秩检验用于问题级 F1，McNemar 用于结论正误；Holm 校正）：

| 配置 | ΔF1 | Wilcoxon p | McNemar b/c | McNemar p | Holm p (W) | Holm p (M) |
|---|---|---|---|---|---|---|
| B0 | -0.564 | 0.000 | 64/7 | 0.000 | 0.000 | 0.000 |
| S-verifier | +0.000 | 1.000 | 0/0 | 1.000 | 1.000 | 1.000 |


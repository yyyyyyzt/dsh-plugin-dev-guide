# 评测复现说明（S5）

设计口径见 `plugins/wsgw-solution-review/docs/evaluation.md`；本文只讲怎么跑。所有命令在 `plugins/wsgw-solution-review/` 下执行，Node ≥ 22.14，pnpm 11。

## 0. 准备

```bash
cd plugins/wsgw-solution-review
pnpm install
pnpm run build          # 评测脚本从 lib/ 加载引擎与 src/eval 的编译产物
pnpm test               # 含 tests/eval/*（T-EVA-01..11）
```

## 1. 合成集

```bash
pnpm run eval:gen                                   # 默认 --seed 20261029 --minor-threshold 3
pnpm run eval:gen -- --seed 7 --out /tmp/syn-7      # 换种子 / 换目录
```

输出目录（默认 `paper/data/public/synthetic/`）：

| 文件 | 内容 |
|---|---|
| `manifest.json` | 数据集 id、seed、生成器版本、规则包版本、结论分布 |
| `solutions/<id>.md` | 100 份 Markdown 方案（`syn-hist-01..30` 按历史结论分布 15/14/1，`syn-rand-01..70` 随机） |
| `truth.json` | 每份的 `expectedVerdict` 与 `defects[]`（`ruleId / severity / plantedKind`）与特性开关 |
| `selfcheck.json` | 自检：满足句不触发任何 hard/hybrid 问题（`violations` 必须为空）+ 每种植入类型的 检出 / 待人工 / 漏检 |

同一 seed 生成结果逐字节一致（T-EVA-04）。

## 2. 消融

```bash
pnpm run eval:ablation                              # 无 adapter：只跑 B0 / S-full / S-verifier（flag judge），其余标 skipped
pnpm run eval:ablation -- --adapter ./my-adapter.mjs --repetitions 3
pnpm run eval:ablation -- --dataset paper/data/public/real --out paper/data/public/real-runs
pnpm run eval:ablation -- --ablations B0,S-full     # 只跑指定配置
```

输出（默认 `paper/data/public/`）：`eval-runs/<runId>.json`（每配置 × 每次重复一条 `eval_runs` 记录：config / metrics / perRule / perSolution）、`summary.md`（指标表 + 与 S-full 的配对检验）、`skipped.json`。

`--adapter` 指向一个 ESM 模块，默认导出 `{ model: string, complete(messages, { temperature }) => Promise<string> }`（或返回它的工厂函数）。插件本体不含任何模型客户端；adapter 由运行者自备，例如在 DSH 内包一层 `ctx.llm`，或者自己写 10 行 fetch。模型名随 adapter 报告写入 `eval_runs.config.model`，提示词哈希写入 `promptHash`（提示词见 `src/eval/prompts.ts`）。带 adapter 时 hybrid 判定、B1 全文直审、S-policy 结论都走模型，温度固定 0。

## 3. 用真实数据集替换合成集

按 `docs/evaluation.md` §2.5 的目录协议准备：

```
<dir>/
  manifest.json        { "id": "...", "generatedBy": "manual", "rulePackVersion": "...", "minorThreshold": 3, "counts": {...} }
  solutions/<id>.md
  truth.json           [{ "id", "expectedVerdict", "defects": [{ "ruleId", "severity" }] }]   # plantedKind 可省略
```

`truth.json` 的问题级真值来自看板导出的专家反馈（采纳 / 改写 = 真问题，专家新增 = 漏检），结论级真值为 `final_verdict`。然后 `pnpm run eval:ablation -- --dataset <dir> --out <out>`。

## 4. 脱敏后再公开

```bash
# 词典与映射都在 paper/data/private/（已 gitignore）
pnpm run eval:anonymize -- --in paper/data/private/real --out paper/data/public/real --dict paper/data/private/dictionary.json
```

`dictionary.json` 字段：`fixed`（原名 → 别名）、`provinces`、`thirdParties`、`services`、`tables`、`codes`、`reviewers`、`dateShiftDays`。脚本输出脱敏副本并做泄漏扫描（命中任何禁用词即非零退出），映射表写到词典同目录的 `mapping.json`，不得入库。

## 5. 当前已有结果（2026-10-29，确定性配置）

`paper/data/public/summary.md`；要点：B0 F1 0.222 / 结论准确率 28% / κ −0.04；S-full（flag judge）P 1.000 / R 0.664 / F1 0.798 / 结论准确率 85% / κ 0.76；S-verifier 在确定性 judge 下与 S-full 等价；B1 / S-gate / S-policy 待带 adapter 本地跑。

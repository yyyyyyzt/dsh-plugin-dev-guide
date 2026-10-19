# archive/ — 归档区

本目录存放**不再维护、但保留作为资产或证据**的内容。归档内容不参与构建、测试和发布；新代码不得 import 这里的任何文件。

## legacy-review-tool/（2026-08 旧版「网上国网技术方案 AI 审查工具」演示）

Python FastAPI + 单页 HTML 的旧版原型，与本仓库的 DSH 插件指南没有功能关系，已被 `plugins/wsgw-solution-review/`（DSH 插件重做版）取代。保留原因与复用方式：

| 路径 | 性质 | 对新版的价值 |
|---|---|---|
| `data/eval/review_records.json` | **30 条真实历史评审意见**（方案号、标题、结论、分点） | 核心资产。新版评测集与「意见点 → 规则」对齐的原始材料，迁移时需逐条经专家在对话中确认 |
| `data/seed-solution.md` | 种子方案《余额查询能力对 AI 版支付宝开放》Markdown | 新版第一份测试 fixture 与演示输入 |
| `rules/capability-open-access-rules.json` | 24 条规则包 V0.1（8 维度） | 规则**语义**可复用；`check_method`/关键词机制整体废弃，需按新版规则 schema 重写并收紧 |
| `knowledge/*.md` | 4 篇维度经验样例 | 可改写为规则的 `rationale` / 少样本示例 |
| `技术方案AI审查工具-开发需求.md`、`design.md`、`progress.md` | 旧版需求 V0.1 / 设计 V0.2 / 进度 | 仅作历史记录。三份文档之间互相矛盾（向量库取舍、软著说明书、评测完成度），**不要**再以它们为准 |
| `src/`、`web/`、`scripts/*.py` | 旧实现 | 不复用。已知缺陷：硬检查只做子串匹配、证据列表恒空、结论完全由模型决定、评测用 mock 数据、缺 `config.yaml` 无法启动 |
| `data/ledger/*` | 台账 mock | 已决定不进入审查产品范围 |
| `data/eval/golden_set.json` | 3 条占位评测样本 | 无效（正文为占位文本），不迁移 |

详细的问题清单与重做决策见仓库根 `AGENTS.md` 的「历史与决策」一节。

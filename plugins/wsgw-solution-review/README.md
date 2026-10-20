# wsgw-solution-review

网上国网技术方案 **AI 预审** 的 DeepSeek Harness（DSH）插件：专家提交 Markdown 方案，AI 依据规则给出带原文证据的问题建议（通过 / 建议整改 / 不通过），专家在对话里逐条采纳、驳回、改写后定稿，决定回流为规则统计与范例。**AI 只预审，不裁决。**

设计、规则模型、对话协议与评测方案见 [`docs/`](./docs/)；项目进度与决策见仓库根目录 [`progress.md`](../../progress.md)。

## 安装（一条命令）

前提：Node.js ≥ 22.19、pnpm 10+，并且已经用 `npx @deepseek-ai/dsh web` 启动过一次（会生成 `web` profile）。

```bash
# 在本目录执行：安装依赖 → 构建 lib/ → 装进 web profile
pnpm dsh:install
```

等价的手工命令：

```bash
pnpm install && pnpm run build
npx @deepseek-ai/dsh plugin --profile web add <本目录的绝对路径>
```

安装后重启 `npx @deepseek-ai/dsh web`。验证：

```bash
pnpm dsh:verify          # = npx @deepseek-ai/dsh --profile web --dump-config，应出现 wsgw-solution-review 与 preset-wsgw-solution-review 两行
```

卸载：`npx @deepseek-ai/dsh plugin --profile web remove wsgw-solution-review`。

## 装好之后有什么

| 面 | 内容 |
|---|---|
| Agent 预设 | 新建会话的模式下拉里多出 **方案审查**：persona（铁律：只建议、不编造引文、不编造规则）+ 文件/终端/技能/提问/待办/`present` 工具 + 本插件 9 个审查工具 |
| 工具（仅方案审查预设可见） | `review_parse` `review_check` `review_record_issue` `review_status` `review_decide` `review_finalize` `rules_list` `rules_propose` `memory_recall` |
| 命令（host 侧即时查询，不经模型） | `/review [编号]` 审查记录与三层摘要；`/rules [维度\|层级]` 生效规则表；`/memory <规则号>` 某条规则的采纳统计、范例与最近驳回原因 |
| 技能 | `wsgw-solution-review`：预审 → 复核 → 定稿与回流 三阶段 SOP，模型与 `/skill` 均可调用 |
| 规则包 | `rules/capability-open-access.rules.yaml`：28 条（hard 10 / hybrid 13 / soft 5） |
| 存储 | storage domain `wsgw_solution_review` v1：reviews / issues / feedback / exemplars / rule_overrides / rule_candidates / eval_runs |

Word / PDF 转 Markdown、Markdown 转 Word 等能力不在本插件内，按 DSH 原生 office 技能或其他插件解决。

## 配置

写在 profile 的 `cordis.patch.yml`（`$DSH_HOME/profiles/web/cordis.patch.yml`）里覆盖 id 为 `wsgw-solution-review` 的行，字段与默认值：

| 字段 | 默认 | 说明 |
|---|---|---|
| `rulesDir` | `null`（随包规则） | 规则包目录，`*.rules.yaml` |
| `outputDir` | `reviews` | 正式意见文件输出目录（相对工作目录） |
| `minorThreshold` | `3` | minor 累计达到该数视作一条 major |
| `askBatchSize` | `5` | 复核时每批向专家提问的问题数 |
| `rejectWarnRatio` / `rejectWarnMinSamples` | `0.6` / `5` | 「常被驳回」告警阈值 |
| `exemplarsPerRule` | `20` | 每条规则保留的范例上限 |
| `maxSourceBytes` | `204800` | 单份方案大小上限 |
| `presentOnFinalize` | `true` | 定稿后由 agent 调用 `present` 展示意见 |
| `defaultReviewer` | `''` | 默认审核人；为空则复核前问一次 |

## 开发

```bash
pnpm install        # 同时触发 prepare → build
pnpm test           # vitest：引擎 + 存储 + 工具 + host 契约
pnpm typecheck
pnpm bench          # 200 KB 文档 check() 耗时
```

工程约定：先文档（`docs/`）→ 再测试（`tests/`，用例以 T-ID 对应各文档末尾的「测试要点」）→ 后实现（`src/`）。共享的 `@deepseek-ai/*` 包同时写在 `peerDependencies` 与 `devDependencies`，运行时由 DSH 的安装副本解析。

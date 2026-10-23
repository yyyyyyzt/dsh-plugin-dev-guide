# 看板规格 V1.0（右侧 Sidebar tab「方案审查」）

> 状态：S1 定稿候选（2026-10-19）；2026-10-23 用户决定改为**可写**。看板是复核面：看规则 / 记录 / 记忆 / 评测，并可调整规则、审批候选、做复核决定；写操作统一走 `ReviewStore` 写入口，沿用 DSH 鉴权，细粒度权限后置。实现为 DSH Web 右侧 Sidebar 的一个扩展 tab（`ctx.sidebarRightTabs` + `sidebar.right.pane.tab`），数据来自 `design.md` §10 的读写路由。
> 不建独立前端工程、不自建路由、不引入 UI 框架之外的组件库；复用 DSH client 的主题变量与设置卡片。

## 1. 注册

```ts
// src/client/index.ts
export const name = 'wsgw-solution-review/client'
export const inject = ['slots', 'sidebarRightTabs', 'locale']

export function apply(ctx) {
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'wsgw-solution-review',
    kind: 'wsgw-review',
    priority: 'extension',
    title: () => '方案审查',
    keepMounted: true,
    guide: { order: 50, title: () => '方案审查看板', description: () => '规则 · 审查记录 · 记忆 · 评测' },
  }), 'review tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: 'wsgw-solution-review' }, ReviewDashboard,
  )), 'review tab body')
  // settings.plugin.item 卡片：见 §6
}
```

- 页面类 tab（无 `patterns`），通过引导页入口框或 `openTab('wsgw-review')` 打开；chip 标题固定「方案审查」。
- `keepMounted: true`：切会话不丢筛选状态。
- 四页为 tab 内部的分段切换（本地 state），不是四个 Sidebar tab。

## 2. 信息架构

```
方案审查
├─ 规则        生效规则表 + 规则详情抽屉
├─ 审查记录    列表 → 详情（三层 + 复核轨迹 + 正式意见预览）
├─ 记忆        规则级采纳率 / 范例 / 候选规则 / 学习曲线
└─ 评测        eval_runs 列表 → 一轮详情（消融对比表）
```

顶部常驻：数据刷新按钮（`tab.actions.bindCommands({ refresh })`）、最近刷新时间、后端不可达提示。

## 3. 各页规格

### 3.1 规则

数据：`GET /plugins/wsgw-solution-review/api/rules`。

| 区域 | 内容 |
|---|---|
| 筛选 | 维度（8）、tier（3）、状态（active / draft / retired）、文本搜索（id / 标题） |
| 表格列 | id、标题、维度、severity、tier、状态、shown、采纳率（adopt+rewrite / shown）、驳回率、来源（shipped / learned）、最后变更 |
| 行标记 | 驳回率 ≥ `rejectWarnRatio` 且 shown ≥ `rejectWarnMinSamples` → 行尾「常被驳回」标记；override 覆盖过的字段加下划线并 hover 显示 shipped 原值 |
| 详情抽屉 | question / rationale / suggestion / applicability / verifier（YAML 高亮只读）/ 近 5 条审计 / 近 5 条范例 / 操作：启用 / 停用、严重级别下拉、可白名单参数编辑（families / minChars / whenNoCandidate 等） |
| 空状态 | 「规则包未加载」+ 加载错误列表（`design.md` §12） |

### 3.2 审查记录

数据：`GET /reviews?limit&offset&status`、`GET /reviews/:id`。

| 区域 | 内容 |
|---|---|
| 列表列 | reviewId、标题、aiVerdict（预审）、finalVerdict、状态（open / finalized）、审核人、开始时间、时长、问题数（确认 / 待人工 / 新增） |
| 筛选 | 状态、结论、审核人、时间范围 |
| 详情：结论层 | aiVerdictAtFinalize vs finalVerdict 并排；差异高亮；`verdictDelta` 说明 |
| 详情：明细层 | 问题表：规则号、级别、来源（verifier / llm / expert）、状态、门禁结果（reason）、证据引文（可展开看章节与行号）、建议、专家决定（adopt / reject / rewrite + 原因 / 改写文） |
| 详情：清单层 | 28 条规则逐条状态 |
| 详情：正式意见 | 渲染 opinion Markdown（只读）；版本切换；文件路径复制 |
| 详情：指标 | 工具调用数、门禁拒绝数、时长 |
| 操作 | 每条问题：采纳 / 驳回 / 改写（改写填文本与原因）；审核人；最终结论确认；另有「回到对话」链接（有 `sessionId` 时） |
| 空状态 | 「还没有审查记录。在「方案审查」agent 会话里粘贴一份方案开始。」 |

### 3.3 记忆

数据：`GET /memory`。

| 区域 | 内容 |
|---|---|
| 学习曲线 | 折线：按 finalize 序号的滑动采纳率（窗 5）；叠加驳回率；样本 < 5 时显示「样本不足」 |
| 规则级精确率 | 条形：每条 shown ≥ 1 的规则的采纳率，按 tier 分色；点击跳规则详情 |
| 范例 | 按规则分组的措辞范例列表（kind: adopt / rewrite、来源 reviewId、时间）；搜索 |
| 候选规则 | 列表：文本、来源 reviewId、状态（new / drafted / accepted / dismissed）、草案预览（有则显示 YAML）；操作：accept / dismiss；起草仍由对话里的 agent 产生 YAML |
| 升级提示 | soft 规则 shown ≥ 10 且采纳率 ≥ 0.8 → 「可考虑升级为 hybrid」提示（只读） |
| 空状态 | 「记忆为空：完成第一次定稿后出现。」 |

### 3.4 评测

数据：`GET /eval`。

| 区域 | 内容 |
|---|---|
| 运行列表 | runId、配置代号（B0 / B1 / S-full / S−…）、数据集、模型、重复序号、时间、P / R / F1 / kappa |
| 一轮详情 | 指标卡（`evaluation.md` §4 全部）、3×3 混淆矩阵、规则级 P/R 表、按方案明细（可按 F1 排序） |
| 对比视图 | 选 2–7 个 run 并排：F1 / 加权召回 / kappa 条形 + CI 误差线 |
| 空状态 | 「尚无评测结果。运行 `pnpm run eval:ablation`（见 evaluation.md §5）。」 |

## 4. 数据与刷新

- 所有数据经 `fetch` 同源路由；写操作成功后重新拉取当前页聚合（不依赖跨浏览器推送）；失败显示错误条与重试；不缓存到 localStorage（数据可能含方案片段）。
- 刷新：手动 + 打开 tab 时 + 可选 60 s 轮询（设置项 `dashboardPollSeconds`，0 关闭）。`domain/changed` 是 Host 进程内事件，不跨到浏览器，因此不依赖推送。
- 分页：记录列表 50 条 / 页。

## 5. 交互边界（可写）

看板提供：规则启停 / 严重级别 / 白名单参数、候选规则 accept / dismiss、问题采纳 / 驳回 / 改写、审核人与最终结论。所有写操作复用 `ReviewStore` 的同一方法（与 `rules_propose` / `review_decide` 等价），不另写一套业务逻辑；每次写操作记录 `who`（DSH 用户）/ `when` / `reviewId` 审计。

看板**不**提供：删除审查记录、直接编辑正式意见正文。需要重新出意见时回到对话调用 `review_finalize` 重新渲染。

鉴权：写路由必须同源（`Origin`/`Host`）+ DSH Web 鉴权；当前 profile 用户即可写。细粒度权限（只读账号 / 审批人 / 规则管理员）与 CSRF token 后置，等局域网多人使用时再加。

## 6. 设置卡片（`settings.plugin.item`）

字段（与 `design.md` §11 一致）：`minorThreshold`（数字 1–10）、`askBatchSize`（1–10）、`rejectWarnRatio`（0–1）、`presentOnFinalize`（开关）、`defaultReviewer`（文本）、`outputDir`（文本，相对工作目录）、`dashboardPollSeconds`（0 / 30 / 60）。用 `ctx.settingsScope.bind('wsgw-solution-review')` 读写；保存即生效。

## 7. 视觉与可用性

- 使用 DSH client 主题 CSS 变量（颜色、字号、间距），无自定义主题。
- 结论三色：通过 = success、建议整改 = warning、不通过 = danger（取主题语义色）。
- 表格支持键盘导航与 `aria-sort`；证据引文使用 `<blockquote>` 并标注章节与行。
- 宽度 < 480px 时表格切为卡片列表。
- 中文为主，`locale` 预留英文词条（S4 只填中文）。

## 8. 构建与校验

- `tsdown.config.ts` 按 `docs/plugin-frontend.md` §9.3 模板：entry `src/client/index.ts` → `lib/client.js`，banner / footer 封装，外部化 `react`、`react-dom`、`@deepseek-ai/dsh-client-*`。
- `tests/client/check-bundle.mjs`：存在性、banner 以 `window.__ModuleLoader__.load({ id: "wsgw-solution-review"` 开头、footer、`require(` 的外部包都在白名单、未内联 React。
- 页面在 `pnpm dsh web` 中手测并录屏（S4 证据）。

## 9. 测试要点（供 S2 / S4）

| ID | 要点 |
|---|---|
| T-DSH-01 | tab 注册：`id`、`kind`、`guide` 字段快照；重复注册抛错由框架保证（不测） |
| T-DSH-02 | 四页在空数据下渲染各自空状态文案 |
| T-DSH-03 | 规则页筛选与「常被驳回」标记逻辑（纯函数：`markFrequentlyRejected(stats, cfg)`） |
| T-DSH-04 | 记录详情：aiVerdictAtFinalize ≠ finalVerdict 时高亮；清单 28 行 |
| T-DSH-05 | 记忆页滑动采纳率计算（纯函数，窗 5，样本不足判定） |
| T-DSH-06 | 评测对比视图选择 2–7 个 run 的约束 |
| T-DSH-07 | 路由失败 → 错误条 + 重试；非 JSON 响应不崩溃 |
| T-DSH-08 | check-bundle 脚本全部断言 |
| T-DSH-09 | 设置卡片字段范围校验（minorThreshold 1–10 等） |
| T-DSH-10 | 写路由：同源 + 鉴权通过才写；跨源 / 未授权返回 403 / 401；写后审计字段与聚合刷新 |
| T-DSH-11 | 规则停用 / 级别 / 参数写后下一次 `review_check` 生效（与 `rules_propose` 同断言） |

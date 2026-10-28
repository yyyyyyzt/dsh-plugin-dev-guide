# 看板规格 V2.0（左侧栏「方案审查」主面板 + 右侧栏「复核助手」）

> 状态：S1 定稿（2026-10-19）；2026-10-23 改为**可写**；2026-10-27 按 `dsh-v0.2.1-rc.2` 源码复核注册方式；**2026-10-28 按用户反馈重做交互**：总览与全局规则管理移到左侧栏入口打开的主面板，右侧栏只保留对话手边的复核。
> 看板是对话之外的**复核面**：一眼看到审查量与结果、点开任一方案就地复核、维护全局规则。起草规则 YAML 与定稿（写文件 + `present`）仍留在对话里。
> 全部用 DSH 现成席位：左侧栏 `sidebar.panellist` + 布局 `main` keyed slot（与 DSH 自带「定时任务」「插件」页同一机制）、右侧栏 `sidebarRightTabs` + `sidebar.right.pane.tab`；数据来自 `design.md` §10 的同源路由。不建独立前端工程、不自建路由、不引入组件库或图表库；样式只用 DSH 主题 CSS 变量。

## 1. 两个入口，各管一件事

| 入口 | 位置 | 管什么 | 不管什么 |
|---|---|---|---|
| **方案审查**（主面板） | 左侧栏全局面板行（与「定时任务」「插件」并列），点开占据中间主区域 | 全局：审查量趋势、全部方案及其结果（点开就地复核）、全局规则与候选规则、评测 | 不发起审查、不定稿 |
| **复核助手**（右侧栏 tab） | 右侧栏引导页「方案审查 · 复核助手」 | 当前：进行中 / 需重新定稿的审查，边和 agent 对话边逐条采纳 / 驳回 / 改写 | 不放规则、记忆、评测、历史统计（一律到主面板） |

两者读写同一组路由、复用同一个复核组件（§3.3），所以在任一处的操作，另一处刷新后一致。

## 2. 注册

```tsx
// src/client/index.tsx（Client 插件：package.json `dsh.client` + exports["./client"]）
export const name = 'wsgw-solution-review'
export const inject = ['slots', 'sidebarRightTabs', 'layout']
export const PANEL_ID = 'wsgw-solution-review'          // MainPanelId：panellist id = main key

export function apply(ctx) {
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, OverviewPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: () => '方案审查' }, PanelIcon,
  ))
  ctx.effect(() => ctx.sidebarRightTabs.register(TAB_DEFINITION), 'wsgw-solution-review: assistant tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: TAB_ID,
    inject: () => ({ openOverview: () => ctx.layout.selectPanel(PANEL_ID) }),
  }, ReviewAssistant))
}
```

- **左侧栏**：`sidebar.panellist` 是 root 作用域 list，`id` 同时寻址 `main` keyed slot 的同名条目；侧栏负责按钮、选中态与标签（`label`），本包只给 16/18px 图标（内联 SVG，`currentColor`，不依赖 DSH 图标库——它不在 bundle 外部化白名单里）。`order: 30` 排在「定时任务」（10）之后。主面板不绑定 Session；点侧栏任一会话即回到对话。
- **右侧栏**：`TAB_DEFINITION = { id: 'wsgw-solution-review', kind: 'wsgw-review', priority: 'extension', keepMounted: true, title: () => '复核助手', guide: [{ id: 'assistant', order: 50, title: () => '方案审查 · 复核助手', description: () => '进行中的审查 · 采纳 / 驳回 / 改写' }] }`。`guide` 在 0.2.1 源码中是数组。
- `package.json` 的 `dsh.client.inject` 列出 `dsh-client-ui-layout`、`dsh-client-ui-sidebar`、`dsh-client-ui-sidebar-right`，只保证脚本到达顺序；服务依赖由 Cordis `inject` 表达，`slots.inject` 对声明先后不敏感。
- 页签、筛选、展开都是组件内 state，不是多个 Sidebar tab 或多个 main 面板。

## 3. 主面板「方案审查」

版式沿用 DSH 一级页面（「插件」「定时任务」）：内容列最大 960px 居中、左右 `clamp(24px, 4vw, 48px)`、标题行上内边距 28px（macOS 额外加 `--dsh-frame-top-clearance`）、标题 20px / 28px / 500、胶囊式页签与筛选。

```
方案审查                                            [刷新]
AI 只建议 · 专家定稿
[审查] [规则] [评测]
```

默认页签「审查」。

### 3.1 审查（总览 + 全部方案）

数据：`GET /overview`（全部审查的紧凑摘要，§10 of design）；展开某行时 `GET /reviews/:id`。

**① 指标卡**（一行五张，窄屏换行；点击可作为筛选）：

| 卡 | 口径 |
|---|---|
| 累计审查 | 全部记录数（超出上限时注「仅统计最近 N 条」） |
| 近 30 天 | 创建时间在今天往前 30 天内（含今天）的记录数 |
| 待处理 | 进行中 + 需重新定稿；副文「需重新定稿 k」。点击 → 状态筛选「待处理」 |
| 问题采纳率 | Σ(采纳 + 改写) / Σ(采纳 + 改写 + 驳回)，跨全部记录；无决定显示「—」。改写算采纳（问题成立、措辞调整） |
| 结论一致率 | 已定稿且有最终结论的记录中，定稿时预审结论 = 最终结论的比例；副文样本数 |

**② 审查量图**（卡片，右上角分段切换「日历 / 趋势」）：

- **日历**：GitHub 式热力图，最近 53 周，列 = 周（周一在上），行 = 星期；每格 = 当天**发起**的审查数（按浏览器本地时区取日期）；颜色 5 级（0 用 `--dsw-alias-label-primary` 的 7% 混色——`bg-layer-2` 在浅色主题下与卡片底色无法区分，1–4 级用 `--dsw-alias-brand-primary` 的 25 / 50 / 75 / 100% 混色，级别 = ⌈count / max × 4⌉）；今天之后的格子留空；列上方标月份、左侧标「一 / 三 / 五」；右下图例「少 □□□□□ 多」。悬停提示「10月27日 · 3 份（已定稿 2）」。**点击某天 → 列表只看这一天**（再点同一天或点筛选条上的 × 取消）。SVG 为 `role="group"`（`aria-label` 概述总数），每个格子是带 `aria-label` 的 `role="button"`——格子可点击，不能用 `role="img"` 把它们藏起来。
- **趋势**：最近 30 天折线，两条线——发起数、定稿数（按 `finalizedAt` 日期）；纵轴从 0 到 max(1, 最大值)；横轴标首 / 中 / 末日期（M/D）；数据点带悬停提示。纯 SVG（`viewBox` 自适应宽度，`role="img"` + `aria-label` 概述两条线的合计），不引入图表库。
- 无任何记录时卡片内显示空状态文案。

**③ 方案列表**：

| 区域 | 内容 |
|---|---|
| 筛选条 | 状态胶囊：全部 / 待处理 / 进行中 / 需重新定稿 / 已定稿；结论下拉：全部结论 / 通过 / 建议整改 / 不通过（按「最终结论，未定则预审建议」）；搜索框（标题 / reviewId / 审核人）；选中的日期以胶囊显示「10月27日 ×」；右侧显示「n / 总数」 |
| 行（可点击，整行是按钮，`aria-expanded`） | 日期（M/D HH:mm）· 方案标题 · 预审建议（三色）· 最终结论（未定显示「未定」）· 问题计数（只列非零项：「待复核 n · 采纳 a · 驳回 r · 改写 w」，无问题显示「无问题」；悬停显示全部计数）· 状态胶囊（需重新定稿为警示色）· 展开箭头 |
| 展开 | 行下方就地展开该方案的完整结果（§3.3 复核组件）：结论与依据、逐条问题（证据、建议、采纳 / 驳回 / 改写）、署名与最终结论、正式意见版本、检查清单（折叠）。同一时刻只展开一行；写操作后同时刷新该行详情与总览数据 |
| 分页 | 一次显示 50 行，底部「显示更多（剩余 N）」 |
| 空状态 | 无记录：「还没有审查记录。在「方案审查」agent 会话里粘贴一份方案开始。」；有记录但筛选为空：「当前筛选下没有方案。」 |

### 3.2 规则（全局规则 + 候选 + 记忆）

数据：`GET /rules`、`GET /memory`（候选与每条规则的近 5 次采纳率）；展开时 `GET /rules/:id`。记忆按规则号组织（决策 1），所以并入规则行，不再单独成页。

| 区域 | 内容 |
|---|---|
| 工具条 | 维度（8 个，与引擎 `Dimension` 一致）/ 层级 / 状态下拉；搜索（规则号 / 标题）；「只看已覆盖」胶囊；右侧「n / 28 条 · 规则包 version」 |
| 候选规则（有未处理候选时显示在表格上方） | 每条：意见原文、来源 reviewId、建议维度、状态；`drafted` →「接受草案 RULE-ID」「忽略」；`new` →「忽略」并提示「回到对话请 agent 起草」 |
| 表头 + 行（整行可点击展开） | 规则号 · 标题 · 维度 · 层级 · 级别（三色）· 状态 · 采纳率 · 展示次数（「89% · 18」，无记录「—」；悬停显示展示 / 采纳 / 驳回 / 改写）· 标记「已覆盖」「常被驳回」 |
| 展开：内容 | 检查问题、依据、适用范围、校验器（折叠的只读 JSON）、来源 |
| 展开：编辑（全局生效，写 learned 层，审计 `who:'dashboard'`） | 状态开关（启用 / 停用；草案规则另有「接受草案」走候选流程）；严重级别下拉；**整改建议**多行文本框 +「保存建议」（空白不可保存，最长 500 字）；有覆盖时显示「出厂值 → 当前值」对照与「恢复出厂」（两步确认：点一次出现「确认恢复 / 取消」，不用 `window.confirm`）；最近变更（审计最近 10 条，新的在上，字段名显示为中文：状态 / 级别 / 整改建议 / 参数 / 草案） |
| 展开：记忆 | 展示 / 采纳 / 驳回 / 改写、近 5 次定稿采纳率（决定 < 5 显示「样本不足」）、措辞范例与最近驳回原因（相同文本合并为一行并标「×n」） |
| 加载错误 | `loadErrors` / `warnings` 以提示条显示（`design.md` §12） |

可编辑字段只限 learned 层白名单：状态、严重级别、整改建议（以及只在对话里改的校验器参数）。检查问题、依据、适用范围、校验器结构**不在看板改**——改了就是另一条规则，应在对话中由 agent 起草新规则（`rules_propose draft`）并接受。

「常被驳回」= `reject / shown ≥ 0.6` 且 `shown ≥ 5`（与 `memory_recall.warn` 默认阈值一致）。

### 3.3 复核组件（主面板展开行与复核助手共用）

| 区域 | 内容 |
|---|---|
| 头部 | 标题、状态、reviewId、规则包版本；`status=open` 且已有版本时警示「定稿后决定已变更，旧意见文件已过期：需回到对话重新定稿」 |
| 结论 | 当前预审建议 vs 最终结论；定稿时预审 ≠ 最终时高亮差异；`basis` 一句话依据 |
| 问题 | 每条：规则号（专家新增显示「专家」）、级别、状态、来源、门禁未过原因、证据引文（`absence` 显示「未提及」不加引号）、建议（改写后显示改写文与原建议）。未决定的（`confirmed` / `pending`）给「采纳」（`pending` 显示「确认为问题」）/「驳回」（行内原因输入）/「改写」（行内文本框，预填原建议） |
| 署名与最终结论 | 审核人输入 + 保存；最终结论下拉（预审建议项标「推荐」）+ 确认；无审核人时提示 |
| 正式意见 | 版本列表（路径、时间）；未定稿提示「定稿在对话中完成」 |
| 检查清单 | 默认折叠（`<details>`），展开为逐行规则号 / 状态 / 备注 + 各状态计数 |

### 3.4 评测

数据：`GET /eval-runs`、`GET /eval-runs?ids=…`。运行列表（runId、时间、数据集、P / R / F1 / kappa）；勾选 2–7 个 → 指标对比表；空状态「尚无评测结果。运行离线评测脚本后在此查看（evaluation.md §5）。」

## 4. 右侧栏「复核助手」

数据：`GET /overview`（取状态为进行中 / 需重新定稿的记录，按创建时间倒序）+ `GET /reviews/:id`。

| 区域 | 内容 |
|---|---|
| 头部 | 「复核助手」·「刷新」·「打开总览」（`ctx.layout.selectPanel(PANEL_ID)`，切到主面板） |
| 选择 | 多于一条待处理时显示下拉（标题 · 日期 · 状态），默认最新一条 |
| 主体 | §3.3 复核组件（窄栏排版：按钮换行、清单折叠） |
| 空状态 | 「没有待处理的审查。在「方案审查」会话里粘贴方案开始；历史记录与规则见左侧栏「方案审查」。」+「打开总览」 |

## 5. 数据与刷新

- 所有数据经 `fetch` 同源路由（`credentials: 'same-origin'`）；写成功后重新拉取受影响的数据（展开行详情 + 总览 / 规则列表 + 规则详情）。
- 刷新时机：打开面板 / 切换页签、手动点刷新、写操作之后。**不轮询**；`domain/changed` 是 Host 进程内事件，不跨到浏览器。专家在对话里做了决定后点刷新即可。
- 日期分桶在浏览器按本地时区计算（Host 只给 ISO 时间戳），因此局域网内不同时区的用户各自看到本地日期。
- 失败：错误条 + 重试；响应非 JSON（如被代理改写成 HTML）不崩溃，提示 HTTP 状态。
- 不写 localStorage / sessionStorage（数据可能含方案片段）。

## 6. 交互边界

看板提供：问题采纳 / 驳回 / 改写、审核人、最终结论；规则启停 / 严重级别 / 整改建议 / 恢复出厂；候选规则接受草案 / 忽略。所有写操作复用 `ReviewStore` 的同一方法（与 `review_decide` / `rules_propose` 等价），审计 `who:'dashboard'`。

看板**不**提供：发起审查、删除审查记录、编辑正式意见正文、起草规则 YAML、修改规则的检查问题 / 依据 / 适用范围 / 校验器结构、定稿。

鉴权：DSH 连接围栏（`ctx.connection.requestRejection`）+ 同源校验。细粒度权限与 CSRF token 后置。

## 7. 视觉

- 颜色、边框、背景只用 DSH 主题变量：`--dsw-alias-label-primary/secondary/tertiary`、`--dsw-alias-border-l2/l3`、`--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1/2`、`--dsw-alias-interactive-bg-hover`、`--dsw-alias-brand-primary`、`--dsw-alias-state-success/warn/error-primary`；圆角 `--dsw-radius-sm`；热力图分级用 `color-mix(in srgb, var(--dsw-alias-brand-primary) N%, transparent)`，空格子用 `color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)`。悬停与焦点环需要选择器，用组件内一段 `<style>`（类名前缀 `wsgw-`，同样只引用主题变量）。无硬编码色值（深色主题可用）。
- 结论三色：通过 = success、建议整改 = warn、不通过 = error；严重级别 blocker = error、major = warn、minor = 次要文字色。
- 证据引文用 `<blockquote>`；按钮有可读文字；趋势图 `role="img"` + `aria-label`，日历 `role="group"` + 可点击格子的 `aria-label`（§3.1）。
- 文案只有中文。

## 8. 构建与校验

- `tsdown.config.ts`：entry `src/client/index.tsx` → `lib/client.js`，CJS 工厂，banner `window.__ModuleLoader__.load({ id: "wsgw-solution-review", factory: (require) => {`、footer `return module.exports; } });`，外部化 `react`、`react-dom`、`@deepseek-ai/cordis`。
- `tests/client/check-bundle.mjs`：存在性、banner / footer、`require(` 的外部包都在白名单、未内联 React。
- 页面在用户本机 `dsh web` 中手工冒烟（清单见 `progress.md` §7）。

## 9. 测试要点

| ID | 要点 |
|---|---|
| T-DSH-01 | 注册：`main` keyed 条目与 `sidebar.panellist` 条目共用 `PANEL_ID`、`order`、`label()`；右栏 tab 定义（`keepMounted`、`guide` 数组）；`inject` 含 `layout`；右栏正文的 `openOverview` 调用 `ctx.layout.selectPanel(PANEL_ID)` |
| T-DSH-02 | 主面板三页签与复核助手在空数据下渲染各自空状态（`react-dom/server`） |
| T-DSH-03 | 规则筛选按引擎维度 + 搜索 + 只看已覆盖；「常被驳回」判定 |
| T-DSH-04 | 复核组件：定稿预审 ≠ 最终时高亮；清单 28 行；`absence` 证据不加引号；需重新定稿提示；未决定问题才有操作 |
| T-DSH-05 | 规则展开：近 5 次采纳率与样本不足；候选按状态给出操作；有覆盖才出现「恢复出厂」，草案规则没有 |
| T-DSH-06 | 评测对比选择 2–7 个 run 的约束 |
| T-DSH-07 | 请求封装：非 JSON 响应、错误体 `message`、HTTP 状态回退 |
| T-DSH-08 | check-bundle 脚本全部断言 |
| T-DSH-10 | 写路由：同源 + 连接围栏通过才写；跨源 / 未授权返回 403 / 401；写后审计 |
| T-DSH-11 | 规则停用 / 级别 / 建议写后下一次 `review_check` / `review_record_issue` 生效 |
| T-DSH-12 | 不使用 localStorage / sessionStorage / `window.prompt` / `window.confirm`（源码断言） |
| T-DSH-13 | 日历：53 列 × 7 行、周一起、今天之后为空、级别分档、按本地日期分桶、点击日期筛选列表 |
| T-DSH-14 | 趋势：最近 30 天两条序列（发起按 `createdAt`、定稿按 `finalizedAt`），跨天边界正确 |
| T-DSH-15 | 指标卡：累计、近 30 天、待处理（含需重新定稿）、问题采纳率（改写算采纳、无决定为空）、结论一致率（只计已定稿且有最终结论） |
| T-DSH-16 | 列表筛选：状态（含「待处理」）、结论（最终优先）、搜索、日期；展开一行渲染复核组件 |
| T-DSH-17 | 复核助手只列进行中 / 需重新定稿，默认最新；无待处理时显示空状态与「打开总览」 |

# 看板规格 V1.1（右侧 Sidebar tab「方案审查」）

> 状态：S1 定稿（2026-10-19）；2026-10-23 用户决定改为**可写**；2026-10-27 按 `dsh-v0.2.1-rc.2` 源码复核注册方式、去掉设置卡片与轮询。
> 看板是对话之外的**复核面**：看规则 / 审查记录 / 记忆 / 评测，并可调整规则、审批候选、对问题做采纳 / 驳回 / 改写、署名与确认最终结论。起草规则 YAML 与定稿（写文件 + `present`）留在对话里。
> 实现为 DSH Web 右侧 Sidebar 的一个扩展 tab，数据来自 `design.md` §10 的同源路由。不建独立前端工程、不自建路由、不引入组件库；样式只用 DSH 主题 CSS 变量。

## 1. 注册

```tsx
// src/client/index.tsx（Client 插件：package.json `dsh.client` + exports["./client"]）
export const name = 'wsgw-solution-review'
export const inject = ['slots', 'sidebarRightTabs']

export function apply(ctx) {
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'wsgw-solution-review',
    kind: 'wsgw-review',
    priority: 'extension',
    keepMounted: true,
    title: () => '方案审查',
    guide: [{ id: 'dashboard', order: 50, title: () => '方案审查看板', description: () => '规则 · 审查记录 · 记忆 · 评测' }],
  }), 'wsgw-solution-review: tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: 'wsgw-solution-review' }, Dashboard,
  )), 'wsgw-solution-review: dashboard body')
}
```

- 页面类 tab（无 `patterns`）：在右侧栏引导页点「方案审查看板」打开；chip 标题固定「方案审查」。
- `guide` 在 0.2.1 源码中是**数组**（`SidebarRightGuideEntry[]`），子系统文档里的对象写法已过时。
- `keepMounted: true`：切换会话、隐藏右栏时不丢当前页与筛选状态。
- `package.json` 的 `dsh.client.inject: ["@deepseek-ai/dsh-client-ui-sidebar-right"]` 只保证脚本在 sidebar-right 之后到达；`sidebarRightTabs` / `slots` 依赖由 `inject` 数组表达。
- 四页是 tab 内部的分段切换（组件 state），不是四个 Sidebar tab。

## 2. 信息架构

```
方案审查
├─ 审查记录    列表（分页）→ 详情：结论 / 问题明细（可复核）/ 检查清单 / 署名与最终结论
├─ 规则        生效规则列表（筛选）→ 行内展开详情：问题、依据、校验器、覆盖、审计、记忆；启停 / 级别
├─ 记忆        有记录的规则：采纳统计、近 5 次定稿采纳率、范例、驳回原因；候选规则审批
└─ 评测        eval_runs 列表 → 勾选 2–7 个对比指标
```

顶部常驻：页签、刷新按钮、错误条（带重试）。默认页为「审查记录」——专家最常用的入口。

## 3. 各页规格

### 3.1 审查记录

数据：`GET /reviews?page=N`、`GET /reviews/:id`。

| 区域 | 内容 |
|---|---|
| 列表行 | 标题、预审结论（三色）、最终结论（若有）、状态（进行中 / 已定稿 / 需重新定稿）、reviewId、问题计数（采纳 / 驳回 / 改写 / 待人工） |
| 分页 | 每页 50 条，上一页 / 下一页 |
| 详情：结论 | 预审结论 vs 最终结论并排；定稿时的预审结论 ≠ 最终结论时高亮并显示差异；`basis` 一句话依据 |
| 详情：问题 | 每条：规则号（专家新增显示「专家」）、级别、来源（校验器 / 模型 / 专家）、状态、门禁未过原因、证据引文（`absence` 类显示「未提及」而非引号）、建议；已改写的显示改写文 |
| 详情：复核操作 | 未决定的问题（`confirmed` / `pending`）：采纳（`pending` 显示为「确认为问题」）/ 驳回（可选原因，行内输入）/ 改写（行内文本框，非 `window.prompt`） |
| 详情：清单 | 检查清单逐行（规则号、状态、备注）+ 各状态计数；种子规则包为 28 行 |
| 详情：署名与结论 | 审核人输入框 + 保存；最终结论下拉（通过 / 建议整改 / 不通过）。无审核人时提示先署名（后端 `REVIEWER_REQUIRED`） |
| 详情：正式意见 | 只显示 `opinionPath` 与版本列表（正文在文件中，用右栏文件预览或编辑器打开）；记录 `status=open` 且 `versions` 非空时提示「决定已变更，需回到对话重新定稿」 |
| 空状态 | 「还没有审查记录。在「方案审查」agent 会话里粘贴一份方案开始。」 |

### 3.2 规则

数据：`GET /rules`；展开时 `GET /rules/:id`。

| 区域 | 内容 |
|---|---|
| 筛选 | 维度（8：容量 / 安全 / 接口 / 渠道 / 数据同步 / 配置 / 监控 / 文档，与引擎 `Dimension` 一致）、tier、状态 |
| 列表行 | 规则号 · 标题、级别、tier、状态、维度、展示 / 采纳 / 驳回 / 改写；「已覆盖」标记（只认真实覆盖，见 `design.md` §7）；常被驳回提示 |
| 行内详情 | 检查问题、依据、整改建议、适用范围、校验器配置（JSON 只读）、shipped 原值 vs 覆盖值、最近审计、记忆（范例与驳回原因） |
| 操作 | 启用 / 停用、级别下拉。参数调整与草案起草在对话里用 `rules_propose` 完成（需要模型理解上下文） |
| 加载错误 | `loadErrors` / `warnings` 以提示条显示（`design.md` §12） |

「常被驳回」= `reject / shown ≥ 0.6` 且 `shown ≥ 5`（与 `memory_recall.warn` 默认阈值一致；看板不读 Host 配置，故用默认值）。

### 3.3 记忆

数据：`GET /memory`。

| 区域 | 内容 |
|---|---|
| 汇总 | 范例数 · 候选规则数 · 反馈数 |
| 规则记忆 | 只列 `shown > 0` 或有范例的规则（28 条全列只会是噪音）；每条：统计、驳回率、近 5 次定稿的采纳率（决定数 < 5 显示「样本不足」）、范例、最近驳回原因 |
| 候选规则 | 文本、来源 reviewId、状态（新 / 已起草 / 已接受 / 已忽略）、建议维度；已起草的显示规则号。操作：`drafted` → 「接受草案」；`new` / `drafted` → 「忽略」；`new` 提示「回到对话请 agent 起草」 |
| 空状态 | 「记忆为空：完成第一次定稿后出现。」 |

### 3.4 评测

数据：`GET /eval-runs`、`GET /eval-runs?ids=…`。

| 区域 | 内容 |
|---|---|
| 运行列表 | runId、时间、数据集、主要指标（P / R / F1 / kappa，存在才显示） |
| 对比 | 勾选 2–7 个 → 指标对比表（行 = 指标，列 = run）；少于 2 或多于 7 给出提示，不发请求 |
| 空状态 | 「尚无评测结果。运行离线评测脚本后在此查看（evaluation.md §5）。」 |

## 4. 数据与刷新

- 所有数据经 `fetch` 同源路由（`credentials: 'same-origin'`）；写成功后重新拉取当前页数据。
- 刷新时机：打开页面 / 切换页签时、手动点刷新、写操作之后。**不轮询**；`domain/changed` 是 Host 进程内事件，不跨到浏览器。专家在对话里做了决定后，回到看板点刷新即可。
- 失败：显示错误条与重试；响应非 JSON（如被代理改写成 HTML）不崩溃，提示 HTTP 状态。
- 不写 localStorage / sessionStorage（数据可能含方案片段）。

## 5. 交互边界

看板提供：规则启停 / 严重级别、候选规则接受草案 / 忽略、问题采纳 / 驳回 / 改写、审核人、最终结论。所有写操作复用 `ReviewStore` 的同一方法（与 `rules_propose` / `review_decide` 等价），审计 `who:'dashboard'`。

看板**不**提供：删除审查记录、编辑正式意见正文、起草规则 YAML、定稿。

鉴权：DSH 连接围栏（`ctx.connection.requestRejection`）+ 同源校验。细粒度权限与 CSRF token 后置。

## 6. 设置

不做设置卡片（`design.md` §11）：阈值改 profile 中本插件行的 `config`。

## 7. 视觉

- 颜色、边框、背景只用 DSH 主题变量：`--dsw-alias-label-primary/secondary/tertiary`、`--dsw-alias-border-l2/l3`、`--dsw-alias-bg-layer-1/2`、`--dsw-alias-interactive-bg-hover`、`--dsw-alias-state-success/warn/error-primary`；圆角 `--dsw-radius-sm`。无硬编码色值（深色主题可用）。
- 结论三色：通过 = success、建议整改 = warn、不通过 = error。
- 证据引文用 `<blockquote>`；按钮有可读文字；窄栏下自动换行。
- 文案只有中文。

## 8. 构建与校验

- `tsdown.config.ts`：entry `src/client/index.tsx` → `lib/client.js`，CJS 工厂，banner `window.__ModuleLoader__.load({ id: "wsgw-solution-review", factory: (require) => {`、footer `return module.exports; } });`，外部化 `react`、`react-dom`、`@deepseek-ai/cordis` 等平台模块。
- `tests/client/check-bundle.mjs`：存在性、banner / footer、`require(` 的外部包都在白名单、未内联 React。
- 页面在用户本机 `dsh web` 中手工冒烟（清单见 `progress.md`）。

## 9. 测试要点

| ID | 要点 |
|---|---|
| T-DSH-01 | tab 注册：`id`、`kind`、`keepMounted`、`guide` 数组快照；`apply` 注册 tab 类型与 slot 主体 |
| T-DSH-02 | 四页在空数据下渲染各自空状态文案（`react-dom/server`） |
| T-DSH-03 | 规则筛选按引擎维度；「常被驳回」判定 |
| T-DSH-04 | 记录详情：定稿预审结论 ≠ 最终结论时高亮；清单 28 行；`absence` 证据不加引号；需重新定稿提示 |
| T-DSH-05 | 记忆页：近 5 次采纳率与样本不足判定；只列有记录的规则；候选按状态给出操作 |
| T-DSH-06 | 评测对比选择 2–7 个 run 的约束 |
| T-DSH-07 | 请求封装：非 JSON 响应、错误体 `message`、HTTP 状态回退 |
| T-DSH-08 | check-bundle 脚本全部断言 |
| T-DSH-09 | ~~设置卡片字段范围~~（设置卡片推迟，删除） |
| T-DSH-10 | 写路由：同源 + 连接围栏通过才写；跨源 / 未授权返回 403 / 401；写后审计 |
| T-DSH-11 | 规则停用 / 级别写后下一次 `review_check` 生效 |
| T-DSH-12 | 不使用 localStorage / sessionStorage（源码断言） |

// Synthetic proposal generator (evaluation.md §2.3): template skeleton + per-rule phrase pools + planted defects.
// Deterministic for a given seed; ground truth is computed by the same verdict policy the system uses.
import { createHash } from 'node:crypto'
import { check } from '../engine/check.js'
import { parseMarkdown } from '../engine/parse/markdown.js'
import type { Rule, RulePack, Severity, Verdict } from '../engine/types.js'
import { computeVerdict } from '../engine/verdict.js'
import { flagJudge, judgeCandidates } from './judge.js'
import { seededRandom } from './stats.js'

export const GENERATOR_VERSION = 'wsgw-solution-review/eval/synthetic@1.0.0'

export const PLANTED_KINDS = ['missing', 'negated', 'placeholder', 'hollow'] as const
export type PlantedKind = (typeof PLANTED_KINDS)[number]

export interface Defect {
  ruleId: string
  severity: Severity
  plantedKind: PlantedKind
}

export interface SyntheticSolution {
  id: string
  markdown: string
  expectedVerdict: Verdict
  defects: Defect[]
  features: Feature[]
}

export interface SyntheticManifest {
  id: string
  seed: number
  generatedBy: string
  rulePackVersion: string
  minorThreshold: number
  counts: Record<Verdict, number>
}

export interface SyntheticSet {
  manifest: SyntheticManifest
  solutions: SyntheticSolution[]
}

export interface SyntheticOptions {
  seed: number
  minorThreshold?: number
}

export type Feature = 'riskctl' | 'realname' | 'sync' | 'tracking' | 'ui' | 'message' | 'modify'
const FEATURES: Feature[] = ['riskctl', 'realname', 'sync', 'tracking', 'ui', 'message', 'modify']

// ---------- phrase pools ----------

type Slot = 'approach' | 'access' | 'interface' | 'dataPlan' | 'implementation' | 'resources' | 'risk'

interface StatementPool {
  slot: Slot
  feature?: Feature
  satisfied: string[]
  negated: string[]
  placeholder: string[]
  hollow: string[]
}

const STATEMENT_POOLS: Record<string, StatementPool> = {
  'CAP-001': {
    slot: 'approach',
    satisfied: [
      '接入网关按渠道配置限流阈值 200 QPS，超限返回限流提示，保护主业务链路。',
      '采用令牌桶做并发控制，单渠道并发上限 50，超出排队等待。',
      '网关对该渠道设置每秒最大请求数上限，超过上限直接拒绝并提示稍后重试。',
    ],
    negated: ['本期不做限流，依赖渠道侧自行控制调用频次。', '暂不设置并发控制，后续视流量再评估。', '无需限流，渠道流量可控。'],
    placeholder: ['限流策略：待定。', '并发控制方案：/', '限流与并发阈值：TBD'],
    hollow: ['限流策略详见后续补充。', '并发控制由平台统一处理，本方案不展开。', '限流方案参考平台通用规范。'],
  },
  'CAP-003': {
    slot: 'resources',
    satisfied: [
      '依据接入方提供的流量预估，现有 4 个实例的容量余量在 60% 以上，经评估无需扩容。',
      '服务器资源按预估流量扩容 2 个节点，扩容后 CPU 水位控制在 50% 以下。',
      '现有部署规模可承载预估流量，经测算余量充足，上线后按水位观察。',
    ],
    negated: ['初步评估无需扩容资源。', '无需扩容。', '本次不需要扩容。'],
    placeholder: ['扩容评估：待定，上线后观察水位。', '服务器资源评估结论：/', '容量扩容方案：TBD'],
    hollow: ['资源扩容情况参考平台容量管理办法。', '容量评估另行开展。', '服务器资源由运维统一评估。'],
  },
  'CAP-005': {
    slot: 'risk',
    feature: 'riskctl',
    satisfied: [
      '接入风控后链路增加约 30 ms，各接口响应时间经评估仍在阈值内。',
      '风控开关默认关闭，开启后对接口耗时的影响已在测试环境验证。',
      '接入该校验能力后各接口响应时间增加约 30 ms，已在测试环境评估。',
    ],
    negated: ['未对风控接入做耗时评估。', '暂不评估风控带来的延时影响。', '不考虑风控带来的耗时。'],
    placeholder: ['风控耗时评估：待定。', '风控影响：/', '风控接入评估：TBD'],
    hollow: ['风控影响另行评估。', '风控接入按平台统一方案执行。', '风控相关评估见平台文档。'],
  },
  'SEC-001': {
    slot: 'approach',
    satisfied: [
      '卡片 URL 携带时间戳与 HMAC 签名，网关验签通过后才放行，全链路 HTTPS。',
      '接口参数采用 SM4 加密传输，密钥由平台统一下发并定期轮换。',
      '卡片地址附带一次性校验串并设置 5 分钟有效期，防止被复制转发。',
    ],
    negated: ['接口暂不加签，后续迭代补充。', '本期不做加密传输，使用明文参数。', '无需鉴权，卡片为公开页面。'],
    placeholder: ['加密策略：待定。', '签名方案：/', '鉴权与加密：TBD'],
    hollow: ['加密策略按平台统一规范执行。', '签名方式参考渠道接入文档。', '鉴权机制沿用现有渠道，此处不再赘述。'],
  },
  'SEC-003': {
    slot: 'approach',
    feature: 'realname',
    satisfied: [
      '调用实名信息仅用于户号绑定核验，业务用途已与业务部门确认，实名查询逻辑保持原样。',
      '实名接口调用的业务用途为开户身份核验，输出仅含脱敏后的姓名。',
      '该身份核验接口仅用于开户环节，用途已经业务部门确认。',
    ],
    negated: ['未说明实名信息的业务用途，待补充。', '暂不明确实名信息的用途。', '没有实名调用的用途说明。'],
    placeholder: ['实名信息用途：待定。', '实名调用说明：/', '实名用途说明：TBD'],
    hollow: ['实名信息用途见业务需求文档。', '实名接口调用方式同现有渠道。', '实名相关逻辑由用户中心负责。'],
  },
  'SEC-004': {
    slot: 'risk',
    satisfied: [
      '外部渠道只与前端卡片交互，不直接读取内部数据，因此数据暴露面仅限卡片展示字段。',
      '越权访问风险通过渠道标识与 token 双重校验控制，所有查询均经用户授权。',
      '外部渠道只能看到卡片渲染结果，内部接口不对渠道开放，相关风险已由安全部门评估。',
    ],
    negated: ['无暴露风险。', '不存在数据泄露风险。', '渠道接入无暴露风险。'],
    placeholder: ['数据暴露面：待定。', '泄露风险评估：/', '越权风险：TBD'],
    hollow: ['数据暴露风险评估见安全评审记录。', '泄露风险由安全部门另行评估。', '越权风险控制沿用现有机制。'],
  },
  'INT-002': {
    slot: 'interface',
    satisfied: [
      '手机号与户号的绑定关系缺失时返回 0203 并提示用户先绑定，接口超时 3 秒后重试一次。',
      '查询失败或返回为空时前端展示兜底文案，不向渠道透出错误详情。',
      '户号未关联手机号时返回提示码并引导用户完成关联。',
    ],
    negated: ['暂不考虑异常与边界场景。', '本期不处理失败场景。', '无需兜底逻辑。'],
    placeholder: ['异常处理：待定。', '边界场景：/', '超时与边界处理：TBD'],
    hollow: ['异常场景按平台通用规范处理。', '边界逻辑见接口文档。', '失败处理沿用现有机制。'],
  },
  'INT-003': {
    slot: 'approach',
    feature: 'modify',
    satisfied: [
      '本次改造涉及现有接口的参数组装逻辑，已评估对原有调用方的回归影响。',
      '优化点仅限新增渠道分支，现有逻辑保持原样，回归范围已明确。',
      '本次只在新增渠道分支上做处理，其余链路保持原样，回归范围已明确。',
    ],
    negated: ['本次不调整现有逻辑。', '未修改原有逻辑。', '不改造既有流程。'],
    placeholder: ['现有逻辑调整范围：待定。', '原有逻辑修改说明：/', '既有流程变更影响：TBD'],
    hollow: ['现有接口修改影响见评审纪要。', '原有逻辑调整由开发自行评估。', '既有接口变更范围后续确认。'],
  },
  'INT-005': {
    slot: 'interface',
    satisfied: [
      '接口按请求流水号做幂等，重复请求直接返回首次结果。',
      '渠道侧重试间隔 2 秒、最多 3 次，服务端按流水号去重。',
      '同一流水号的二次调用返回首次结果，不会产生新的记录。',
    ],
    negated: ['暂不做幂等处理。', '本期不考虑重复请求。', '无需防重，前端已限制点击。'],
    placeholder: ['幂等策略：待定。', '幂等与防重策略：/', '防重方案：TBD'],
    hollow: ['幂等方案参考平台通用组件。', '重试策略由渠道侧自行决定。', '去重逻辑见公共服务说明。'],
  },
  'CHN-001': {
    slot: 'approach',
    satisfied: [
      '渠道开关与配额在运营后台配置，可按渠道一键下线。',
      '支持渠道级限流与黑名单，异常渠道可熔断。',
      '运营后台可按渠道启停接入并设置每日调用上限。',
    ],
    negated: ['本期不做渠道管控。', '暂不设置渠道开关。', '无需配额控制。'],
    placeholder: ['渠道管控策略：待定。', '渠道开关：/', '配额方案：TBD'],
    hollow: ['渠道管控按运营要求另行设计。', '渠道开关由平台统一提供。', '配额策略参考既有渠道。'],
  },
  'SYN-001': {
    slot: 'dataPlan',
    feature: 'sync',
    satisfied: [
      '用户授权数据通过 MQ 异步同步至营销库，不占用主链路。',
      '数据同步采用定时任务每 5 分钟批量执行。',
      '授权结果写入消息队列后由下游批量消费，不阻塞主流程。',
    ],
    negated: ['本期不做数据同步的异步化改造。', '暂不引入 MQ。', '无需定时任务。'],
    placeholder: ['数据同步方式：待定。', '同步数据机制：/', 'MQ 选型：TBD'],
    hollow: ['数据同步方式沿用既有机制。', '同步数据由平台统一调度。', '定时任务配置另行说明。'],
  },
  'MON-001': {
    slot: 'implementation',
    feature: 'tracking',
    satisfied: [
      '新增埋点通过前端 SDK 上报 click_balance 事件，字段含渠道标识与时间戳。',
      '埋点采集方式为页面曝光与点击两类事件，经统一上报接口写入分析库。',
      '新增埋点由前端组件在用户点击时记录并批量发送到分析服务。',
    ],
    negated: ['埋点暂不明确实现方式。', '不做上报。', '未定义埋点字段。'],
    placeholder: ['埋点实现方式：待定。', '埋点上报：/', '埋点字段：TBD'],
    hollow: ['埋点实现方式另行讨论。', '埋点上报参考平台规范。', '埋点字段由数据组确认。'],
  },
}

const CAP002 = {
  satisfied: [
    '上线前在准生产环境开展压测，目标 500 TPS 下平均响应时间不超过 200 ms。',
    '性能测试覆盖余额查询与登录链路，按峰值 1.5 倍流量验证。',
    '负载测试由测试组在上线前一周完成并出具报告。',
  ],
  negated: ['本期不做压测，直接上线观察。', '暂不安排压力测试，视上线后流量再定。', '无需压测，静态页面流量可忽略。'],
  placeholder: ['压测方案：待定。', '压测：/', '性能测试计划：TBD'],
  hollow: ['压测安排另行通知。', '压测由平台统一组织。', '性能测试参照平台规范执行。'],
}

const CAP006 = {
  satisfied: [
    '数据增长估算：预计日均请求量 20 万次，峰值并发 300 TPS。',
    '新增用户约 5 万户/月，首年累计 60 万户。',
    '接入后访问量预估 120 万次/日，较当前增长 15%。',
  ],
  negated: ['上线前期会带来大量新增用户。', '业务量预计显著增长。', '调用量较现状明显上升。'],
  placeholder: ['业务量：待定。', '请求量预估：TBD。', '日活预估：N/A。'],
  hollow: ['业务量数据由业务部门另行提供。', '请求量预估参考同类渠道。', '新增用户数待业务侧确认。'],
}

const INT004 = {
  satisfied: [
    '调用方须在 appCode 字段传输平台分配的固定渠道编号，用于区分来源。',
    '请求头携带渠道标识 channel，取值由平台统一分配且固定不变。',
    'member 字段固定填写本渠道编号。',
  ],
  negated: ['本期不区分渠道标识，统一走默认渠道。', '暂不传渠道编号。', '无需渠道号，由网关统一标记。'],
  placeholder: ['渠道标识取值：待定。', '渠道编号：/', 'channel 取值：TBD'],
  hollow: ['渠道标识按平台规范传输。', '渠道编号由平台另行分配。', 'channel 字段说明见接口文档。'],
}

const SEC002_STATEMENT = {
  satisfied: [
    '用户中心依据客户端获取的一次性授权码调用渠道服务端获取 openId，通过 openId 换取手机号后校验是否已完成内部授权，已授权则一键登录。',
    '客户端取得授权码后交由用户中心换取 openId 与手机号，校验绑定关系通过即完成登录。',
    '用户在渠道内确认后，平台取得其身份凭据并完成账号关联与登入。',
  ],
  negated: ['客户端获取一次性授权码后，由用户中心换取 openId。', '不校验绑定关系，直接按手机号登录。'],
  placeholder: ['授权码换取 openId 与登录校验流程：待定。'],
  hollow: ['客户端获取一次性授权码后，由用户中心换取 openId 与手机号。', '校验绑定关系后的处理方式参考渠道文档。'],
}

const BACKGROUND = [
  '为落实年度智能交互能力建设安排，探索将余额查询能力通过第三方渠道开放，整合渠道已有生活缴费场景，满足用户便捷查询需求。',
  '为提升对外服务触达能力，本方案将账单查询能力以服务卡片形式开放给第三方渠道，用户在渠道内即可完成查询。',
  '按照年度数字化服务工作部署，建设面向第三方渠道的能力开放接入，先行开放余额与账单查询两项能力。',
]

const FEATURE_SENTENCES: Record<Feature, string> = {
  riskctl: '本方案需接入风控能力，对高风险操作做二次校验。',
  realname: '本次新增实名信息接口调用。',
  sync: '涉及用户授权数据向营销库的数据同步需求。',
  tracking: '需新增页面埋点以统计使用情况。',
  ui: '本次同时调整首页余额卡片的按钮样式。',
  message: '支持订阅消息推送到渠道。',
  modify: '',
}

const AUTH_DIAGRAM = `\`\`\`mermaid
sequenceDiagram
    participant C as 渠道客户端
    participant F as 前端卡片
    participant U as 用户中心
    participant S as 渠道服务端
    C->>F: 唤起授权浮层
    F->>U: 传递一次性授权码
    U->>S: 用授权码换取 openId 与手机号
    S-->>U: 返回 openId、手机号
    U->>U: 校验绑定关系是否已授权
    U-->>F: 完成一键登录并返回用户信息
\`\`\``

const AUTH_DIAGRAM_INCOMPLETE = `\`\`\`mermaid
sequenceDiagram
    participant C as 渠道客户端
    participant F as 前端卡片
    participant U as 用户中心
    C->>F: 唤起授权浮层
    F->>U: 传递一次性授权码
    U-->>F: 完成一键登录
\`\`\``

const NEUTRAL_DIAGRAM_SHORT = `\`\`\`mermaid
sequenceDiagram
    participant F as 前端卡片
    participant B as 后端服务
    F->>B: 查询余额
    B-->>F: 返回结果
\`\`\``

const MESSAGE_DIAGRAM = `\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant P as 平台消息服务
    participant C as 渠道消息网关
    U->>P: 订阅消息
    P->>C: 推送账单消息
    C-->>U: 展示消息卡片
\`\`\``

const MESSAGE_DIAGRAM_SHORT = `\`\`\`mermaid
sequenceDiagram
    participant P as 平台消息服务
    participant C as 渠道消息网关
    P->>C: 推送订阅消息
    C-->>P: 回执
\`\`\``

// ---------- plan ----------

interface Plan {
  id: string
  features: Set<Feature>
  defects: Map<string, PlantedKind>
}

interface Rng {
  next(): number
  int(n: number): number
  pick<T>(xs: readonly T[]): T
  chance(p: number): boolean
}

function makeRng(seed: number): Rng {
  const r = seededRandom(seed)
  const rng: Rng = {
    next: r,
    int: (n) => Math.floor(r() * n),
    pick: (xs) => xs[Math.floor(r() * xs.length)]!,
    chance: (p) => r() < p,
  }
  return rng
}

function verifiableRules(pack: RulePack): Rule[] {
  return pack.rules.filter((r) => r.tier !== 'soft' && r.status === 'active')
}

function kindsFor(ruleId: string): PlantedKind[] {
  switch (ruleId) {
    case 'INT-001':
      return ['missing', 'placeholder', 'hollow']
    case 'DOC-001':
      return ['missing', 'placeholder', 'hollow']
    case 'DOC-002':
      return ['missing']
    case 'DOC-005':
      return ['missing', 'hollow']
    case 'DOC-010':
      return ['missing', 'placeholder', 'hollow']
    case 'DOC-011':
      return ['missing', 'placeholder', 'hollow']
    case 'DOC-012':
      return ['missing']
    case 'SEC-002':
      return ['missing', 'negated', 'placeholder', 'hollow']
    default:
      return ['missing', 'negated', 'placeholder', 'hollow']
  }
}

const FEATURE_RULE: Record<string, Feature> = {
  'CAP-005': 'riskctl',
  'SEC-003': 'realname',
  'SYN-001': 'sync',
  'MON-001': 'tracking',
  'DOC-002': 'ui',
  'DOC-005': 'message',
  'INT-003': 'modify',
}

function plantable(rule: Rule, plan: Plan): boolean {
  const feature = FEATURE_RULE[rule.id]
  if (feature && !plan.features.has(feature)) return false
  if (rule.id === 'INT-003' && plan.defects.has('DOC-010')) return false
  if (rule.id === 'DOC-010' && plan.defects.has('INT-003')) return false
  if (rule.id === 'DOC-005' && plan.defects.has('DOC-001')) return false
  if (rule.id === 'DOC-001' && plan.defects.has('DOC-005')) return false
  return true
}

/** Couplings that follow from the rule pack itself (evaluation.md §2.3): planting one defect forces another. */
function applyCouplings(plan: Plan): void {
  if (plan.defects.has('DOC-012')) {
    plan.features.delete('ui')
    plan.defects.delete('DOC-002')
    if (!plan.defects.has('INT-001')) plan.defects.set('INT-001', 'missing')
  }
  if (plan.defects.get('INT-001') === 'hollow') {
    plan.features.delete('ui')
    plan.defects.delete('DOC-002')
  }
  if (plan.defects.has('DOC-010')) plan.features.delete('modify')
  if (plan.defects.has('DOC-001')) {
    plan.features.delete('message')
    plan.defects.delete('DOC-005')
    if (plan.defects.get('SEC-002') === 'missing') plan.defects.set('SEC-002', 'hollow')
  }
}

function chooseKind(rng: Rng, ruleId: string): PlantedKind {
  return rng.pick(kindsFor(ruleId))
}

function targetVerdictOf(defects: Defect[], minorThreshold: number): Verdict {
  return computeVerdict(
    defects.map((d) => ({ status: 'confirmed' as const, tier: 'hard' as const, severity: d.severity })),
    { minorThreshold },
  ).verdict
}

function defectsOf(plan: Plan, pack: RulePack): Defect[] {
  const bySeverity = new Map(pack.rules.map((r) => [r.id, r.severity]))
  return [...plan.defects.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruleId, plantedKind]) => ({ ruleId, severity: bySeverity.get(ruleId)!, plantedKind }))
}

function pickFeatures(rng: Rng): Set<Feature> {
  const out = new Set<Feature>()
  for (const f of FEATURES) if (rng.chance(0.5)) out.add(f)
  return out
}

/** Build a plan whose policy verdict equals `target`; bounded retries keep the generator total. */
function planFor(id: string, target: Verdict, rng: Rng, pack: RulePack, minorThreshold: number, maxDefects: number): Plan {
  const rules = verifiableRules(pack)
  for (let attempt = 0; attempt < 200; attempt++) {
    const plan: Plan = { id, features: pickFeatures(rng), defects: new Map() }
    const pool = rules.filter((r) => plantable(r, plan))
    const minors = pool.filter((r) => r.severity === 'minor')
    const majors = pool.filter((r) => r.severity === 'major')
    const blockers = pool.filter((r) => r.severity === 'blocker')
    const add = (r: Rule) => {
      if (!plantable(r, plan)) return
      plan.defects.set(r.id, chooseKind(rng, r.id))
    }
    if (target === '通过') {
      const k = rng.int(Math.min(minorThreshold, 3))
      for (let i = 0; i < k; i++) add(rng.pick(minors.filter((r) => r.id !== 'DOC-012')))
    } else if (target === '建议整改') {
      const k = 1 + rng.int(Math.min(maxDefects, 5))
      const nonBlockers = [...majors, ...minors]
      for (let i = 0; i < k; i++) add(rng.pick(nonBlockers))
      if (![...plan.defects.keys()].some((rid) => majors.some((m) => m.id === rid))) add(rng.pick(majors))
    } else {
      const k = 1 + rng.int(maxDefects)
      add(rng.pick(blockers))
      for (let i = 1; i < k; i++) add(rng.pick(pool))
    }
    applyCouplings(plan)
    const defects = defectsOf(plan, pack)
    if (defects.length <= maxDefects && targetVerdictOf(defects, minorThreshold) === target) return plan
  }
  throw new Error(`synthetic: could not build a plan for ${id} with verdict ${target}`)
}

// ---------- rendering ----------

function paragraph(lines: string[]): string {
  return lines.filter((l) => l.length > 0).join('\n\n')
}

function resourceTable(plan: Plan): string {
  const kind = plan.defects.get('DOC-010')
  if (kind === 'missing') return ''
  const header = kind === 'hollow'
    ? '| 序号 | 资源名称 | 变更类型 | 内外网位置 | 数据存储 | 备注 |\n| --- | --- | --- | --- | --- | --- |'
    : '| 序号 | 资源名称 | 变更类型 | 名称 | 内外网位置 | 数据存储 | 备注 |\n| --- | --- | --- | --- | --- | --- | --- |'
  const change = kind === 'placeholder' ? '/' : plan.features.has('modify') ? '修改' : '新增'
  const svc = kind === 'placeholder' ? '/' : 'svc-channel-front'
  const rows = kind === 'hollow'
    ? ['| 1 | 微应用 | / | / | / | / |', `| 2 | 微服务 | ${change} | 外网 | / | / |`, '| 3 | 数据表 | / | / | / | / |']
    : ['| 1 | 微应用 | / | / | / | / | / |', `| 2 | 微服务 | ${change} | ${svc} | 外网 | / | / |`, '| 3 | 数据表 | / | / | / | / | / |']
  return [header, ...rows].join('\n')
}

function statementLine(ruleId: string, plan: Plan, rng: Rng, pool: { satisfied: string[]; negated: string[]; placeholder: string[]; hollow: string[] }): string {
  const kind = plan.defects.get(ruleId)
  if (kind === 'missing') return ''
  if (!kind) return rng.pick(pool.satisfied)
  return rng.pick(pool[kind])
}

function statementFor(ruleId: string, plan: Plan, rng: Rng): string {
  const pool = STATEMENT_POOLS[ruleId]!
  if (pool.feature && !plan.features.has(pool.feature)) return ''
  return statementLine(ruleId, plan, rng, pool)
}

function slotLines(slot: Slot, plan: Plan, rng: Rng): string[] {
  return Object.entries(STATEMENT_POOLS)
    .filter(([, p]) => p.slot === slot)
    .map(([ruleId]) => statementFor(ruleId, plan, rng))
}

function backgroundSection(plan: Plan, rng: Rng): string {
  const kind = plan.defects.get('DOC-011')
  if (kind === 'missing') return ''
  const body = kind === 'placeholder' ? '无' : kind === 'hollow' ? '详见立项材料。' : rng.pick(BACKGROUND)
  return `## 一、工作背景\n\n${body}`
}

function diagramsFor(plan: Plan): string[] {
  const out: string[] = []
  const doc001 = plan.defects.get('DOC-001')
  const sec002 = plan.defects.get('SEC-002')
  if (doc001 === 'missing') {
    // no diagram at all
  } else if (doc001 === 'placeholder') {
    out.push('授权时序图见图，略。', '![用户授权时序图](images/auth-sequence.png)')
  } else if (doc001 === 'hollow') {
    out.push(NEUTRAL_DIAGRAM_SHORT)
  } else if (sec002 === 'missing') {
    out.push(AUTH_DIAGRAM_INCOMPLETE)
  } else if (sec002 === undefined) {
    out.push(AUTH_DIAGRAM)
  } else {
    // SEC-002 statement-kind defect: keep the layout verifiable for DOC-001 without an auth diagram
    out.push(NEUTRAL_DIAGRAM_SHORT.replace('    B-->>F: 返回结果', '    B->>B: 组装卡片数据\n    B-->>F: 返回结果'))
  }
  if (plan.features.has('message') && doc001 === undefined) {
    const doc005 = plan.defects.get('DOC-005')
    if (doc005 === 'hollow') out.push(MESSAGE_DIAGRAM_SHORT)
    else if (doc005 === undefined) out.push(MESSAGE_DIAGRAM)
  }
  return out
}

function accessSection(plan: Plan, rng: Rng): string {
  const sec002 = plan.defects.get('SEC-002')
  const doc001 = plan.defects.get('DOC-001')
  const diagramCarriesAuth = doc001 === undefined && (sec002 === undefined || sec002 === 'missing')
  const lines: string[] = ['**（1）用户鉴权**']
  if (diagramCarriesAuth) {
    lines.push('鉴权链路见上方时序图：客户端取得一次性授权码，用户中心换取 openId 与手机号，校验绑定关系后完成一键登录。')
  } else if (sec002 === undefined) {
    lines.push(rng.pick(SEC002_STATEMENT.satisfied))
  } else if (sec002 === 'negated') {
    lines.push(...SEC002_STATEMENT.negated)
  } else if (sec002 === 'placeholder') {
    lines.push(...SEC002_STATEMENT.placeholder)
  } else {
    lines.push(...SEC002_STATEMENT.hollow)
  }
  lines.push('**（2）查询余额**', '卡片以 H5 页面形式部署在外网静态环境，由渠道通过服务卡片调用并展示余额数据。')
  return paragraph(lines)
}

function interfaceSection(plan: Plan, rng: Rng): string {
  const int001 = plan.defects.get('INT-001')
  const int004Planted = plan.defects.has('INT-004')
  const lines: string[] = ['**（1）用户授权接口**']
  if (int001 === 'missing') {
    lines.push('接口采用 Restful 方式，由用户中心提供，入参与出参按平台统一规范。')
  } else if (int001 === 'hollow') {
    lines.push('接口参数与返回码详见附件 1。')
  } else {
    const channelRow = int004Planted ? '| proNo | String | 是 | 省码，默认 00000 |' : '| appCode | String | 是 | 渠道编号，平台分配 |'
    lines.push(
      [
        '| 参数名 | 类型 | 必填 | 说明 |',
        '| --- | --- | --- | --- |',
        channelRow,
        '| authCode | String | 是 | 一次性授权码 |',
        '| tenant | String | 是 | 租户名称 |',
      ].join('\n'),
      '返回参数：',
      int001 === 'placeholder'
        ? ['| 字段 | 类型 | 说明 |', '| --- | --- | --- |', '| / | / | / |', '| / | / | / |'].join('\n')
        : [
            '| 字段 | 类型 | 说明 |',
            '| --- | --- | --- |',
            '| resultCode | String | 0000 成功，其余为失败码 |',
            '| resultMessage | String | 返回消息 |',
            '| token | String | 登录令牌 |',
          ].join('\n'),
    )
  }
  lines.push('**（2）查询余额的业务数据接口**')
  lines.push(statementLine('INT-004', plan, rng, INT004))
  lines.push(...slotLines('interface', plan, rng))
  if (plan.features.has('ui')) {
    lines.push(plan.defects.get('DOC-002') === 'missing' ? '按钮样式调整说明见附件 3。' : '按钮样式调整前后的原型对比见附件 3。')
  }
  if (plan.defects.get('DOC-012') === 'missing') lines.push('接口联调记录见附件 9。')
  return paragraph(lines)
}

function dataPlanSection(plan: Plan, rng: Rng): string {
  const lines = ['数据流转与数据存储与现有数据架构保持一致。']
  lines.push(statementLine('CAP-006', plan, rng, CAP006))
  lines.push(...slotLines('dataPlan', plan, rng))
  return paragraph(lines)
}

function implementationSection(plan: Plan, rng: Rng): string {
  const lines = ['第一阶段完成产品设计确认；第二阶段完成开发与测试；第三阶段完成正式环境配置及上线。']
  lines.push(statementLine('CAP-002', plan, rng, CAP002))
  lines.push(...slotLines('implementation', plan, rng))
  return paragraph(lines)
}

function goalSection(plan: Plan): string {
  const lines = ['使用群体：通过第三方渠道查询余额的用户。']
  for (const f of FEATURES) if (plan.features.has(f) && FEATURE_SENTENCES[f]) lines.push(FEATURE_SENTENCES[f])
  return paragraph(lines)
}

function resourcesSection(plan: Plan, rng: Rng): string {
  const lines = ['静态资源以 H5 卡片形式部署在外网静态环境。']
  lines.push(...slotLines('resources', plan, rng))
  return paragraph(lines)
}

function riskSection(plan: Plan, rng: Rng): string {
  const lines = ['本方案涉及外部渠道接入，上线后由运营侧持续跟踪。']
  lines.push(...slotLines('risk', plan, rng))
  return paragraph(lines)
}

function attachmentsSection(plan: Plan): string {
  const items = ['附件 1：余额查询接口文档', '附件 2：渠道接入规范']
  if (plan.features.has('ui')) items.push(plan.defects.get('DOC-002') === 'missing' ? '附件 3：按钮样式说明' : '附件 3：优化前后原型对比图')
  return items.join('；') + '。'
}

function render(plan: Plan, rng: Rng): string {
  const parts: string[] = [`# 余额查询能力对第三方渠道开放技术方案（${plan.id}）`, '']
  const table = resourceTable(plan)
  if (table) parts.push(table, '')
  const background = backgroundSection(plan, rng)
  if (background) parts.push(background, '')
  parts.push('## 二、技术方案', '')
  parts.push('### 2.1 技术思路及实现方式', '')
  parts.push(
    paragraph([
      '渠道客户端通过服务卡片调用前端 H5 页面，前端经能力开放网关访问后端余额查询服务并渲染结果。',
      ...slotLines('approach', plan, rng),
      ...diagramsFor(plan),
    ]),
    '',
  )
  parts.push('#### 2.1.1 接入方式', '', accessSection(plan, rng), '')
  parts.push('#### 2.1.2 接口设计', '', interfaceSection(plan, rng), '')
  parts.push('### 2.2 数据规划', '', dataPlanSection(plan, rng), '')
  parts.push('### 2.3 实施方案', '', implementationSection(plan, rng), '')
  parts.push('### 2.4 上线目标', '', goalSection(plan), '')
  parts.push('### 2.5 资源评估', '', resourcesSection(plan, rng), '')
  parts.push('### 2.6 风险评估', '', riskSection(plan, rng), '')
  parts.push('## 三、附件', '', attachmentsSection(plan), '')
  return parts.join('\n')
}

// ---------- public API ----------

const HIST_TARGETS: Verdict[] = [
  ...Array.from({ length: 15 }, () => '通过' as const),
  ...Array.from({ length: 14 }, () => '建议整改' as const),
  '不通过',
]

export function generateSyntheticSet(pack: RulePack, opts: SyntheticOptions): SyntheticSet {
  const minorThreshold = opts.minorThreshold ?? 3
  const rng = makeRng(opts.seed)
  const solutions: SyntheticSolution[] = []

  const build = (id: string, target: Verdict, maxDefects: number): void => {
    const plan = planFor(id, target, rng, pack, minorThreshold, maxDefects)
    const defects = defectsOf(plan, pack)
    solutions.push({
      id,
      markdown: render(plan, rng),
      expectedVerdict: targetVerdictOf(defects, minorThreshold),
      defects,
      features: FEATURES.filter((f) => plan.features.has(f)),
    })
  }

  HIST_TARGETS.forEach((target, i) => build(`syn-hist-${String(i + 1).padStart(2, '0')}`, target, 6))

  const RAND_TARGETS: Verdict[] = ['通过', '建议整改', '建议整改', '不通过', '不通过']
  for (let i = 0; i < 70; i++) build(`syn-rand-${String(i + 1).padStart(2, '0')}`, RAND_TARGETS[rng.int(RAND_TARGETS.length)]!, 6)

  const counts: Record<Verdict, number> = { 通过: 0, 建议整改: 0, 不通过: 0 }
  for (const s of solutions) counts[s.expectedVerdict] += 1

  return {
    manifest: {
      id: `synthetic-v1-seed${opts.seed}`,
      seed: opts.seed,
      generatedBy: GENERATOR_VERSION,
      rulePackVersion: `${pack.pack.id}@${pack.pack.version}`,
      minorThreshold,
      counts,
    },
    solutions,
  }
}

// ---------- self-check (T-EVA-05) ----------

export interface SelfCheckViolation {
  solutionId: string
  ruleId: string
  status: string
  note?: string
}

export interface KindDetection {
  planted: number
  detected: number
  pending: number
  missed: number
}

export interface SelfCheckReport {
  ok: boolean
  violations: SelfCheckViolation[]
  detection: Record<PlantedKind, KindDetection>
  perRule: Record<string, KindDetection>
}

export function selfCheck(set: SyntheticSet, pack: RulePack): SelfCheckReport {
  const violations: SelfCheckViolation[] = []
  const detection = Object.fromEntries(PLANTED_KINDS.map((k) => [k, { planted: 0, detected: 0, pending: 0, missed: 0 }])) as Record<PlantedKind, KindDetection>
  const perRule: Record<string, KindDetection> = {}

  for (const s of set.solutions) {
    const doc = parseMarkdown(s.markdown)
    const report = check(doc, pack.rules, pack.lexicon)
    const planted = new Map(s.defects.map((d) => [d.ruleId, d.plantedKind]))
    const judged = judgeCandidates(doc, report.hybridCandidates, pack, flagJudge)
    const flagged = new Set(judged.issues.map((i) => i.ruleId))

    for (const issue of report.hardIssues) {
      if (!planted.has(issue.ruleId!)) {
        violations.push({ solutionId: s.id, ruleId: issue.ruleId!, status: 'fail', note: issue.finding })
      }
    }
    for (const rid of flagged) {
      if (!planted.has(rid)) violations.push({ solutionId: s.id, ruleId: rid, status: 'flag-judge-issue' })
    }

    const statusOf = new Map(report.checklist.map((c) => [c.ruleId, c.status]))
    for (const d of s.defects) {
      const row = detection[d.plantedKind]
      const pr = (perRule[d.ruleId] ??= { planted: 0, detected: 0, pending: 0, missed: 0 })
      row.planted += 1
      pr.planted += 1
      const st = statusOf.get(d.ruleId)
      if (st === 'fail' || flagged.has(d.ruleId)) {
        row.detected += 1
        pr.detected += 1
      } else if (st === 'pending' || st === 'candidate') {
        row.pending += 1
        pr.pending += 1
      } else {
        row.missed += 1
        pr.missed += 1
      }
    }
  }
  return { ok: violations.length === 0, violations, detection, perRule }
}

// ---------- determinism hash (T-EVA-06) ----------

export function checkHash(solutions: { id: string; markdown: string }[], pack: RulePack): string {
  const h = createHash('sha256')
  for (const s of solutions) {
    const report = check(parseMarkdown(s.markdown), pack.rules, pack.lexicon)
    h.update(s.id)
    h.update(JSON.stringify(report))
  }
  return h.digest('hex')
}

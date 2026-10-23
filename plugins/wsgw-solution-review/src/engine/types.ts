// Engine vocabulary. Source of truth: docs/design.md §4, docs/rule-schema.md §1–§4.

export interface Offset {
  line: number
  column: number
  offset: number
}

export interface Range {
  start: Offset
  end: Offset
}

export type Verdict = '通过' | '建议整改' | '不通过'
export type Severity = 'blocker' | 'major' | 'minor'
export type Tier = 'hard' | 'hybrid' | 'soft'
export type Dimension =
  | 'capacity'
  | 'security'
  | 'interface'
  | 'channel'
  | 'data_sync'
  | 'config'
  | 'monitoring'
  | 'documentation'

// ---------- Document model ----------

export interface HeadingNode {
  depth: number
  text: string
  path: string
  range: Range
  bodyRange: Range
  children: HeadingNode[]
}

export interface TableBlock {
  header: string[]
  rows: string[][]
  range: Range
  cellRanges: Range[][]
  sectionPath: string
}

export interface MermaidMessage {
  from: string
  to: string
  arrow: string
  text: string
  line: number
}

export interface MermaidBlock {
  kind: 'sequence' | 'other'
  participants: string[]
  messages: MermaidMessage[]
  range: Range
  sectionPath: string
  raw: string
}

export interface ImageRef {
  alt: string
  range: Range
  sectionPath: string
}

export type Block =
  | { type: 'heading'; node: HeadingNode }
  | { type: 'paragraph'; text: string; range: Range; sectionPath: string }
  | { type: 'table'; table: TableBlock }
  | { type: 'mermaid'; block: MermaidBlock }
  | { type: 'code'; lang: string | null; range: Range; sectionPath: string }
  | { type: 'image'; image: ImageRef }

export interface DocStats {
  bytes: number
  headings: number
  tables: number
  mermaid: number
  paragraphs: number
  images: number
}

export interface Doc {
  hash: string
  title: string
  source: string
  blocks: Block[]
  headings: HeadingNode[]
  tables: TableBlock[]
  mermaid: MermaidBlock[]
  images: ImageRef[]
  stats: DocStats
}

// ---------- Evidence & issues ----------

export type EvidenceKind = 'text' | 'table-cell' | 'mermaid' | 'heading' | 'absence'

export interface Evidence {
  quote: string
  sectionPath?: string
  range?: Range
  kind: EvidenceKind
}

export type IssueTier = Tier | 'expert'
export type IssueOrigin = 'verifier' | 'llm' | 'expert'
export type IssueStatus = 'confirmed' | 'pending' | 'rejected' | 'adopted' | 'rewritten'

export type GateReason =
  | 'NO_RULE'
  | 'SOFT_RULE'
  | 'NO_EVIDENCE'
  | 'QUOTE_TOO_SHORT'
  | 'QUOTE_TOO_LONG'
  | 'QUOTE_NOT_FOUND'
  | 'OUT_OF_CANDIDATES'
  | 'ABSENCE_NOT_ALLOWED'

export interface Issue {
  issueId: string
  reviewId: string
  ruleId?: string
  severity: Severity
  tier: IssueTier
  origin: IssueOrigin
  finding: string
  suggestion: string
  evidence: Evidence[]
  status: IssueStatus
  gate: { passed: boolean; reasons: GateReason[] }
  rewriteText?: string
  seq: number
}

// ---------- Rules ----------

export type SnippetFlag = 'negated' | 'assertion-only' | 'placeholder'

export interface Snippet {
  quote: string
  sectionPath: string
  range: Range
  flags?: SnippetFlag[]
}

export type VerifierStatus = 'pass' | 'fail' | 'candidate' | 'pending' | 'not-applicable'

export interface VerifierResult {
  status: VerifierStatus
  evidence: Evidence[]
  candidates?: Snippet[]
  note?: string
}

export type WhenNoCandidate = 'pass' | 'fail' | 'pending'

export interface SectionParams {
  heading: string | string[]
  minChars?: number
  allowPlaceholder?: boolean
}

export interface TableParams {
  locate: { section?: string; headerAny?: string[] }
  requiredColumns?: string[][]
  minRows?: number
  placeholderCells?: 'fail' | 'ignore'
  requireRow?: { column: string[]; equalsAny: string[] }
}

export interface StatementParams {
  sections?: string[]
  families: string[]
  requireAll?: boolean
  negationWindow?: number
  assertionOnly?: string[]
  causalWords?: string[]
  decisive?: boolean
  whenNoCandidate?: WhenNoCandidate
}

export interface QuantityParams {
  sections: string[]
  contextFamilies: string[]
  units?: string[]
  window?: number
}

export interface MermaidSequenceParams {
  sections?: string[]
  minParticipants?: number
  minMessages?: number
  participantFamilies?: string[]
  requiredMessageFamilies?: string[]
  treatImageAsFail?: boolean
}

export interface CrossRefParams {
  refPattern?: string
  listSection?: string
  listItemPattern?: string
  requireListNonEmpty?: boolean
}

export type VerifierSpec =
  | { kind: 'section'; params: SectionParams }
  | { kind: 'table'; params: TableParams }
  | { kind: 'statement'; params: StatementParams }
  | { kind: 'quantity'; params: QuantityParams }
  | { kind: 'mermaid-sequence'; params: MermaidSequenceParams }
  | { kind: 'cross-ref'; params: CrossRefParams }
  | { kind: 'all'; of: VerifierSpec[] }
  | { kind: 'first'; of: VerifierSpec[] }

export interface Applicability {
  families?: string[]
  sections?: string[]
  tableRows?: { column: string; equals: string }
}

export type RuleStatus = 'active' | 'draft' | 'retired'

export interface Rule {
  id: string
  title: string
  dimension: Dimension
  severity: Severity
  tier: Tier
  question: string
  rationale: string
  suggestion: string
  applicability: Applicability | null
  verifier: VerifierSpec | null
  status: RuleStatus
  provenance: { source: string; examples: string[] }
}

export interface Lexicon {
  headings: Record<string, string[]>
  placeholders: string[]
  negations: string[]
  families: Record<string, string[]>
}

export interface RulePack {
  pack: { id: string; name: string; version: string; scenario: string; description: string }
  lexicon: Lexicon
  rules: Rule[]
}

export interface RuleStats {
  shown: number
  adopt: number
  reject: number
  rewrite: number
}

export interface RuleAudit {
  who: string
  at: string
  reviewId?: string
  change: { field: string; from: unknown; to: unknown }
}

export interface RuleOverride {
  ruleId: string
  status?: RuleStatus
  severity?: Severity
  suggestion?: string
  params?: {
    families?: { add?: string[]; remove?: string[] }
    minChars?: number
    minMessages?: number
    minParticipants?: number
    whenNoCandidate?: WhenNoCandidate
    negationWindow?: number
    window?: number
  }
  draft?: Rule
  stats: RuleStats
  audit: RuleAudit[]
}

// ---------- Check / verdict ----------

export type ChecklistStatus =
  | 'pass'
  | 'fail'
  | 'candidate'
  | 'pending'
  | 'not-applicable'
  | 'soft'
  | 'reviewed-no-issue'

export interface ChecklistEntry {
  ruleId: string
  title: string
  tier: Tier
  severity: Severity
  status: ChecklistStatus
  note?: string
}

export interface HybridCandidate {
  ruleId: string
  title: string
  severity: Severity
  question: string
  snippets: Snippet[]
  note?: string
}

export interface CheckReport {
  hardIssues: Omit<Issue, 'issueId' | 'reviewId' | 'seq'>[]
  hybridCandidates: HybridCandidate[]
  softRules: { ruleId: string; title: string; question: string }[]
  checklist: ChecklistEntry[]
}

export interface VerdictConfig {
  minorThreshold: number
}

export interface VerdictResult {
  verdict: Verdict
  counts: { blocker: number; major: number; minor: number }
  basis: string
}

// ---------- Memory ----------

export type FeedbackAction = 'adopt' | 'reject' | 'rewrite'

export interface Feedback {
  reviewId: string
  issueId: string
  ruleId?: string
  action: FeedbackAction
  reason?: string
  text?: string
  reviewer?: string
  at: string
}

export interface Exemplar {
  ruleId: string
  kind: 'adopt' | 'rewrite'
  text: string
  reviewId: string
  at: string
}

export interface RuleCandidate {
  text: string
  reviewId: string
  issueId: string
  suggestedDimension?: Dimension
}

export interface MemoryRecall {
  stats: RuleStats & { rejectRatio: number }
  warn: boolean
  exemplars: Exemplar[]
  recentRejectReasons: string[]
}

export interface MemoryConfig {
  rejectWarnRatio: number
  rejectWarnMinSamples: number
  exemplarsPerRule: number
}

// ---------- Opinion rendering ----------

export interface OpinionInput {
  reviewId: string
  title: string
  reviewer: string
  finalizedAt: string
  finalVerdict: Verdict
  aiVerdictAtFinalize: Verdict
  issues: Issue[]
  counts: { adopt: number; reject: number; rewrite: number; add: number }
}

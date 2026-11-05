# DA只读审查：核心论证挑战

**criteria_binding_unavailable；NOT_CALIBRATED。** 固定沿用五项盲准则；非正式ARS机器契约，不给期刊对齐或接收裁决。完整阅读[上传稿][M]751行及[摘要补件][A]；未读同伴或历史审稿意见。前置[事实核验][I]仅作线索，Critical另读源码并复跑反例。既有integrity FAIL保留；未修改论文或发布源码。

## 最强反论（约200–300英文词等量中文）

HARK最有力的反对意见不是“没有测试所有大模型”，而是它把三种不同保证写成同一个保证：规则有类型、引文可定位、操作者留有署名，并不共同推出“系统不能自行扩大权限”。原型可以真实地提高结构化检查的检出率，也可以留下有用的审计记录；但提高检出率的原因可能只是更好的解析、否定和占位检测，而非权限类型本身。确定性评估器复用这些线索，恰好不会挑战最需要证明的模型不可信边界。更关键的是，即使完全不使用大模型，现有调用面也允许以参数变化改变无候选时的裁决、激活新的hybrid规则、用任意足够长的字符串充当专家原话，并以可输入的姓名写入最终结论。因而最强替代模型是“带工作约定的可审计检查插件”，不是“由代码强制的人类权限边界”。这不是说实验数字虚假，也不是否认可信团队使用它的价值；它要求作者在两种贡献中选择：要么证明不可由代理伪造的人类批准及有效规则不变量，要么承认批准由可信操作流程提供，把贡献收窄为可检查的规则路由、证据定位和反馈记录原型。后一条路线仍能保留有意义的系统研究，但需要从摘要到结论一致撤回超出实现的安全保证。

## 核心挑战清单

### DA-C1｜Critical：署名和原话字段没有构成人类批准边界

**Typed anchors：manuscript-claim**，[稿件][M]47、76、101、341、353、356、397、619、651行；**code-path**，[工具入口][T]272–334、383–442行，[存储实现][S]493–505、1245–1261、1300–1350行；**executed-counterexample**，[复现测试][R]19、21–24行。

我复跑测试确认：`basis.quote='This is not any human authorization.'`仍能把SEC-003改为blocker；`reviewer='agent-entered-name'`可写最终“通过”；一个真实pending issue未处理，仍可finalize且pending数量为1。工具直接转发代理可填字段，源码没有在这些边界验证独立批准凭据。唯一写入口和非空署名是真约束，但不是“只有专家可写”的认证证明。它击中题名Human-Gated和“每次更新可归因人类决定”的核心，不是一般缺实验。

**边界**：反例是隔离store调用，非真实LLM攻击；未测试宿主账户认证，未证明pilot发生伪造。即使宿主限制登录者，也不能据此把同一会话内代理填入的字符串等同于该人的具体批准。

**最小修复/收窄**：作者可选择撤回代码强制审批主张，明示“可信操作员监督的交互协议；署名为声明性归属，批准真实性依赖外部流程”，并纠正pending拒绝定稿的表述。若坚持强保证，应将批准绑定审核人、动作、对象、版本及一次性状态，代理不得自行产生凭据。

**验收/降级**：强路线须拒绝伪署名、无批准、跨对象或旧版本批准和未完成待办；弱路线须全稿及图表统一外部信任假设，保留未满足项而不宣称已实现。完成后本项可降为明确局限，不永久否决系统贡献。

### DA-C2｜Critical：固定tier不等于固定有效决策权限

**Typed anchors：manuscript-invariant**，[稿件][M]101、239、353、376行；**code-path**，[规则合并][U]284–328行、[存储实现][S]592–646行、[statement校验器][V]46–64行；**executed-counterexample**，[复现测试][R]11–20、29–32行。

复跑得到CAP-001原先无候选为pending，`set_param(whenNoCandidate=fail)`后可产生hybrid自动finding，再改pass则不再待人工；tier始终未变。复制合法hybrid为新ID，draft后accept_draft可直接active；schema证明结构合法，不证明人类批准。合法候选引文提交时另传severity，也可在expert adoption之前成为不同严重度的confirmed finding。该路径说明权限必须至少包括可触发条件、状态转换和结论效力；仅保持类型名称不足以支持“no dashed path widens”或“promotion ... human act by construction”。

**最小修复/收窄**：将effective rule的无候选行为、严重度、启停、新规则激活和reset纳入同一权限模型；合并后重新校验不变量。或者仅声称“既有规则tier字段不可直接编辑”，公开参数、草案和finding严重度是尚未封闭的边界。

**验收/降级**：强路线覆盖pending→fail/pass、agent激活hybrid/hard草案、单finding调级、reset恢复已停用规则的负向测试，并说明权限上限相对于shipped还是当前批准状态。弱路线撤回完整封顶主张后可降级；不能只修图注而保留核心承诺。

### DA-M1｜Major：定位检查既不是严格包含，也不检验蕴涵

**Typed anchors：algorithm/claim**，[稿件][M]316–324、454、607、610行；**static-code**，[gate][G]29–79行及[区间函数][O]38–40行。

gate用`overlaps`，不是引文全部包含于candidate；相交而越界的区间不被该条件拒绝。这是静态谓词差异，未另做在线攻击实验。更根本地，gate输入不含finding语义；同一合格quote配真实或错误指控，位置检查无法区分。故“precision saturated by construction”不能从定位推出；79.2%是gate接受率，不是证据支持率。正文610行已承认gate未提高本配置精度，应以此统一表述。

**最小修复/验收**：明确overlap语义，或补严格包含检查及跨边界测试；分开来源存在、规则相关、语义支持三层。以“真实引文+错误结论”负例说明不保证蕴涵，并把零FP限定于该语料与judge。消解后可保留定位贡献。

### DA-M2｜Major：端到端优势不能归因于typed authority本身

**Typed anchors：comparison/causal-claim**，[稿件][M]419、460、466、547、607、635行；**code-path**，[B0实现][B]65–80行。

B0执行全文关键词存在性检查，不经过同一个flag judge；两组同时更换结构、否定、占位与路由机制。S-full与S-verifier完全相同，未识别span限制的贡献。最强替代解释是“更丰富的确定性检查优于旧关键词原型”。这足以解释现有增益，尚不能单独归于类型权限；确定性结果也不是任意LLM表现的上下界，模型可能漏掉已有cue而使recall更低。

**最小修复/验收**：不强求立刻补全所有实验；改为组合系统比较，删除因果隔离和普遍上下界语言。若保留因果主张，至少固定verifier与judge、只改变authority路由，报告改变及不改变的部件。贡献可定位为架构整合及可检验约束，而非已证实的单机制优势。

### DA-M3｜Major：机器确认、专家采纳与自动结构失败被混同

**Typed anchors：internal-contradiction**，[稿件][M]203、331–343、581–587行；**code-path**，[结论策略][P]6–18行、[check路由][C]74–88行、[存储实现][S]1025–1031行；**executed-counterexample**，[复现测试][R]25–26行。

confirmed已经计入建议结论，不必等adopted；复跑公开syn-rand-46，SEC-002由verifier直接产出hybrid/blocker/confirmed。因此343行“blocker只能专家确认后触发”不成立。表中允许hybrid structural fail，这种设计本身不必非法；43个hybrid TP也不必等于42次gate通过，差额可以是结构分支，不能据此指控造假。

**最小修复/验收**：给出机器确认、专家确认、最终署名三个不同状态；统一算法、表格、案例，分别报告结构分支与judge分支计数。若作者坚持专家先确认才建议Fail，就需改变政策并重评，而非文字悄悄换定义。

### DA-M4｜Major：版本计数不能保证有效知识可重放

**Typed anchors：reproducibility-claim**，[稿件][M]351、376行；**code-path**，[存储实现][S]400–408行；**executed-counterexample**，[复现测试][R]13–16行。

同一规则先覆盖fail再覆盖pass，ovN相同而行为相反；计数不是内容标识。不能从“有审计行”直接推出当前版本字符串能恢复有效知识。

**最小修复/验收**：要么仅称显示用计数，并明确重放依赖另存快照/完整有序事件；要么存有效包内容摘要与不可变版本。两种行为不同的状态须可区分，并能按审查记录恢复。此项不自动否认已有日志的价值。

## 替代解释、利益方与非缺陷

除DA-M2的实现丰富度解释外，合成短语池与校验器共享知识、开发中修复DOC-002、规则作者兼任内部操作者，都可能使当前数据更像回归测试而非外部效度证明。这些是适用边界，不是伪造证据。尚未知真实用户是否相信错误Pass、待办是否被逐项阅读、记忆是否改善后续判断；不得将未知改写为已失败。

易被忽略的是提交方案的团队（错误blocker的申诉与延误）、具名审核人（姓名被代填的责任）、后任规则维护者（同版本不同内容）、安全及隐私人员（审计原话与exemplar暴露），以及承担9个左右待办的实际专家。617行将miss成本概括为“一行记忆”弱化了漏放风险，应区分记录可见与人类实际处理；最小验收是风险与责任分工说明，而非强制新部署研究。

**不是缺陷**：采用合成语料、没有完整LLM消融、三份内部方案、固定确定性judge，均已披露，单独不足以Critical；结构hybrid失败可合理；hard工具拒绝模型登记是真实边界；精度与F1原始数值没有本审查发现的造假证据。就算最终仅是配置集成，若可解释地组织权限、给出可复现实例和失败边界，也可形成系统贡献。Minor可单独处理74与603–613行RQ名称错位，不与权限问题叠加夸大严重度。

## 复核记录与消解条件

2026-11-05于隔离副本执行`./node_modules/.bin/vitest run tests/store/audit-repro.spec.ts`，2 tests通过；七个关键实现文件与原快照逐字节一致。测试不写论文、不生成真实正式意见，虚拟sink仅返回路径。未复跑完整100篇生成实验，未认证在线LLM、宿主登录或保密pilot；前置核验数字不冒充本席独立重算。

两项Critical是对当前“代码保证”的已验证反例，不是对研究永久否定。强路线修边界并复测；弱路线把人类批准改为外部可信流程、把bounded降为局部字段约束，仍可保留检查原型。其余Major均有陈述收窄或局部修复路线。任何路线需作者确认，不在本次执行；integrity FAIL不因选择路线自动解除。现停等新任务。

[M]: </root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex>
[A]: </root/research/hark-audit/manuscript-long-lines.txt>
[I]: </root/research/hark-audit/code-data-integrity.md>
[R]: </root/research/hark-audit/runtime-copy/tests/store/audit-repro.spec.ts>
[S]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts>
[T]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/tools.ts>
[U]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/rules.ts>
[V]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verifiers/statement.ts>
[G]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/gate.ts>
[O]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verifiers/common.ts>
[B]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/baselines.ts>
[P]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verdict.ts>
[C]: </root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/check.ts>

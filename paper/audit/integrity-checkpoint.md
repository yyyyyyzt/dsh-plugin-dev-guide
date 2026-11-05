# HARK／Computers：首轮完整性核验报告与必要检查点

日期：2026-11-05（Asia/Hong_Kong）。**这是完整审查的第一阶段，不是最终五视角审稿意见。** 本轮只读，未修改论文或原始公开代码。

## 1. 核验结论

**事实一致性核验：FAIL／尚不能通过。** 已发现可定位、部分可执行复现的稿件—实现矛盾，统计群体和引用比较也有需要修正之处。此标签不是学术不端认定，也不是期刊拒稿决定。

**ARS机器契约：未完整执行，不能声称PASS。** 当前技能安装未包含上游 `claim_registry_coverage.py` 等完整验证工具；本轮未补造标准sidecar、机器覆盖率或复审契约。现有报告是可追溯的人工/模型辅助核验与实际代码复现，不等于完整ARS机器认证。

**不直接进入投稿定稿。** 用户仅授权审查与计划，未授权修改论文，因此本轮没有运行“改稿→复验”循环，更不会空跑三轮来绕过检查点。若继续以“只读诊断和修稿计划”为目标，应明确该分支不宣称完成ARS修订—复审—最终完整性闭环。

## 2. 材料、覆盖与证据边界

原始文件、角色和哈希见[材料清单](<input-manifest.json>)。主张基准是[上传修订稿](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex>)，SHA-256为 `ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313`。

|核验面|实际覆盖|不能据此声称|
|---|---|---|
|四份文字附件|首次意见1051行、回复171行、全过程875行、修订稿751行，共2848行；摘要长行补读|没有初稿，不能认证真实修订差分|
|压缩包|五篇期刊PDF的完整提取文本，共137页、7707逻辑行，含参考文献|未逐页视觉查图，也未审查其补充数据|
|引用目标存在性|23个显式条目及外部版本补足的17个候选，共40/40有可信源存在性证据|17项实际参考文献依赖未上传；非全字段、全版本元数据认证|
|引用上下文|33/58次引用出现，56.9%，涉及22/40唯一引用|其余25次上下文未核验；抽查中2次仍证据不足|
|有限文本出处抽查|23/74正文块，31.08%，24次真实检索，覆盖7章|不是商业查重、原创认证或无抄袭证明；51块未抽查|
|公开数据|三配置r0逐篇重算；核对r1/r2指标和逐篇记录；重算阈值表|未重新运行完整100篇生成器/消融实验；未重算bootstrap CI、Wilcoxon/Holm|
|公开代码|固定快照静态核查及两个复现测试内多项断言成功|非真实LLM攻击实验；未认证宿主账户安全或pilot中曾发生越权|
|完整测试套件|尝试两次，日志保留；未完整通过|不能确认回复所称450 passed／1 todo|
|保密pilot|只核对稿件描述和公开说明|原始五次运行库、模型配置、三方案及30历史意见未获得|
|PDF编译|未执行|不能确认上传稿24页／0 error|

### 版本不能混同

本次取得固定提交 `b566b08de2976451747215af4dc874a0846f6173` 的下载快照，未把当前main默认为同一版本。其论文源文件实测哈希是 `5e9a39a0168a91abbf4628b85c304fabd73d3f8dbd0e2472f9a22e33b12650cf`：不同于上传稿，也不同于第三方记录所写的 `b415...`。差异原因未确定，不照抄旧记录。Zenodo API及DOI本次抓取失败，归档内容为 **NOT_VERIFIED_ACCESS**，不是“不存在”。

## 3. 关键发现：以新证据校正所有参与方

### IL-SERIOUS-1：完整人工授权保证与工具路径不一致

见[代码与数据核验第2节](<code-data-integrity.md#L13-L29>)及其源代码链接、[复现日志](<audit-repro.log>)。

- `set_param`无需独立授权即可将hybrid的无候选处理从pending改成fail或pass，分别改变自动判缺陷或人工转交行为。
- 合法hybrid草案可以通过draft→accept_draft激活，未要求独立审批凭据。该路径已动态复现；hard草案仅静态分析，不冒称已动态测试。
- gate合法的hybrid finding可携带不同于规则的severity，且专家采纳前即confirmed；直接登记hard finding仍被拒，不能把反例扩大为所有规则均无约束。
- `basis.quote`检查字符串长度，不验证真实来源和变更批准语义。明确不表示人类授权的长句也可通过。
- 代理可传入final-verdict动作及任意署名；这是动作/署名要求，不等于已认证人类身份门禁。没有测试或否定宿主所有访问控制。
- reset也会改变生效的severity/status/params，不能一概当作无权限影响操作。

**最低纠正方向**：系统保证必须与真实强制边界一致；要么补上绑定身份、目标、diff和动作的审批机制并验证，要么明确只是代理遵守的交互协议。仅把tier写成不可变，不足以证明裁决权限不变。

### IL-SERIOUS-2：pending仍可定稿，和论文列出的拒绝条件相反

[上传稿:397](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L397>)把open pending列为finalize拒绝条件。本次在真实store/backend、虚拟交付sink中复现：真实pending issue仍在，记录已finalized。不是单纯界面文字，也不是只有checklist pending。

**最低纠正方向**：明确pending的终态要求和专家豁免规则，并使代码、表格与正式意见一致。当前不能写成已强制逐项解决。

### IL-SERIOUS-3：建议结论与人工采纳时序矛盾

[上传稿:341–343](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L341-L343>)一处允许gate-confirmed进入建议结论，一处称hybrid blocker仅在expert确认后触发。代码及案例支持前者。

另已解开“43项hybrid TP但42次gate通过”的差额：**42次judge→gate通过＋1次默认SEC-002结构校验直接fail＝43**，不是算术错误。该结构路径与tier表允许structural fail相容，但进一步否定“所有blocker必须先经专家确认”的文字。应区分verifier-confirmed、gate-confirmed、expert-adopted和finalized。

### IL-SERIOUS-4：clean、defective与政策合格分母混用

原始公开记录重算如下，见[数值核验](<code-data-integrity.md#L64-L81>)：

|群体/指标|正确计数|解释|
|---|---:|---|
|零植入缺陷|13篇|13篇均无finding|
|至少一个植入缺陷|87篇|包含政策允许的少量minor缺陷|
|expected Pass|30篇|其中17篇有minor缺陷，15篇确有finding|
|expected Revise或Fail|70篇|这才是15/70 under-call的分母|
|expected non-Pass→Pass|10/70＝14.29%|6个Revise→Pass＋4个Fail→Pass|
|expected Fail→Pass|4/23＝17.39%|严重子集，不是全部错误放行|
|expected Fail→非Fail|9/23＝39.13%|4个Pass＋5个Revise|
|predicted Pass中错误Pass|10/40＝25%|与10/70不同的条件概率|

因此摘要/结论的“15 of 70 defective … four … to a pass”需要明确群体：对70个政策预期非Pass文档而言，是10个被建议Pass；4只属于原本应Fail子集。不能把87个有缺陷文档中27个Pass全部当作政策错误，因为17个本就符合minor阈值下的Pass政策。

**也必须校正第三方意见**：其“30/30 clean无finding”不是经本次数据支持的事实。不能一面批评作者分母，一面照抄第三方的同类混用。

### IL-SERIOUS-5：引文可定位不等于证据充分，也不保证precision

- 79.2%实际是42/53 **gate acceptance**，不是语义证据正确率。11次拒绝全为过短，损失了已植入真缺陷的确认机会。
- [上传稿:454](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L454>)把precision饱和归因于gate，但[讨论:610](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L610>)自己说明本配置未测得gate提高precision。
- gate实现检查范围 **overlap**，不是完整 **containment**；定位优先级也与算法第316行不同。这里为静态代码证据，未另做跨边界引文的动态攻击测试。
- 确定性judge的0.387不能无条件称真实LLM召回下界，79.2%也不能据此定义真实模型gate usefulness上界。

**最低纠正方向**：分别报告定位、候选区域约束、语义充分性和门禁接受率；只保留实际检验过的保证。

### IL-SERIOUS-6：B0比较没有独立识别typing的效果

B0直接进行关键词存在性判断，并未经过同一个flag judge；它仍使用解析/适用性逻辑，故也不能反过来称它完全不解析结构。论文“same structure-only judge”不准确。B0与S-full同时改变多种机制，现有差异只支持指定端到端配置比较。

同源policy标签及self-check可用于回归，但不能直接替代独立专家判定。尤其[上传稿:413](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L413>)说每个植入规则都fail，并不符合self-check实际行为：pending/miss被统计，而不全部记为违规。这不意味着85个漏检把自检程序算坏了，而是正文对自检保证说得过强。

### IL-SERIOUS-7：版本标签不足以保证重放

同一规则的override先fail后pass，`ovN`不变，已动态确认。它能标示override条数，不能唯一标识知识内容。完整日志/快照可能另行支持重放，但不能把该能力归给计数串本身。作者回复已承认此点，正文仍需同步。

### IL-SERIOUS-8：相关工作的负能力比较存在反证

完整逐项记录见[引用核验](<references-integrity.md>)。

1. [PolicyGuard Appendix G](https://arxiv.org/html/2606.32004v1#A7)明确有构建/验证期专家修订与审计追踪。“no feedback loop”需限定，不能无条件使用；这也不意味着对方已实现HARK完整部署后learned layer。
2. [Lin的CodeRabbit描述](https://arxiv.org/html/2607.03316v1#S2.SS1)及[官方Learnings文档](https://docs.coderabbit.ai/knowledge-base/learnings)支持用户查看、编辑、删除学习记录，反证工业系统一概“reviewer看不见/不能撤销”的表述；不据此推断等同HARK全部回滚与权限保证。
3. BitsAI-CR的RuleChecker和ReviewFilter均为fine-tuned LLM，规则taxonomy也会更新，不宜暗示只有模型/filter内部学习。
4. 第623行把process-control故障/行动核验称为design-document verification，研究对象错配。

引用目标存在不等于引用论证成立。此轮40项中没有可判为捏造的引用目标，但不能给相关工作比较整体盖章。

### IL-MEDIUM-1：研究问题跨章节换义

[引言:74](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L74>)列auditability／typed authority／growth／bounded growth；[讨论:603–613](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L603-L613>)却回答verifiability tension／typing／gate／decision memory。需要先固定问题及可支持它们的证据，不用未做实验的计划填充“已回答”。

### IL-MEDIUM-2：F1差值需标明聚合，不是简单算错

- 主表micro-F1差为 `.7980997625 − .2216981132 = .5764016493`。
- 逐篇F1均值差为 `.7797611833 − .2161269841 = .5636341991`，对应文中 `.564`。

所以不能直接把+.564指为造假或算术错误；应明确它是mean paired per-proposal差，不能与相邻micro指标混写。检验设计和区间充分性留待正式方法审查，本轮未重算对应推断统计。

### IL-MEDIUM-3：引言例子内部矛盾

[第59行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L59>)先称类比满足例没有keyword family，末尾又称All four contain the keyword；“Only one is a pass”与前述满足例指代也需澄清。

### IL-MEDIUM-4：投稿材料与声明仍有缺项

实际上传源缺少所引用的外部bibliography，17个cite key无法仅凭上传源解析；作者、ORCID和贡献仍占位。前者是本次材料缺口，后者可能为匿名供审，均不推断作者实际不存在完整材料。摘要近似318词，超过[官网约200词指导](https://www.mdpi.com/journal/computers/instructions)。AI致谢缺工具名称/版本，实质设计、代码、分析使用范围也应按实际情况核实披露。

## 4. 可保留的结果，以及不能继承的“通过”

### 本轮支持

- 指定公开合成记录的S-full为TP168／FP0／FN85，B0为47／124／206；主要precision、recall、F1及κ可重算对应。
- hard为125/17、hybrid为43/68（TP/FN）；blocker为17/18。
- 68/85漏检被pending覆盖；pending列表总932、篇均9.32、中位9，不能当作人工解决数或独立缺陷数。
- S-full与S-verifier在指定确定性judge下相同，重复的指标与逐篇记录一致；不意味着真实LLM稳定。
- 稿件已经明确三份内部文档、五次团队运行，也披露了关键负面结果。这些应保留，而不是为了修稿删掉。

### 测试结果的诚实边界

最小复现2/2通过，支持具体反例存在。完整套件第一次因副本层级/宿主依赖等未通过；第二次恢复层级并补一项peer后为366 passed、1 todo、1 failed、3 suite加载失败。加载失败涉及缺宿主依赖；另一个失败是发布快照的忽略配置缺少测试预期的私有数据目录条目。不能将环境加载失败当算法错误，也不能确认作者所称450 passed／1 todo。详见[完整日志说明](<code-data-integrity.md#L93-L125>)。

### 历史材料也需纠偏

作者拒绝把标题改成Reliable、拒绝在本轮承担所有真实数据/双专家/纵向研究，并非本身不合理。第三方对部分完成度的批评有证据，但其B档“已经达到门槛”的归因偏强，某些行号、DOC-002转述、clean分母及仓库哈希也需修正。逐项36条登记见[历史矩阵](<history-integrity.md>)，不以任何一份意见为不可质疑的标准。

## 5. 七项研究失效模式检查

下列为风险筛查标签，不推断作者意图；SUSPECTED不等于已认定造假。

|模式|状态|本轮依据与尚缺材料|
|---|---|---|
|1 实现问题漏过自审|SUSPECTED／存在直接反例|多项权限与pending保证被具体调用反例否定；现有测试通过不能认证整个保证|
|2 引用失真|SUSPECTED（上下文层）|目标40/40存在，但若干负能力全称和对象描述失真；不指控虚构文献|
|3 实验结果无执行依据|INSUFFICIENT EVIDENCE（pilot）；合成核心计数有记录支持|未取得内部运行库和模型配置；不能把有JSON等同全部实验已独立重跑|
|4 依赖捷径而外推|SUSPECTED／待方法审查|固定词池、规则flags、同源policy标签没有排除独立泛化替代解释|
|5 将bug写成新发现|INSUFFICIENT EVIDENCE|未发现可确定的该类行为；没有修前开发轨迹，不能认证排除；DOC-002修复故事仅作者陈述|
|6 方法描述与实际执行不符|SUSPECTED／有事实差异|同judge、self-check、human-only final、pending门禁等描述与实现不同|
|7 早期框架锁定|SUSPECTED（叙述风险）|RQ换义、B0优势归因typing、未测growth仍承担保证；需重新选择主张范围|

实验来源核验边界：**This check verifies disclosure and claim-to-provenance fidelity. It does not judge whether the experiment was correctly designed, run, statistically adequate, or reproducible by ARS.** 本报告另列的实际程序运行仅验证其明确覆盖的调用反例和记录重算，不扩大该边界。

## 6. 期刊参照与后续审查范围

[官方要求取证](<journal-official-requirements.md>)确认Article及Software两种可能路径，但Software不是免验证入口。[五篇参照报告](<journal-reference-evidence.md>)完整读取后发现：四篇综述、一篇结构化专家综合型Article，没有一篇是直接同型的新系统受控实验。它们可以帮助把“设计理由”“实现可执行”“机制效果”“真实用户收益”分开，不能证明HARK已达门槛，也不能推出两模型/双专家等统一配额。

拟开展的五个角色：期刊适配与文章类型；软件工程实验方法与统计；需求工程/神经符号近邻贡献；人机协同与部署边界；反方权限与证据挑战。它们是同模型体系中的角色分离，不宣称统计独立或代表期刊真实评审。

## 7. 检查点：请确认下一步

原始目标是意见和计划而非代写。建议选择：

**A. 继续只读诊断（推荐）**：保留本轮所有未解决项，不把完整性状态改为PASS；进一步审查后输出最终修稿意见、完整回应矩阵、最小可行与增强路线、验收清单。该结果是审查/修稿咨询，不宣称ARS完整修订—复审—定稿十阶段已完成。

**B. 严格继续完整ARS修订闭环**：先补充对应版本的完整源包与实验材料，并明确授权修订范围；修正后重新核验，再进入正式评审及后续必要检查点。

本轮进度：已完成一次只读核验；论文修改0次，修订循环0次，修复复验循环0次；已完成入口确认1次，当前停在必要检查点。没有为达到自动放行条件伪造循环或隐去问题。

## 8. 可追溯分报告

- [历史意见—回复—现稿—第三方矩阵](<history-integrity.md>)
- [代码、数值与最小复现](<code-data-integrity.md>)
- [引用逐条核验及上下文](<references-integrity.md>)
- [有限文本出处抽查](<originality-screen.md>)
- [五篇期刊参照证据](<journal-reference-evidence.md>)
- [期刊官方要求](<journal-official-requirements.md>)

以上工作由角色分工的同模型子任务完成，协调层复读报告并核对关键证据；未使用外部跨模型评判，不将分工称为独立误差过程。原稿、初稿缺失、私有数据缺失与未运行验证器的边界始终保留。

# R1 方法与统计只读审查

## 总体建议与边界

**咨询建议：Major revision。NOT_CALIBRATED；criteria_binding_unavailable。** 不是期刊决定，不宣称符合Computers正式评审标准；前置integrity FAIL保留，不因本报告而转为通过。遵循[R1预承诺](</root/research/hark-audit/panel/r1-criteria.md>)，未读同伴输出或历史review。已完整阅读[上传稿](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex>)751行及[摘要补件](</root/research/hark-audit/manuscript-long-lines.txt>)，读取[前置事实核验](</root/research/hark-audit/code-data-integrity.md>)、[重算记录](</root/research/hark-audit/recomputed.json>)与相关评测代码。未执行完整实验重跑；重算记录只支持已保存结果的再聚合，bootstrap、显著性和内部pilot尚未独立复核。

本席认为现有证据足以支撑“确定性审查机制及合成回归评测”，不足以把整体增益归因为typing，或确认真实LLM与人工闭环的有效性。没有把未知当错误，也不把可修复的口径问题升为Critical；安全实现反例沿用前置核验状态，不重复逐条审理。

## 实质优点

1. [稿件419、632–638行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L419>)主动区分确定性judge、真实模型、内部开发者演练与独立专家研究，这是有价值的限制披露，不应因未做完整在线试验就否定工程贡献。
2. [稿件480–515行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L480-L515>)同时报告tier、严重性、缺陷类别和silent misses，揭示blocker召回低于总体；公开逐篇记录允许校核TP/FP/FN，优于仅给一个总分。
3. [稿件415–416行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L415-L416>)披露测试促成规则修复。这对回归测试是优点，问题在于不能同时将该数据当未接触留出集。

## Major意见

### R1-M1 整体系统差异不识别typing效应

**锚点类型：manuscript_span + code_path。** [稿件419、460、466、606–607行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L460-L466>)称相同judge隔离机制，并把改善归给typing；但[评测分支106–118、143–158行](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/ablation.ts#L106-L158>)显示B0独立调用runB0，不进入flag judge。两组同时改变关键词、结构、否定识别、候选与gate。历史弱基线可保留，公平性不足以支持组件因果解释；S−verifier相同也不证明scoping无价值。

**最小修复／验收：** 列出配置实际变化，改为“整套实现相对历史关键词基线”；把typing性能归因改为待检验假设，全篇不再称共同judge或隔离typing。若坚持组件因果主张，保持规则内容、检测器、输入与判定器不变，仅改变权限路由，并说明合法反事实及其新增能力。**替代收窄：** 不新增实验，定位机制示范。**影响：** 保留数值差，撤回未经识别的原因解释。

### R1-M2 标签、自检和抽样单位限制外推

**锚点类型：manuscript_span + code_path。** [稿件413–416、632行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L413-L416>)与[生成／自检669–770行](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/synthetic.ts#L669-L770>)表明expected verdict由植入规则和同一policy生成，自检调用同一check及flagJudge。代码只把非植入规则被报出列作violations，植入缺陷pending或miss会计数，不要求全部fail。因此“每个植入规则均fail”已被代码反证；标签语义是否经独立专家确认则是未知，不是已证实错误。100篇共享有限短语池，253缺陷、2300规则—文档对不是独立样本；三次确定性重复也不是新增样本。

**最小修复／验收：** 明示回归集兼开发集、标签生成过程及修复历史，纠正self-check定义；CI说明只针对当前生成分布的proposal重抽样，报告模板／短语复用及空真值F1约定。泛化主张应采用冻结代码后、按模板或来源族隔离的独立编写留出集，标签盲于系统输出；规则标注和分歧裁决留痕。**替代收窄：** 保留固定测试集描述统计，不以p值证明真实提案普适优势。**影响：** 独立性决定推断范围，不以统一样本门槛代替设计判断。

### R1-M3 安全结果分母与估计目标混用

**锚点类型：manuscript_span + derived_data。** [摘要47、结果460–462、结论653行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L460-L462>)与[重算42–80、149–161行](</root/research/hark-audit/recomputed.json#L42-L80>)不一致：无植入缺陷13篇，有缺陷87篇；30是政策expected Pass，其中17篇有minor缺陷。70只能称应Revise／Fail，不是所有defective。15/70低判中共有10篇变Pass；4/23仅是应Fail却Pass，另5/23变Revise。预测Pass的40篇中10篇政策错误，即10/40；不要把政策允许的minor-defective Pass也叫false-clear。

**最小修复／验收：** 摘要、结果、结论用同一混淆矩阵逐项生成，分别报告10/70、4/23、9/23与10/40及定义；“clean无finding”明确13/13。F1表为micro差+.576，逐篇均值差才是+.564，应标注两种estimand及配对检验对象，而非宣称+.564算错。**替代收窄：** 删除歧义概括，只呈矩阵和条件比例。**影响：** 直接改变读者对放行风险的理解，必须先于新增实验修正。

### R1-M4 pending覆盖不是人工补救，gate接受不是语义有效

**锚点类型：manuscript_span + code_path + derived_data。** [稿件454、496、541–543、635行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L541-L543>)把定位、precision与上下界联系过强。[评测236–257行](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/ablation.ts#L236-L257>)实际测gate接受42/53，不测引文是否蕴含缺陷。68/85=80%只是漏检的待办覆盖；总待办932、篇均9.32，未证明人读、解决或减少最终漏检。无定位错误的judge不能建立真实模型precision上界／recall下界；模型可能误判已有cue，也可能修复短引文。

**最小修复／验收：** 改名gate acceptance；区分检测、转介与最终人工裁决。报告待办总量、含真缺陷待办比例及严重性分层；在当前23条可验证规则口径，68/932约7.3%只叫植入缺陷命中率，不能当现实待办价值。明确决定覆盖率的分母与abstention条件；现有系统仍给每篇建议结论，不能把pending直接当文档级拒答。删除无证明上下界和“引文可定位所以precision为1”。**替代收窄：** 仅称当前配置观测值和转介能力。**影响：** 防止以选择性报告隐藏人工负担、silent misses与过度信任。

## Minor意见及澄清

- **R1-m1，manuscript_span + audit_result：** [稿件481、541行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L481>)的43 hybrid TP与42 gate通过不是算术矛盾；[核验31–39行](</root/research/hark-audit/code-data-integrity.md#L31-L39>)定位额外1条为SEC-002结构verifier直接fail。最低修复是路径表列125 hard、1 hybrid结构、42 hybrid judge；验收为168合计一致。不要把43全叫LLM发现；若仍声称所有blocker需专家确认，则成为实质Major而非表注问题。
- **R1-m2，manuscript_span：** [稿件74与603–613行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L603-L613>)RQ编号与内容漂移。逐项对齐问题、仪器、结果、未测量栏即验收；这是低成本一致性修复。
- **R1-m3，manuscript_span：** [稿件597、638行](</root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex#L597>)五次运行包含修订重审和重放，独立提案仅三篇；15/18接受不能当泛化准确性。补模型／提示／版本、运行与提案映射及脱敏事件表，保留“流程演练”即可。保密材料真实性目前未独立核实，不能据此断言造假。

## 最小修稿路线与可选补证

**路线A：现有证据优先。** 先冻结并标明制品版本，解决前置integrity反例或收窄对应保证；统一指标定义与RQ，修正上述分母和路径；将结论限定为确定性机制、开发性合成回归集与内部流程演练。补齐复现命令、依赖、原始结果到表格的脚本；版本标记不足以唯一重放的问题参见[核验26行](</root/research/hark-audit/code-data-integrity.md#L26>)。此路线无需强行新增大规模LLM矩阵，但修词不能把已知实现缺陷变成“已保证”。

**路线B：保留真实LLM机制效果。** 先指定估计目标：gate对错误确认／真缺陷丢失的影响，或scoping对同模型审查质量的影响。gate可对同一批模型原始输出做配对启闭重放，另报重试策略；scoping需固定模型、规则、提示骨架、预算和policy，只改变全文／候选输入。检测质量用独立盲标，定位与语义充分性分别判定；保存模型标识、解码、输出及拒绝原因。选择能覆盖缺失、空洞、否定、占位和合规近似文本的留出材料，尤其覆盖blocker及越界引文机会。重复运行只在测随机性时需要；第二模型只在主张跨模型稳健性时必要，不强制2×6×3。

规模按预期风险率与区间精度、可用独立来源及预算确定；少量探索案例可先验证流程，但不能承担低漏检率保证。若保留“memory改善后续审查”，需进一步控制时间、难度与学习效应，优先随机化／交叉或合适同期对照，不能只用前后两阶段代替因果识别；否则保持未来工作。所有选择均供作者裁决，不代表期刊门槛。本轮不改稿，停等下一任务。

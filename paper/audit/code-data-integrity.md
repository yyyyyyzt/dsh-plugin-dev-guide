# ARS Stage 2.5：实现与数值独立核验

日期：2026-11-05。用途：实现—数据—上传稿一致性核查，不作正式审稿裁决。不将第三方记录的判断当作事实；该记录875行已完整阅读。

## 1. 版本与核查边界

- 固定解压快照标识：`b566b08de2976451747215af4dc874a0846f6173`。本地为下载解压目录而非有`.git`的工作树；未重新认证远端提交历史。
- 主张基准为[上传稿](/root/.dsh/attachments/v1/files/ff/ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313/main.tex)，SHA256=`ff4a080292c880f2d4d32484c5811865bd4471c301656846db93fd3401a49313`。
- 本地[仓库稿](repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/paper/mdpi-article/main.tex)实际SHA256=`5e9a39a0168a91abbf4628b85c304fabd73d3f8dbd0e2472f9a22e33b12650cf`。这既不同于上传稿，也不同于第三方记录所报`b415...`，故第三方该hash不能照抄。此处不推断差异原因，也未核验Zenodo归档内容。
- 原始快照代码未修改。运行依赖及新增复现用例仅置于独立副本。插件版本`0.1.0-dev.1`；数据`synthetic-v1-seed20261029`，rule pack `capability-open-access@1.0.0`，judge=`flag`，model=`none`，minorThreshold=3。
- “静态”表示读取代码路径；“运行”表示本次执行断言成功；“重算”表示从公开perSolution/perRule记录独立聚合，不等于真实LLM重新实验。本次未执行完整`eval:gen`/`eval:ablation`重新生成公开100篇实验结果；全套测试中的synthetic/ablation测试执行不应表述为该完整实验的独立重跑。

## 2. 逐项核验：权限和状态

| 指控 | 核验结论及限定 | 直接代码证据 |
|---|---|---|
| set_param绕过severity/status权限检查 | **静态+运行成立**：CAP-001的whenNoCandidate由pending改fail，产生hybrid verifier-confirmed finding；再改pass消除pending；均无需basis。不能仅以tier未变宣称权限不变。不是任意字段皆可改，存在参数白名单。 | [src/host/store.ts:487-499,592-606](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L487-L499>); [src/engine/rules.ts:284-328](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/rules.ts#L284-L328>); [src/engine/verifiers/statement.ts:46-64](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verifiers/statement.ts#L46-L64>) |
| accept_draft可由代理激活 | **静态+运行成立**：复制一个合法hybrid规则为新ID，经draft再accept_draft即可active，无独立审批凭据。schema校验并非身份审批。现有tier无直接编辑入口不等于不能添加新hybrid/hard规则。 | [src/host/tools.ts:385-442](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/tools.ts#L385-L442>); [src/host/store.ts:608-646](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L608-L646>); [src/engine/rules.ts:256-279](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/rules.ts#L256-L279>) |
| finding severity覆盖规则锁 | **静态+运行成立**：合法candidate引文通过gate后，输入severity可不同于规则severity，finding在专家adopt前即confirmed。hard规则手工登记被拒，这条绕过不适用于直接登记hard finding。 | [src/host/tools.ts:216,248](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/tools.ts#L216>); [src/host/store.ts:997-1032](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L997-L1032>); [src/engine/verdict.ts:6-25](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verdict.ts#L6-L25>) |
| basis.quote为人类授权证明 | **不是**：仅字符串normalize后长度门槛。任意长句“This is not any human authorization.”成功将SEC-003设blocker。第三方所举major引语被用于blocker的原测试确实存在。细节修正：实现将连续空白折叠为单空格再trim，并非删除全部空白。 | [src/host/store.ts:493-505](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L493-L505>); [tests/store/authority.spec.ts:20,52-68](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/tests/store/authority.spec.ts#L20>) |
| final verdict仅专家可写 | **仅唯一动作/署名约束，不是认证角色约束**：代理工具可传set_final_verdict和reviewer；运行中任意`agent-entered-name`即可写。未测试宿主账户安全，也未证明实际实验发生恶意调用。 | [src/host/tools.ts:272-334](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/tools.ts#L272-L334>); [src/host/store.ts:1237-1261](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L1237-L1261>) |
| pending阻止finalize | **上传稿397与实现不符，运行反例成立**：登记一个pending issue，写finalVerdict，通过虚拟sink finalize后status=finalized且pending仍1。不是只有checklist pending，而是真实issue pending。 | [src/host/store.ts:1300-1350](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L1300-L1350>) |
| hybrid blocker专家确认后才计结论 | **与代码不符**：confirmed/adopted/rewritten均计数；gate-confirmed已可Fail。另有默认SEC-002结构校验直接fail路径，见下节。上传稿341较准确，343“only after expert”不成立。 | [src/engine/verdict.ts:6-18](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verdict.ts#L6-L18>); [src/host/store.ts:1031](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L1031>); [src/engine/check.ts:74-88](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/check.ts#L74-L88>) |
| dashboard身份审计 | **静态成立但用语应降级**：存储的是固定渠道字符串dashboard，不是具体审核人身份；本核查不否认宿主HTTP访问控制可能存在。 | [src/host/api.ts:251-259](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/api.ts#L251-L259>) |
| reset无需basis | **静态+运行成立**：reset恢复shipped severity/status/params，可撤销先前人类降级/停用；是否“扩权”依赖ceiling定义，不可普遍称无影响。 | [src/host/store.ts:573-590](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L573-L590>) |
| ovN可重放 | **标识不唯一，运行证明碰撞**：同CAP-001一个override先fail后pass，version相同。只表示override规则条数，不能唯一恢复有效内容；完整日志/快照另行保存可能支持重放，但ovN本身不支持。 | [src/host/store.ts:400-408](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/host/store.ts#L400-L408>) |
| 算法定位顺序 | **静态差异成立**：实际“candidate且section→candidate→section→first”，上传稿316是“section→candidate→first”。此外实现判断overlaps，不是严格包含；不可把`inside`文字误读为完整区间containment保证。 | [src/engine/gate.ts:61-75](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/gate.ts#L61-L75>) |

以上运行使用真实store/domain JSON backend，但未经在线模型、不含真实用户点击。证据支持“这些调用可成功”，不支持“实际pilot中模型曾绕过人类”。

## 3. 43 hybrid TP 与42 gate通过：不是加总错误

从逐篇记录发现唯一差额在`syn-rand-46`：预测包含hybrid规则SEC-002，但submitted=0、gateRejects=0。

本次对原文直接运行check，得到SEC-002：tier=hybrid、origin=verifier、severity=blocker、status=confirmed，finding为“缺少步骤：openid、phone、bind-check”。规则使用first(mermaid-sequence,statement)，结构分支已给出fail；`check`将所有verifier fail写入名为hardIssues的数组而保留原tier。因此：

**43 = 42 judge提交后gate通过 + 1 hybrid规则结构校验直接fail。**

规则证据：[rules/capability-open-access.rules.yaml:193-215](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/rules/capability-open-access.rules.yaml#L193-L215>)；路由：[src/engine/check.ts:74-88](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/check.ts#L74-L88>)；评测合并：[src/eval/ablation.ts:143-158](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/ablation.ts#L143-L158>)。这不自动证明实现违反其允许结构失败的设计，但进一步否定“所有blocker只能专家确认后触发”的文字。不能把全部43都称为gate-confirmed/LLM发现。

## 4. 原始eval记录重算

读取三配置r0的perSolution，从truth/predicted集合重算TP/FP/FN及混淆矩阵；另检查r1/r2的metrics和perSolution均与各自r0完全相同（完整JSON的runId/repetition/at当然不同）。

| 指标 | B0 | S-full（S-verifier相同） |
|---|---:|---:|
| 文档数 | 100 | 100 |
| TP / FP / FN | 47 /124 /206 |168 /0 /85 |
| micro F1 | .2216981132 | .7980997625 |
| mean per-proposal F1 | .2161269841 | .7797611833 |
| verdict accuracy | .28 | .85 |
| Cohen κ | -.0427226647 | .7625079164 |
| F1=1文档数 |4 |42 |
| per-proposal F1中位数 |0 |.8571428571 |

S-full真阳性/漏检：hard125/17、hybrid43/68；blocker17/18、major99/42、minor52/25。对应recall：168/253=.6640316，blocker17/35=.4857143，hybrid43/111=.3873874。

Gate：提交53、拒绝11、接受42，接受率42/53=.7924528；11次均QUOTE_TOO_SHORT。FN中68被pending覆盖，68/85=.8；pending列表总932，篇均9.32，min/median/max=6/9/13。这是rule-level待办，不是932个独立真缺陷，更不是实际人工解决率。

### 4.1 ΔF1的独立澄清

上传稿460的+.564并非必须判为算术错误：代码[src/eval/ablation.ts:374-384](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/ablation.ts#L374-L384>)明确定义配对差为逐篇F1均值之差，重算=.5636341991，四舍五入+.564。表中aggregate micro F1之差则=.5764016493，四舍五入+.576。应标明两种estimand，不能把+.564直接写成前一句aggregate F1的差。第三方未指出此aggregation区分。

### 4.2 “clean 30”“defective 70”及false-clear分母

**第三方记录的“30/30 clean方案无finding”不成立；30是expected Pass，不是零植入缺陷。**

- 真正truth为空13篇，全部无预测finding（13/13）；truth非空87篇。
- expected Pass30篇中17篇有minor缺陷：15篇有预测finding（12篇1条、3篇2条），其余2篇漏掉minor。故expected Pass30篇中只有15篇无finding；若“clean”意为无缺陷，分母应13。
- expected non-Pass为70篇，15篇under-call；若分母采用所有有植入缺陷文档则为15/87，不是15/70。70只有在明确定义“需Revise或Fail的文档”时正确。
- S-full混淆矩阵（行truth、列prediction，Pass/Revise/Fail）：`[[30,0,0],[6,41,0],[4,5,14]]`。
- 应Fail却Pass：4/23=17.39%；应Fail但非Fail：9/23=39.13%；这是严重误放行/降级的不同定义。
- 所有应non-Pass却Pass：10/70=14.29%，不是4/70；包括6个Revise→Pass和4个Fail→Pass。
- 在全部40个predicted Pass中，错误Pass10/40=25%；其中本应Fail4/40=10%。
- 87个有缺陷文档中27个predicted Pass，但其中17个minor-defective本来按政策允许Pass，不能把27/87都叫政策false-clear。

因此摘要/结论“15 of 70 defective proposals under-called (four to a pass)”混合了不同群体：four仅指23个expected Fail子集；对70 expected non-Pass总体应为ten to a pass。应展开分子/分母，避免一条数字承担不同定义。

### 4.3 阈值表与重复

从S-full预测rule severity重新施加policy：theta1 accuracy=.72、κ=.5341098，theta2=.82、κ=.7126895，theta3/4/5均=.85、κ=.7625079。theta1对expected Pass产生15个over-call，恰与该组15篇有finding吻合；这也反证将30篇全称为无finding的clean组。

## 5. 第三方其他具体代码指控

- **B0不走flagJudge：成立。** [src/eval/baselines.ts:65-80](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/baselines.ts#L65-L80>)全文关键词存在性+同verdict policy；但“无结构”只能作概括，B0仍parseMarkdown并调用isApplicable，不能绝对说完全未解析结构。上传稿460“same structure-only judge”不准确。typing、verifier、范围、negation等同时变化，端到端差不能独立归因typing。
- **标签/自检同源：成立。** [src/eval/synthetic.ts:669-704](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/synthetic.ts#L669-L704>)targetVerdictOf生成expectedVerdict；730-770调用同check和flagJudge做self-check。这是执行一致性/合成回归证据，不是独立专家判定正确率。
- **self-check“每个植入规则都fail”不成立。** 源码只把未植入却fail/flagged列violations，植入的pending/missed被计数而非全视为失败。上传稿413过强；85 FN并不意味着self-check错误实现，它本就不是“所有缺陷必须被发现”的断言。
- **S-verifier不隔离真实LLM span效果：成立。** 其改变hybrid statement章节scope，flag judge仍读候选flags；三次确定性结果相同不能被当作跨模型/提示稳定性实验。
- **evidenceValidity实际为gate acceptance：成立。** [src/eval/ablation.ts:236-257](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/eval/ablation.ts#L236-L257>)仅(submitted-rejected)/submitted，不测语义充分性。原本precision=1也不能仅由引文可定位推出。
- **同一评价集修DOC-002**：上传稿416确有该历史陈述，但本次未取得修前版本/完整开发轨迹，故“历史事实”仅是作者自述，不当作本次动态复现结论。
- 未独立重算bootstrap CI、Wilcoxon/Holm或pilot统计；表中其余这些统计不能被本报告的“核心数字重算”覆盖。没有真实LLM、保密文档、真实审批轨迹或PDF编译。

## 6. 命令、运行结果与材料

先读取[package.json:52–66](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/package.json#L52-L66>)的scripts，再复制运行，未调用prepare/build或修改原始源文件。

```bash
pwd
sha256sum <uploaded-main.tex> <snapshot>/paper/mdpi-article/main.tex
cp -a <snapshot>/plugins/hark /root/research/hark-audit/runtime-copy
# workdir=runtime-copy
npm install --ignore-scripts --legacy-peer-deps
npm test
npx vitest run tests/store/audit-repro.spec.ts
# 恢复原始两级仓库层级，并补宿主peer依赖后重试：
cp -a <snapshot> /root/research/hark-audit/runtime-tree
ln -s /root/research/hark-audit/runtime-copy/node_modules /root/research/hark-audit/runtime-tree/plugins/hark/node_modules
npm install --ignore-scripts --legacy-peer-deps --no-save @deepseek-ai/dsh-scope@0.2.1-rc.2
# workdir=runtime-tree/plugins/hark
npm test
python3 /root/research/hark-audit/recompute.py > /root/research/hark-audit/recomputed.json
```

环境：Node v24.22.0，npm11.19.1，实际安装Vitest3.2.7（package范围^3.2.4）。首次npm install退出0；首次全套退出1：363 passed/1 todo/1 failed，另4 suite加载失败，原因是缺宿主peer `dsh-scope`和只复制插件导致`.gitignore`相对路径不存在；不应将其当算法缺陷。第二次保留原仓库层级后退出1：366 passed/1 todo/1 failed，3 suite加载失败。加载失败变为缺宿主peer `dsh-sandbox`；anonymize测试则实质发现发布快照根.gitignore没有其断言要求的`paper/data/private/`条目。后者是发布制品与测试预期不一致（不是算法准确性失败）。未再逐个补宿主依赖，因此不能确认答复所称450 passed/1 todo；也不能把未加载测试视为实现失败。

新增最小复现2 tests最终均通过，退出0。首次severity测试的自写短文未产生candidate导致断言失败，已换用公开syn-hist-01验证，未改被测源码；不隐去这个测试开发过程。虚拟sink仅返回路径，不实际写正式审查意见。

数值脚本首次误用`python`失败退出127（环境只有python3）；更正python3后退出0。

- [独立重算脚本](recompute.py) / [完整重算JSON](recomputed.json)
- [复现用例](runtime-copy/tests/store/audit-repro.spec.ts) / [成功复现日志](audit-repro.log)
- [首次全套日志](original-tests.log) / [正确仓库层级全套日志](layout-tests.log)
- [依赖安装日志](npm-install.log) / [补peer日志](npm-peer.log)

本报告不将“所有测试通过”等同于权限保证，也不因现有测试失败/通过替代具体代码路径和反例。结论边界：多条绝对权限/定稿声明与实现不符，若干核心算术可复核，但第三方的clean分母、版本hash及潜在ΔF1直减判断也必须独立纠正。

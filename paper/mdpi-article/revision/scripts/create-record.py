import pathlib,json,re,hashlib,difflib
p=pathlib.Path('/root/research/hark-revision');src=(p/'original-main.tex').read_text();new=(p/'main.tex').read_text()
lines=new.splitlines()
def anchor(needle):
 return next(i+1 for i,x in enumerate(lines) if needle in x)
def link(needle,label='修订稿'):
 n=anchor(needle);return f'[{label}:{n}](</root/research/hark-revision/main.tex#L{n}>)'
rows=[
('中心命题','文字改完；系统保证未实现','一般任务与可执行组合架构；要求表区分当前与目标。',r'\subsection{Task Formulation'),
('可靠性分类','收缩主张','不再以可靠性总称覆盖模型、审批、演化及人因。',r'\paragraph{Judge and component'),
('标题','文字改完','移除Human-Gated与LLM中心承诺，保留HARK品牌。',r'\Title{'),
('摘要','文字改完','保留改善、错误分母及未实现能力，约200词以内。',r'\abstract{'),
('关键词','文字改完','一般任务、操作权限、证据与反馈定位。',r'\keyword{'),
('RQ1','问题重定；工程未闭合','表示/操作权限及实现边界，不假称LLM可靠性实验完成。','Four research questions'),
('RQ2','结果保留；因果主张撤回','组合配置比较；B0不使用flag judge。',r'\subsection{Combined-Configuration'),
('RQ3','问题重定；人工解决未测','traceability/gate acceptance/pending全分母。',r'\subsection{Traceability and Pending'),
('RQ4','问题重定；严格能力未实现','持久化有报告；批准及恢复仍缺口。',r'\paragraph{RQ4:'),
('文档边界','文字改完；跨域未验证','一般task有条件定义，技术方案为唯一实证。',r'\subsection{Task Formulation'),
('规则分类','解释改完；未重新标注','维度/严重性/操作tier与业务质量类别分开。',r'\subsection{Operational Authority'),
('可验证性','定义改完；predicate未修','hard是当前自动路由，不等于完整业务充分性。','The tier is an'),
('tier语义','文字改完；有效权限未锁定','硬/混合/软默认路由，明确参数/草案等扩权面。','Package validation rejects'),
('span/gate','算法修正；gate代码未修','忠实描述overlap及选命中优先级；不声称containment/entailment。',r'\subsection{Located-Evidence'),
('verdict','时序澄清；pending签署未修','机器confirmed可进入建议；最终名字不是认证。',r'\subsection{Recommendation and Final'),
('schema','现有协议解释；公平模型对照未做','注册与renderer分离，未拿公文可读性证明judge比较公平。',r'\subsection{Located-Evidence'),
('权限模型','目标契约新增；尚未实现','主机认证、审批内容绑定、所有写入口及消费/过期。',r'\subsection{Required Human-Approval'),
('性质/测试','完成声明收缩；部署验收未做','撤回全套通过/形式化保证；列正负验收路径。','Acceptance tests must include'),
('版本','缺陷披露；快照未实现','ovN非内容身份，reset非精准恢复。','The displayed identifier'),
('对抗测试','边界写明；完整攻击矩阵未做','接口反例可不用LLM测试；无恶意使用推断。','This contract assumes'),
('数据/金标','描述纠正；独立新金标未建','13零缺陷/87有缺陷，自检非逐缺陷fail或留出。',r'\paragraph{Corpus and labels.}'),
('配置矩阵','现有三配置保留；增强实验未做','未声称memory treatment/live LLM/隔离typing效果。',r'\paragraph{Configurations.}'),
('模型重复','限制改完；真实模型未跑','确定性重复不增加独立样本。',r'\paragraph{Metrics and analysis'),
('压力测试','计划边界保留；未运行','留出、新词、转换与攻击均不得计完成。',r'\paragraph{Developmental synthetic'),
('指标口径','数值纠正完','microΔ.5764与mean pairedΔ.5636；门禁接受非有效。',r'\subsection{Combined-Configuration'),
('分阶段诊断','已有记录分解；人工链条未测','53→42/11；43 hybrid TP=42 gate+1结构；68/85及68/932。',r'\subsection{Traceability and Pending'),
('人机/学习/成本','效果主张收缩；研究未做','不把存储和受理计数当学习曲线/节时；旧推断统计移除。',r'\paragraph{Workflow evidence and human'),
('独立专家','明确未做','团队五run三document两final，只作者报告流程证据。',r'\subsection{Development-Team Workflow'),
('Related Work','章节改完；非全量再认证','纠正PolicyGuard/BitsAI/CodeRabbit/过程控制比较；补17定义。',r'\section{Related Work}'),
('章节重构','本轮文字完成','引言/方法/结果/讨论/限制/结论同步，不只限制栏降调。',r'\section{Materials and Methods}'),
('内部一致性','本轮检查；非终审证书','统一RQ、计数、路由、计划状态，模型辅助的分工角色只读复核，不代表独立误差或独立专家。',r'\section{Discussion}'),
('工作分解','计划写明；代码未改','优先规则与阶段冻结→批准/有效权限→gate/快照→重评。',r'\subsection{Required Human-Approval'),
('最低门槛','不宣称达到','文本修订不等于原完整性FAIL消失，不签ready-to-submit。','% AUTHOR CHECKPOINT'),
('降级路线','全篇一致执行','一般任务贡献+单域组合证据+明确未实现契约。',r'\section{Conclusions}')]
text='''# HARK 修订记录与提交前检查表

## 1. 本轮范围和交付状态

按作者选择的方案一完成**论文文字修订稿**：研究意义扩展为有明确准则、可定位证据与责任处置的规则驱动文档审查；技术方案仍是唯一验证领域。保留可追溯的有限检测改善，同时将未实现的严格批准、有效权限和内容恢复明确写为目标契约。**没有修改系统代码、重建金标、运行新LLM或完成新专家研究。** 本稿不是可直接投稿的认证终稿；作者信息、声明与工程/评测闭环仍待完成。

原始附件只读且保持未改；本轮原始基线是上传的修改后论文，不是第一次投稿初稿。因此下列diff只证明“本轮修订前后”，不证明第一次审稿的所有改动历史。

- [修订主文件](</root/research/hark-revision/main.tex>)：缺失的外部bib条目已内联。
- [本轮基线](</root/research/hark-revision/original-main.tex>)。
- [机器可读精确替换账本](</root/research/hark-revision/editorial-patch-manifest.json>)与[统一差异](</root/research/hark-revision/revision.diff>)。
- [此前完整修稿计划](</root/research/hark-audit/revision-plan.md>)仍是工程及增强证据的参照；本记录不把其工作包标成已实现。

这是一轮有来源记录的编辑修订，不提供ARS exact-authority、Material Passport或期刊接收认证。已有完整性检查中的实现反证不会因文字修改自动关闭。

## 2. 研究定位和全文重构

'''
for title,needle,desc in [
 ('标题与摘要',r'\Title{','从Human-Gated/LLM-assisted的保证式题目转为Authority-Typed Review Knowledge for Evidence-Bearing Document Review。摘要直接披露错误、唯一实证场景与尚未实现边界。'),
 ('引言与RQ','Four research questions','RQ1表示/操作权限边界；RQ2固定组合配置权衡；RQ3traceability/gate接受/pending；RQ4持久化、批准、恢复证据。其他文档族仅潜在应用。'),
 ('方法',r'\section{Materials and Methods}','加入任务前提、生命周期、真实gate算法、建议/最终时序与部署目标契约；明确主机信任边界。'),
 ('结果',r'\section{Results}','固定输出重聚合，保留微F1与计数，增加完整混淆矩阵和pending分母；不保留未复核的推断统计。'),
 ('讨论与限制',r'\section{Discussion}','将贡献/局限同步到各RQ，不把限制留在末尾；机制存在不等于保证成立。'),
 ('结论',r'\section{Conclusions}','一般任务框架与可执行组合，保留有限证据，撤回已强制人签/不可扩权/完整重放/学习增益。')]:
 text+=f'- **{title}**：{link(needle)}。{desc}\n'
text+='''
## 3. 核心数值与主张的纠正

|项目|本轮采用的准确口径|解释/边界|
|---|---|---|
|B0 / S-full|TP/FP/FN = 47/124/206 与 168/0/85|同一冻结开发性合成材料，不是独立泛化测试|
|Micro-F1|0.221698 → 0.798100，差0.576402|不可把0.564称为micro差|
|逐文档均值|0.216127 → 0.779761，paired均值差0.563634|空truth/空prediction计F1=1；与micro不同|
|文档分组|13零植入缺陷、87至少一缺陷；30policy Pass、70non-Pass|30Pass包含17minor缺陷，不是30clean|
|policy错误|15/70低估；10/70建议Pass = 6Revise+4Fail|4/23是严重Fail子集的Fail→Pass，不是所有放行|
|严重错误|9/23 Fail→non-Fail；10/40建议Pass错误|没有overcall不等于安全|
|gate|53提交、42接受、11短引语拒绝；79.2%接受率|不是语义证据有效率/LLM性能边界|
|hybrid TP|43 = 42gate接受+1SEC-002结构直接失败|不能全部称模型判断|
|pending|68/85漏检被转交；全量932hybrid document–rule pairs|mean9.32/median9/range6–13；68/932是植入标签密度，非precision或人工解决率|
|hard遗漏|17；hybrid遗漏68；blocker遗漏18/35|自动路由不等于完整可判定业务要求|
|确定性重复|已有输出重复的核心结果相同|无新增独立样本、无模型稳定性证明|
|推断统计|移除未复核CI、Wilcoxon、Holm、McNemar完成口径|并非认定原推断算错；避免把未经重核的显著性当本轮验证|

上述结果来自[重聚合记录](</root/research/hark-audit/recomputed.json>)，本轮没有修改输入、规则、标签或执行路径。纯文义澄清不必重跑；真正更改业务predicate、truth、tier、gate、policy或状态机，应按受影响范围重评；核心配置变动应冻结新版本和重跑相关组合。

## 4. 原答复34项逐项处置

这34项对应旧答复R§4的实际34数据行（非旧记录所称32项）。状态只说明本轮文字/证据处理，不表示接受了原审稿全部实验要求，也不声称工程已修复。

|项|主题|本轮状态|处置及修订位置|
|---|---|---|---|
'''
for i,(name,state,desc,needle) in enumerate(rows,1): text+=f'|{i:02d}|{name}|{state}|{desc} {link(needle)}。|\n'
text+='''
## 5. 引用、输入与工作流的专项处理

- Related Work不再用“先前系统无反馈/无法查看/无回退”建立虚假新颖性：PolicyGuard v1有构建/验证专家纠正和audit trail；BitsAI两个组件均为微调LLM且规则taxonomy会更新；CodeRabbit官方Learnings可查看/编辑/删除；过程控制论文不再称设计文档研究。未确认的能力写not established，而非不存在。
- 原上传缺失的17个bibliography定义由已检查的固定仓库版本补入，新增CodeRabbit官方文档条目。所有引用键闭合是排版完整性检查，不是所有引用论证与元数据的再认证。
- 图片转Mermaid与计划/实施阶段冲突明确披露：图像不可读不等于设计缺陷，方案设计不等于实施验收。历史计数保留，相关标签未悄悄更改。
- 内部pilot“三文档五run两final及58发现”等明确为作者报告；无私有库独立审核。不用统计/示例数量证明专家效度或学习收益。
- 作者/机构/CRediT、资助、伦理/知情同意、利益冲突及最终AI披露以AUTHOR CONFIRMATION REQUIRED显式占位，不能自动填Not applicable。归档访问/版本对应未验证，需作者确认。
- 本轮确实使用AI协助结构/语言/文献比较/记录解释，并非仅润色。实际运行标识在任务环境与可见技能历史中不完全一致；记录中不擅自把代理路由字符串当可确认的商用模型名。作者应从实际会话/服务记录确认主模型和辅助角色的精确名称/版本/日期；原初稿工具信息目前未知。

## 6. 提交前必须完成的工作

### 必须由作者确认
1. 作者、真实机构与邮箱、ORCID和CRediT；删除所有示例身份。
2. 保密材料的使用权限、历史意见与operator记录的伦理/同意依据；确认资助和利益声明。
3. GitHub/Zenodo的可访问性、版本/DOI内容对应；提供可匿名公开的输入摘要—门禁—决定—版本—最终意见链。
4. 对业务规则的阶段、适用条件、证据对象和充分性做领域审定，优先MON-001、DOC-001及hard代理谓词。

### 如要保留强“系统保障”贡献，必须真实实现并验证
1. 主机真实审批事件，绑定操作者/对象/内容/action/值/消费状态；名字和任意引语不能生成授权。
2. 覆盖no-candidate、draft activation、severity、enable/disable、reset的effective authority验证。
3. pending逐项处置或显式授权waiver，再允许签署；有效批准正例不能被一律拒绝的“假安全”代替。
4. 内容寻址不可变配置快照及恢复测试；ovN计数不能当版本身份。
5. gate边界正负测试（若目标是containment需真改算法）；新冻结版本重评，不能给修复版套用旧数字。

### 增强期刊说服力而非虚构完成
建立比B0更强的确定性基线和组件隔离、源分离独立标签/留出样本与匿名workflow traces。只有保留真实LLM质量、跨模型稳定性、人因节时或学习改善主张时，才需要相应真实实验；没有一律“两个模型/两个专家”的配额。当前文字已不承诺这些效果。

## 7. 本轮验证与文件使用

最终检查结果见[验证报告](</root/research/hark-revision/revision-validation.json>)，只覆盖源文件保护、精确替换记录、引用键/标签闭合、统计口径及可执行编译（若成功），不覆盖新工程保证、全量引用真伪或期刊接收。

主文件的引用定义已内联，但MDPI类及logo仍需要伴随的[Definitions目录](</root/research/hark-revision/Definitions/>)；下载[LaTeX源码包](</root/research/hark-revision/hark-revision-source.zip>)可保留这些依赖。预览PDF若提供，仍包含显式作者占位，不能直接投稿。
'''
(p/'修改记录.md').write_text(text)
(p/'revision.diff').write_text(''.join(difflib.unified_diff(src.splitlines(True),new.splitlines(True),fromfile='original-main.tex',tofile='main.tex')))
print('Wrote record with',len(rows),'mapped rows')

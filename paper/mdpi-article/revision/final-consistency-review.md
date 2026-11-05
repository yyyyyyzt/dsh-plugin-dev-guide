# 最终修订文本一致性核查

**范围**：只读检查[main.tex](</root/research/hark-revision/main.tex>)，对照[recomputed.json](</root/research/hark-audit/recomputed.json>)与[code-data-integrity.md](</root/research/hark-audit/code-data-integrity.md>)；补读 verdict 实现以核对状态名称。未修改主稿、未联网、未进行新实验或完整 LaTeX 编译。本报告是模型辅助、材料有界的一致性核查，**不是独立专家审稿、ARS认证或工程修复证明**。核查时主稿 SHA256：`dcf828296546ef24f290f091ad6485e9cecbb31d799276faba59c783bca54518`。

## 核查时发现的事项（历史状态）

**交付阶段回填**：主稿现已修复下列TikZ换行及adopted状态两项。另加入长段落弹性及可换行DOI链接；伴随MDPI类改为使用已随源提供的PDF版logo。Tectonic 0.17.0已成功编译最终源稿，最终SHA和检查范围见[revision-validation.json](</root/research/hark-revision/revision-validation.json>)。作者确认项与七项声明已于作者确认后写入，引用已重排为首次出现顺序。以下行号属于核查时版本，最终稿因作者区与声明区调整而整体位移；本回填不是独立复核或工程修复证明。

| 优先级 | 行号 | 问题与最小操作 |
|---|---|---|
| 必须 | [main.tex:219–222](</root/research/hark-revision/main.tex#L219-L222>) | TikZ 节点预期换行写成了单反斜杠，形成 `\configured`、`\verifier`、`\structural`、`\gate`、`\unresolved`、`\reviewer`、`\final` 等控制序列；这些不是正文或标准换行，具有 undefined-control-sequence 编译风险。仅将这些分隔符改成双反斜杠 `\\`；随后实际编译并检查两张图的宽度/布局。环境未找到 tectonic/pdflatex/latexmk，故不宣称已编译通过。 |
| 建议 | [main.tex:316](</root/research/hark-revision/main.tex#L316>) | policy 集合写作状态 `confirmed, accepted, rewritten`，实际状态为 `confirmed, adopted, rewritten`，见[verdict.ts:6–10](</root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173/plugins/hark/src/engine/verdict.ts#L6-L10>)。将 accepted 改为 adopted，或明确“accept 动作生成 adopted 状态”，避免动作名与持久状态混淆。 |
| 已关闭 | [main.tex:34–40](</root/research/hark-revision/main.tex#L34-L40>)、[571–583](</root/research/hark-revision/main.tex#L571-L583>) | 作者/ORCID/机构与七项声明已由作者确认真实信息替换，正文不再含 AUTHOR CONFIRMATION 占位；引用已按首次出现顺序重排为 1–41。本行保留为历史记录，不再构成投稿阻塞项。 |

## 已对齐，不建议重新放大或无谓改动

- **贡献与RQ**：[66–75](</root/research/hark-revision/main.tex#L66-L75>)、[525–541](</root/research/hark-revision/main.tex#L525-L541>)一致：有界系统组合贡献；RQ2为端到端比较而非typing因果效应，RQ4为持久化/审批/恢复证据而非在线学习。未发现残留RQ冲突。
- **核心数字与分母**：[424](</root/research/hark-revision/main.tex#L424>)区分 micro-F1差0.5764与逐篇均值差0.5636；[470](</root/research/hark-revision/main.tex#L470>)区分42/53 gate接受与43 hybrid TP；[491](</root/research/hark-revision/main.tex#L491>)及[573](</root/research/hark-revision/main.tex#L573>)明确15/70 under-call、10/70错误Pass、4/23 Fail→Pass，及13零缺陷/87有缺陷与30 policy-Pass不同。与指定重算材料一致，未发现剩余核心算术或分母错误。
- **有限改善与限制**：168/0/85、F1 0.798、85%为同源开发性合成语料的描述结果；68/85 referral不等于人工解决，932待办不等于932缺陷；[450](</root/research/hark-revision/main.tex#L450>)、[534–536](</root/research/hark-revision/main.tex#L534-L536>)已避免相应夸大。
- **现有/目标边界**：[355–363](</root/research/hark-revision/main.tex#L355-L363>)、[557–561](</root/research/hark-revision/main.tex#L557-L561>)明确认证审批、完整authority ceiling、内容恢复与边界测试未实现；overlap不是containment、姓名/引语不是授权、pending可存续均已披露。未发现声称这些工程漏洞已修复的正文残留。
- **单域验证**：[547](</root/research/hark-revision/main.tex#L547>)、[571](</root/research/hark-revision/main.tex#L571>)将其他证据型文档列为潜在适配而非已验证领域；内部五次运行仅作作者报告的工作流证据，不作独立质量验证。

**核查边界**：本次不认证外部文献、档案、私有pilot明细，也不把指定JSON未列出的全部分组/案例数字视为本次独立重算。数值一致性不等于业务标签有效性；稿内保留的生命周期与Mermaid格式标签问题仍需领域负责人及新冻结版本处理。

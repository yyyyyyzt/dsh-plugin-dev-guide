# MDPI *Computers* 投稿：Section / Topic 建议 + 各项草稿

> 本目录服务于「若投 MDPI *Computers*（EI 期刊）」这一条路线；EI 会议稿在 `../ei-conference/`，两者共用同一篇内容。
> 生成时间：2026-10-30。

## 1. 投稿页该选什么

### Section：`AI-Driven Innovations`

六个 Section 里其余五个都明确错位——Blockchain（区块链）、Cloud Continuum（云边协同）、Human–Computer Interactions（HCI 实证/交互设计）、ICT Infrastructures for Cybersecurity（安全基础设施）、IoT and Industrial IoT（物联网）。本稿的贡献是 LLM agent 的**知识表示与治理**（可验证性分级、证据门禁、确定性结论策略、人控演化），属 AI 方法创新，`AI-Driven Innovations` 是唯一自然归属（该 Section 已发 471 篇，接受面最宽）。

`Human–Computer Interactions` 是唯一有争议的备选（本稿有专家复核协议与看板），但 HCI Section 要的是用户研究/交互评估，本稿的评测是机制级 precision/recall/κ，选中会被分派给不匹配的编辑。

### Topic：`AI Agents: Progress, Architecture, and Applications`（首选）

理由（逐条对齐 Topic scope 原文）：

| Topic 要求 | 本稿对应 |
|---|---|
| LLM-driven agent architectures | 插件原生 agent（preset + 9 工具 + storage domain），§3.6 |
| planning / reasoning / decision-making | 三阶段协议；确定性结论策略把"判决"从模型手里拿走，§3.4–3.5 |
| tool use / memory / RAG | 证据门禁是工具侧强制；learned layer 是**非向量**的结构化记忆，§3.5 |
| evaluation of agentic systems | 合成集 100 份 / 253 处植入缺陷，P/R/F1/κ 与配对检验，§4 |
| safety / alignment / human–agent collaboration | 「模型永远不能写结论、不能声称缺失、不能提升规则权限」，§3.2 / §5.2 |

且该 Topic 的参与期刊含 *Computers*，已有 12 篇发表、页面未标截稿日期，选它不影响送审时间。

**次选**：`AI-Driven Software Engineering and Next-Generation Web Services`（scope 明确写了 *advanced requirements engineering*，与"技术方案/需求文档审查"贴合；缺点是它 0 篇已发表、且本稿不做代码生成/测试/Web 服务）。若编辑认为本稿更偏 RE 而非 agent，可换这条。

**不建议**：各类 Medical / Education / 6G / Blockchain 的 Special Issue——即使关键词沾边，Special Issue 有硬截稿日、且被拒后要重新走常规流程。

> 注：Topic/Special Issue 是**选填**（提交页下拉含 "None"）。若只求录用速度，Section 选 `AI-Driven Innovations`、Topic 留空即可；选 Topic 的收益是被一批同主题编辑看到。

## 2. Cover Letter（英文，可直接粘贴）

> 需替换 `[...]` 后使用；两句强制声明已按 instructions 原样写入。

```
Dear Editors,

We submit the manuscript "Verifiability-Typed Review Knowledge with Human-Gated
Evolution for LLM-Assisted Review of Technical Solution Proposals" for
consideration as an Article in Computers (Section: AI-Driven Innovations;
Topic: AI Agents: Progress, Architecture, and Applications).

The manuscript studies how expert review knowledge should be put into an LLM
system so that it stays auditable, is checked at the authority level its
verifiability justifies, and can grow from use without letting the model
promote itself. We formalise this as the review-knowledge ingestion problem,
type rules as hard / hybrid / soft, enforce a tool-side evidence gate so a
model can quote only inside verifier-located spans and can never assert
absence, compute the suggested verdict deterministically from confirmed
findings, and turn the expert's ordinary accept / dismiss / rewrite decisions
into a versioned learned layer that is audited and reversible but may never
raise a rule's tier. The design is implemented as a plugin of an open-source
agent harness with no separate backend.

The evaluation reports F1 0.798 against 0.222 for a keyword baseline on a
synthetic corpus with 253 planted defects, with zero false positives and 85%
verdict agreement (kappa 0.76), and shows that 80% of the remaining misses
reach the expert as open items instead of silent passes. Re-expressing the
legacy checklist under the typing criterion showed that only 10 of 28 rules
are deterministically verifiable, and the four blocking rules least of all --
which is, in our view, the general lesson for LLM-assisted review of
engineering documents rather than a property of our setting.

The work fits Computers because it reports a complete computational system
rather than a model-only result: architecture, implementation, an
evidence-governance mechanism, and a reproducible evaluation harness. The
plugin, the rule package, the synthetic corpus and the evaluation scripts are
released with the manuscript, and the paper states explicitly which claims are
mechanism-level and which await deployment data.

We confirm that neither the manuscript nor any parts of its content are
currently under consideration for publication with or without [journal name]
and have not been published in another journal.

All authors have approved the manuscript and agree with its submission to
Computers.

Sincerely,
[Corresponding author name, affiliation, e-mail, ORCID]
```

要点：
- 第二段是"与期刊的关联"，必须具体到 *Computers* 的软件/系统类文章定位，不要写成泛泛的"很重要"。
- 不要写审稿人推荐（写在系统里）。
- 若同时把会议版投出去，**必须先撤一个**：instructions 明确禁止一稿多投；会议扩展版投 MDPI 时还要在首页引用原会议论文并在 cover letter 说明扩写了什么。

## 3. Manuscript 上传

- 只用**一个主文件**：`Computers` 要求正文单独提交，不要把补充材料打进主文件。
- 两种合法路径：
  1. **Free Format Submission**（推荐先用）：直接传 `paper/draft-en.md` 转出的 PDF/Word，不套 MDPI 排版；编辑部转成 MDPI 版式后再送审。参考文献风格统一即可。
  2. **LaTeX**：必须换成 MDPI 官方模板 `MDPI_template_ACS.zip`，并把**所有源文件 + 图片打成一个 ZIP**（本目录的 IOS Press 模板**不能**用于 MDPI 投稿）。
- 摘要 ≤ 200 词左右、关键词 3–10 个（现稿 6 个）。
- 首页脚注需含：Funding、Author Contributions、Conflict of Interest、Data Availability、Acknowledgments（现稿只有 Acknowledgements）。
- 独立研究者须标 "Independent Researcher"。

## 4. Supplementary File(s)

- 单个 ZIP，≤ 250 MB；超过则传 Zenodo/figshare，在表单填 DOI、Link 与 caption。
- 建议打包内容：`paper/data/public/synthetic/`（100 份合成方案 + truth + selfcheck）、`paper/data/public/eval-runs/*.json`、`scripts/eval/*.mjs`、`rules/capability-open-access.rules.yaml`、`paper/REPRODUCE.md`。
- caption 草稿：

```
Supplementary material for "Verifiability-Typed Review Knowledge with
Human-Gated Evolution for LLM-Assisted Review of Technical Solution Proposals".
Contents: (i) the synthetic corpus of 100 technical solution proposals with 253
planted defects, its generator seed (20261029), the planted-defect ground truth
and the self-check report (0 violations); (ii) the nine deterministic ablation
runs underlying Table 2, with per-review metrics; (iii) the evaluation scripts
(generator, ablation runner, anonymiser) and the shipped rule package
(capability-open-access@1.0.0, 28 rules); (iv) REPRODUCE.md with the exact
commands, the adapter interface for LLM-judge configurations and the data
directory protocol. No personal or organisational data is included; the corpus
is fully synthetic.
```

## 5. Copyright Permission

- 若正文图/表**全部自绘**（现稿 Figure 1 为 TikZ、Table 1–2 为自有数据）→ 勾选 "not applicable"，并在表单备注 "All figures and tables are original and created by the authors; no third-party material is reproduced."
- 若之后加入引用他文的图（如 PolicyGuard 架构图）→ 需 RightsLink/出版社书面许可，并在 caption 写 "Reproduced with permission from [ref], Copyright [year] [publisher]."
- 若投的是**会议扩展版**：还需取得原会议论文集版权方（如 IEEE/IOS Press）对复用文本/图的许可，并在首页致谢原论文。

## 6. Graphical Abstract

- 文件：`graphical-abstract.png`（1100 × 560 px，200 dpi 由 `graphical-abstract.tex` 渲染，源文件同目录，可改后重生成）。
- 已满足：非正文图的复制/叠加、无版权素材、无 "Graphical Abstract" 字样、字体为 Times/Helvetica 系、结论以文字给出。
- 重生成：`pdflatex graphical-abstract && pdftoppm -r 200 -png -singlefile graphical-abstract.pdf graphical-abstract`。

## 7. Figures / Graphics 清单

| 项 | 现状 | 投稿前要做 |
|---|---|---|
| Fig. 1 流水线 | `paper/ei-conference/main.tex` 内 TikZ，矢量 | 导出 PDF/EPS（或 300 dpi PNG，≥ 1100 px 宽）单传 |
| Table 1 tier 语义 | 纯 LaTeX 表 | 无需单独传图 |
| Table 2 结果 | 纯 LaTeX 表 | 无需单独传图 |
| 图形摘要 | 已生成 1100 × 560 PNG | 直接上传 |
| 看板截图（可选） | 未做 | 需脱敏（方案标题、审核人、时间）后 300 dpi |

- 图内字号 ≥ 6 pt、线宽 ≥ 0.5 pt；位图 ≥ 1100 px 宽 / 300 dpi；单图 ≤ 20 MB。
- 正文引用写 "Figure 1" / "Table 2"，不要写 "the figure above"。

## 8. 待补清单（投稿前）

1. 作者、单位、ORCID、通讯作者邮箱（现为 `First Author` 占位）。
2. Funding / Conflict of Interest / Author Contributions / Data Availability 四段声明。
3. 伦理与知情同意措辞（若引用任何真实方案或专家意见）。
4. 代码与数据仓库链接（公开仓库名含产品缩写，需决定是否发布中性命名镜像）。
5. 推荐 3 位审稿人（近三年无合作、不同机构）。

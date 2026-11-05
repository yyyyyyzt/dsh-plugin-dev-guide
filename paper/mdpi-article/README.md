# MDPI *Computers* 投稿稿

这是论文的**唯一投稿版本**（目标 MDPI *Computers*，ISSN 2073-431X，EI/Compendex 收录）。
`paper/ei-conference/`（IOS Press 模板的会议稿）已废弃，只作留档，不得用于投稿。

当前 `main.tex` 是 2026-11-05 在 `japan` 研究机上完成的分支修订稿（审计—修订闭环），已合并回本仓库：
标题改为 **HARK: Authority-Typed Review Knowledge for Evidence-Bearing Document Review**，摘要/RQ/结果/讨论同步重写，
未实现的能力（认证式人工批准、完整有效权限上限、内容寻址恢复）全部显式降为 *target contracts*。
修订依据与逐条处置见 `revision/修改记录.md` 与 `../audit/final-review.md`。

## 文件

| 文件 | 说明 |
|---|---|
| `main.tex` | 唯一源文件（89,912 B，sha256 `3cbb06b8…`）。`\documentclass[computers,article,submit,moreauthors]{Definitions/mdpi}`；7 个一级节、12 表、2 幅 TikZ 图、1 段算法伪代码、41 条文献（全部内联 `\bibitem`，不再 `\input{bib.tex}`） |
| `main.pdf` | 权威编译产物（23 页 A4，约 11.8k 词，sha256 `0e955f80…`，Tectonic 0.17.0，0 Overfull） |
| `main.zip` | 投稿源码包（19 个文件，含 `Definitions/` 与修订记录，sha256 `98fb38d2…`），直接上传 MDPI 系统 |
| `Definitions/` | MDPI 官方类文件与参考文献样式。`mdpi.cls` 仅改 2 处 logo 引用（EPS → `logo-mdpi-eps-converted-to.pdf`），避免编译时依赖 shell-escape 的 EPS 转换 |
| `revision/` | 本轮修订的可复核证据：统一差异、机器可读替换账本、验证报告、修订记录、最终一致性复核、基线稿、编译日志与页面预览 |
| `build.sh` | 本机编译脚本（`pdflatex` 两遍；`epstopdf` 仅在缺 logo PDF 时执行） |

## 编译

在本机（TeX Live + `texlive-science` + `texlive-font-utils`）已验证：

```bash
./build.sh
# 或：
epstopdf --outfile=Definitions/logo-mdpi-eps-converted-to.pdf Definitions/logo-mdpi.eps  # 仅当缺文件
pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex
```

- 2026-11-05 本机复编：**23 页、0 error、0 Overfull、无 undefined citation/reference**；与 `japan` 上的 Tectonic 0.17.0 产物页数一致（正文逐字符一致，仅行号/换页细节不同）。
- 两次编译是必须的：第二次才解析交叉引用与文献编号。
- 不需要 bibtex/biber：文献是 `\bibitem` 内联的 ACS 数字制（41 条，按首次引用顺序编号 1–41，无缺号、无未引用条目；程序化核验见 `revision/revision-validation.json`）。
- 若要用 Tectonic：`main.zip` 没有随附二进制；本机装 `tectonic` 后 `tectonic -X compile main.tex --keep-logs` 即可。

## 当前状态（2026-11-05，可投稿的**文字稿**）

- **作者区**：Zhitong Yang（通讯，ORCID `0009-0002-1803-1529`）、Kai Wang、Qingxian Wang、Qi Li、Lin Song、Dahai Jin、Hong Wang；State Grid Customer Service Center, Tianjin 300300, China；通讯邮箱仅 `yyyyyyzt@tju.edu.cn`。其余 6 位不显示空 ORCID 图标（模板会为每个 `\orcidauthor` 画图标，故删除定义而非留空）。
- **七项声明**全部为作者确认的真实内容：完整 CRediT 14 项、no external funding、IRB / Informed Consent 为 Not applicable 并说明是内部评审文档、Data Availability 写仓库快照 `b566b08` + Zenodo DOI `10.5281/zenodo.23955205`（并如实说明归档源码早两个提交）、Generative AI 披露（DeepSeek Harness + DeepSeek 模型，2026-11 使用，未生成任何实验结论）、无利益冲突并披露全员隶属被评审组织。
- **主张边界**：只报已跑出的确定性结果（micro-F1 0.798 vs 关键词基线 0.222、零假阳性、κ=0.763、85 处漏检分解、pending 932 对、gate 42/53）；LLM-judge 配置、独立专家、跨文档族泛化、学习增益均写成未做。
- **未实现契约**（正文明确标注，不声称保证）：认证式人工批准、覆盖全部写入口的有效权限上限、内容寻址的配置快照与恢复、pending 逐项处置后才允许签署。
- 模板字段 `\articlenumber{0}`、卷期、收稿/修回/录用日期保持模板默认，由编辑部录用后填写；投稿系统里另选 Section = `AI-Driven Innovations`（Topic 首选 `AI Agents: Progress, Architecture, and Applications`）。

## `revision/` 目录

| 文件 | 说明 |
|---|---|
| `README.md` | 修订包自带说明（构建方式、最终状态、not claimed） |
| `revision.diff` | 相对上传基线 `original-main.tex` 的完整统一差异 |
| `original-main.tex` | 本轮基线（= 原 `paper/mdpi-article/main.tex`，sha256 `ff4a08…`），可据此复算 diff |
| `editorial-patch-manifest.json` | 机器可读的逐处替换账本（精确匹配，`exact_patch_replay: true`） |
| `revision-validation.json` | 校验记录：哈希、页数、引用闭合、环境配平、编译结果 |
| `修改记录.md` | 中文修订记录：定位/重构、数值口径纠正、34 项答复逐项处置、仍属目标契约的清单 |
| `final-consistency-review.md` | 最终一致性复核（模型辅助、角色分离，非独立人工复核） |
| `compiled-text.txt` / `main.log` | Tectonic 编译文本与日志 |
| `previews/` | 选定页面（首页、架构图、tier 表、文末文献）的 PNG 预览 |
| `scripts/` | 修订组装与校验脚本（`assemble-revision.py`、`finalize-checks.py`、`create-record.py`） |
| `framing-*.txt`、`methods-new.tex`、`related-new.tex`、`results-new.tex`、`*-replacement.json`、`coderabbit-bib.tex` | 重写过程中按块替换的中间产物（框架、方法、相关工作、结果的成稿片段与精确替换表） |

## 与其它稿的关系

| 文件 | 角色 |
|---|---|
| `paper/mdpi-article/` | **投稿稿**（按 MDPI 模板）与修订证据 |
| `paper/audit/` | 2026-11-05 只读审计（五席面板、完整性检查点、修订计划、逐条回应矩阵）——`main.tex` 的上游依据 |
| `paper/mdpi-submission/` | 投稿系统材料：Section/Topic 判断、cover letter、图形摘要、中文译稿、审稿回应 |
| `paper/draft-en.md` | Frontiers 结构的长稿，素材库，已停更 |
| `paper/ei-conference/` | IOS Press 会议稿，**已废弃** |

一稿多投禁止：同一时间只投 *Computers* 一处。

## 投稿前仍需人确认

1. **CRediT 14 项逐条是否与实际相符**（尤其 Software 只给 Z.Y.，Supervision 给 D.J. 与 H.W.）——这是唯一需要作者逐条过目的内容。
2. **Zenodo 版本对应**：正文如实写「归档源码 v1.0.0 比引用快照早两个提交（引语校验与发布说明），数据逐字节一致」。若要完全对齐需发 v1.1.0（新版本 DOI），届时同步替换 Data Availability。
3. MON-001 / DOC-001 / hard 谓词建议在录用前由领域负责人复核（正文已把 hard 定位为解析器可见的代理，而非业务充分性判定）。

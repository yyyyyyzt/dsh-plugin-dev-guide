# MDPI *Computers* 投稿稿

这是论文的**唯一投稿版本**（目标 MDPI *Computers*，ISSN 2073-431X，EI/Compendex 收录）。
`paper/ei-conference/`（IOS Press 模板的会议稿）已废弃，只作留档，不得用于投稿。

## 文件

| 文件 | 说明 |
|---|---|
| `main.tex` | 唯一源文件。`\documentclass[computers,article,submit,moreauthors]{Definitions/mdpi}` |
| `Definitions/` | MDPI 官方类文件与参考文献样式（`mdpi.cls`、`journalnames.tex`、`mdpi.bst` 等），**原样随包**，投稿时一并打包 |
| `build.sh` | 编译脚本：生成 logo 的 EPS 转换结果，跑两遍 `pdflatex` |
| `main.pdf` | 最近一次编译产物（11 页 A4） |

## 编译

```bash
./build.sh
# 或手动：
epstopdf --outfile=Definitions/logo-mdpi-eps-converted-to.pdf Definitions/logo-mdpi.eps
pdflatex main && pdflatex main
```

依赖（Debian/Ubuntu）：

```bash
sudo apt-get install -y texlive-latex-recommended texlive-latex-extra \
  texlive-fonts-recommended texlive-plain-generic texlive-science texlive-font-utils
```

- `texlive-font-utils` 提供 `epstopdf`（MDPI 的 `logo-mdpi.eps` 需要先转 PDF，否则 `pdftex.def` 报 `File ... not found`）。
- `texlive-science` 提供 `algpseudocode`（Algorithm 1 的伪代码环境，MDPI 类文件未预装）。
- 不需要 bibtex/biber：参考文献是 `\isAPAandChicago{}{...}` 内的 23 条 `\bibitem`（ACS 数字制，*Computers* 不走 APA/Chicago）。

## 当前状态

- 11 页 A4，编译 0 error；正文约 4,100 词。
- 结构：Introduction / Related Work / Materials and Methods（3.1–3.6）/ Results（4.1–4.4）/ Discussion / Conclusion + 声明区。
- 浮动体：`Table 1`（tier 语义，tabularx 满栏宽）、`Algorithm 1`（证据门禁）、`Figure 1`（TikZ 流水线）、`Table 2`（结果，tabularx 满栏宽）。
- 只报**已经跑出来**的确定性结果（F1 0.798 vs 0.222 关键词基线、零假阳性、κ=0.76、85 处漏检的分解）；LLM-judge 配置与真实试点在 4.1 与 5 明确写成限制，不用代理指标充数。
- 参考文献 23 条，ACS 格式（作者. 标题. *期刊缩写* **年**, *卷*(期), 页码. DOI），按首次引用顺序编号（`natbib` 数字制自动重排）。

## 投稿前必须替换的占位

`main.tex` 里以 `TODO` 标注：

1. 作者姓名、单位、邮箱、ORCID（`\Author` / `\address` / `\corres` / `\orcidauthorA`）。
2. `\authorcontributions{}` 的 CRediT 缩写（现在是 `X.X.`）。
3. `\funding{}`（现在写 no external funding）。
4. `\dataavailability{}`（现在是 "on request"，建议换成仓库链接 + Zenodo DOI）。
5. Section/Topic 在投稿系统里选（见 `../mdpi-submission/submission-drafts.md`）。

## 与其它稿的关系

| 文件 | 角色 |
|---|---|
| `paper/mdpi-article/main.tex` | **投稿稿**（按 MDPI 模板） |
| `paper/draft-en.md` | Frontiers 结构的长稿，素材库，已停更 |
| `paper/ei-conference/` | IOS Press 会议稿，**已废弃** |
| `paper/mdpi-submission/` | 投稿系统材料：Section/Topic 判断、cover letter、图形摘要、补充材料 caption |

一稿多投禁止：同一时间只投 *Computers* 一处。

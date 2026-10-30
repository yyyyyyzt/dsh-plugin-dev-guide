# 会议稿说明（`main.tex`）

模板自带说明见 `README.md`（IOS Press 官方，勿改）。本文件记录本稿的构建、状态与取舍。

## 编译

```bash
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex   # 第二遍：交叉引用与参考文献
```

依赖（Debian/Ubuntu）：

```bash
sudo apt-get install texlive-latex-recommended texlive-latex-extra \
  texlive-fonts-recommended texlive-plain-generic texlive-science
```

- `soul.sty` 来自 `texlive-plain-generic`；`algorithm.sty` / `algpseudocode.sty` 来自 `texlive-science`。
- 不需要 bibtex：参考文献用 `thebibliography` + Vancouver 风格，`%%BIBSTART` / `%%BIBEND` 之间的 23 条 `\bibitem` 已按首次引用顺序排列。
- 剩余一条 `Overfull \hbox (18.9pt) while \output is active` 是模板页眉盒自带（官方示例 `ios-book-article.tex` 编译同样报 9.2pt 同类告警），不影响版面，不必修。

## 状态（2026-10-30）

- 篇幅 **12 页**（含 23 条参考文献），正文约 4,100 词；版心 12.4 × 20 cm、10 pt Times。
- 结构：1 Introduction / 2 Related Work / 3 Materials and Methods（问题与四性质、分层规则、校验器与证据门禁、确定性结论策略、复核即反馈、实现）/ 4 Results（setup、旧规则分层、合成集结果、效度威胁）/ 5 Discussion / 6 Conclusion。
- 浮动体：Table 1（tier 语义）、Table 2（结果）、Algorithm 1（证据门禁）、Figure 1（TikZ 流水线）。
- 数据来源：`paper/data/public/summary.md` 与 `eval-runs/*.json`，仅确定性配置（B0 / S-full / S−verifier）。LLM-judge 配置（B1 / S-gate / S-policy）需要 adapter，**本文未报**，在 §4.1 与 §5 写成明确限制，没有用代理指标代替。
- 占位待补：`% TODO` 标出的作者/单位/ORCID/通讯地址，Acknowledgements 里的资助与利益冲突声明。

## 页数怎么压

- 限 10 页：删 §2 中「LLM for requirements」与「Feedback-driven」两段的细节（保留检查质量与神经符号合规两段），约省 0.8 页；参考文献收到核心 15 条约省 0.6 页。
- 限 8 页：在上面基础上把 Algorithm 1 压成正文内联三步（省约 0.55 页）、Table 1 三行改写为一段（省约 0.35 页）——但会削弱「类型」这一核心论点的可读性，建议先争取 10 页。

## 与其他稿件的关系

- `paper/draft-en.md`：Frontiers 结构长稿（含试点/生长/成本三节的 `[[TBD]]`），留作期刊版底稿。
- `paper/mdpi-submission/`：若改投 MDPI *Computers* 的投稿草稿（Section/Topic 建议、cover letter、图形摘要、补充材料 caption）。
- 会议版与期刊版正文可互相搬用，但**不能同时投稿**（一稿多投）。

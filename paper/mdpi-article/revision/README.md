# HARK revision source (final submission copy)

This package contains the author-approved manuscript for submission to *Computers* (MDPI), a Chinese revision record, a compiled PDF and editorial provenance.

## Build

Use the bundled Tectonic 0.17.0:

```bash
./build-tools/tectonic -X compile main.tex --keep-logs
```

Keep `Definitions/` beside `main.tex`. Bibliography entries are inline; no external `bib.tex` is required. The bundled MDPI class differs from the audited upstream copy only in two logo references (EPS replaced by the shipped PDF), so the build needs no shell-enabled EPS conversion.

## Final state

- **Authors**: Zhitong Yang (corresponding), Kai Wang, Qingxian Wang, Qi Li, Lin Song, Dahai Jin, Hong Wang — State Grid Customer Service Center, Tianjin 300300, China. Correspondence: yyyyyyzt@tju.edu.cn. ORCID for the corresponding author: 0009-0002-1803-1529.
- **Declarations**: all seven MDPI declarations are author-confirmed (CRediT contributions, no external funding, IRB/consent not applicable, data availability, AI disclosure, no conflicts of interest). No placeholders remain.
- **References**: 41 entries, numbered in first-citation order 1–41, no gaps and no uncited entries.
- **Compilation**: Tectonic 0.17.0, 23 pages, 0 overfull boxes, 0 undefined citation/reference warnings; remaining warnings are underfull boxes and the legacy `lineno.sty` encoding note.

`revision-validation.json` records the bounded checks performed. `修改记录.md` documents the revision scope, the retained descriptive metrics and the engineering contracts that remain unimplemented by design (Section 6). `revision.diff` is the diff against the uploaded baseline `original-main.tex`.

## Not claimed

No new model outcomes, no repaired-engine performance, no independent human review, and no journal acceptance. The strict approval, effective-authority and content-addressed recovery mechanisms described in Section 5 remain target contracts, as stated in the manuscript.

## Manual steps for the journal system

`\articlenumber`, `\pubvolume`, `\issuenum` and the received/revised/accepted/published dates are left at template defaults; the editorial office supplies them after acceptance.

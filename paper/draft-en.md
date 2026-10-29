# Verifiability-typed review knowledge with human-gated evolution for LLM-assisted preliminary review of technical solution proposals

<!--
DRAFT STATUS (not part of the manuscript)
- Version: v0.1 English draft, 2026-10-29. Written against paper/innovation-notes.md v0.2 + §10 (v0.3 re-review).
- Target: Frontiers in Computer Science, section "Software". Article type: Original Research (Abstract / Introduction / Materials and methods / Results / Discussion). If fewer than ~30 real finalized reviews are available at submission, relabel as Technology and Code (Method / Results incl. examples of use / Discussion incl. scalability) and move §4.4–4.5 into a "pilot observations" subsection; the remaining sections are shared.
- Reference style: Frontiers Harvard (author–date). The 2025–2026 references (Alsawalqah, Chinnam, Dolcetti & Iotti, Goldman, Hemmat, Lin, Malik, Sun, Zhang 2025, Zhang 2026) and the two footnoted web sources were checked to exist on 2026-10-29 with the stated venues/identifiers. Older references are standard works cited from memory; re-check volume/page/DOI against the publisher record before submission.
- Placeholders: every item that depends on data not yet collected is marked [[TBD: ...]]. grep for "TBD" before submission.
- Anonymisation: the utility and its product appear only as "a large utility" and "an energy-internet online service platform (OSP)"; third-party channels appear as "a third-party channel". The plugin is referred to as SolutionReview. Repository URL/DOI to be added at submission (the public repository name currently reveals the product abbreviation; decide whether to publish from a neutrally named mirror).
- Word budget: Frontiers limit 12,000 words (body only); abstract limit 350 words (currently 349). Current body is ~7,600 words excluding this block, tables, code and references (~8,500 with tables); results sections are placeholders and will add ~1,500–2,500 words.
-->

**Authors:** [[TBD: author list and affiliations]]

**Correspondence:** [[TBD]]

**Keywords:** large language models; document review; human-in-the-loop; neuro-symbolic verification; knowledge engineering; evidence grounding; software engineering tools; agent plugins

---

## Abstract

Large language models (LLMs) increasingly pre-screen technical documents before experts sign off on them. Expert review knowledge usually enters such systems as keyword rules, prompt checklists, or retrieval over past reviews; each route loses a property that high-stakes review needs: traceability of every finding to a rule and a location, authority matched to verifiability, growth from use, and human control over that growth. We call choosing a form and permission structure for review knowledge under these properties the *review-knowledge ingestion problem* and address it for the preliminary review of technical solution proposals at a large utility's energy-internet online service platform. Review knowledge is a versioned package of typed rules: *hard* rules are owned by deterministic verifiers that produce located evidence, including absence evidence that an LLM may never assert; *hybrid* rules let verifiers locate candidate spans and negation or placeholder cues while the LLM judges only within those spans, enforced by a tool-side evidence gate; *soft* rules can only raise items for human judgement. A deterministic policy derives the suggested verdict, and only the expert can write the final one. The expert's conversational decisions—accept, dismiss, rewrite, add—are persisted as rule-level statistics, phrasing exemplars, parameter overrides and candidate rules in an audited learned layer over the shipped package; the system may tune parameters and phrasing but can never promote a rule to a higher tier. The design is a plugin for an open-source agent harness (about 7,000 lines of TypeScript, 28 rules) with no separate backend or database. Typing the legacy checklist showed that only 10 of 28 rules, and none of the four blocking rules, are deterministically verifiable, which quantifies why keyword matching cannot implement expert review. On a synthetic corpus with planted defects, [[TBD: headline precision/recall versus the keyword and direct-LLM baselines, and the effect of removing the gate]]. In a pilot of [[TBD: n]] real reviews, [[TBD: acceptance rate; dismissal rate ordered hard < hybrid < soft; κ between suggested and final verdicts; full traceability of knowledge changes]]. We frame the design as bounded, human-gated knowledge evolution and release the plugin, rule package and anonymised data.

---

## 1 Introduction

Before a change to a large online service platform is built, its *technical solution proposal*—a templated document describing background, architecture, interfaces, data flows, implementation plan, capacity and risk—must be reviewed and approved by a small group of senior experts. The review is checklist-driven, the documents are highly templated, the consequences are real (the expert signs the opinion), and the knowledge is both specialised and changing as new integration patterns and risk-control requirements appear. These properties make preliminary review a natural target for LLM assistance, and they also make the usual way of building such assistance fragile.

Our starting point is a failed first attempt. A monolithic prototype that we built in 2025 encoded 24 expert rules as a few keywords each and otherwise delegated to an LLM through long prompts. In retrospective analysis, "load test" appearing anywhere in a document counted as the load test having been planned; negations ("no load test is planned for now"), placeholders ("/", "N/A", "omitted"), and empty sections were invisible; the overall verdict was whatever the model wrote in a single field, so a blocking finding did not change the outcome; and because nothing was persisted, the hundredth review was no better informed than the first. None of these failures was a failure of the model. They were failures of *how the review knowledge had been put into the system*.

We argue that this is a general and under-named problem. Three ingestion routes dominate current practice (Table 1, Figure 1). *Keywording* turns a rule into substrings and loses the rule's meaning. *Prompting* turns a rule into natural-language instructions and loses verifiability and auditability: the model has "seen" the rule, but its judgement cannot be traced back to the rule or to the document. *Fragmenting* turns past reviews into retrieved chunks and loses accumulation: knowledge is reassembled at every query and never consolidated. All three treat knowledge as *input shown to the model* rather than as *an asset owned by the system*, with provenance, permissions and a life cycle. Two tensions underlie this. First, a *verifiability tension*: review requirements span a spectrum from "the implementation-plan section exists and is not a placeholder" (fully checkable by a program) to "the risk analysis is adequate" (almost entirely a matter of judgement), and the less verifiable a requirement is the more it needs a model, while the more verifiable it is the less a model should be trusted with it, because models make unexplained errors on deterministic questions and cannot locate them (Huang et al., 2024; Liu et al., 2024). Second, a *growth tension*: knowledge must grow from use—every expert dismissal is information—but in a setting where a human signs the outcome, growth cannot be unilateral, and growth that happens in model weights or filter thresholds is invisible to the people who are accountable.

**Table 1.** Three routes for ingesting expert review knowledge into an LLM review system, the form knowledge takes, and what is lost.

| Route | Form of the knowledge | Failure mode | In our 2025 prototype |
|---|---|---|---|
| Keywording | Substrings per rule | Degradation: presence of a word ≠ satisfaction of the requirement; negation, placeholders and empty sections are invisible | 24 rules × 3–5 keywords; baseline B0 in §3.9 |
| Prompting | Natural-language checklist in the prompt | Unverifiable and unauditable: a judgement cannot be traced to a rule or to a document location; errors cannot be attributed | All 24 rules sent on every call; baseline B1 |
| Fragmenting (retrieval over past reviews) | Embedded chunks | No accumulation: knowledge is re-derived per query; no consolidation, conflict marking or provenance | Considered and rejected |

This paper makes four contributions.

1. **Problem and design requirements.** We formulate the *review-knowledge ingestion problem* and derive four properties that a solution should have: (i) *auditability*—every finding traces to a rule and to a location in the document; (ii) *authority follows verifiability*—knowledge of different verifiability receives matching decision authority; (iii) *growth*—the knowledge is updated incrementally from expert–system interaction; and (iv) *bounded growth*—updates are constrained by human permission and are reversible (§3.1).
2. **A verifiability-typed rule model with a tool-side evidence gate.** Rules carry a type (*hard*, *hybrid*, *soft*) that is checked statically when the rule package loads and that determines who may raise a finding: deterministic verifiers, the LLM within verifier-located spans, or nobody without a human. Absence ("the section is missing") is a first-class evidence kind that only verifiers may produce. A deterministic policy turns confirmed findings into a suggested verdict (§3.2–3.5).
3. **Review-as-feedback with bounded evolution.** The expert's accept/dismiss/rewrite/add decisions, taken in the same conversation, are the only source of change to a learned knowledge layer that overlays the shipped package; the system may adjust parameters, phrasing and statistics but can never raise a rule's tier (§3.6–3.7).
4. **A plugin-native implementation and an evaluation design.** The whole system is a set of reversible plugins on an open-source agent harness—no backend, no database, no vector store—and we report what that implementation costs and how the four properties are measured on a synthetic corpus and a pilot deployment (§3.8–3.9, §4).

The individual components are not new: deterministic checks over document structure are the basis of requirements-smell detection and checklist-based inspection (Fagan, 1976; Laitenberger and DeBaud, 2000; Femmer et al., 2017); verbatim-quote verification is used to make LLM citations checkable (Gao et al., 2023; Liu et al., 2023; Zhang et al., 2026); and feedback flywheels drive industrial LLM code review (Sun et al., 2025). What we claim is the organisation of these components under a type system and a permission boundary, and the evidence that this organisation yields knowledge that is auditable and that grows under human control. We answer four research questions, one per property: **RQ1** Can every finding produced in use be traced to a rule and a document location? **RQ2** Does typed authority outperform untyped authority, and does the type carry information about how experts will respond? **RQ3** Does the knowledge measurably grow with use? **RQ4** Is all growth attributable to human decisions and reversible?

The paper is organised as follows. §2 reviews related work by how knowledge enters the system. §3 formulates the problem, presents the rule model, gate, policy and feedback mechanism, describes the implementation and the evaluation design. §4 reports results on the legacy rule set, a worked example, the synthetic corpus and the pilot. §5 discusses implications, threats and limitations; §6 concludes.

## 2 Related work

We organise related work by the question that motivates this paper—*in what form does domain knowledge enter the system, and what does that form preserve*—and summarise the comparison against the four properties in Table 2.

**Inspection and requirements quality.** Checklist-based reading has been the backbone of document and code inspection since Fagan (1976), and surveys of inspection practice stress that reading technique, not reviewer talent, determines yield (Laitenberger and DeBaud, 2000). In requirements engineering, *verifiability* is a defined quality attribute of a requirement (ISO/IEC/IEEE, 2018; Génova et al., 2013), and *requirements smells*—weak words, placeholders, missing units, vague quantifiers—are detected with lightweight deterministic analysers precisely because they are cheap, explainable and stable (Femmer et al., 2017). Our hard and hybrid verifiers inherit this tradition; the contribution is to use verifiability as a *type* that governs what the LLM may do, rather than as a quality score of the requirement.

**LLMs for requirements and design review.** Recent work in this journal has surveyed LLM use across requirements engineering and identified hybrid LLM–tool pipelines and human-in-the-loop control as the main responses to hallucination and inconsistency (Hemmat et al., 2025; for hallucination in general see Huang et al., 2025), and has reviewed the pairing of LLMs with static analysers and verifiers for code (Dolcetti and Iotti, 2025). Multi-agent validators of requirement specifications such as MARV retrieve standards into role prompts and report high recall with over-flagging (Chinnam, 2025). ReqPlan-Eval routes requirements to human review on the basis of evidence signals and keeps decision authority with the reviewer, evaluating components separately and stating what the evidence does not establish (Alsawalqah et al., 2026). We share the evidence-first, human-controlled stance; we differ in making the knowledge itself an asset with types and a life cycle rather than a set of routing signals.

**Neuro-symbolic compliance review.** The closest design to ours is PolicyGuard, which compiles organisational policy into typed relational logic rules whose ground atoms are answered by an LLM from retrieved document evidence, after which a symbolic evaluator applies the rule (Malik et al., 2026). PolicyGuard satisfies auditability and partially separates authority: the LLM grounds local assertions and the symbolic layer decides. The separation is, however, *symmetric*—every atom is answered by the LLM and every answer enters symbolic evaluation—and there is no notion of a requirement that the LLM must not be asked at all, no human feedback loop, and no bounded evolution of the rule base. More broadly, neuro-symbolic integration aims to let symbolic components constrain learned ones (Garcez and Lamb, 2023); our contribution is a specific, operational constraint—*evidence must fall inside verifier-located spans*—and a static type check that rejects rule packages violating the permission structure.

**Feedback-driven LLM code review.** Industrial code review systems learn from developer reactions. BitsAI-CR combines a rule-based checker with an LLM filter and prunes under-performing review rules using an *outdated rate* proxy for adoption (Sun et al., 2025); uReview at Uber reports 75% of comments rated useful after multi-stage filtering (footnote 1); Goldman et al. (2025) classify which comment types developers resolve. Mining 31,073 CodeRabbit review–feedback pairs, Lin et al. (2026) found that 56.3% of agentic review comments were rejected, mainly as false positives or misaligned with intent, and that rejection is predictable (F1 up to 0.76). These studies establish that expert feedback carries learnable signal. In all of them, learning happens in the model, a filter, or a rule-pruning step operated by the vendor; the reviewer cannot see what was learned or roll it back, and the object of review is code rather than a design document. Our design moves the learning into a human-readable overlay that the expert controls.

**Grounding and verbatim citation.** Attributed generation attaches citations to claims (Gao et al., 2023), and verifiability of generative search has been measured by whether citations support statements (Liu et al., 2023). Verbatim quotation makes grounding falsifiable by construction: models can produce verbatim quotes for over 90% of claims when prompted, yet those quotes fully substantiate far fewer (Zhang et al., 2026). We reuse verbatim-quote verification as a component and add two constraints that the citation literature does not need: quotes must lie in a candidate span chosen by a verifier, and a claim of *absence* can never be made by the model.

**Compiled knowledge and self-improving agents.** The "LLM wiki" pattern frames retrieval as interpretation and persistent, LLM-maintained knowledge as compilation (footnote 2); its product is human-readable prose with no executable part, no types, and no permission boundary between the model and the human. Self-refinement and reflection let an agent improve its own outputs or memory (Madaan et al., 2023; Shinn et al., 2023), and open-ended self-modifying agents have been demonstrated (Zhang et al., 2025). We do not pursue model-level self-improvement; we treat the question "which layer of the knowledge may the system change on its own" as a design decision, and we fix the answer by type.

**Human-in-the-loop and interaction design.** Surveys of human-in-the-loop machine learning distinguish active learning, interactive learning and machine teaching by who initiates and who decides (Mosqueira-Rey et al., 2023); guidelines for human–AI interaction recommend making the system's confidence and the user's control visible (Amershi et al., 2019). Our protocol is machine teaching in the strict sense—the expert's ordinary review decisions are the teaching signal—and the dashboard exposes what has been learned per rule.

**Table 2.** Related approaches against the four properties of §3.1. ● satisfied, ◐ partially, ○ not addressed.

| Approach | Knowledge form | (i) Auditable | (ii) Authority ∝ verifiability | (iii) Grows | (iv) Bounded |
|---|---|---|---|---|---|
| Prompt checklists / role agents (Chinnam, 2025) | prompt text | ○ | ○ | ○ | ○ |
| Retrieval over past reviews | embedded chunks | ◐ (source only) | ○ | ○ | ○ |
| Evidence-routed human review (Alsawalqah et al., 2026) | routing signals + records | ● | ◐ | ○ | ● (human decides) |
| Neuro-symbolic compliance (Malik et al., 2026) | logic rules + atom questions | ● | ◐ (symmetric) | ○ | ○ |
| Feedback-driven code review (Sun et al., 2025; Lin et al., 2026) | filters / pruned rules | ◐ | ○ | ● (vendor-side) | ○ |
| LLM wiki (footnote 2) | interlinked prose | ◐ | ○ | ● | ○ |
| This work | typed, versioned rule package + learned overlay | ● | ● | ● | ● |

## 3 Materials and methods

### 3.1 Problem formulation and design requirements

Let \(K\) be a body of review knowledge—rules, phrasing exemplars and past decisions—and \(S\) an LLM-based review system that, given a document \(d\), produces findings and a suggested verdict. The **review-knowledge ingestion problem** is to choose a representation of \(K\) and an assignment of decision authority over it such that:

- (i) **Auditability.** Every finding emitted by \(S\) in use can be traced to an element of \(K\) and to a location in \(d\) (or to an explicit, verifier-produced statement that something expected at a location is absent).
- (ii) **Authority follows verifiability.** The authority \(S\) exercises over an element of \(K\)—to raise a finding automatically, to raise it subject to a check, or merely to flag it for a human—is a function of how deterministically that element can be checked against \(d\).
- (iii) **Growth.** \(K\) is updated incrementally from the interaction between the expert and \(S\), without a separate annotation process.
- (iv) **Bounded growth.** Every update to \(K\) is attributable to a human decision, constrained by the authority structure of (ii), and reversible.

These four properties are design requirements for the mechanisms in §3.2–3.7 and evaluation dimensions in §3.9 and §4. We use them rather than issue-level accuracy as the primary lens because accuracy comparisons against a direct-prompting baseline are quickly overtaken by the next model generation, whereas (i)–(iv) are properties of the organisation, not of the model.

### 3.2 Verifiability-typed rules

A rule package is a YAML file shipped with the plugin and validated on load. Each rule has an identifier, a review *dimension* (capacity, security, interface, channel, data synchronisation, configuration, monitoring, documentation), a *severity* (blocker, major, minor), a *tier* (hard, hybrid, soft), the question put to the LLM and the expert, a rationale, a default remediation suggestion, an optional *applicability* precondition (keyword families, sections, or a value in the change-list table), a verifier specification, a status (active, draft, retired), and provenance. The package also carries a lexicon: section-heading aliases, placeholder tokens, negation tokens and keyword *families* (e.g. *loadtest* = {压测, 压力测试, 性能测试, 负载测试}, the Chinese terms for load, stress and performance testing), which rules reference by key.

The tier is the type of the knowledge (Table 3, Figure 2). The typing criterion is operational: *can a deterministic procedure produce located evidence for or against the requirement on the document, including evidence of absence?* If yes for every aspect of the requirement, the rule is hard. If a procedure can at least locate where the requirement would be addressed and flag surface cues (negation, placeholder, assertion without justification) but the judgement itself requires reading, the rule is hybrid. If no procedure can locate relevant text reliably, the rule is soft.

**Table 3.** Tier semantics. "Who may raise a finding" is enforced in the tools, not in the prompt.

| Tier | Verifier | Verifier outcomes | Who may raise a finding | Counts toward suggested verdict |
|---|---|---|---|---|
| hard | required; every sub-verifier must be *decisive* (pass / fail / not-applicable) | pass, fail, not-applicable | only the verifier (automatic registration); an LLM attempt is rejected with `HARD_RULE_VERIFIER_OWNED` | yes |
| hybrid | required | candidate, pass (structural sub-verifiers only), pending, not-applicable; structural sub-verifiers may still fail | structural fail → automatic; `candidate` → LLM, whose evidence must lie inside the candidate spans; no candidate → *pending*, never fail | yes (structural fails and gate-passed LLM findings) |
| soft | forbidden | — | LLM may register; the finding is always *pending* (needs human judgement) | no |

The type is checked statically when the package loads (`parseRulePack`). A package is rejected as a whole if any rule violates an invariant: a soft rule with a verifier; a hard or hybrid rule without one; a hard rule whose verifier tree contains a non-decisive statement check or a `whenNoCandidate: pending` branch; a hybrid rule whose statement check is decisive or whose no-candidate behaviour is `fail` (absence may not fail a hybrid rule); a reference to a lexicon key that does not exist; or a duplicate identifier. These invariants are the executable form of property (ii): they make it impossible to ship a rule whose stated verifiability and whose authority disagree.

Two design constraints follow from the typing and deserve emphasis. First, *absence is verifier-owned*. "The risk section is missing", "load testing is not mentioned" and "no sequence diagram is present" are findings about what is *not* in the document; they cannot be quoted, and an LLM claim of absence is unverifiable by construction. Only hard verifiers may emit evidence of kind `absence`; a hybrid rule with no candidate becomes *pending*, and an LLM submission of kind `absence`—or a quote that begins with "not mentioned", "not found", "missing" and similar—is rejected by the gate. Absence evidence is displayed as such ("no load-test statement under §4; absence, not a quotation") and never formatted as a quotation. Second, *candidate existence is not satisfaction*. A hybrid rule's statement check never yields *pass*; if the LLM registers no finding on the candidates, the checklist records "reviewed, no issue" rather than "pass", keeping the distinction between what the program verified and what the model read.

### 3.3 Verifiers and evidence anchoring

Documents are Markdown (Word and PDF inputs are converted by a separate, pre-existing office plugin of the host; the review plugin contains no converter). The parser builds a heading tree with section paths, tables with cell ranges, Mermaid `sequenceDiagram` blocks with participants and messages, and a normalised text layer—NFKC folding, full-width to half-width punctuation, removal of Markdown emphasis, whitespace collapsing—together with an offset map back to the source so that any match on the normalised text can be reported as a source range.

Six verifier families and two combinators are sufficient for the shipped package (Table 4). Each verifier is a pure function from (document, rule, lexicon) to a result with a status, evidence and, for hybrid rules, candidate snippets flagged `negated`, `assertion-only` or `placeholder`. Sentences are split at Chinese and Latin terminators and at table-cell boundaries, so that a table cell is itself a candidate unit. Every verifier-produced evidence item carries a source range; absence evidence carries a zero-length range at the position where the expected content would appear.

**Table 4.** Verifier families, what they check, and how often they are used in the 28-rule package.

| Family | Checks | Typical parameters | Uses |
|---|---|---|---|
| section | heading present; body above a minimum length; body not a placeholder | heading key, `minChars`, `allowPlaceholder` | 9 |
| table | table located by section or header words; required column groups; placeholder cells; required row | `locate`, `requiredColumns`, `placeholderCells`, `requireRow` | 3 |
| statement | sentences hitting keyword families; negation within a window; assertion-only patterns without causal words; decisive mode for hard rules | `families`, `sections`, `negationWindow`, `assertionOnly`, `decisive`, `whenNoCandidate` | 16 |
| quantity | number + unit within a window of a context family ("expected 500k new users / month"), vs. unquantified claims ("a large number of new users") | `contextFamilies`, `units`, `window` | 1 |
| mermaid-sequence | diagram present as Mermaid (an image is a fail: unverifiable); minimum participants and messages; required message families (e.g. authorisation code, user identifier, binding check, login) | `minParticipants`, `minMessages`, `requiredMessageFamilies`, `treatImageAsFail` | 3 |
| cross-ref | every "see Attachment n" in the body resolves to an entry in the attachment list | `refPattern`, `listSection` | 3 |
| all / first | combinators: conjunction with evidence merging; first applicable sub-verifier decides (used to fall back from a diagram check to a textual check) | — | 4 / 2 |

### 3.4 The evidence gate

The LLM can write a finding only through the tool `review_record_issue`, whose implementation runs the gate (Algorithm 1). The gate resolves the rule and its tier; rejects attempts on hard rules; marks soft and rule-less findings as pending; requires at least one evidence item; rejects absence claims; normalises each quote and requires 8–300 characters; locates the quote in the normalised document (preferring a hit in the stated section, then a hit inside a candidate span, then the first hit); fills in the source range and the actual section path; and, for hybrid rules, requires each located range to intersect a candidate span from the most recent check of that rule. A finding passes to *confirmed* only if every step passes; otherwise it is stored as *pending* with the full list of reasons (Table 5) so that the agent can repair the quote once and so that the reasons can be analysed later. Gate decisions are deterministic and recorded per review.

**Algorithm 1.** Evidence gate (simplified).

```
gate(review, ruleId?, evidence[]):
  rule ← resolve(ruleId)
  if rule is undefined        → reasons += NO_RULE;  tier ← soft
  if rule.tier = soft         → reasons += SOFT_RULE
  if rule.tier = hard         → raise HARD_RULE_VERIFIER_OWNED
  if evidence = ∅             → reasons += NO_EVIDENCE
  for e in evidence:
    if e.kind = absence or startsWithAbsenceMarker(e.quote) → reasons += ABSENCE_NOT_ALLOWED
    q ← normalise(e.quote); if |q| < 8 → QUOTE_TOO_SHORT; if |q| > 300 → QUOTE_TOO_LONG
    hit ← locate(q, doc, prefer: e.sectionPath, then candidates(rule), then first)
    if hit = none → reasons += QUOTE_NOT_FOUND else e.range ← hit.range; e.sectionPath ← hit.section
    if rule.tier = hybrid and ¬intersects(e.range, candidates(rule)) → reasons += OUT_OF_CANDIDATES
  status ← confirmed if reasons = ∅ else pending
```

**Table 5.** Gate reasons. All are recorded; a finding with any reason is *pending* and does not count toward the suggested verdict until an expert confirms it.

| Reason | Meaning |
|---|---|
| NO_RULE | finding not attached to a rule (treated as soft) |
| SOFT_RULE | rule is soft: human judgement required by type |
| NO_EVIDENCE | no evidence supplied |
| QUOTE_TOO_SHORT / QUOTE_TOO_LONG | quote outside 8–300 normalised characters |
| QUOTE_NOT_FOUND | quote not a substring of the normalised document |
| OUT_OF_CANDIDATES | hybrid rule: quote located outside the verifier's candidate spans |
| ABSENCE_NOT_ALLOWED | LLM asserted absence (kind or leading marker) |

The preference order in `locate` matters more than it appears. The same sentence can occur several times in a document (in the seed proposal, "consistent with the existing data architecture" appears twice in one section); choosing the first hit would wrongly reject a legitimate quote as out of candidates. The candidate-span constraint is therefore a constraint on *position*, not on *string*.

### 3.5 Deterministic verdict policy

The suggested verdict is a function of the confirmed findings, not of anything the model writes:

```
confirmed = { i | i.status ∈ {confirmed, accepted, rewritten} ∧ i.tier ∈ {hard, hybrid, expert} }
verdict   = Fail    if ∃ i ∈ confirmed : severity(i) = blocker
          = Revise  if ∃ i ∈ confirmed : severity(i) = major
                    or |{ i ∈ confirmed : severity(i) = minor }| ≥ θ
          = Pass    otherwise
```

Soft and pending items are listed but never counted. Before review, only verifier and gate-confirmed findings are counted; after review, dismissed findings drop out, accepted and rewritten ones stay, and expert-added findings (tier `expert`) count. The policy is recomputed after every expert decision and is shown to the expert as the recommendation when the final verdict is requested. The final verdict is written by a single tool action, `review_decide(set_final_verdict)`, which requires that a reviewer has been named; no other code path can write it. The difference between the recommended and the final verdict is stored (`verdictDelta`) and is one of our measures of whether experts are rubber-stamping the system (§3.9).

### 3.6 Review as feedback: the conversational protocol

The whole review happens in one conversation with a dedicated *review preset* of the agent harness (a persona, a skill document and a tool allow-list). The skill prescribes three phases (Figure 3).

*Phase 1, preliminary review.* The expert pastes the Markdown, gives a path, or attaches a Word file. The agent calls `review_parse` (which also detects that the same proposal has been reviewed before, by content hash after whitespace normalisation, and resumes it), then `review_check`, which runs all active rules: hard failures are registered automatically; hybrid candidates and soft rules are returned. For each hybrid candidate the agent first calls `memory_recall(ruleId)`, which returns the rule's acceptance statistics, recent dismissal reasons and phrasing exemplars, and warns when the rule has been dismissed often; it then judges the candidate snippets only and, if a requirement is not met, calls `review_record_issue` with a verbatim quote from a snippet. The gate decides. `review_status` then renders a three-layer presentation: the suggested verdict with counts, the list of findings ordered by severity with quotation and section, the items that need the expert's judgement, and a one-line checklist summary (passed / failed / pending / not applicable / reviewed-no-issue).

*Phase 2, expert review.* The agent asks for a reviewer name once, then presents findings in batches of at most five through the harness's structured question tool, each phrased in plain language ("The proposal does not say how load testing will be done or give results—should this be fixed?"), with the quotation and the proposed remediation, and three options: *fix as suggested*, *no change needed*, *fix, but in my words*. Free-text answers are allowed and are normalised by the tool, not by the model: "fix", "yes", "agreed" → accept; "no change", "not an issue", "already covered" → dismiss, with the remainder stored as the reason; "change it to: …" → rewrite with the text; "make it minor" → accept with a per-finding severity override that does not touch the rule; "you missed …" → add, matched to the closest rule if any. "Accept the rest" accepts only *confirmed* findings; pending items must each be looked at. Finally the agent asks for the verdict, listing the counts and the recommendation.

*Phase 3, finalisation and feedback.* `review_finalize` renders the formal opinion in the house style (verdict, numbered findings with quotations and remediation, reviewer, version), writes it as a file (delivered through the host's `present` tool), and then—atomically with respect to the record—updates the knowledge layer (§3.7). A decision taken after finalisation reopens the record and requires a new version of the opinion; the dashboard shows the record as "needs re-finalisation".

The protocol is *machine teaching by ordinary work*: the expert never labels anything; every decision the expert must take anyway becomes a typed event.

### 3.7 Bounded evolution: layers, permissions and audit

Knowledge lives in two layers. The *shipped* layer is the rule package in the plugin. The *learned* layer is a set of records in the host's storage domain that are merged over the shipped layer at read time: per-rule *overrides* (status, severity, suggestion text, and a whitelist of verifier parameters—keyword family additions and removals, minimum lengths, minimum participants/messages, negation window, no-candidate behaviour), per-rule *statistics* (times shown, accepted, dismissed, rewritten), *exemplars* (accepted and rewritten remediation texts, capped per rule), *candidate rules* (expert-added findings that matched no rule), and *draft rules* (`LRN-nnn`) that the agent writes in YAML from a candidate and that become active only when the expert accepts them. Every write to the learned layer appends an audit entry (who, when, which review, field, from, to). An *effective knowledge version* `pack@ver+ovN` is stamped on every review, where `N` counts rules with an active override (statistics-only rows do not count), so that a review can always be reproduced against the knowledge that produced it.

Four expert actions map to four kinds of change (Figure 4): *accept* strengthens the rule's statistics and stores the suggestion as an exemplar; *rewrite* stores the expert's wording as an exemplar that future suggestions reuse; *dismiss* accumulates counter-evidence and, past a configurable ratio and sample size, raises a warning that `memory_recall` surfaces to the agent and the dashboard surfaces to the expert; *add* creates a candidate rule. A second group of actions is explicit rule management, taken in conversation ("from now on treat this as minor", "stop checking this") or in the dashboard, and goes through the same `rules_propose` entry point.

The boundary is deliberately asymmetric. The system—agent or dashboard automation—may change parameters within the whitelist, phrasing, severity and status, and may draft new *soft* rules. It can never raise a rule's tier: a draft that claims to be hybrid or hard must carry a verifier that a human has reviewed, and the static invariants of §3.2 still apply to drafts. Promotion of authority is thus a human act by construction, which is our reading of property (iv). Reversal is symmetric: setting a field back to its shipped value deletes the override (so "changed back" and "never changed" are indistinguishable in the effective version), and `reset` removes all overrides of a rule in one audited step while keeping its statistics.

### 3.8 Implementation as a plugin of an agent harness

We implemented the design as *SolutionReview*, a plugin bundle for an open-source conversational agent harness (DSH; version 0.2.1-rc.2) that already provides the conversation loop, model access, file access, a structured question tool, a delivery tool, a persona/skill/preset mechanism, a JSON-backed storage service, a web server with access control, and a client-side layout with sidebar slots. The plugin adds only what the design needs (Figure 5; footprint in §4.6): a pure-function engine (parser, verifiers, gate, policy, memory aggregation, opinion renderer; no I/O, no clock), a storage domain with seven tables (reviews, issues, feedback, exemplars, rule overrides, rule candidates, evaluation runs), nine tools exposed only inside the review preset (`review_parse`, `review_check`, `review_record_issue`, `review_status`, `review_decide`, `review_finalize`, `rules_list`, `rules_propose`, `memory_recall`), three slash commands that query state without the model, an HTTP API under the host's access control, and a dashboard (Figure 6) with a left-panel overview (daily calendar and trend of reviews, metric cards, the list of proposals with in-place review), a rules page (global editing of status, severity, suggestion and whitelisted parameters; per-rule memory; candidate approval) and a right-sidebar *review assistant* that shows the open review next to the conversation. There is no separate backend, database, embedding index, or front-end build; the client is a single 80 kB bundle that externalises only React. Model access goes through the host's provider abstraction; the plugin contains no vendor SDK and is model-agnostic. All writes—from the conversation and from the dashboard—go through one store object, so the permission rules of §3.7 cannot be bypassed by a second code path.

Tool contracts are schema-checked, and errors are typed (`REVIEW_ALREADY_DECIDED`, `HARD_RULE_VERIFIER_OWNED`, `FINAL_VERDICT_FORBIDDEN`, `REVIEW_CLOSED`, among thirteen codes). Two contracts protect the integrity of the feedback data: re-running the check after any expert decision is refused (it would delete reviewed findings and orphan their feedback), and a proposal that has already been reviewed is resumed rather than duplicated (content hash after normalisation of BOM, line endings and trailing whitespace), with stale duplicates closed as *superseded* rather than deleted. Documents are in Chinese; the normalisation and sentence segmentation are language-specific, while the type system, gate and policy are not.

### 3.9 Evaluation design

**Datasets.** (1) *Legacy rule set*: the 24 expert rules of the 2025 prototype, re-expressed in the new schema, plus four structural rules derived from the proposal template (28 rules). (2) *Seed proposal and variants*: one anonymised, template-conformant proposal (≈7 kB) and seven variants that remove the implementation section, negate the load-test statement, replace a section body with a placeholder, remove an attachment, replace a sequence diagram by an image, complete the diagram, or satisfy all rules; used for unit tests and the worked example. (3) *Synthetic corpus*: 100 generated proposals (30 shaped on the verdict distribution of historical opinions, 70 random) built from phrase pools in which each rule has at least three "satisfied" and four "unsatisfied" phrasings (absent, negated, placeholder, keyword-present-but-empty), with at least one phrasing that avoids the lexicon keywords to test recall; each proposal carries issue-level ground truth and an expected verdict computed by the same policy function. The corpus is synthetic because the original proposals could not be released; it measures mechanism correctness and relative baselines, not business-semantic judgement. (4) *Pilot set*: real reviews conducted in the deployed system; each finalised review is a sample, and no separate annotation is performed. Historical opinions (30 opinions, 45 opinion points; verdict distribution 15 Pass / 14 Revise / 1 Fail) are used only to calibrate the verdict distribution and to note the class imbalance, which is why we report per-class recall and κ rather than accuracy alone.

**Online labels.** The expert's decision labels each finding: accept and rewrite → true positive (rewrite also counted as a phrasing change); dismiss → false positive, with the free-text reason thematically coded; add → false negative (attributed to the matched rule, or counted as "outside the rule set"); a pending item confirmed by the expert → true positive from the pending pool (reported separately as the gate's over-strictness); a pending item marked "not an issue" → false positive that never entered the verdict (reported separately). Alignment is at (review, rule) granularity.

**Metrics by property.** (i) Auditability: share of findings with rule, quote and located range (should be 100% by construction; we report exceptions), distribution of gate reasons, share of LLM registrations that passed the gate (*evidence validity*), and a 30-item expert spot check of whether the quote supports the finding. (ii) Authority follows verifiability: issue-level precision, recall, F1 and severity-weighted recall (weights 3/2/1) on the synthetic corpus for the configurations in Table 6; dismissal rate per tier in the pilot (the type system is informative if hard < hybrid < soft); verdict agreement between the pre-review suggestion and the final verdict (accuracy, macro-F1, Cohen's κ unweighted and quadratically weighted over Pass < Revise < Fail; Cohen, 1960; Landis and Koch, 1977), plus `verdictDelta` and the share of findings the expert changed. (iii) Growth: knowledge increments per finalised review (exemplars, overrides, candidates, activated drafts), the effective-version trajectory, the sliding-window acceptance rate over review index with a fitted slope and confidence interval, and per-rule precision convergence after ten exposures. (iv) Bounded growth: audit coverage of all learned-layer changes (must be 100%), the share of changes initiated by humans versus by the system, and a *simulated-expert* experiment in which a rule parameter is deliberately degraded and a scripted expert that answers from ground truth reviews synthetic proposals until the dismissal-rate warning fires, after which the override is reset and the warning clears. Cost: lines of code, number of tools and tables, tool calls and wall-clock per review, and token usage.

**Table 6.** Configurations compared on the synthetic corpus. The model, temperature (0) and prompts are fixed; each configuration is run three times; runs are recorded as `eval_runs` with model name and prompt hash.

| Code | Configuration | Claim tested |
|---|---|---|
| B0 | keyword baseline replicating the 2025 prototype: 3–5 substrings per rule, no negation, no structure, no evidence; the verdict policy of §3.5 is applied to the set of keyword-absent rules (more lenient to the baseline than the prototype, which only looked at blockers) | (ii): typing vs. keywording |
| B1 | direct LLM review: whole document and all 28 rules in one prompt; model lists findings and the verdict | (ii) and verdict authority |
| S-full | typed verifiers + candidates + gate + policy + memory | — |
| S−gate | gate disabled: every LLM registration is confirmed | contribution of the gate to precision |
| S−verifier | hybrid rules get no candidates: the LLM reads the whole document; hard rules unchanged | contribution of span scoping |
| S−policy | the model states the verdict; findings unchanged | deterministic policy vs. model verdict |
| S−memory | `memory_recall` and exemplar injection disabled | phrasing effect of memory (approximated by edit distance to historical wording) |

**Model.** [[TBD: name and version of the LLM used for hybrid and soft judgements in the pilot and in the batch runs]]. The model is accessed through the host's provider abstraction; batch runs use temperature 0 and fixed prompts that are released with the code; the conversational pilot uses the host's default sampling settings, which we record per review.

**Statistics.** Proportions carry bootstrap 95% confidence intervals (1,000 resamples by proposal). Paired configuration comparisons use the Wilcoxon signed-rank test on per-proposal F1 and McNemar's test on verdict correctness, with Holm correction over the six comparisons and effect sizes reported as differences with intervals. Learning curves are fitted by linear regression and Spearman correlation; we do not claim causality and discuss confounders (expert familiarity, drift in proposal difficulty). Engine determinism is checked by hashing the check output of the synthetic corpus over three runs.

**Anonymisation and ethics.** Proposal identifiers, titles, organisational and third-party names, service, table and field names, codes, URLs, reviewer identities and dates are mapped deterministically to placeholders by a script whose mapping table is private; a forbidden-term scan must return zero hits before any export. Free-text dismissal reasons are released only after manual inspection. The data are records of work-document review by employees acting in their professional role; no personal or sensitive data are involved. [[TBD: ethics statement and consent wording as required by the institution and by Frontiers]]

## 4 Results

### 4.1 Typing the legacy rule set

Re-expressing the 24 legacy rules under the typing criterion of §3.2 produced 6 hard, 13 hybrid and 5 soft rules; with the four template-derived structural rules (quantified business volume, change-list table, mandatory sections, attachment consistency), the shipped package has 10 hard, 13 hybrid and 5 soft rules (Table 7). Two observations follow. First, fewer than half of the rules that the 2025 prototype implemented as keyword checks are deterministically verifiable; thirteen require reading a located passage, which is exactly the case in which keyword presence is uninformative. Second, severity and verifiability are inversely related in this package: all four *blocker* rules (rate limiting, encryption and signing, closed authorisation chain, data exposure) are hybrid, and all ten hard rules are major or minor. The most consequential requirements are the ones a program can locate but not decide, which is where the evidence gate and the expert's attention are concentrated.

**Table 7.** Shipped rule package by tier, severity and dimension (28 rules).

| | hard | hybrid | soft | total |
|---|---|---|---|---|
| blocker | 0 | 4 | 0 | 4 |
| major | 6 | 7 | 3 | 16 |
| minor | 4 | 2 | 2 | 8 |
| **total** | **10** | **13** | **5** | **28** |

| Dimension | n | hard / hybrid / soft | Dimension | n | hard / hybrid / soft |
|---|---|---|---|---|---|
| documentation | 8 | 6 / 0 / 2 | channel | 1 | 0 / 1 / 0 |
| capacity | 6 | 2 / 3 / 1 | data synchronisation | 1 | 0 / 1 / 0 |
| security | 5 | 0 / 4 / 1 | monitoring | 1 | 0 / 1 / 0 |
| interface | 5 | 2 / 3 / 0 | configuration | 1 | 0 / 0 / 1 |

Seven rules carry applicability preconditions (e.g. risk-control rules apply only if the proposal mentions risk control; the change-impact rule applies only if the change list marks a service as *modified*), which turns "not applicable" into an explicit checklist state rather than a silent pass. The lexicon has 25 keyword families, 11 heading groups, 12 placeholder tokens and 11 negation tokens.

### 4.2 Worked example

On the seed proposal (a capability-opening integration with a third-party channel, with sequence diagrams supplied as images), `review_check` yields the checklist in Table 8: three hard failures are registered automatically—no load-test statement in the implementation or resource sections (absence evidence), business volume described only as "a large number of new users" (text evidence flagged assertion-only), and the sequence diagram present only as an image (absence of a verifiable diagram)—so the suggested verdict before any LLM involvement is *Revise*. Seven hybrid rules produce candidate spans for the LLM (resource growth, encryption, authorisation chain, real-name data use, data exposure, boundary handling, impact on existing logic); three hybrid rules have no candidate and are pending rather than failed (rate limiting, idempotency, channel control); five soft rules are listed for the expert; five rules are not applicable; five pass. Removing the implementation section (variant *no-impl*) adds a mandatory-section absence failure; negating the load-test sentence ("load testing will not be carried out for now") turns the absence into a located negated statement; replacing the image by a Mermaid diagram that lacks the user-identifier and phone-number exchange turns the diagram rule to pass and the authorisation-chain rule to a structural fail whose note names the missing message families.

**Table 8.** Checklist for the seed proposal (28 rules).

| Outcome | Rules | n |
|---|---|---|
| fail (hard, auto-registered) | CAP-002 load test (absence), CAP-006 quantified volume (text), DOC-001 sequence diagram (absence) | 3 |
| candidate (hybrid → LLM) | CAP-003, SEC-001, SEC-002, SEC-003, SEC-004, INT-002, INT-003 | 7 |
| pending (hybrid, no candidate) | CAP-001, INT-005, CHN-001 | 3 |
| soft (listed) | CAP-004, SEC-005, CFG-001, DOC-003, DOC-004 | 5 |
| not applicable | CAP-005, SYN-001, MON-001, DOC-002, DOC-005 | 5 |
| pass (hard) | INT-001, INT-004, DOC-010, DOC-011, DOC-012 | 5 |

In a scripted end-to-end replay used as a regression test, the full protocol—parse, check, seven memory recalls, eight LLM registrations, status, three question batches (5/5/1), fourteen decisions, reviewer, final verdict, finalisation—reproduces the expected opinion file byte-for-byte after whitespace normalisation. A first live session with a production model completed the same proposal with ten findings, all accepted by the expert, and a finalised opinion; we treat it as a smoke test, not as evidence.

### 4.3 Mechanism evaluation on the synthetic corpus (RQ2, RQ1)

**Corpus.** The released generator (`src/eval/synthetic.ts`, seed 20261029) produced 100 proposals with 253 planted defects over the 23 verifiable rules (98 *absent*, 37 *negated*, 52 *placeholder*, 66 *keyword-present-but-empty*); the expected verdicts are 30 Pass / 47 Revise / 23 Fail (the 30 history-shaped proposals follow the 15 / 14 / 1 distribution of the historical opinions). Every rule's "satisfied" phrasings pass a self-check: on the 100 proposals no verifier fails and the deterministic judge raises no finding on any rule that was not planted (0 violations), so every reported false positive would be attributable to the mechanism rather than to the corpus. Building the corpus surfaced one defect in the shipped package: the attachment-list pattern of the prototype-comparison rule (DOC-002) did not capture the attachment number, so a correctly listed prototype attachment was reported as missing on every UI-change proposal; the pattern was corrected and the fix is covered by the self-check.

**Configurations run.** The plugin ships no model client; hybrid judgements are made through a pluggable *judge* (§3.9). This section reports the deterministic configurations only—B0, S-full and S−verifier with the deterministic *flag judge*, which raises a finding on a candidate span exactly when the verifier marked it negated, assertion-only or placeholder. The flag judge measures the mechanism (verifiers, candidates, gate, policy), not LLM capability; B1, S−gate and S−policy require an LLM adapter and are recorded as *skipped* in the released summary rather than approximated. Three repetitions of each configuration produced byte-identical metrics and the engine hash over the corpus agreed across three runs (T-EVA-06), so no confidence intervals are needed for repetition variance; the intervals in Table 9 are bootstrap intervals over proposals.

**Table 9.** Issue-level and verdict-level results on the synthetic corpus (100 proposals, 253 planted defects; deterministic configurations; 95% bootstrap CIs by proposal; S-full and S−verifier are identical under the deterministic judge).

| Configuration | P | R | F1 [95% CI] | R_w | hard P / R | hybrid P / R | Verdict acc. | macro-F1 | κ | κ_w | Evidence validity | Pending coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B0 keyword | 0.275 | 0.186 | 0.222 [0.176, 0.267] | 0.162 | — | — | 28.0% | 0.275 | −0.043 | −0.059 | n/a | 0% |
| S-full (flag judge) | **1.000** | **0.664** | **0.798** [0.762, 0.836] | **0.649** | 1.00 / 0.88 | 1.00 / 0.39 | **85.0%** | **0.832** | **0.763** | **0.739** | 79.2% | 80.0% |
| S−verifier (flag judge) | 1.000 | 0.664 | 0.798 [0.762, 0.836] | 0.649 | 1.00 / 0.88 | 1.00 / 0.39 | 85.0% | 0.832 | 0.763 | 0.739 | 79.2% | 80.0% |

*Typing versus keywording (RQ2).* B0 produced 47 true, 124 false and 206 missed findings; S-full produced 168 true findings, no false finding and 85 misses (ΔF1 = +0.564, paired Wilcoxon over per-proposal F1 *p* < 0.001; McNemar on verdict correctness b/c = 64/7, *p* < 0.001; both survive Holm correction). B0's errors have the shape predicted in §3.2: keyword presence is uninformative on negated, placeholder and keyword-present-but-empty phrasings (precision 0.00 on 13 of the 23 rules), while keyword absence fires on satisfied phrasings that avoid the lexicon (recall 0.13 on the sequence-diagram rule, 0.25 on the volume rule). Its verdict agreement with the planted verdict is at chance (κ = −0.04; 17 of 30 Pass proposals rated Fail), which reproduces the 2025 failure mode in which a declared-but-unverifiable checklist drove the verdict.

*Where the remaining misses are.* All 85 misses of S-full are either planned pending states or a documented limit of decisive verifiers; none is a silent pass on a located defect. Sixty-eight are hybrid defects reported as *pending* for the expert—27 *absent* and 30 *keyword-present-but-empty* phrasings that the deterministic judge cannot decide, plus 11 negated or placeholder spans rejected by the gate (below)—so 80% of all misses are shown to the expert as open items rather than hidden (pending coverage). The remaining 17 are hard rules whose verifier is *decisive* on keyword presence (load-test statement, parameter completeness, change-list table): they miss 7 + 5 + 5 placeholder or hollow phrasings, which is the documented trade-off for making these rules fully automatic. Per planted kind, the mechanism alone located 71 of 98 absent, 31 of 37 negated, 42 of 52 placeholder and 24 of 66 keyword-present-but-empty defects, with 27 / 6 / 5 / 30 pending and 0 / 0 / 5 / 12 missed; the hollow kind is exactly the case that needs the LLM judge in the hybrid tier, and the ordering absent > negated > placeholder > hollow is the ordering of what structure alone can decide.

*Evidence gate.* Under S-full the deterministic judge submitted 53 hybrid findings; 42 passed the gate and 11 (20.8%, in 10 proposals) were rejected with `QUOTE_TOO_SHORT`: short negated or placeholder sentences such as "不改造既有流程" or "幂等策略：待定" fall below the eight-character quote floor. The rejected findings were downgraded to pending rather than discarded—they are exactly the 6 negated and 5 placeholder pending cases above—so the gate cost 11 located true findings (recall −0.043) and no false one, and every one of them stays visible to the expert as an open item. The result identifies the quote floor, chosen to stop one- or two-word "evidence", as a parameter to revisit for whole-sentence placeholder spans. No `ABSENCE_NOT_ALLOWED`, `QUOTE_NOT_FOUND` or `OUT_OF_CANDIDATES` rejection occurred, as expected for a judge that quotes the verifier's own span.

*Span scoping.* S−verifier (hybrid statements evaluated over the whole document instead of their sections) is identical to S-full under the deterministic judge (ΔF1 = 0, b/c = 0/0): widening the search region added candidate spans but none carried a negation or placeholder cue, and the judge never cites outside a region. The contribution of span scoping is therefore a property of the LLM judge (how often an unconstrained model cites outside the verifier's region, measured as `OUT_OF_CANDIDATES`), and is left to the LLM configurations.

*Verdict policy.* With the finding sets above, S-full's suggested verdict agreed with the planted verdict in 85 of 100 proposals (κ = 0.76, κ_w = 0.74; confusion over Pass / Revise / Fail: [[30, 0, 0], [6, 41, 0], [4, 5, 14]]). All 15 disagreements are under-calls caused by pending hybrid findings that the deterministic judge could not confirm (nine Fail proposals whose blocker defect was a hybrid rule, six Revise proposals whose major defects were hybrid); there is no over-call, consistent with the policy counting only confirmed findings.

[[TBD when the LLM adapter runs are available (`pnpm run eval:ablation --adapter …`, three repetitions at temperature 0, model name and prompt hash recorded per run): B1, S−gate and S−policy rows of Table 9; evidence validity and gate-reason distribution of LLM registrations under S-full; `OUT_OF_CANDIDATES` share under S−verifier; SD of F1 across repetitions for the LLM path; the hybrid-tier recall gained over the flag judge on absent and keyword-present-but-empty phrasings.]]

### 4.4 Pilot deployment (RQ1–RQ3)

[[TBD: n finalised reviews between … and …; number of experts; proposals per expert. Table: counts of findings by origin (verifier / LLM / expert) and by decision (accept / dismiss / rewrite / add); dismissal rate per tier with CIs (Figure 7); acceptance rate over review index with sliding window of 5 and fitted slope (Figure 8); per-rule precision for rules shown ≥ 10 times; rules that triggered the dismissal warning and what was changed; candidate rules produced / drafted / activated; verdict agreement (3×3 confusion matrix, κ, weighted κ), verdictDelta distribution, share of reviews in which the expert changed the finding set; evidence validity and spot-check result (30 items); exceptions to full traceability, if any.]]

### 4.5 Growth and bounded growth (RQ3, RQ4)

[[TBD: effective-version trajectory `pack@1.0.0+ovN` over review index (Figure 8); knowledge increments per review; audit coverage (expected 100%); human- vs system-initiated changes; simulated-expert experiment: parameter degraded (e.g. `negationWindow` of CAP-002 set to 0), reviews until warning, reset and clearance, with the audit excerpt as a figure or listing.]]

### 4.6 Cost

**Table 9.** Implementation footprint at the evaluated revision.

| Component | Size |
|---|---|
| Engine (parser, 6 verifier families + 2 combinators, gate, policy, memory, renderer; pure functions) | 2,273 LOC TypeScript |
| Host (store, 9 tools, 3 commands, HTTP API, skill provider, config) | 2,592 LOC |
| Storage domain (7 tables, schemas) | 286 LOC |
| Dashboard client (overview, rules, assistant; inline SVG charts) | 1,740 LOC; 80 kB bundle, React externalised |
| Rule package | 28 rules, 25 keyword families, 1 YAML file |
| Tests | 5,116 LOC; 386 passing, 15 pending (unit, contract, protocol replay, bundle, benchmark) |
| Check latency | 200 kB document in 0.54 s (single thread, Node 22) |
| External services added | none (storage, model access, web server, access control, document conversion are the host's) |

[[TBD: per-review tool calls, wall-clock (total and machine time excluding expert wait), model requests and tokens from `reviews.metrics` and the host token meter; expert self-reported time per proposal without the tool (n ≥ 3) as a reference, not a controlled baseline.]]

## 5 Discussion

### 5.1 Answers to the research questions

[[TBD: one paragraph per RQ once §4.3–4.5 are filled. Keep the following framing.]] RQ1 is answered by construction plus exceptions: every finding that reaches the opinion carries a rule and either a located quotation or a verifier-produced absence statement; the measured quantities are how often the LLM's first attempt failed the gate and why. RQ2 has two halves: the ablation measures whether typing, span scoping and the gate buy precision without losing recall against keywording and direct prompting; the pilot's per-tier dismissal rate measures whether the type predicts expert disagreement, which is the practically relevant sense in which the type system "works". RQ3 is the growth of the learned layer and the trend in acceptance; RQ4 is the audit coverage, the human share of changes, and the simulated-expert experiment.

### 5.2 Symmetric and asymmetric authority

PolicyGuard (Malik et al., 2026) and our design agree that the LLM should not decide compliance and that a symbolic layer should. They differ on whether the LLM should be asked at all. In PolicyGuard, every ground atom is an LLM question whose answer flows into symbolic evaluation; the LLM's reliability on each atom is an empirical matter addressed by validation and repair. In our design, the *type* says in advance which questions the LLM may be asked and on which spans: for hard rules it is not consulted; for hybrid rules it is consulted on verifier-located text and its evidence is checked positionally; for soft rules its output cannot affect the outcome without a human. The practical consequence is that a verifier bug and an LLM error have different signatures—the former shows up as a dismissed hard finding, the latter as a gate rejection or a dismissed hybrid finding—which is what makes the per-tier statistics interpretable and the dismissal warning actionable.

### 5.3 Where the learning lives

BitsAI-CR's data flywheel prunes rules by an adoption proxy and improves precision over weeks (Sun et al., 2025); CodeRabbit's rejection patterns are learnable by a classifier (Lin et al., 2026). Both place learning where the reviewer cannot see it. Our learned layer is human-readable, per rule, versioned and reversible, at the price of being coarser: we adjust parameters within a whitelist, phrasing, severity and status, and we create candidate rules, but we do not learn a filter. We consider this the right trade for a setting where the reviewer signs the outcome: the question the reviewer can answer when a rule starts to misfire is "what changed, who changed it, and how do I undo it", and the layer is designed around that question. Whether the coarser learning converges as fast is an empirical question that the pilot addresses [[TBD: refer to §4.4]].

### 5.4 Bounded, human-gated knowledge evolution

Agent research increasingly studies systems that modify their own tools, prompts or code (Madaan et al., 2023; Shinn et al., 2023; Zhang et al., 2025). In an organisational review setting the relevant question is not whether self-modification is possible but where its boundary lies. Our boundary is drawn by type: the system may change what is already within its authority (parameters, phrasing, soft drafts) and may never extend that authority (tier promotion). The boundary is enforced by static checks on the rule package and by the single write path, not by instructions to the model, and every crossing attempt is an auditable error. We offer this as one concrete, testable configuration of "bounded self-improvement" for high-stakes document review rather than as a general theory.

### 5.5 How the host shaped the design

Building on an agent harness rather than a stand-alone application decided several design questions for us, mostly for the better. The harness's structured question tool fixed the review interaction as batched questions with options and free text, which pushed us toward tool-side normalisation of answers (so that the model never reinterprets "no change") and toward per-finding severity overrides (because experts kept answering "make it minor"). Its storage service made a JSON domain the natural persistence, which in turn made the learned layer a small set of inspectable records rather than a database schema. Its command mechanism bypasses the model, so slash commands became pure queries and review initiation stayed in natural language. The absence of a settings UI for third-party plugins kept configuration in YAML. The constraint we found most limiting was the lack of a stable session identifier inside tool execution, which prevents a "back to the conversation" link from the dashboard. Conversely, two host behaviours surfaced real design issues: the same proposal being re-parsed from paste, path and converted Word produced duplicate records until we normalised content hashes and introduced *superseded* records, and re-running the check after decisions silently orphaned feedback until we refused it.

### 5.6 Threats to validity and limitations

*Construct.* Synthetic ground truth is produced by the same policy function that the system uses, so the synthetic verdict comparison tests policy *consistency*, not policy *correctness*; verdict correctness is assessed only on the pilot against expert decisions. Online labels treat an expert's acceptance as truth; experts may rubber-stamp, which is why we report the share of changed findings, rewrites, additions and dismissals and the `verdictDelta` distribution. *Internal.* Learning-curve trends are confounded by expert familiarity and by drift in proposal difficulty; we report trends, not causal effects. *External.* One organisation, one document template, one rule package in Chinese; the rule package is data and the engine is template-agnostic, but we have not yet demonstrated a second package [[TBD: update if the change-type package is available]]. Hybrid judgements depend on one model family at temperature 0; we did not replicate with a second model, so model invariance is outside the evidence. The historical proposals could not be released and the historical opinions are used only as a distribution. *Reliability.* The engine is deterministic and the gate is recorded, so the mechanism part of the evaluation is reproducible from the released corpus; the LLM part is reproducible only up to provider drift.

### 5.7 Future work

Three extensions follow directly from the design. First, a soft-to-hybrid *promotion hint*—a rule whose findings are consistently accepted and whose accepted quotations share stable keywords is a candidate for a verifier—could be computed from the learned layer; promotion would remain a human act. Second, rule applicability by document type and change type would let one engine serve several templates. Third, the simulated-expert harness could be generalised into a continuous lint of the knowledge layer. Beyond the system, the evaluation methodology—decision-as-label, per-tier dismissal, effective-version trajectories—applies to any in-the-loop review tool and could be compared with adoption proxies such as the outdated rate.

## 6 Conclusion

Putting expert review knowledge into an LLM system is a design problem with its own requirements, not a prompt-engineering detail. We named the problem, stated four properties a solution should have, and showed a design that meets them by typing rules by verifiability, letting the type decide who may raise a finding, gating the model's evidence by position, computing verdicts deterministically, and turning the expert's ordinary review decisions into a versioned, auditable, human-gated knowledge layer—all as plugins on an existing agent harness. Typing the legacy checklist already explained the failure of the keyword approach: most of the knowledge was not keyword-verifiable, and the most consequential rules least of all. [[TBD: one sentence with the headline quantitative result from §4.3 and one from §4.4.]] The plugin, rule package, synthetic corpus, evaluation scripts and anonymised pilot data are released for reuse.

---

## Data availability statement

[[TBD]] The plugin source code, the rule package, the synthetic corpus with ground truth, the evaluation scripts and the anonymised pilot exports are available at [[TBD: repository URL and archived DOI]]. Original proposals, the anonymisation mapping and the forbidden-term list are not released.

## Ethics statement

[[TBD: institutional wording.]] The study analysed records of technical-document review performed by employees in their professional capacity; participating experts were informed that their review decisions would be analysed in anonymised form. No personal or sensitive data were collected.

## Author contributions

[[TBD: CRediT roles per author.]]

## Funding

[[TBD]]

## Conflict of interest

[[TBD: declaration.]]

## Generative AI statement

[[TBD: Frontiers requires disclosure of any generative AI used in writing or editing, including model name, version and source. State whether an LLM was used to draft or edit text and which, and whether prompts/outputs are supplied as supplementary material.]] The LLM used *inside* the evaluated system is part of the studied artefact and is described in §3.8 and §3.9.

## Publisher's note

(standard Frontiers text, added at typesetting)

## Footnotes

1. uReview: Scalable, Trustworthy GenAI for Code Review at Uber. Uber Engineering Blog, 12 August 2025. https://www.uber.com/blog/ureview/ (accessed 29 October 2026).
2. Karpathy, A. (2026). LLM Wiki: a pattern for building personal knowledge bases using LLMs. GitHub Gist, 4 April 2026. https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f (accessed 29 October 2026).

## Figure captions

**Figure 1.** Three routes for ingesting review knowledge into an LLM review system (keywording, prompting, fragmenting) and the property each loses; the proposed route treats knowledge as a typed, versioned asset. [[TBD: draw]]

**Figure 2.** The verifiability spectrum of review requirements and the three tiers with their authority: hard (verifier-owned, may fail automatically, may assert absence), hybrid (verifier-scoped: candidate spans and cues; LLM judges within spans; no candidate → pending), soft (advisory: pending by type). [[TBD: draw]]

**Figure 3.** Review pipeline: parse → check (hard fails registered; hybrid candidates; soft listed) → LLM judgement on candidates → evidence gate → deterministic policy → expert decisions → finalisation → learned layer. [[TBD: draw]]

**Figure 4.** Review as feedback: the four expert actions (accept, dismiss, rewrite, add) and the explicit rule-management actions, the learned-layer records each one writes, and the permission boundary (dashed) that the system cannot cross: tier promotion requires a human-reviewed verifier. [[TBD: draw]]

**Figure 5.** Plugin architecture inside the agent harness: host services reused (conversation, model provider, storage, question and delivery tools, web server, layout) and plugin components added (engine, storage domain, tools in the review preset, commands, API, dashboard). [[TBD: draw]]

**Figure 6.** Dashboard. (A) Overview with daily calendar and 30-day trend of started and finalised reviews, metric cards and the proposal list with in-place review. (B) Rules page with global editing, per-rule memory (statistics, exemplars, recent dismissal reasons) and candidate-rule approval. (C) Review assistant beside the conversation. [[TBD: screenshots from the anonymised instance]]

**Figure 7.** Ablation on the synthetic corpus (precision, recall, F1 per configuration of Table 6) and dismissal rate per tier in the pilot with 95% CIs. [[TBD: data]]

**Figure 8.** Knowledge growth over the pilot: effective-version trajectory, cumulative exemplars / overrides / candidates / activated drafts, and sliding-window acceptance rate. [[TBD: data]]

## References

Alsawalqah, H., Abadleh, A., Ibrahim, S., Alqaralleh, B. A. Y., Aoun, C., and Zreikat, A. I. (2026). Evidence-aware human-in-the-loop LLM review for requirements-to-planning decisions. *Computers* 15, 608. doi: 10.3390/computers15090608

Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., et al. (2019). "Guidelines for human-AI interaction," in *Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems (CHI '19)* (New York, NY: ACM), Paper 3. doi: 10.1145/3290605.3300233

Chinnam, H. (2025). *MARV: A Multi-Agent Approach for Validation of Software Requirements Specifications*. Master's thesis, Tampere University, Tampere. Available at: https://urn.fi/URN:NBN:fi:tuni-202507297873

Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educ. Psychol. Meas.* 20, 37–46. doi: 10.1177/001316446002000104

Dolcetti, G., and Iotti, E. (2025). A dual perspective review on large language models and code verification. *Front. Comput. Sci.* 7:1655469. doi: 10.3389/fcomp.2025.1655469

Fagan, M. E. (1976). Design and code inspections to reduce errors in program development. *IBM Syst. J.* 15, 182–211. doi: 10.1147/sj.153.0182

Femmer, H., Méndez Fernández, D., Wagner, S., and Eder, S. (2017). Rapid quality assurance with Requirements Smells. *J. Syst. Softw.* 123, 190–213. doi: 10.1016/j.jss.2016.02.047

Gao, T., Yen, H., Yu, J., and Chen, D. (2023). "Enabling large language models to generate text with citations," in *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing (EMNLP 2023)* (Singapore: Association for Computational Linguistics), 6465–6488. doi: 10.18653/v1/2023.emnlp-main.398

Garcez, A. d'A., and Lamb, L. C. (2023). Neurosymbolic AI: the 3rd wave. *Artif. Intell. Rev.* 56, 12387–12406. doi: 10.1007/s10462-023-10448-w

Génova, G., Fuentes, J. M., Llorens, J., Hurtado, O., and Moreno, V. (2013). A framework to measure and improve the quality of textual requirements. *Requir. Eng.* 18, 25–41. doi: 10.1007/s00766-011-0134-z

Goldman, S., Lin, H. Y., Pasuksmit, J., Thongtanunam, P., Tantithamthavorn, K., Wang, Z., et al. (2025). What types of code review comments do developers most frequently resolve? *arXiv* [Preprint]. arXiv:2510.05450. Available at: https://arxiv.org/abs/2510.05450 (Accessed October 29, 2026).

Hemmat, A., Sharbaf, M., Kolahdouz-Rahimi, S., Lano, K., and Yassipour Tehrani, S. (2025). Research directions for using LLM in software requirement engineering: a systematic review. *Front. Comput. Sci.* 7:1519437. doi: 10.3389/fcomp.2025.1519437

Huang, J., Chen, X., Mishra, S., Zheng, H. S., Yu, A. W., Song, X., et al. (2024). "Large language models cannot self-correct reasoning yet," in *The Twelfth International Conference on Learning Representations (ICLR 2024)*.

Huang, L., Yu, W., Ma, W., Zhong, W., Feng, Z., Wang, H., et al. (2025). A survey on hallucination in large language models: principles, taxonomy, challenges, and open questions. *ACM Trans. Inf. Syst.* 43, 42. doi: 10.1145/3703155

ISO/IEC/IEEE (2018). *ISO/IEC/IEEE 29148:2018 Systems and software engineering — Life cycle processes — Requirements engineering*. Geneva: International Organization for Standardization.

Laitenberger, O., and DeBaud, J.-M. (2000). An encompassing life cycle centric survey of software inspection. *J. Syst. Softw.* 50, 5–31. doi: 10.1016/S0164-1212(99)00073-4

Landis, J. R., and Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics* 33, 159–174. doi: 10.2307/2529310

Lin, H. Y., Liang, M., Tantithamthavorn, K., and Thongtanunam, P. (2026). Is agentic code review helpful? Mining developers' feedback to CodeRabbit reviews in the wild. *arXiv* [Preprint]. arXiv:2607.03316. Available at: https://arxiv.org/abs/2607.03316 (Accessed October 29, 2026).

Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., et al. (2024). Lost in the middle: how language models use long contexts. *Trans. Assoc. Comput. Linguist.* 12, 157–173. doi: 10.1162/tacl_a_00638

Liu, N. F., Zhang, T., and Liang, P. (2023). "Evaluating verifiability in generative search engines," in *Findings of the Association for Computational Linguistics: EMNLP 2023* (Singapore: Association for Computational Linguistics), 7001–7025. doi: 10.18653/v1/2023.findings-emnlp.467

Madaan, A., Tandon, N., Gupta, P., Hallinan, S., Gao, L., Wiegreffe, S., et al. (2023). "Self-Refine: iterative refinement with self-feedback," in *Advances in Neural Information Processing Systems 36 (NeurIPS 2023)*.

Malik, S., Singh, A., and Azad, A. P. (2026). PolicyGuard: from organizational policies to neuro-symbolic compliance review engines. *arXiv* [Preprint]. arXiv:2606.32004. Available at: https://arxiv.org/abs/2606.32004 (Accessed October 29, 2026).

Mosqueira-Rey, E., Hernández-Pereira, E., Alonso-Ríos, D., Bobes-Bascarán, J., and Fernández-Leal, Á. (2023). Human-in-the-loop machine learning: a state of the art. *Artif. Intell. Rev.* 56, 3005–3054. doi: 10.1007/s10462-022-10246-w

Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K., and Yao, S. (2023). "Reflexion: language agents with verbal reinforcement learning," in *Advances in Neural Information Processing Systems 36 (NeurIPS 2023)*.

Sun, T., Xu, J., Li, Y., Yan, Z., Zhang, G., Xie, L., et al. (2025). "BitsAI-CR: automated code review via LLM in practice," in *Companion Proceedings of the 33rd ACM International Conference on the Foundations of Software Engineering (FSE Companion '25)* (New York, NY: ACM). doi: 10.1145/3696630.3728552

Zhang, J., Chen, Y., Commodore-Mensah, Y., and Oberst, M. (2026). Verifiable by construction: claim-level evaluation of verbatim citation in clinical question answering. *arXiv* [Preprint]. arXiv:2609.15964. Available at: https://arxiv.org/abs/2609.15964 (Accessed October 29, 2026).

Zhang, J., Hu, S., Lu, C., Lange, R., and Clune, J. (2025). Darwin Gödel Machine: open-ended evolution of self-improving agents. *arXiv* [Preprint]. arXiv:2505.22954. Available at: https://arxiv.org/abs/2505.22954 (Accessed October 29, 2026).

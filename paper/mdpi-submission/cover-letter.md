# Cover letter — draft for the *Computers* (MDPI) submission

> Fill the bracketed placeholders, paste into the MDPI submission system, and keep a copy in the
> repository. Length: one screen. No claim in it goes beyond what Section 4 measures.

Dear Editor,

We submit the manuscript **"HARK: Human-Gated Authority-Typed Review Knowledge for LLM-Assisted
Proposal Review"** for consideration as an *Article* in *Computers*, in the Section *AI-Driven
Innovations*.

**Problem.** Large language models are increasingly used to pre-screen documents before an expert
signs off, but the expert's review knowledge enters such systems as keyword rules, prompt checklists
or retrieval over past reviews. Each route loses a property that high-stakes review needs: a finding
must trace to a rule and to a location in the document; decision authority must match how
deterministically a requirement can actually be checked; the knowledge must grow from use; and that
growth must stay under human control.

**Contribution.** The manuscript studies this problem on preliminary review of technical solution
proposals at a [utility / platform] and makes four contributions:

1. a **verifiability-typed rule model** in which the rule's type, not the prompt, decides who may
   conclude it — deterministic verifiers (`hard`), verifier-located spans judged by the model
   (`hybrid`), and judgement-only items (`soft`, never counted);
2. a **tool-side evidence gate** that refuses any finding whose quote cannot be located in the
   document, so an unanchored finding is downgraded to an open item instead of being reported;
3. a **deterministic verdict policy** over the confirmed set, with the final verdict written only by
   the expert;
4. an **expert-review memory** in which each decision (accept / reject / rewrite / add) becomes an
   audited record that retunes parameters and collects phrasing exemplars but never promotes a rule's
   type.

**Evidence.** On a synthetic corpus of 100 proposals with 253 planted defects, the design reaches
F1 0.798 against 0.222 for a keyword baseline of the same policy, with no false finding and 85%
verdict agreement (κ = 0.76); 80% of its remaining misses reach the expert as open items rather than
as silent passes. Only 10 of the 28 shipped rules proved deterministically verifiable, and the four
blocking rules least of all — a result we report as a finding, not as a limitation to be hidden.
The system is implemented as a plugin of an open agent harness with no separate backend; the
manuscript reports five internal end-to-end runs as pilot evidence, explicitly labelled as internal
and not as independent expert validation.

**Reproducibility.** The plugin, the 28-rule package, the corpus generator, the corpus with ground
truth, the ablation runner and the nine published runs are released under MIT at
<https://github.com/yyyyyyzt/HARK-Human-Gated-Authority-Typed-Review-Knowledge>, archived at Zenodo
(DOI 10.5281/zenodo.23955205); every number in Section 4 is recomputed by one command.

**Declarations.** The manuscript is original, is not under consideration elsewhere, and all authors
have approved the submission. The authors declare no conflict of interest. [Adjust if a grant
applies: this work was supported by …]

We suggest the Section *AI-Driven Innovations* because the contribution is a design and an
evaluation for AI-assisted expert work, and the Topic *AI Agents: Progress, Architecture, and
Applications* (alternative: *AI-Driven Software Engineering and Next-Generation Web Services*).

Yours sincerely,

[Corresponding author name], on behalf of all authors
[Affiliation, e-mail, ORCID]

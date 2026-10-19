// Three-phase review protocol driven by a scripted LLM (dsh-llm-mock-server / llm-replay) — S3c.
import { describe, it } from 'vitest'

describe('skill & persona wiring (T-PRO-01, T-PRO-10)', () => {
  it.todo('SKILL.md is discoverable via ctx.skills under the name wsgw-solution-review and renders < 8192 chars')
  it.todo('persona text equals review-protocol.md §2 (snapshot)')
})

describe('canonical path on the seed solution (T-PRO-02, T-REQ-20, AC-10)', () => {
  it.todo('tool sequence: review_parse → review_check → memory_recall* → review_record_issue* → review_status → ask_user_question batches → review_decide* → set_final_verdict → review_finalize')
  it.todo('parameter snapshot of every tool call matches the recorded script')
  it.todo('final opinion file exists and equals the expected Markdown snapshot')
})

describe('review batches (T-REQ-11, T-PRO-03)', () => {
  it.todo('11 issues → 3 ask_user_question calls sized 5 / 5 / 1')
  it.todo('confirmed items offer 「采纳（推荐）/ 驳回 / 改写」 with custom free text enabled')
  it.todo('pending items offer 「确认为问题 / 不是问题」 and the detail text explains the gate reason')
})

describe('reviewer identity (T-PRO-06)', () => {
  it.todo('without defaultReviewer the agent asks once per session before set_final_verdict')
  it.todo('with defaultReviewer configured the agent does not ask')
})

describe('final verdict recommendation (T-PRO-07)', () => {
  it.todo('recommended option equals computeVerdict over post-review issue statuses')
  it.todo('expert choosing a different verdict is accepted and recorded as verdictDelta')
})

describe('failure paths (T-PRO-09)', () => {
  it.todo('QUOTE_NOT_FOUND → agent retries once with a corrected quote, then accepts pending')
  it.todo('cancelled ask_user_question → no review_decide call, review stays open')
  it.todo('re-pasting the same solution → agent surfaces existingReviewId and asks continue / restart')
  it.todo('request to skip review and emit the opinion directly is refused; two-step fast path offered')
})

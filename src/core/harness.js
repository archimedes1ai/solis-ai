// SOLIS harness — orchestration layer that sits in front of a single model call.
//
// Shape: instead of one callSolis round trip, a message is routed through a
// named pipeline — retrieve context, run a specialist, check its finding, then
// have the Core compose ONE coordinated answer in SOLIS's normal voice.
//
// This is deliberately a drop-in for callSolis: same inputs, returns a plain
// string. Call sites (App.jsx) need no other change.
//
// Live today:  Stage 2 (specialist) and Stage 5 (Core composition).
// Stubs:       Stage 1 (retrieval), Stage 3 (evidenceCheck), Stage 4 (riskReview),
//              Stage 6 (approvalGate) — all pass their input straight through.
//              They exist so the pipeline shape is visible and each can be
//              filled in later without moving the call sites around.
//
// NOTE: callSolis always prepends the full SOLIS persona prompt (apiClient.js)
// to whatever `system` it is given. The prompts below are therefore SUFFIXES
// that narrow that persona for one hop — they do not replace it.

// Specialist findings are internal working notes, not user-facing prose, so
// they do not need the caller's full token budget.
const SPECIALIST_MAX_TOKENS = 1500;

// ── Stage 1 · retrieval (STUB) ──────────────────────────────────────────────
// Will eventually pull Project Truth File entries, prior records and documents
// relevant to this turn. For now it passes the caller's context through as-is.
function retrieval(ctx) {
  return ctx;
}

// ── Stage 3 · evidenceCheck (STUB) ──────────────────────────────────────────
// Will eventually verify that each claim in the finding is backed by a named
// document or record, and downgrade confidence where it is not.
function evidenceCheck(finding) {
  return finding;
}

// ── Stage 4 · riskReview (STUB) ─────────────────────────────────────────────
// Will eventually score the finding for commercial, programme and legal
// exposure, and flag anything needing the draft-for-review prefix.
function riskReview(finding) {
  return finding;
}

// ── Stage 6 · approvalGate (STUB) ───────────────────────────────────────────
// Will eventually decide whether the composed output must be held for human
// sign-off before it reaches the user. Nothing is gated yet.
function approvalGate(output) {   // eslint-disable-line no-unused-vars
  return { required: false };
}

// System suffix for the specialist hop. Constrains the model to one discipline
// and to reporting a finding INWARD to the Core — not answering the user.
function specialistPrompt(retrievedCtx) {
  return `${retrievedCtx}

── SPECIALIST BRIEF: QUANTITY SURVEYING / COST ──
You are acting ONLY as the Quantity Surveying and Cost specialist within the SOLIS harness.
Stay strictly inside that discipline. If part of the question falls outside QS/cost
(law, programme, safety, engineering), say so briefly and do not attempt to cover it.

You are NOT speaking to the user. You are reporting INWARD to the SOLIS Core, which
will compose the user-facing answer. Do NOT write advice, a greeting, a sign-off, or a
final answer. Do NOT address the user as "sir". Do NOT use the evidence-first response
format. Output the structured finding below and nothing else:

**Finding:** [what you determined, from a QS/cost perspective]
**Evidence / Source:** [the documents, records, contract clauses or data this rests on — name them; if none are available, say so plainly]
**Confidence:** [High / Medium / Low — one line on why]
**Concerns / Caveats:** [assumptions made, missing information, anything the Core must not overstate]

Be concise and factual. Never invent documents, figures or clause references.`;
}

// System suffix for the Core hop. Hands the specialist's finding back in and
// asks for one coordinated answer in the normal SOLIS voice.
function corePrompt(retrievedCtx, finding) {
  return `${retrievedCtx}

── HARNESS: CORE COMPOSITION ──
You are the SOLIS Core. A specialist was consulted on this turn and reported the
finding below. It is internal working material — the user has NOT seen it.

<specialist_finding discipline="quantity-surveying-cost">
${finding}
</specialist_finding>

Produce the single coordinated answer for the user, in your normal SOLIS voice and
response format. Draw on the finding where it is sound, but speak in ONE voice: do not
mention the specialist, the harness, or this internal process, and do not quote the
finding's headings back verbatim. Carry its caveats and confidence honestly — if the
specialist flagged low confidence or missing evidence, reflect that in your answer
rather than presenting it as settled. Where the finding does not cover part of the
question, answer that part yourself.`;
}

/**
 * Run one turn through the harness.
 *
 * Drop-in replacement for callSolis: returns the composed answer as a plain string.
 *
 * @param {object}   opts
 * @param {Array}    opts.history    - conversation messages, exactly as callSolis takes them
 * @param {string}   opts.system     - the caller's assembled system context (stage/project/agents/research)
 * @param {string}   opts.ctx        - project & lifecycle context, fed to the retrieval stage
 * @param {number}   opts.maxTokens  - token budget for the final Core answer
 * @param {Function} opts.callSolis  - injected so this module stays transport-agnostic and testable
 * @returns {Promise<string>} the Core's composed answer
 */
export async function runHarness({ history, system, ctx, maxTokens, callSolis }) {
  // ── Stage 1 · retrieval ───────────────────────────────────────────────────
  // Stub for now: the retrieved context is just the caller's ctx. `system`
  // (which also carries agent + research context) is kept alongside it so no
  // caller-supplied instruction is dropped on either hop.
  const retrieved = retrieval(ctx);
  const baseCtx = system || retrieved;

  // ── Stage 2 · specialist (LIVE) ───────────────────────────────────────────
  // One QS/cost specialist, its own model call, same history as the Core sees.
  // Errors are intentionally left to propagate: sendMessage's existing catch
  // already renders them, so a failed specialist fails the turn rather than
  // silently degrading to an unreviewed answer.
  const rawFinding = await callSolis({
    messages: history,
    system: specialistPrompt(baseCtx),
    maxTokens: Math.min(maxTokens, SPECIALIST_MAX_TOKENS),
  });

  // ── Stages 3 & 4 · evidenceCheck → riskReview (STUBS) ─────────────────────
  // Pass-through today; the finding reaches the Core unchanged.
  const checked = evidenceCheck(rawFinding);
  const reviewed = riskReview(checked);

  // ── Stage 5 · Core composition (LIVE) ─────────────────────────────────────
  // The finding rides in on the system prompt rather than as an extra message,
  // so `history` still ends on the user's turn.
  const composed = await callSolis({
    messages: history,
    system: corePrompt(baseCtx, reviewed),
    maxTokens,
  });

  // ── Stage 6 · approvalGate (STUB) ─────────────────────────────────────────
  // Result is not acted on yet — nothing is held back. When this goes live the
  // return contract stays a string; gating decisions surface via the UI instead.
  approvalGate(composed);

  return composed;
}

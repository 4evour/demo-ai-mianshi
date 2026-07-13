import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicSession, normalizeSession } from "../lib/session-service";
import type { Session } from "../lib/types";

const legacy = {
  id: "session-1", token: "token", candidateId: "candidate-1", jobId: "job-1",
  questions: [
    { id: "q1", text: "第一题", purpose: "p1", dimension: "d1", required: true },
    { id: "q2", text: "未来问题不能公开", purpose: "p2", dimension: "d2", required: true },
  ],
  answers: {}, status: "INVITED", createdAt: "now", updatedAt: "now",
} as Session;

test("normalizes a legacy session and initializes its first turn", () => {
  const session = normalizeSession(legacy, () => "turn-1", "later");

  assert.equal(session.maxFollowUps, 3);
  assert.equal(session.turns[0]?.id, "turn-1");
  assert.deepEqual(session.reviewReasons, []);
});

test("public session hides future questions and internal review reasons", () => {
  const session = normalizeSession(legacy, () => "turn-1", "later");
  const view = buildPublicSession(session, "AI 实习生", "张三");
  const serialized = JSON.stringify(view);

  assert.equal(view.currentTurn?.text, "第一题");
  assert.equal(view.currentTurn?.required, true);
  assert.equal(view.history.length, 0);
  assert.doesNotMatch(serialized, /未来问题不能公开|reviewReasons|needsManualReview|"dimension"|"purpose"/);
});

test("normalizes legacy submitted answers into read-only turns", () => {
  const submitted = normalizeSession({
    ...legacy,
    status: "SUBMITTED",
    answers: { q1: "旧版第一题回答", q2: "旧版第二题回答" },
  }, (() => { let index = 0; return () => `legacy-turn-${++index}`; })(), "later");

  assert.equal(submitted.turns.length, 2);
  assert.equal(submitted.turns[0]?.answer, "旧版第一题回答");
  assert.equal(submitted.turns.every((turn) => turn.status === "ANSWERED"), true);
});

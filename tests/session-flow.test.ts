import assert from "node:assert/strict";
import test from "node:test";

import { answerSessionTurn, finalizeSession, normalizeSession } from "../lib/session-service";
import type { Candidate, Job, Session } from "../lib/types";

const job = { id: "job-1", title: "AI 实习生", jd: "jd", requirements: [], niceToHave: [], dimensions: [], createdAt: "now" } satisfies Job;
const candidate = { id: "candidate-1", jobId: job.id, name: "张三", email: "", status: "IN_PROGRESS", createdAt: "now", resume: { name: "张三", email: "", phone: "", school: "", major: "", summary: "", skills: [], projects: [], artifactLinks: [], sourceText: "", redactedText: "脱敏简历" } } satisfies Candidate;

function session(): Session {
  return normalizeSession({
    id: "session-1", token: "token", candidateId: candidate.id, jobId: job.id,
    questions: [
      { id: "q1", text: "第一题", purpose: "p1", dimension: "d1", required: true },
      { id: "q2", text: "第二题", purpose: "p2", dimension: "d2", required: true },
    ],
    answers: {}, turns: [], currentQuestionIndex: 0, followUpCount: 0, maxFollowUps: 3,
    needsManualReview: false, reviewReasons: [], status: "INVITED", createdAt: "now", updatedAt: "now",
  }, () => "turn-1", "now");
}

test("uses the controlled decision to add a follow-up", async () => {
  const updated = await answerSessionTurn({
    session: session(), job, candidate, turnId: "turn-1", answer: "回答内容", declined: false,
    decide: async () => ({ action: "ASK_FOLLOW_UP", reason: "EVIDENCE_GAP", question: "请补充证据。" }),
    createId: () => "turn-2", now: "later",
  });
  assert.equal(updated.turns[1]?.kind, "FOLLOW_UP");
});

test("declined answer advances without calling the model", async () => {
  let calls = 0;
  const updated = await answerSessionTurn({
    session: session(), job, candidate, turnId: "turn-1", answer: "不方便回答", declined: true,
    decide: async () => { calls += 1; return { action: "NEXT_QUESTION", reason: "SUFFICIENT" }; },
    createId: () => "turn-2", now: "later",
  });
  assert.equal(calls, 0);
  assert.equal(updated.turns[1]?.questionId, "q2");
});

test("model failure marks manual review and keeps the interview moving", async () => {
  const updated = await answerSessionTurn({
    session: session(), job, candidate, turnId: "turn-1", answer: "回答内容", declined: false,
    decide: async () => { throw new Error("DeepSeek 超时"); },
    createId: () => "turn-2", now: "later",
  });
  assert.equal(updated.needsManualReview, true);
  assert.equal(updated.turns[1]?.questionId, "q2");
});

test("finalizes only a ready-to-submit session", () => {
  assert.throws(() => finalizeSession(session(), "later"), /尚未完成/);
  const ready = { ...session(), status: "READY_TO_SUBMIT" as const };
  assert.equal(finalizeSession(ready, "later").status, "SUBMITTED");
});

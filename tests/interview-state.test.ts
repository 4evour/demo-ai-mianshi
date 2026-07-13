import assert from "node:assert/strict";
import test from "node:test";

import { advanceAfterModelFailure, initializeSession, submitTurn } from "../lib/interview-state";
import type { Question, Session } from "../lib/types";

const questions: Question[] = [
  { id: "q1", text: "请介绍项目中的个人贡献。", purpose: "验证贡献", dimension: "项目真实性", required: true },
  { id: "q2", text: "请说明一次排错过程。", purpose: "验证排错", dimension: "问题解决", required: true },
];

function baseSession(maxFollowUps = 3): Session {
  return {
    id: "session-1",
    token: "token",
    candidateId: "candidate-1",
    jobId: "job-1",
    questions,
    answers: {},
    turns: [],
    currentQuestionIndex: 0,
    followUpCount: 0,
    maxFollowUps,
    needsManualReview: false,
    reviewReasons: [],
    status: "INVITED",
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
  };
}

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `id-${index}`;
}

test("initializes the first main question as the only current turn", () => {
  const session = initializeSession(baseSession(), ids("turn-1"), "2026-07-13T00:01:00.000Z");

  assert.equal(session.turns.length, 1);
  assert.equal(session.turns[0]?.id, "turn-1");
  assert.equal(session.turns[0]?.kind, "MAIN");
  assert.equal(session.turns[0]?.status, "CURRENT");
});

test("adds a follow-up linked to the answered main turn", () => {
  const initialized = initializeSession(baseSession(), ids("turn-1"), "2026-07-13T00:01:00.000Z");
  const updated = submitTurn(initialized, {
    turnId: "turn-1",
    answer: "我负责检索、重排和评测，并说明了具体实现。",
    decision: { action: "ASK_FOLLOW_UP", reason: "CONTRIBUTION_UNCLEAR", question: "具体哪些代码由你完成？" },
    createId: ids("turn-2"),
    now: "2026-07-13T00:02:00.000Z",
  });

  assert.equal(updated.followUpCount, 1);
  assert.equal(updated.turns[1]?.kind, "FOLLOW_UP");
  assert.equal(updated.turns[1]?.triggerTurnId, "turn-1");
  assert.equal(updated.turns[1]?.status, "CURRENT");
});

test("enforces the configured interview follow-up limit", () => {
  const initialized = initializeSession(baseSession(0), ids("turn-1"), "2026-07-13T00:01:00.000Z");
  const updated = submitTurn(initialized, {
    turnId: "turn-1",
    answer: "回答内容足够长并包含实现过程。",
    decision: { action: "ASK_FOLLOW_UP", reason: "EVIDENCE_GAP", question: "继续追问" },
    createId: ids("turn-2"),
    now: "2026-07-13T00:02:00.000Z",
  });

  assert.equal(updated.followUpCount, 0);
  assert.equal(updated.currentQuestionIndex, 1);
  assert.equal(updated.turns[1]?.questionId, "q2");
});

test("declined answers advance without calling for another follow-up", () => {
  const initialized = initializeSession(baseSession(), ids("turn-1"), "2026-07-13T00:01:00.000Z");
  const updated = submitTurn(initialized, {
    turnId: "turn-1",
    answer: "不方便回答",
    declined: true,
    decision: { action: "NEXT_QUESTION", reason: "DECLINED" },
    createId: ids("turn-2"),
    now: "2026-07-13T00:02:00.000Z",
  });

  assert.equal(updated.turns[0]?.disposition, "DECLINED");
  assert.equal(updated.turns[1]?.questionId, "q2");
  assert.equal(updated.followUpCount, 0);
});

test("marks manual review and advances after a model failure", () => {
  const initialized = initializeSession(baseSession(), ids("turn-1"), "2026-07-13T00:01:00.000Z");
  const updated = advanceAfterModelFailure(initialized, {
    turnId: "turn-1",
    answer: "这是已经保存的回答。",
    error: "DeepSeek 超时",
    createId: ids("turn-2"),
    now: "2026-07-13T00:02:00.000Z",
  });

  assert.equal(updated.needsManualReview, true);
  assert.match(updated.reviewReasons[0] ?? "", /DeepSeek 超时/);
  assert.equal(updated.turns[1]?.questionId, "q2");
});

test("moves to ready-to-submit after the last main question", () => {
  const session = initializeSession({ ...baseSession(), questions: [questions[0]!] }, ids("turn-1"), "2026-07-13T00:01:00.000Z");
  const updated = submitTurn(session, {
    turnId: "turn-1",
    answer: "完整回答",
    decision: { action: "NEXT_QUESTION", reason: "SUFFICIENT" },
    createId: ids("unused"),
    now: "2026-07-13T00:02:00.000Z",
  });

  assert.equal(updated.status, "READY_TO_SUBMIT");
  assert.equal(updated.turns.every((turn) => turn.status === "ANSWERED"), true);
});

test("rejects an answer for a non-current turn", () => {
  const initialized = initializeSession(baseSession(), ids("turn-1"), "2026-07-13T00:01:00.000Z");
  assert.throws(() => submitTurn(initialized, {
    turnId: "other-turn",
    answer: "回答",
    decision: { action: "NEXT_QUESTION", reason: "SUFFICIENT" },
    createId: ids("turn-2"),
    now: "2026-07-13T00:02:00.000Z",
  }), /当前题/);
});

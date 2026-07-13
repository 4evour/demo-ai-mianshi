import assert from "node:assert/strict";
import test from "node:test";

import { buildFollowUpMessages } from "../lib/ai";
import { followUpAiSchema } from "../lib/schemas";
import type { Candidate, Job, Session } from "../lib/types";

test("accepts only a complete controlled follow-up action", () => {
  const parsed = followUpAiSchema.parse({
    action: "ASK_FOLLOW_UP",
    reason: "EVIDENCE_GAP",
    question: "请说明测试集如何固定。",
  });
  assert.equal(parsed.action, "ASK_FOLLOW_UP");
  assert.throws(() => followUpAiSchema.parse({ action: "ASK_FOLLOW_UP", reason: "EVIDENCE_GAP" }));
  assert.throws(() => followUpAiSchema.parse({ action: "FREE_FORM", reason: "EVIDENCE_GAP", question: "x" }));
});

test("defaults a missing reason for each controlled action", () => {
  assert.deepEqual(followUpAiSchema.parse({ action: "ASK_FOLLOW_UP", question: "请说明缓存失效时如何降级。" }), {
    action: "ASK_FOLLOW_UP",
    reason: "EVIDENCE_GAP",
    question: "请说明缓存失效时如何降级。",
  });
  assert.deepEqual(followUpAiSchema.parse({ action: "NEXT_QUESTION" }), {
    action: "NEXT_QUESTION",
    reason: "SUFFICIENT",
  });
  assert.deepEqual(followUpAiSchema.parse({ action: "END_INTERVIEW" }), {
    action: "END_INTERVIEW",
    reason: "SUFFICIENT",
  });
});

test("follow-up prompt contains only redacted candidate context", () => {
  const job = {
    id: "job-1", title: "AI 实习生", jd: "jd", requirements: ["TypeScript"], niceToHave: [], dimensions: [], createdAt: "now",
  } satisfies Job;
  const candidate = {
    id: "candidate-1", jobId: "job-1", name: "张三", email: "secret@example.com", status: "IN_PROGRESS", createdAt: "now",
    resume: {
      name: "张三", email: "secret@example.com", phone: "13800138000", school: "秘密大学", major: "计算机",
      summary: "summary", skills: [], projects: [], artifactLinks: [], sourceText: "张三 secret@example.com 秘密大学",
      redactedText: "[REDACTED_NAME] [REDACTED_EMAIL] [REDACTED_SCHOOL] 项目经历",
    },
  } satisfies Candidate;
  const session = {
    id: "session-1", token: "token", candidateId: candidate.id, jobId: job.id, questions: [], answers: {},
    currentQuestionIndex: 0, followUpCount: 1, maxFollowUps: 3, needsManualReview: false, reviewReasons: [], status: "IN_PROGRESS",
    createdAt: "now", updatedAt: "now",
    turns: [{
      id: "turn-1", questionId: "q1", kind: "MAIN", text: "你负责什么？", purpose: "验证贡献", dimension: "真实性",
      required: true, status: "CURRENT", answer: "", createdAt: "now",
    }],
  } satisfies Session;

  const messages = buildFollowUpMessages(job, candidate, session, session.turns[0]!, "我负责检索和评测。");
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /REDACTED_EMAIL/);
  assert.doesNotMatch(content, /secret@example\.com|13800138000|秘密大学|张三/);
  assert.match(content, /剩余整场追问次数：2/);
  assert.match(content, /技术原理.*关键参数.*失败场景.*性能边界.*方案取舍.*量化验证/);
  assert.match(content, /ASK_FOLLOW_UP.*reason.*question/);
});

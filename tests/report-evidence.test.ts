import assert from "node:assert/strict";
import test from "node:test";

import { buildReportMessages, validateReportEvidence } from "../lib/ai";
import type { Candidate, Job, Session } from "../lib/types";

const job = { id: "job-1", title: "AI 实习生", jd: "jd", requirements: ["TypeScript"], niceToHave: [], dimensions: [{ name: "项目真实性", weight: 100, description: "证据" }], createdAt: "now" } satisfies Job;
const candidate = { id: "candidate-1", jobId: job.id, name: "张三", email: "", status: "SUBMITTED", createdAt: "now", resume: { name: "张三", email: "", phone: "", school: "", major: "", summary: "", skills: [], projects: [], artifactLinks: [], sourceText: "原文", redactedText: "脱敏简历项目" } } satisfies Candidate;
const session = {
  id: "session-1", token: "token", candidateId: candidate.id, jobId: job.id, questions: [], answers: {},
  turns: [{ id: "turn-1", questionId: "q1", kind: "MAIN", text: "你负责什么？", purpose: "p", dimension: "项目真实性", required: true, status: "ANSWERED", answer: "我负责检索模块。", disposition: "ANSWERED", createdAt: "now", answeredAt: "later" }],
  currentQuestionIndex: 1, followUpCount: 0, maxFollowUps: 3, needsManualReview: false, reviewReasons: [], status: "SUBMITTED", createdAt: "now", updatedAt: "later",
} satisfies Session;

test("report prompt labels every answer with its turn id", () => {
  const content = buildReportMessages(job, candidate, session).map((message) => message.content).join("\n");
  assert.match(content, /\[TURN:turn-1\]/);
  assert.match(content, /你负责什么？/);
  assert.match(content, /我负责检索模块/);
  assert.match(content, /dimensions 必须是 JSON 数组/);
  assert.match(content, /evidenceConfidence/);
});

test("removes evidence references that do not exist in the session", () => {
  const validated = validateReportEvidence({
    summary: "summary",
    dimensions: [{
      name: "项目真实性", level: 3, evidenceConfidence: 0.8, reason: "reason",
      evidence: ["[TURN:turn-1] 说明负责检索", "[TURN:missing] 不存在", "[RESUME] 项目描述"],
    }],
    strengths: [], gaps: [], followUps: [], pendingChecks: [],
  }, session);

  assert.deepEqual(validated.dimensions[0]?.evidence, ["[TURN:turn-1] 说明负责检索", "[RESUME] 项目描述"]);
  assert.match(validated.pendingChecks.join(" "), /无效证据引用/);
});

test("resets a dimension when all of its evidence references are invalid", () => {
  const validated = validateReportEvidence({
    summary: "summary",
    dimensions: [{
      name: "项目真实性", level: 4, evidenceConfidence: 0.95, reason: "unsupported",
      evidence: ["[TURN:missing] 不存在"],
    }],
    strengths: [], gaps: [], followUps: [], pendingChecks: [],
  }, session);

  assert.equal(validated.dimensions[0]?.level, 0);
  assert.equal(validated.dimensions[0]?.evidenceConfidence, 0);
  assert.match(validated.dimensions[0]?.reason ?? "", /有效证据/);
});

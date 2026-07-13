import assert from "node:assert/strict";
import test from "node:test";

import { buildCandidateFromResume, createResumeImport, enrichCandidateFromSource } from "../lib/resume-workflow";

const extraction = {
  text: "姓名：张三\n邮箱：zhang@example.com\n学校：示例大学\n" + "项目开发经历。".repeat(12),
  source: "OCR" as const,
  status: "NEEDS_CORRECTION" as const,
  pages: [{ page: 1, text: "第一页", confidence: 0.58 }],
  averageConfidence: 0.58,
  warnings: ["OCR 平均置信度 0.58，需要人工确认"],
};

test("creates a local correction record without model output", () => {
  const pending = createResumeImport({
    id: "import-1",
    jobId: "job-1",
    fileName: "resume.pdf",
    extraction,
    createdAt: "2026-07-13T00:00:00.000Z",
  });

  assert.equal(pending.status, "NEEDS_CORRECTION");
  assert.equal(pending.sourceText, extraction.text);
  assert.equal(pending.pages[0]?.confidence, 0.58);
});

test("builds a candidate while keeping model text redacted", () => {
  const candidate = buildCandidateFromResume({
    id: "candidate-1",
    jobId: "job-1",
    text: extraction.text,
    extraction: { ...extraction, status: "READY" },
    parsed: {
      summary: "候选人具备项目经验",
      skills: ["TypeScript"],
      projects: [],
      artifactLinks: [],
    },
    createdAt: "2026-07-13T00:00:00.000Z",
  });

  assert.equal(candidate.name, "张三");
  assert.equal(candidate.resume.extraction.source, "OCR");
  assert.doesNotMatch(candidate.resume.redactedText, /zhang@example\.com/);
  assert.doesNotMatch(candidate.resume.redactedText, /示例大学/);
});

test("enriches an existing candidate created by the legacy identity parser", () => {
  const sourceText = `李四\nlisi@example.com\n教育背景\n示例大学 软件工程(本科) 2022.09 - 2026.07\n荣誉证书\n2025｜算法竞赛一等奖\n自我评价\n持续学习`;
  const enriched = enrichCandidateFromSource({
    id: "candidate-legacy",
    jobId: "job-1",
    name: "未识别候选人",
    email: "lisi@example.com",
    status: "READY",
    resume: {
      name: "未识别候选人", email: "lisi@example.com", phone: "", school: "", major: "", summary: "",
      skills: [], projects: [], artifactLinks: [], sourceText, redactedText: sourceText,
    },
    createdAt: "2026-07-13T00:00:00.000Z",
  });

  assert.equal(enriched.name, "李四");
  assert.equal(enriched.resume.education?.[0]?.major, "软件工程");
  assert.deepEqual(enriched.resume.honors, ["2025｜算法竞赛一等奖"]);
  assert.doesNotMatch(enriched.resume.redactedText, /李四|示例大学/);
});

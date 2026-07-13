import assert from "node:assert/strict";
import test from "node:test";

import type { Candidate, Job, Report, Session, StoreData } from "../lib/types";

async function reviewerDataModule(): Promise<Record<string, unknown>> {
  return import("../lib/reviewer-data").catch(() => ({}));
}

const jobA = { id: "job-a", title: "岗位 A", jd: "jd", requirements: [], niceToHave: [], dimensions: [], createdAt: "2026-07-13T00:00:00.000Z" } satisfies Job;
const jobB = { id: "job-b", title: "岗位 B", jd: "jd", requirements: [], niceToHave: [], dimensions: [], createdAt: "2026-07-13T00:00:00.000Z" } satisfies Job;

function candidate(id: string, jobId: string, status: Candidate["status"]): Candidate {
  return {
    id, jobId, name: id, email: "", status, createdAt: "now",
    resume: {
      name: id, email: "", phone: "", school: "", major: "", summary: "summary", skills: [], projects: [], artifactLinks: [],
      sourceText: "PRIVATE SOURCE", redactedText: "PRIVATE REDACTED",
    },
  };
}

function report(id: string, candidateId: string): Report {
  return {
    id, candidateId, sessionId: `session-${candidateId}`, summary: "summary", dimensions: [], strengths: [], gaps: [], followUps: [],
    pendingChecks: [], totalScore: 80, aiGeneratedAt: "now",
  };
}

const store: StoreData = {
  jobs: [jobA, jobB],
  candidates: [candidate("a1", jobA.id, "REPORTED"), candidate("a2", jobA.id, "SUBMITTED"), candidate("b1", jobB.id, "READY")],
  sessions: [{ id: "session-a2", token: "token", candidateId: "a2", jobId: jobA.id, questions: [], answers: {}, turns: [], currentQuestionIndex: 0, followUpCount: 0, maxFollowUps: 3, needsManualReview: false, reviewReasons: [], status: "SUBMITTED", createdAt: "now", updatedAt: "now" } satisfies Session],
  reports: [report("report-a1", "a1")],
  resumeImports: [],
};

test("builds job summaries with candidate workflow counts", async () => {
  const module = await reviewerDataModule();
  assert.equal(typeof module.buildJobOverviews, "function");
  const buildJobOverviews = module.buildJobOverviews as (store: StoreData) => Array<Record<string, unknown>>;

  const overviews = buildJobOverviews(store);
  assert.deepEqual(overviews.map(({ id, candidateCount, submittedCount, reportCount }) => ({ id, candidateCount, submittedCount, reportCount })), [
    { id: jobA.id, candidateCount: 2, submittedCount: 2, reportCount: 1 },
    { id: jobB.id, candidateCount: 1, submittedCount: 0, reportCount: 0 },
  ]);
});

test("builds a sanitized candidate review view", async () => {
  const module = await reviewerDataModule();
  assert.equal(typeof module.buildCandidateReviewView, "function");
  const buildCandidateReviewView = module.buildCandidateReviewView as (store: StoreData, candidateId: string) => unknown;

  const serialized = JSON.stringify(buildCandidateReviewView(store, "a1"));
  assert.doesNotMatch(serialized, /PRIVATE SOURCE|PRIVATE REDACTED|sourceText|redactedText/);
  assert.match(serialized, /report-a1/);
});

test("validates a same-job two-report comparison", async () => {
  const module = await reviewerDataModule();
  assert.equal(typeof module.buildReportComparison, "function");
  const buildReportComparison = module.buildReportComparison as (store: StoreData, jobId: string, candidateIds: string[]) => unknown;
  const comparisonStore = { ...store, reports: [...store.reports, report("report-a2", "a2"), report("report-b1", "b1")] };

  assert.doesNotThrow(() => buildReportComparison(comparisonStore, jobA.id, ["a1", "a2"]));
  assert.throws(() => buildReportComparison(comparisonStore, jobA.id, ["a1"]), /两名/);
  assert.throws(() => buildReportComparison(comparisonStore, jobA.id, ["a1", "b1"]), /同一岗位/);
  assert.throws(() => buildReportComparison(store, jobA.id, ["a1", "a2"]), /报告/);
});

import type { Candidate, Job, Report, ResumeProfile, Session, StoreData } from "./types";

export type ReviewResume = Omit<ResumeProfile, "sourceText" | "redactedText">;

export type CandidateReviewView = Omit<Candidate, "resume"> & {
  resume: ReviewResume;
  job: Job;
  session: Session | null;
  report: Report | null;
};

export type JobOverview = Job & {
  candidateCount: number;
  submittedCount: number;
  reportCount: number;
};

const submittedStatuses = new Set<Candidate["status"]>(["SUBMITTED", "REPORTED", "ADVANCED", "REJECTED", "ON_HOLD"]);

function sanitizeResume(resume: ResumeProfile): ReviewResume {
  const { sourceText: _sourceText, redactedText: _redactedText, ...reviewResume } = resume;
  return reviewResume;
}

export function buildCandidateReviewView(store: StoreData, candidateId: string): CandidateReviewView | null {
  const candidate = store.candidates.find((item) => item.id === candidateId);
  if (!candidate) return null;
  const job = store.jobs.find((item) => item.id === candidate.jobId);
  if (!job) return null;
  return {
    ...candidate,
    resume: sanitizeResume(candidate.resume),
    job,
    session: store.sessions.find((session) => session.id === candidate.interviewId || session.candidateId === candidate.id) ?? null,
    report: store.reports.find((report) => report.candidateId === candidate.id) ?? null,
  };
}

export function buildJobOverviews(store: StoreData): JobOverview[] {
  return store.jobs.map((job) => {
    const candidates = store.candidates.filter((candidate) => candidate.jobId === job.id);
    return {
      ...job,
      candidateCount: candidates.length,
      submittedCount: candidates.filter((candidate) => submittedStatuses.has(candidate.status)).length,
      reportCount: candidates.filter((candidate) => store.reports.some((report) => report.candidateId === candidate.id)).length,
    };
  });
}

export function buildJobReviewView(store: StoreData, jobId: string): { job: Job; candidates: CandidateReviewView[] } | null {
  const job = store.jobs.find((item) => item.id === jobId);
  if (!job) return null;
  const candidates = store.candidates
    .filter((candidate) => candidate.jobId === job.id)
    .map((candidate) => buildCandidateReviewView(store, candidate.id))
    .filter((candidate): candidate is CandidateReviewView => candidate !== null);
  return { job, candidates };
}

export function buildReportComparison(store: StoreData, jobId: string, candidateIds: string[]): { job: Job; candidates: CandidateReviewView[] } {
  const ids = [...new Set(candidateIds)];
  if (ids.length !== 2) throw new Error("请选择两名不同的候选人进行对比");
  const job = store.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error("岗位不存在");
  const candidates = ids.map((id) => buildCandidateReviewView(store, id));
  if (candidates.some((candidate) => !candidate || candidate.jobId !== job.id)) throw new Error("候选人必须属于同一岗位");
  const validCandidates = candidates as CandidateReviewView[];
  if (validCandidates.some((candidate) => !candidate.report)) throw new Error("两名候选人都必须先生成报告");
  return { job, candidates: validCandidates };
}

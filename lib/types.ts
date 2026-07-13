export type Job = {
  id: string;
  title: string;
  jd: string;
  requirements: string[];
  niceToHave: string[];
  dimensions: Dimension[];
  createdAt: string;
};

export type Dimension = {
  name: string;
  weight: number;
  description: string;
};

export type ResumeProfile = {
  name: string;
  email: string;
  phone: string;
  school: string;
  major: string;
  summary: string;
  skills: string[];
  education?: EducationEntry[];
  honors?: string[];
  projects: Project[];
  artifactLinks: string[];
  sourceText: string;
  redactedText: string;
  extraction?: ResumeExtractionMeta;
};

export type EducationEntry = {
  school: string;
  major: string;
  degree: string;
  period: string;
};

export type ResumeExtractionMeta = {
  source: "PDF_TEXT" | "OCR";
  pages: Array<{ page: number; text: string; confidence: number }>;
  averageConfidence: number;
  warnings: string[];
};

export type ResumeImport = ResumeExtractionMeta & {
  id: string;
  jobId: string;
  fileName: string;
  sourceText: string;
  status: "NEEDS_CORRECTION";
  createdAt: string;
};

export type Project = {
  name: string;
  role: string;
  description: string;
  technologies: string[];
  claims: string[];
};

export type Candidate = {
  id: string;
  jobId: string;
  name: string;
  email: string;
  resume: ResumeProfile;
  status: "READY" | "INVITED" | "IN_PROGRESS" | "SUBMITTED" | "REPORTED" | "ADVANCED" | "REJECTED" | "ON_HOLD";
  interviewId?: string;
  createdAt: string;
};

export type Question = {
  id: string;
  text: string;
  purpose: string;
  dimension: string;
  required: boolean;
};

export type FollowUpReason = "SHORT_ANSWER" | "OFF_TOPIC" | "CONTRIBUTION_UNCLEAR" | "CLAIM_CONFLICT" | "EVIDENCE_GAP" | "DECLINED" | "SUFFICIENT";

export type FollowUpDecision =
  | { action: "ASK_FOLLOW_UP"; reason: Exclude<FollowUpReason, "DECLINED" | "SUFFICIENT">; question: string }
  | { action: "NEXT_QUESTION" | "END_INTERVIEW"; reason: FollowUpReason };

export type InterviewTurn = {
  id: string;
  questionId: string;
  kind: "MAIN" | "FOLLOW_UP";
  text: string;
  purpose: string;
  dimension: string;
  required: boolean;
  status: "CURRENT" | "ANSWERED";
  answer: string;
  disposition?: "ANSWERED" | "DECLINED";
  triggerTurnId?: string;
  reason?: FollowUpReason;
  modelError?: string;
  createdAt: string;
  answeredAt?: string;
};

export type Session = {
  id: string;
  token: string;
  candidateId: string;
  jobId: string;
  questions: Question[];
  answers: Record<string, string>;
  turns: InterviewTurn[];
  currentQuestionIndex: number;
  followUpCount: number;
  maxFollowUps: number;
  needsManualReview: boolean;
  reviewReasons: string[];
  status: "INVITED" | "IN_PROGRESS" | "READY_TO_SUBMIT" | "SUBMITTED";
  createdAt: string;
  updatedAt: string;
};

export type ReportDimension = {
  name: string;
  level: number;
  evidenceConfidence: number;
  reason: string;
  evidence: string[];
};

export type Report = {
  id: string;
  candidateId: string;
  sessionId: string;
  summary: string;
  dimensions: ReportDimension[];
  strengths: string[];
  gaps: string[];
  followUps: string[];
  pendingChecks: string[];
  totalScore: number;
  aiGeneratedAt: string;
  humanDecision?: "ADVANCED" | "REJECTED" | "ON_HOLD";
  humanNote?: string;
};

export type StoreData = {
  jobs: Job[];
  candidates: Candidate[];
  sessions: Session[];
  reports: Report[];
  resumeImports: ResumeImport[];
};

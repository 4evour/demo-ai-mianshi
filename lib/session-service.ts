import { advanceAfterModelFailure, initializeSession, submitTurn } from "./interview-state";
import type { Candidate, FollowUpDecision, InterviewTurn, Job, Session } from "./types";

type CreateId = () => string;

export function normalizeSession(session: Session, createId: CreateId, now: string): Session {
  const legacy = session as Session & Partial<Pick<Session, "turns" | "currentQuestionIndex" | "followUpCount" | "maxFollowUps" | "needsManualReview" | "reviewReasons">>;
  const normalized: Session = {
    ...session,
    turns: legacy.turns ?? [],
    currentQuestionIndex: legacy.currentQuestionIndex ?? 0,
    followUpCount: legacy.followUpCount ?? 0,
    maxFollowUps: legacy.maxFollowUps ?? 3,
    needsManualReview: legacy.needsManualReview ?? false,
    reviewReasons: legacy.reviewReasons ?? [],
  };
  if (normalized.status === "SUBMITTED" && normalized.turns.length === 0) {
    return {
      ...normalized,
      currentQuestionIndex: normalized.questions.length,
      turns: normalized.questions.map((question) => ({
        id: createId(),
        questionId: question.id,
        kind: "MAIN",
        text: question.text,
        purpose: question.purpose,
        dimension: question.dimension,
        required: question.required,
        status: "ANSWERED",
        answer: normalized.answers[question.id] ?? "",
        disposition: normalized.answers[question.id] ? "ANSWERED" : "DECLINED",
        createdAt: normalized.createdAt,
        answeredAt: normalized.updatedAt,
      })),
    };
  }
  return initializeSession(normalized, createId, now);
}

export async function answerSessionTurn(input: {
  session: Session;
  job: Job;
  candidate: Candidate;
  turnId: string;
  answer: string;
  declined: boolean;
  decide: (job: Job, candidate: Candidate, session: Session, turn: InterviewTurn, answer: string) => Promise<FollowUpDecision>;
  createId: CreateId;
  now: string;
}): Promise<Session> {
  const current = input.session.turns.find((turn) => turn.status === "CURRENT");
  if (!current || current.id !== input.turnId) throw new Error("只能提交当前题");
  if (input.declined) {
    return submitTurn(input.session, {
      turnId: input.turnId,
      answer: input.answer,
      declined: true,
      decision: { action: "NEXT_QUESTION", reason: "DECLINED" },
      createId: input.createId,
      now: input.now,
    });
  }
  try {
    const decision = await input.decide(input.job, input.candidate, input.session, current, input.answer);
    return submitTurn(input.session, { ...input, decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "动态追问失败";
    return advanceAfterModelFailure(input.session, {
      turnId: input.turnId,
      answer: input.answer,
      error: message,
      createId: input.createId,
      now: input.now,
    });
  }
}

export function finalizeSession(session: Session, now: string): Session {
  if (session.status !== "READY_TO_SUBMIT") throw new Error("面试尚未完成，不能提交");
  return { ...session, status: "SUBMITTED", updatedAt: now };
}

export function buildPublicSession(session: Session, jobTitle: string, candidateName: string) {
  const history = session.turns
    .filter((turn) => turn.status === "ANSWERED")
    .map(({ id, kind, text, required, answer, disposition, triggerTurnId, reason }) => ({ id, kind, text, required, answer, disposition, triggerTurnId, reason }));
  const current = session.turns.find((turn) => turn.status === "CURRENT");
  return {
    id: session.id,
    token: session.token,
    status: session.status,
    currentTurn: current ? {
      id: current.id,
      kind: current.kind,
      text: current.text,
      required: current.required,
      answer: current.answer,
      reason: current.reason,
    } : null,
    history,
    progress: {
      currentMainQuestion: Math.min(session.currentQuestionIndex + 1, session.questions.length),
      totalMainQuestions: session.questions.length,
      followUpCount: session.followUpCount,
      maxFollowUps: session.maxFollowUps,
    },
    jobTitle,
    candidateName,
  };
}

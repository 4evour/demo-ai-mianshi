import type { FollowUpDecision, InterviewTurn, Question, Session } from "./types";

type CreateId = () => string;

function mainTurn(question: Question, createId: CreateId, now: string): InterviewTurn {
  return {
    id: createId(),
    questionId: question.id,
    kind: "MAIN",
    text: question.text,
    purpose: question.purpose,
    dimension: question.dimension,
    required: question.required,
    status: "CURRENT",
    answer: "",
    createdAt: now,
  };
}

export function initializeSession(session: Session, createId: CreateId, now: string): Session {
  if (session.turns.length > 0 || session.status === "SUBMITTED") return session;
  const question = session.questions[session.currentQuestionIndex];
  if (!question) return { ...session, status: "READY_TO_SUBMIT", updatedAt: now };
  return { ...session, turns: [mainTurn(question, createId, now)], updatedAt: now };
}

export function currentTurn(session: Session): InterviewTurn | null {
  return session.turns.find((turn) => turn.status === "CURRENT") ?? null;
}

export function saveTurnDraft(session: Session, turnId: string, answer: string, now: string): Session {
  const current = currentTurn(session);
  if (!current || current.id !== turnId) throw new Error("只能保存当前题草稿");
  return {
    ...session,
    status: "IN_PROGRESS",
    turns: session.turns.map((turn) => turn.id === turnId ? { ...turn, answer } : turn),
    updatedAt: now,
  };
}

function answerCurrent(session: Session, turnId: string, answer: string, declined: boolean, now: string, modelError?: string): Session {
  const current = currentTurn(session);
  if (!current || current.id !== turnId) throw new Error("只能提交当前题");
  if (!declined && current.required && !answer.trim()) throw new Error("当前必答题尚未完成");
  return {
    ...session,
    status: "IN_PROGRESS",
    answers: { ...session.answers, [turnId]: answer },
    turns: session.turns.map((turn) => turn.id === turnId ? {
      ...turn,
      answer,
      status: "ANSWERED",
      disposition: declined ? "DECLINED" : "ANSWERED",
      modelError,
      answeredAt: now,
    } : turn),
    updatedAt: now,
  };
}

function advance(session: Session, createId: CreateId, now: string): Session {
  const nextIndex = session.currentQuestionIndex + 1;
  const question = session.questions[nextIndex];
  if (!question) return { ...session, currentQuestionIndex: nextIndex, status: "READY_TO_SUBMIT", updatedAt: now };
  return {
    ...session,
    currentQuestionIndex: nextIndex,
    turns: [...session.turns, mainTurn(question, createId, now)],
    updatedAt: now,
  };
}

export function submitTurn(session: Session, input: {
  turnId: string;
  answer: string;
  declined?: boolean;
  decision: FollowUpDecision;
  createId: CreateId;
  now: string;
}): Session {
  const current = currentTurn(session);
  if (!current || current.id !== input.turnId) throw new Error("只能提交当前题");
  const answered = answerCurrent(session, input.turnId, input.answer, input.declined ?? false, input.now);
  if (input.declined) return advance(answered, input.createId, input.now);

  const perQuestionFollowUps = answered.turns.filter((turn) => turn.questionId === current.questionId && turn.kind === "FOLLOW_UP").length;
  if (input.decision.action !== "ASK_FOLLOW_UP"
    || answered.followUpCount >= answered.maxFollowUps
    || perQuestionFollowUps >= 2) {
    return advance(answered, input.createId, input.now);
  }

  const followUp: InterviewTurn = {
    id: input.createId(),
    questionId: current.questionId,
    kind: "FOLLOW_UP",
    text: input.decision.question,
    purpose: current.purpose,
    dimension: current.dimension,
    required: true,
    status: "CURRENT",
    answer: "",
    triggerTurnId: current.id,
    reason: input.decision.reason,
    createdAt: input.now,
  };
  return {
    ...answered,
    followUpCount: answered.followUpCount + 1,
    turns: [...answered.turns, followUp],
    updatedAt: input.now,
  };
}

export function advanceAfterModelFailure(session: Session, input: {
  turnId: string;
  answer: string;
  error: string;
  createId: CreateId;
  now: string;
}): Session {
  const answered = answerCurrent(session, input.turnId, input.answer, false, input.now, input.error);
  return advance({
    ...answered,
    needsManualReview: true,
    reviewReasons: [...(answered.reviewReasons ?? []), `动态追问降级：${input.error}`],
  }, input.createId, input.now);
}

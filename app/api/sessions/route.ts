import { createId, createToken, readStore, updateStore } from "@/lib/store";
import { questionPlanSchema } from "@/lib/question-plan";
import type { Question, Session } from "@/lib/types";
import { normalizeSession } from "@/lib/session-service";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({
  candidateId: z.string().uuid(),
  questions: questionPlanSchema,
  maxFollowUps: z.number().int().min(0).max(3).default(3),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const store = await readStore();
    const candidate = store.candidates.find((item) => item.id === input.candidateId);
    if (!candidate) throw new Error("候选人不存在");
    const existing = store.sessions.find((session) => session.candidateId === candidate.id);
    if (existing) return NextResponse.json({ session: normalizeSession(existing, createId, new Date().toISOString()) });

    const now = new Date().toISOString();
    const session: Session = {
      id: createId(),
      token: createToken(),
      candidateId: candidate.id,
      jobId: candidate.jobId,
      questions: input.questions as Question[],
      answers: {},
      turns: [],
      currentQuestionIndex: 0,
      followUpCount: 0,
      maxFollowUps: input.maxFollowUps,
      needsManualReview: false,
      reviewReasons: [],
      status: "INVITED",
      createdAt: now,
      updatedAt: now,
    };
    const initialized = normalizeSession(session, createId, now);
    await updateStore((current) => ({
      ...current,
      sessions: [initialized, ...current.sessions],
      candidates: current.candidates.map((item) => item.id === candidate.id ? { ...item, interviewId: initialized.id, status: "INVITED" } : item),
    }));
    return NextResponse.json({ session: initialized }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发布问题失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

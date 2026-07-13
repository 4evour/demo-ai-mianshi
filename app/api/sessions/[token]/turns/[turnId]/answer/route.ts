import { generateFollowUpDecision } from "@/lib/ai";
import { answerSessionTurn, buildPublicSession, normalizeSession } from "@/lib/session-service";
import { createId, readStore, updateStore } from "@/lib/store";
import { NextResponse } from "next/server";
import { z } from "zod";

type Context = { params: { token: string; turnId: string } };

export async function POST(request: Request, context: Context) {
  try {
    const input = z.object({ answer: z.string().max(20_000), declined: z.boolean().default(false) }).parse(await request.json());
    if (!input.declined && !input.answer.trim()) throw new Error("请先填写当前问题的回答");

    const store = await readStore();
    const stored = store.sessions.find((item) => item.token === context.params.token);
    if (!stored) return NextResponse.json({ error: "链接不存在或已失效" }, { status: 404 });
    if (stored.status === "SUBMITTED") return NextResponse.json({ error: "面试已经提交" }, { status: 409 });
    const job = store.jobs.find((item) => item.id === stored.jobId);
    const candidate = store.candidates.find((item) => item.id === stored.candidateId);
    if (!job || !candidate) throw new Error("岗位或候选人不存在");

    const session = normalizeSession(stored, createId, new Date().toISOString());
    const updated = await answerSessionTurn({
      session,
      job,
      candidate,
      turnId: context.params.turnId,
      answer: input.answer,
      declined: input.declined,
      decide: generateFollowUpDecision,
      createId,
      now: new Date().toISOString(),
    });
    await updateStore((current) => ({
      ...current,
      sessions: current.sessions.map((item) => item.id === updated.id ? updated : item),
      candidates: current.candidates.map((item) => item.id === updated.candidateId ? { ...item, status: "IN_PROGRESS" } : item),
    }));
    return NextResponse.json({ session: buildPublicSession(updated, job.title, candidate.name) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交回答失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

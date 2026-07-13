import { saveTurnDraft } from "@/lib/interview-state";
import { buildPublicSession, normalizeSession } from "@/lib/session-service";
import { createId, readStore, updateStore } from "@/lib/store";
import { NextResponse } from "next/server";
import { z } from "zod";

type Context = { params: { token: string } };

export async function PUT(request: Request, context: Context) {
  try {
    const input = z.object({ turnId: z.string().uuid(), answer: z.string().max(20_000) }).parse(await request.json());
    const store = await readStore();
    const stored = store.sessions.find((item) => item.token === context.params.token);
    if (!stored) return NextResponse.json({ error: "链接不存在或已失效" }, { status: 404 });
    if (stored.status === "SUBMITTED") return NextResponse.json({ error: "面试已经提交" }, { status: 409 });
    const session = normalizeSession(stored, createId, new Date().toISOString());
    const updated = saveTurnDraft(session, input.turnId, input.answer, new Date().toISOString());
    await updateStore((current) => ({
      ...current,
      sessions: current.sessions.map((item) => item.id === updated.id ? updated : item),
      candidates: current.candidates.map((item) => item.id === updated.candidateId ? { ...item, status: "IN_PROGRESS" } : item),
    }));
    const job = store.jobs.find((item) => item.id === updated.jobId);
    const candidate = store.candidates.find((item) => item.id === updated.candidateId);
    return NextResponse.json({ session: buildPublicSession(updated, job?.title ?? "岗位面试", candidate?.name ?? "候选人") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

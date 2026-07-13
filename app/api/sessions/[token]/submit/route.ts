import { buildPublicSession, finalizeSession, normalizeSession } from "@/lib/session-service";
import { createId, readStore, updateStore } from "@/lib/store";
import { NextResponse } from "next/server";

type Context = { params: { token: string } };

export async function POST(_request: Request, context: Context) {
  try {
    const store = await readStore();
    const stored = store.sessions.find((item) => item.token === context.params.token);
    if (!stored) return NextResponse.json({ error: "链接不存在或已失效" }, { status: 404 });
    if (stored.status === "SUBMITTED") return NextResponse.json({ error: "面试已经提交" }, { status: 409 });
    const session = normalizeSession(stored, createId, new Date().toISOString());
    const updated = finalizeSession(session, new Date().toISOString());
    const job = store.jobs.find((item) => item.id === updated.jobId);
    const candidate = store.candidates.find((item) => item.id === updated.candidateId);
    await updateStore((current) => ({
      ...current,
      sessions: current.sessions.map((item) => item.id === updated.id ? updated : item),
      candidates: current.candidates.map((item) => item.id === updated.candidateId ? { ...item, status: "SUBMITTED" } : item),
    }));
    return NextResponse.json({ session: buildPublicSession(updated, job?.title ?? "岗位面试", candidate?.name ?? "候选人") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交面试失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

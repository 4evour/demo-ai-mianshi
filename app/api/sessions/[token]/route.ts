import { createId, readStore, updateStore } from "@/lib/store";
import { buildPublicSession, normalizeSession } from "@/lib/session-service";
import { NextResponse } from "next/server";

type Context = { params: { token: string } };

function publicSession(store: Awaited<ReturnType<typeof readStore>>, token: string) {
  const stored = store.sessions.find((item) => item.token === token);
  if (!stored) return null;
  const session = normalizeSession(stored, createId, new Date().toISOString());
  const job = store.jobs.find((item) => item.id === session.jobId);
  const candidate = store.candidates.find((item) => item.id === session.candidateId);
  return buildPublicSession(session, job?.title ?? "岗位面试", candidate?.name ?? "候选人");
}

export async function GET(_request: Request, context: Context) {
  const store = await readStore();
  const stored = store.sessions.find((item) => item.token === context.params.token);
  if (stored && (!stored.turns || stored.turns.length === 0)) {
    const normalized = normalizeSession(stored, createId, new Date().toISOString());
    await updateStore((current) => ({ ...current, sessions: current.sessions.map((item) => item.id === stored.id ? normalized : item) }));
    const job = store.jobs.find((item) => item.id === normalized.jobId);
    const candidate = store.candidates.find((item) => item.id === normalized.candidateId);
    return NextResponse.json({ session: buildPublicSession(normalized, job?.title ?? "岗位面试", candidate?.name ?? "候选人") });
  }
  const session = publicSession(store, context.params.token);
  if (!session) return NextResponse.json({ error: "链接不存在或已失效" }, { status: 404 });
  return NextResponse.json({ session });
}

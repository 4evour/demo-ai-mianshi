import { generateReport } from "@/lib/ai";
import { normalizeDimensions, calculateTotalScore } from "@/lib/scoring";
import { createId, readStore, updateStore } from "@/lib/store";
import { normalizeSession } from "@/lib/session-service";
import type { Report } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: Request) {
  const candidateId = new URL(request.url).searchParams.get("candidateId");
  const store = await readStore();
  return NextResponse.json({ report: store.reports.find((item) => item.candidateId === candidateId) ?? null });
}

export async function POST(request: Request) {
  try {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(await request.json());
    const store = await readStore();
    const session = store.sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error("面试会话不存在");
    if (session.status !== "SUBMITTED") throw new Error("候选人尚未提交面试");
    const candidate = store.candidates.find((item) => item.id === session.candidateId);
    const job = store.jobs.find((item) => item.id === session.jobId);
    if (!candidate || !job) throw new Error("候选人或岗位不存在");

    const normalizedSession = normalizeSession(session, createId, new Date().toISOString());
    const parsed = await generateReport(job, candidate, normalizedSession);
    const dimensions = normalizeDimensions(parsed.dimensions, job.dimensions);
    const report: Report = {
      id: createId(),
      candidateId: candidate.id,
      sessionId: normalizedSession.id,
      summary: parsed.summary,
      dimensions,
      strengths: parsed.strengths,
      gaps: parsed.gaps,
      followUps: parsed.followUps,
      pendingChecks: parsed.pendingChecks,
      totalScore: calculateTotalScore(dimensions, job.dimensions),
      aiGeneratedAt: new Date().toISOString(),
    };
    await updateStore((current) => ({
      ...current,
      reports: [report, ...current.reports.filter((item) => item.candidateId !== candidate.id)],
      sessions: current.sessions.map((item) => item.id === normalizedSession.id ? normalizedSession : item),
      candidates: current.candidates.map((item) => item.id === candidate.id ? { ...item, status: "REPORTED" } : item),
    }));
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "报告生成失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

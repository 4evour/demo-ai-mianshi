import { readStore, updateStore } from "@/lib/store";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({
  candidateId: z.string().uuid(),
  decision: z.enum(["ADVANCED", "REJECTED", "ON_HOLD"]),
  note: z.string().max(2000).default(""),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const store = await readStore();
    if (!store.candidates.some((candidate) => candidate.id === input.candidateId)) throw new Error("候选人不存在");
    if (!store.reports.some((report) => report.candidateId === input.candidateId)) throw new Error("请先生成 AI 报告");
    await updateStore((current) => ({
      ...current,
      candidates: current.candidates.map((candidate) => candidate.id === input.candidateId ? { ...candidate, status: input.decision } : candidate),
      reports: current.reports.map((report) => report.candidateId === input.candidateId ? { ...report, humanDecision: input.decision, humanNote: input.note } : report),
    }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存决策失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

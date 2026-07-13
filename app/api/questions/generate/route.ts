import { generateQuestions } from "@/lib/ai";
import { readStore } from "@/lib/store";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({ candidateId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const { candidateId } = inputSchema.parse(await request.json());
    const store = await readStore();
    const candidate = store.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error("候选人不存在");
    const job = store.jobs.find((item) => item.id === candidate.jobId);
    if (!job) throw new Error("岗位不存在");
    const result = await generateQuestions(job, candidate);
    return NextResponse.json({
      questions: result.questions.map((question) => ({ ...question, id: crypto.randomUUID() })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成问题失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

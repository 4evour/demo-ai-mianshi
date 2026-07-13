import { analyzeResume } from "@/lib/ai";
import { hasUsableText, prepareResumeText, type ResumeTextExtraction } from "@/lib/resume";
import { buildCandidateFromResume } from "@/lib/resume-workflow";
import { createId, readStore, updateStore } from "@/lib/store";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const input = z.object({ importId: z.string().uuid(), correctedText: z.string().min(1) }).parse(await request.json());
    if (!hasUsableText(input.correctedText)) throw new Error("修正后的简历文本仍然过短或不可读");

    const store = await readStore();
    const pending = store.resumeImports.find((item) => item.id === input.importId);
    if (!pending) throw new Error("待修正的简历不存在或已处理");
    if (!store.jobs.some((item) => item.id === pending.jobId)) throw new Error("岗位不存在");

    const prepared = prepareResumeText(input.correctedText);
    const parsed = await analyzeResume(prepared.redactedText);
    const extraction: ResumeTextExtraction = {
      text: input.correctedText,
      source: pending.source,
      status: "READY",
      pages: pending.pages,
      averageConfidence: pending.averageConfidence,
      warnings: [...pending.warnings, "OCR 文本已由审核员确认"],
    };
    const candidate = buildCandidateFromResume({
      id: createId(),
      jobId: pending.jobId,
      text: input.correctedText,
      extraction,
      parsed,
      createdAt: new Date().toISOString(),
    });

    await updateStore((current) => ({
      ...current,
      resumeImports: current.resumeImports.filter((item) => item.id !== pending.id),
      candidates: [candidate, ...current.candidates],
    }));
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "修正简历失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

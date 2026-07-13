import { analyzeResume } from "@/lib/ai";
import { prepareResumeText, extractResumeText, isPdfBuffer } from "@/lib/resume";
import { buildCandidateFromResume, createResumeImport } from "@/lib/resume-workflow";
import { createId, readStore, updateStore } from "@/lib/store";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const jobId = z.string().uuid().parse(form.get("jobId"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("请选择 PDF 简历");
    if (file.size > 10 * 1024 * 1024) throw new Error("PDF 不能超过 10 MB");
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      throw new Error("只支持 PDF 简历");
    }

    const store = await readStore();
    const job = store.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("岗位不存在");

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isPdfBuffer(buffer)) throw new Error("文件内容不是有效的 PDF");
    const extraction = await extractResumeText(buffer);
    if (extraction.status === "NEEDS_CORRECTION") {
      const resumeImport = createResumeImport({ id: createId(), jobId, fileName: file.name, extraction, createdAt: new Date().toISOString() });
      await updateStore((current) => ({ ...current, resumeImports: [resumeImport, ...current.resumeImports] }));
      return NextResponse.json({
        needsCorrection: true,
        resumeImport: {
          id: resumeImport.id,
          sourceText: resumeImport.sourceText,
          source: resumeImport.source,
          averageConfidence: resumeImport.averageConfidence,
          warnings: resumeImport.warnings,
          pages: resumeImport.pages.map((page) => ({ page: page.page, confidence: page.confidence })),
        },
      }, { status: 202 });
    }

    const prepared = prepareResumeText(extraction.text);
    const parsed = await analyzeResume(prepared.redactedText);
    const candidate = buildCandidateFromResume({ id: createId(), jobId, text: extraction.text, extraction, parsed, createdAt: new Date().toISOString() });

    await updateStore((current) => ({ ...current, candidates: [candidate, ...current.candidates] }));
    return NextResponse.json({
      candidate: {
        ...candidate,
        resume: { ...candidate.resume, sourceText: undefined, redactedText: undefined },
      },
      extraction: { source: extraction.source, averageConfidence: extraction.averageConfidence, warnings: extraction.warnings },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "简历解析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

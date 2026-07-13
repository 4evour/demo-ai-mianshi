import { z } from "zod";

const ocrResponseSchema = z.object({
  pages: z.array(z.object({
    page: z.number().int().positive(),
    text: z.string(),
    confidence: z.number().min(0).max(1),
  })).min(1),
  averageConfidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});

export type OcrResponse = z.infer<typeof ocrResponseSchema>;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export async function requestOcr(buffer: Buffer, fetchLike: FetchLike = fetch): Promise<OcrResponse> {
  const serviceUrl = process.env.OCR_SERVICE_URL?.trim();
  if (!serviceUrl) throw new Error("未配置 OCR_SERVICE_URL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OCR_TIMEOUT_MS || 120_000));
  try {
    const form = new FormData();
    form.append("file", new Blob([Uint8Array.from(buffer)], { type: "application/pdf" }), "resume.pdf");
    const response = await fetchLike(`${serviceUrl.replace(/\/$/, "")}/ocr`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const parsed = z.object({ detail: z.object({ message: z.string() }) }).safeParse(payload);
      throw new Error(parsed.success ? parsed.data.detail.message : `OCR 服务返回 ${response.status}`);
    }
    return ocrResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("OCR 服务超时", { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

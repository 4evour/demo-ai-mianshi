import pdf from "pdf-parse";
import { requestOcr, type OcrResponse } from "./ocr";
import { redactForModel } from "./redact";

export type ResumeTextExtraction = {
  text: string;
  source: "PDF_TEXT" | "OCR";
  status: "READY" | "NEEDS_CORRECTION";
  pages: Array<{ page: number; text: string; confidence: number }>;
  averageConfidence: number;
  warnings: string[];
};

type ExtractionOptions = {
  parsePdf?: (buffer: Buffer) => Promise<string>;
  ocr?: (buffer: Buffer) => Promise<OcrResponse>;
  minTextLength?: number;
  minReadableRatio?: number;
  minOcrConfidence?: number;
};

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function replaceLiteral(input: string, value: string, replacement: string): string {
  return value ? input.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), replacement) : input;
}

async function parsePdfText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text.trim();
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const text = await parsePdfText(buffer);
  if (!text) throw new Error("PDF 没有可提取的文本，本版本暂不支持扫描件 OCR");
  return text;
}

export function hasUsableText(text: string, minLength = 80, minReadableRatio = 0.5): boolean {
  const compact = text.replace(/\s/g, "");
  if (compact.length < minLength) return false;
  const readable = compact.match(/[A-Za-z0-9\u3400-\u9fff]/g)?.length ?? 0;
  return readable / compact.length >= minReadableRatio;
}

export async function extractResumeText(buffer: Buffer, options: ExtractionOptions = {}): Promise<ResumeTextExtraction> {
  const parse = options.parsePdf ?? parsePdfText;
  const embeddedText = (await parse(buffer)).trim();
  if (hasUsableText(embeddedText, options.minTextLength, options.minReadableRatio)) {
    return {
      text: embeddedText,
      source: "PDF_TEXT",
      status: "READY",
      pages: [{ page: 1, text: embeddedText, confidence: 1 }],
      averageConfidence: 1,
      warnings: [],
    };
  }

  try {
    const result = await (options.ocr ?? requestOcr)(buffer);
    const text = result.pages.map((page) => page.text.trim()).filter(Boolean).join("\n\n");
    const minConfidence = options.minOcrConfidence ?? Number(process.env.OCR_MIN_CONFIDENCE || 0.65);
    const warnings = [...result.warnings];
    if (result.averageConfidence < minConfidence) warnings.push(`OCR 平均置信度 ${result.averageConfidence.toFixed(2)}，需要人工确认`);
    if (!text) warnings.push("OCR 未识别到可用文本");
    return {
      text,
      source: "OCR",
      status: result.averageConfidence >= minConfidence && hasUsableText(text, options.minTextLength, options.minReadableRatio) ? "READY" : "NEEDS_CORRECTION",
      pages: result.pages,
      averageConfidence: result.averageConfidence,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return {
      text: embeddedText,
      source: "OCR",
      status: "NEEDS_CORRECTION",
      pages: embeddedText ? [{ page: 1, text: embeddedText, confidence: 0 }] : [],
      averageConfidence: 0,
      warnings: [`OCR 服务不可用：${message}`],
    };
  }
}

export function extractLocalIdentity(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  const phone = text.match(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/)?.[0] ?? "";
  const field = (name: string) => text.match(new RegExp(`(?:${name})\\s*[:：]\\s*([^\\n\\r]{1,40})`, "i"))?.[1]?.trim() ?? "";
  const headerName = lines.slice(0, 6).find((line) => /^[\u3400-\u9fff·]{2,4}$/.test(line) && !/^(简历|教育背景|个人信息)$/.test(line)) ?? "";
  const name = field("姓名|真实姓名") || headerName || "未识别候选人";

  const educationHeading = lines.findIndex((line) => /^(教育背景|教育经历)$/.test(line));
  const educationLine = educationHeading >= 0
    ? lines.slice(educationHeading + 1, educationHeading + 5).find((line) => /(?:大学|学院)/.test(line)) ?? ""
    : "";
  const educationMatch = educationLine.match(/^(.{2,20}?(?:大学|学院))\s*(.*?)(?:[（(](本科|硕士|博士|专科)[）)])?\s*((?:19|20)\d{2}\.\d{2}\s*[-–—至]\s*(?:(?:19|20)\d{2}\.\d{2}|至今))?$/);
  const school = field("学校|院校") || educationMatch?.[1]?.trim() || "";
  const major = field("专业") || educationMatch?.[2]?.trim() || "";
  const degree = educationMatch?.[3]?.trim() || "";
  const period = educationMatch?.[4]?.trim() || "";
  const education = school ? [{ school, major, degree, period }] : [];
  return { name, email, phone, school, major, education };
}

export function extractResumeHonors(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => /^(荣誉证书|荣誉奖项|奖项证书)$/.test(line));
  if (start < 0) return [];
  const sectionHeading = /^(自我评价|专业技能|项目经历|工作经历|实习经历|教育背景|教育经历)$/;
  const honors: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (sectionHeading.test(line)) break;
    honors.push(line);
  }
  return honors;
}

export function prepareResumeText(text: string): { sourceText: string; redactedText: string } {
  const identity = extractLocalIdentity(text);
  let redactedText = redactForModel(text);
  redactedText = replaceLiteral(redactedText, identity.name === "未识别候选人" ? "" : identity.name, "[REDACTED_NAME]");
  redactedText = replaceLiteral(redactedText, identity.school, "[REDACTED_SCHOOL]");
  return { sourceText: text, redactedText };
}

import assert from "node:assert/strict";
import test from "node:test";

import { extractResumeText, isPdfBuffer } from "../lib/resume";

const longText = "姓名：张三\n技能：TypeScript、Python\n" + "项目经验与实现细节。".repeat(12);

test("checks the PDF signature instead of trusting the file name", () => {
  assert.equal(isPdfBuffer(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(isPdfBuffer(Buffer.from("not a pdf")), false);
});

test("uses embedded PDF text without calling OCR", async () => {
  let ocrCalls = 0;
  const result = await extractResumeText(Buffer.from("pdf"), {
    parsePdf: async () => longText,
    ocr: async () => {
      ocrCalls += 1;
      throw new Error("should not run");
    },
  });

  assert.equal(result.source, "PDF_TEXT");
  assert.equal(result.status, "READY");
  assert.equal(result.text, longText);
  assert.equal(ocrCalls, 0);
});

test("uses OCR when the PDF has no usable text layer", async () => {
  const result = await extractResumeText(Buffer.from("pdf"), {
    parsePdf: async () => "",
    ocr: async () => ({
      pages: [{ page: 1, text: longText, confidence: 0.92 }],
      averageConfidence: 0.92,
      warnings: [],
    }),
  });

  assert.equal(result.source, "OCR");
  assert.equal(result.status, "READY");
  assert.equal(result.text, longText);
  assert.equal(result.pages[0]?.page, 1);
});

test("requires correction when OCR confidence is low", async () => {
  const result = await extractResumeText(Buffer.from("pdf"), {
    parsePdf: async () => "",
    ocr: async () => ({
      pages: [{ page: 1, text: "识别结果", confidence: 0.42 }],
      averageConfidence: 0.42,
      warnings: [],
    }),
  });

  assert.equal(result.status, "NEEDS_CORRECTION");
  assert.match(result.warnings.join(" "), /置信度/);
});

test("requires correction instead of throwing when OCR is unavailable", async () => {
  const result = await extractResumeText(Buffer.from("pdf"), {
    parsePdf: async () => "",
    ocr: async () => {
      throw new Error("connection refused");
    },
  });

  assert.equal(result.source, "OCR");
  assert.equal(result.status, "NEEDS_CORRECTION");
  assert.match(result.warnings.join(" "), /OCR 服务不可用/);
});

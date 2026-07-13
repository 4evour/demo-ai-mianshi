import assert from "node:assert/strict";
import test from "node:test";
import { calculateTotalScore, normalizeDimensions } from "../lib/scoring";

const rubric = [
  { name: "项目真实性", weight: 50, description: "能用证据说明个人贡献" },
  { name: "专业技能", weight: 50, description: "能解释实现和取舍" },
];

test("calculates a weighted score with evidence confidence", () => {
  const score = calculateTotalScore([
    { name: "项目真实性", level: 4, evidenceConfidence: 1, reason: "ok", evidence: ["answer"] },
    { name: "专业技能", level: 2, evidenceConfidence: 0.5, reason: "partial", evidence: ["resume"] },
  ], rubric);

  assert.equal(score, 63);
});

test("fills missing dimensions as low-confidence evidence gaps", () => {
  const dimensions = normalizeDimensions([], rubric);
  assert.equal(dimensions.length, 2);
  assert.equal(dimensions[0].level, 0);
  assert.equal(dimensions[0].evidenceConfidence, 0);
  assert.match(dimensions[0].reason, /人工确认/);
});

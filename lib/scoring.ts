import type { Dimension, ReportDimension } from "./types";

export function calculateTotalScore(dimensions: ReportDimension[], rubric: Dimension[]): number {
  if (rubric.length === 0) return 0;

  const totalWeight = rubric.reduce((sum, item) => sum + item.weight, 0);
  const weighted = rubric.reduce((sum, item) => {
    const result = dimensions.find((dimension) => dimension.name === item.name);
    if (!result) return sum;
    const level = Math.max(0, Math.min(4, result.level));
    const confidence = Math.max(0, Math.min(1, result.evidenceConfidence));
    return sum + (level / 4) * item.weight * confidence;
  }, 0);

  return Math.round((weighted / totalWeight) * 100);
}

export function normalizeDimensions(input: ReportDimension[], rubric: Dimension[]): ReportDimension[] {
  return rubric.map((item) => {
    const found = input.find((dimension) => dimension.name === item.name);
    return {
      name: item.name,
      level: Math.max(0, Math.min(4, found?.level ?? 0)),
      evidenceConfidence: Math.max(0, Math.min(1, found?.evidenceConfidence ?? 0)),
      reason: found?.reason ?? "暂无有效证据，需要人工确认。",
      evidence: found?.evidence ?? [],
    };
  });
}

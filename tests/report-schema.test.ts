import assert from "node:assert/strict";
import test from "node:test";

import { reportAiSchema } from "../lib/schemas";

test("normalizes keyed report dimensions and confidence aliases", () => {
  const parsed = reportAiSchema.parse({
    summary: "候选人具备后端经验。",
    dimensions: {
      后端开发能力: {
        level: 3,
        confidence: 0.8,
        reason: "回答包含实现细节。",
        evidence: ["[TURN:turn-1] 描述了缓存策略"],
      },
    },
    strengths: [],
    gaps: [],
    followUps: [],
    pendingChecks: [],
  });

  assert.deepEqual(parsed.dimensions, [{
    name: "后端开发能力",
    level: 3,
    evidenceConfidence: 0.8,
    reason: "回答包含实现细节。",
    evidence: ["[TURN:turn-1] 描述了缓存策略"],
  }]);
});

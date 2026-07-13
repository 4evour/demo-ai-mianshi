import assert from "node:assert/strict";
import test from "node:test";

test("toggles candidates while enforcing a two-person comparison limit", async () => {
  const module = await import("../lib/comparison-selection").catch(() => ({} as Record<string, unknown>));
  const toggleComparisonCandidate = (module as Record<string, unknown>).toggleComparisonCandidate;
  assert.equal(typeof toggleComparisonCandidate, "function");
  const toggle = toggleComparisonCandidate as (selected: string[], candidateId: string) => string[];

  assert.deepEqual(toggle([], "a"), ["a"]);
  assert.deepEqual(toggle(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggle(["a", "b"], "c"), ["a", "b"]);
  assert.deepEqual(toggle(["a", "b"], "a"), ["b"]);
});

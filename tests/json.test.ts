import assert from "node:assert/strict";
import test from "node:test";
import { extractJson } from "../lib/json";

test("extracts JSON from markdown fences", () => {
  assert.deepEqual(extractJson("结果如下：```json\n{\"ok\":true}\n```"), { ok: true });
});

test("rejects incomplete JSON", () => {
  assert.throws(() => extractJson("{\"ok\": true"), /incomplete|JSON/);
});

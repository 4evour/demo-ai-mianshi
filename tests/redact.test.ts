import assert from "node:assert/strict";
import test from "node:test";
import { containsLikelyPii, redactForModel } from "../lib/redact";

test("redacts common identity fields before model calls", () => {
  const input = "姓名：张三\n邮箱：zhangsan@example.com\n手机：13812345678\n学校：清华大学\n项目：做了一个检索系统";
  const output = redactForModel(input);

  assert.equal(output.includes("zhangsan@example.com"), false);
  assert.equal(output.includes("13812345678"), false);
  assert.equal(output.includes("清华大学"), false);
  assert.match(output, /\[REDACTED_EMAIL\]/);
  assert.match(output, /\[REDACTED_PHONE\]/);
  assert.match(output, /\[REDACTED_SCHOOL\]/);
});

test("detects unredacted email and phone", () => {
  assert.equal(containsLikelyPii("contact: a@example.com"), true);
  assert.equal(containsLikelyPii("phone: 13812345678"), true);
  assert.equal(containsLikelyPii("没有身份字段的项目描述"), false);
});

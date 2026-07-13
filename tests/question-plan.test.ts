import assert from "node:assert/strict";
import test from "node:test";

import * as questionPlan from "../lib/question-plan";
import type { Question } from "../lib/types";

test("creates a blank required question for manual editing", () => {
  const exported = questionPlan as unknown as Record<string, unknown>;
  assert.equal(typeof exported.createManualQuestion, "function");
  const createManualQuestion = exported.createManualQuestion as (id: string) => Question;

  assert.deepEqual(createManualQuestion("00000000-0000-4000-8000-000000000003"), {
    id: "00000000-0000-4000-8000-000000000003",
    text: "",
    purpose: "",
    dimension: "",
    required: true,
  });
});

test("removes only the selected draft question", () => {
  const exported = questionPlan as unknown as Record<string, unknown>;
  assert.equal(typeof exported.removeQuestion, "function");
  const removeQuestion = exported.removeQuestion as (questions: Question[], id: string) => Question[];
  const questions: Question[] = [
    { id: "q1", text: "第一题", purpose: "", dimension: "", required: true },
    { id: "q2", text: "第二题", purpose: "", dimension: "", required: false },
  ];

  assert.deepEqual(removeQuestion(questions, "q1"), [questions[1]]);
});

import { z } from "zod";
import type { Question } from "./types";

export const questionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1, "问题内容不能为空"),
  purpose: z.string().trim(),
  dimension: z.string().trim(),
  required: z.boolean(),
});

export const questionPlanSchema = z.array(questionSchema).min(1, "至少需要一道问题");

export function createManualQuestion(id = crypto.randomUUID()): Question {
  return { id, text: "", purpose: "", dimension: "", required: true };
}

export function removeQuestion(questions: Question[], id: string): Question[] {
  return questions.filter((question) => question.id !== id);
}

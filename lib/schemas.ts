import { z } from "zod";

export const jobAiSchema = z.object({
  requirements: z.array(z.string()).min(1).max(12),
  niceToHave: z.array(z.string()).max(12).default([]),
  dimensions: z.array(z.object({
    name: z.string().min(1),
    weight: z.number().min(1).max(100),
    description: z.string().min(1),
  })).min(2).max(8),
});

export const resumeAiSchema = z.object({
  summary: z.string(),
  skills: z.array(z.string()).default([]),
  projects: z.array(z.object({
    name: z.string(),
    role: z.string().nullish().transform((value) => value ?? ""),
    description: z.string().nullish().transform((value) => value ?? ""),
    technologies: z.array(z.string()).default([]),
    claims: z.array(z.string()).default([]),
  })).default([]),
  honors: z.array(z.string()).default([]),
  artifactLinks: z.array(z.string().url()).default([]),
});

export const questionsAiSchema = z.object({
  questions: z.array(z.object({
    text: z.string().min(5),
    purpose: z.string().min(1),
    dimension: z.string().min(1),
    required: z.boolean().default(true),
  })).min(3).max(10),
});

const followUpTriggerSchema = z.enum(["SHORT_ANSWER", "OFF_TOPIC", "CONTRIBUTION_UNCLEAR", "CLAIM_CONFLICT", "EVIDENCE_GAP"]);

export const followUpAiSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ASK_FOLLOW_UP"),
    reason: followUpTriggerSchema.default("EVIDENCE_GAP"),
    question: z.string().min(5),
  }),
  z.object({
    action: z.literal("NEXT_QUESTION"),
    reason: z.enum(["SHORT_ANSWER", "OFF_TOPIC", "CONTRIBUTION_UNCLEAR", "CLAIM_CONFLICT", "EVIDENCE_GAP", "DECLINED", "SUFFICIENT"]).default("SUFFICIENT"),
  }),
  z.object({
    action: z.literal("END_INTERVIEW"),
    reason: z.enum(["DECLINED", "SUFFICIENT"]).default("SUFFICIENT"),
  }),
]);

const reportDimensionSchema = z.object({
  name: z.string(),
  level: z.number().min(0).max(4),
  evidenceConfidence: z.number().min(0).max(1),
  reason: z.string(),
  evidence: z.array(z.string()).default([]),
});

function normalizeReportDimension(value: unknown, fallbackName?: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const dimension = value as Record<string, unknown>;
  return {
    ...dimension,
    name: dimension.name ?? fallbackName,
    evidenceConfidence: dimension.evidenceConfidence ?? dimension.confidence,
  };
}

const reportDimensionsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map((dimension) => normalizeReportDimension(dimension));
  if (value && typeof value === "object") {
    return Object.entries(value).map(([name, dimension]) => normalizeReportDimension(dimension, name));
  }
  return value;
}, z.array(reportDimensionSchema));

export const reportAiSchema = z.object({
  summary: z.string(),
  dimensions: reportDimensionsSchema,
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
  pendingChecks: z.array(z.string()).default([]),
});

export type JobAiOutput = z.infer<typeof jobAiSchema>;
export type ResumeAiOutput = z.infer<typeof resumeAiSchema>;
export type QuestionsAiOutput = z.infer<typeof questionsAiSchema>;
export type FollowUpAiOutput = z.infer<typeof followUpAiSchema>;
export type ReportAiOutput = z.infer<typeof reportAiSchema>;

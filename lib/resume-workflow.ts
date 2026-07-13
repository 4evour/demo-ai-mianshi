import type { ResumeAiOutput } from "./schemas";
import { extractLocalIdentity, extractResumeHonors, prepareResumeText, type ResumeTextExtraction } from "./resume";
import type { Candidate, ResumeImport } from "./types";

export function createResumeImport(input: {
  id: string;
  jobId: string;
  fileName: string;
  extraction: ResumeTextExtraction;
  createdAt: string;
}): ResumeImport {
  return {
    id: input.id,
    jobId: input.jobId,
    fileName: input.fileName,
    sourceText: input.extraction.text,
    source: input.extraction.source,
    pages: input.extraction.pages,
    averageConfidence: input.extraction.averageConfidence,
    warnings: input.extraction.warnings,
    status: "NEEDS_CORRECTION",
    createdAt: input.createdAt,
  };
}

export function buildCandidateFromResume(input: {
  id: string;
  jobId: string;
  text: string;
  extraction: ResumeTextExtraction;
  parsed: ResumeAiOutput;
  createdAt: string;
}): Candidate {
  const identity = extractLocalIdentity(input.text);
  const prepared = prepareResumeText(input.text);
  const honors = [...new Set([...(input.parsed.honors ?? []), ...extractResumeHonors(input.text)])];
  return {
    id: input.id,
    jobId: input.jobId,
    name: identity.name,
    email: identity.email,
    status: "READY",
    resume: {
      ...input.parsed,
      ...identity,
      honors,
      sourceText: prepared.sourceText,
      redactedText: prepared.redactedText,
      extraction: {
        source: input.extraction.source,
        pages: input.extraction.pages,
        averageConfidence: input.extraction.averageConfidence,
        warnings: input.extraction.warnings,
      },
    },
    createdAt: input.createdAt,
  };
}

export function enrichCandidateFromSource(candidate: Candidate): Candidate {
  const sourceText = candidate.resume.sourceText;
  if (!sourceText) return candidate;
  const identity = extractLocalIdentity(sourceText);
  const prepared = prepareResumeText(sourceText);
  const honors = [...new Set([...(candidate.resume.honors ?? []), ...extractResumeHonors(sourceText)])];
  return {
    ...candidate,
    name: identity.name === "未识别候选人" ? candidate.name : identity.name,
    email: identity.email || candidate.email,
    resume: {
      ...candidate.resume,
      ...identity,
      honors,
      redactedText: prepared.redactedText,
    },
  };
}

import { readStore } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  const store = await readStore();
  const candidates = store.candidates
    .filter((candidate) => !jobId || candidate.jobId === jobId)
    .map((candidate) => ({
      ...candidate,
      resume: {
        ...candidate.resume,
        sourceText: undefined,
        redactedText: undefined,
      },
      session: store.sessions.find((session) => session.id === candidate.interviewId) ?? null,
      report: store.reports.find((report) => report.candidateId === candidate.id) ?? null,
    }));
  return NextResponse.json({ candidates });
}

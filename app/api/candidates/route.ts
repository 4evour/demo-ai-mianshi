import { readStore } from "@/lib/store";
import { buildCandidateReviewView } from "@/lib/reviewer-data";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  const store = await readStore();
  const candidates = store.candidates
    .filter((candidate) => !jobId || candidate.jobId === jobId)
    .map((candidate) => buildCandidateReviewView(store, candidate.id))
    .filter((candidate) => candidate !== null);
  return NextResponse.json({ candidates });
}

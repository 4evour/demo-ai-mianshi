import { buildCandidateReviewView } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: { candidateId: string } }) {
  const candidate = buildCandidateReviewView(await readStore(), context.params.candidateId);
  if (!candidate) return NextResponse.json({ error: "候选人不存在" }, { status: 404 });
  return NextResponse.json({ candidate });
}

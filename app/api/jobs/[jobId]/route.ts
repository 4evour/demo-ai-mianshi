import { buildJobReviewView } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: { jobId: string } }) {
  const view = buildJobReviewView(await readStore(), context.params.jobId);
  if (!view) return NextResponse.json({ error: "岗位不存在" }, { status: 404 });
  return NextResponse.json(view);
}

import { analyzeJob } from "@/lib/ai";
import { createId, readStore, updateStore } from "@/lib/store";
import type { Job } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  jd: z.string().trim().min(30).max(20_000),
});

function normalizeWeights(items: Job["dimensions"]): Job["dimensions"] {
  const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  return items.map((item) => ({ ...item, weight: Math.round((item.weight / total) * 100) }));
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ jobs: store.jobs });
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const parsed = await analyzeJob(input.title, input.jd);
    const job: Job = {
      id: createId(),
      title: input.title,
      jd: input.jd,
      requirements: parsed.requirements,
      niceToHave: parsed.niceToHave,
      dimensions: normalizeWeights(parsed.dimensions),
      createdAt: new Date().toISOString(),
    };
    await updateStore((store) => ({ ...store, jobs: [job, ...store.jobs] }));
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建岗位失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

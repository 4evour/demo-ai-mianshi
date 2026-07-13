import { JobDetailClient } from "@/components/job-detail-client";
import { ReviewerShell } from "@/components/reviewer-shell";
import { buildJobReviewView } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { jobId: string } }) {
  const view = buildJobReviewView(await readStore(), params.jobId);
  if (!view) notFound();
  return <ReviewerShell eyebrow="岗位详情" title={view.job.title} description={view.job.requirements.slice(0, 4).join(" · ") || "暂无要求摘要"}>
    <JobDetailClient job={view.job} candidates={view.candidates} />
  </ReviewerShell>;
}

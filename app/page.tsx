import { ReviewerShell } from "@/components/reviewer-shell";
import { buildJobOverviews } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export default async function HomePage() {
  const jobs = buildJobOverviews(await readStore());
  return <ReviewerShell
    eyebrow="岗位总览"
    title="岗位列表"
    description="从岗位进入候选人和报告审阅。详情会在新标签页打开，当前列表保持不变。"
    actions={<a className="button accent" href="/jobs/new" target="_blank" rel="noreferrer">新建岗位</a>}
  >
    {jobs.length === 0 ? <div className="empty">还没有岗位。先新建岗位，再上传候选人简历。</div> : <section className="data-list" aria-label="岗位列表">
      <div className="data-list-head"><span>岗位</span><span>候选人</span><span>已提交</span><span>报告</span><span>创建日期</span><span /></div>
      {jobs.map((job) => <div className="data-list-row" key={job.id}>
        <div><strong>{job.title}</strong><small>{job.requirements.slice(0, 2).join(" · ") || "尚无要求摘要"}</small></div>
        <span>{job.candidateCount}</span>
        <span>{job.submittedCount}</span>
        <span>{job.reportCount}</span>
        <span>{formatDate(job.createdAt)}</span>
        <a className="text-link" href={`/jobs/${job.id}`} target="_blank" rel="noreferrer">打开岗位</a>
      </div>)}
    </section>}
  </ReviewerShell>;
}

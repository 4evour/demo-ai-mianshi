import { ReportActions } from "@/components/report-actions";
import { ReviewerShell } from "@/components/reviewer-shell";
import { buildCandidateReviewView } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CandidateReportPage({ params }: { params: { candidateId: string } }) {
  const candidate = buildCandidateReviewView(await readStore(), params.candidateId);
  if (!candidate) notFound();
  const report = candidate.report;
  return <ReviewerShell eyebrow={`${candidate.job.title} · 面试报告`} title={candidate.name} description={report ? `${candidate.status} · 报告生成于 ${new Date(report.aiGeneratedAt).toLocaleString("zh-CN")}` : candidate.session?.status === "SUBMITTED" ? "候选人已提交，可以生成报告" : "候选人尚未完成答题"} actions={<a className="button secondary" href={`/candidates/${candidate.id}/interview`} target="_blank" rel="noreferrer">打开问答记录</a>}>
    <div className="page-stack">
      {report && <>
        <section className="report-overview"><div><strong>{report.totalScore}</strong><span>证据调整后总分</span></div><p>{report.summary}</p></section>
        <section className="content-band"><div className="section-heading"><div><h2>评分维度</h2><p>{report.dimensions.length} 个维度</p></div></div><div className="report-dimensions">{report.dimensions.map((dimension) => <div key={dimension.name}><div><strong>{dimension.name}</strong><span>{dimension.level}/4 · {Math.round(dimension.evidenceConfidence * 100)}%</span></div><p>{dimension.reason}</p><ul>{dimension.evidence.map((evidence) => { const turnId = evidence.match(/^\[TURN:([^\]]+)\]/)?.[1]; return <li key={evidence}>{turnId ? <a href={`/candidates/${candidate.id}/interview#turn-${turnId}`} target="_blank" rel="noreferrer">{evidence}</a> : evidence}</li>; })}</ul></div>)}</div></section>
        <section className="content-band compare-lists"><div><h2>优势</h2><ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h2>待确认</h2><ul>{[...report.gaps, ...report.pendingChecks].map((item) => <li key={item}>{item}</li>)}</ul></div></section>
      </>}
      <ReportActions candidateId={candidate.id} sessionId={candidate.session?.id} hasReport={Boolean(report)} />
    </div>
  </ReviewerShell>;
}

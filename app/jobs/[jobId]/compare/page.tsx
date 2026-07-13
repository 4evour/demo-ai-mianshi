import { ReviewerShell } from "@/components/reviewer-shell";
import { buildReportComparison } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReportComparisonPage({ params, searchParams }: { params: { jobId: string }; searchParams: { candidateIds?: string } }) {
  const candidateIds = (searchParams.candidateIds ?? "").split(",").filter(Boolean);
  let comparison;
  try { comparison = buildReportComparison(await readStore(), params.jobId, candidateIds); }
  catch (error) {
    return <ReviewerShell eyebrow="报告对比" title="无法生成对比"><div className="notice warning">{error instanceof Error ? error.message : "对比参数无效"}</div></ReviewerShell>;
  }
  const [left, right] = comparison.candidates;
  return <ReviewerShell eyebrow={`${comparison.job.title} · 报告对比`} title={`${left.name} 与 ${right.name}`} description="仅比较同一岗位下的报告，维度顺序与岗位评分量表一致。">
    <div className="comparison-table" role="table" aria-label="候选人报告对比">
      <div className="comparison-row comparison-head" role="row"><strong>对比项</strong>{comparison.candidates.map((candidate) => <div key={candidate.id}><strong>{candidate.name}</strong><a href={`/candidates/${candidate.id}/report`} target="_blank" rel="noreferrer">打开完整报告</a></div>)}</div>
      <div className="comparison-row" role="row"><strong>总分</strong>{comparison.candidates.map((candidate) => <div className="comparison-score" key={candidate.id}>{candidate.report!.totalScore}</div>)}</div>
      <div className="comparison-row" role="row"><strong>人工决策</strong>{comparison.candidates.map((candidate) => <div key={candidate.id}>{candidate.report!.humanDecision ?? "待审核"}</div>)}</div>
      {comparison.job.dimensions.map((jobDimension) => <div className="comparison-row" role="row" key={jobDimension.name}>
        <strong>{jobDimension.name}<small>权重 {jobDimension.weight}%</small></strong>
        {comparison.candidates.map((candidate) => { const dimension = candidate.report!.dimensions.find((item) => item.name === jobDimension.name); return <div key={candidate.id}>{dimension ? <><b>{dimension.level}/4</b><span>证据置信度 {Math.round(dimension.evidenceConfidence * 100)}%</span><p>{dimension.reason}</p></> : <span>无该维度报告</span>}</div>; })}
      </div>)}
      <div className="comparison-row" role="row"><strong>优势</strong>{comparison.candidates.map((candidate) => <ul key={candidate.id}>{candidate.report!.strengths.map((item) => <li key={item}>{item}</li>)}</ul>)}</div>
      <div className="comparison-row" role="row"><strong>待确认</strong>{comparison.candidates.map((candidate) => <ul key={candidate.id}>{[...candidate.report!.gaps, ...candidate.report!.pendingChecks].map((item) => <li key={item}>{item}</li>)}</ul>)}</div>
    </div>
  </ReviewerShell>;
}

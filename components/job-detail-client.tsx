"use client";

import { toggleComparisonCandidate } from "@/lib/comparison-selection";
import type { CandidateReviewView } from "@/lib/reviewer-data";
import type { Job } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ResumeCorrection = { id: string; sourceText: string; averageConfidence: number; warnings: string[]; pages: Array<{ page: number; confidence: number }> };

export function JobDetailClient({ job, candidates }: { job: Job; candidates: CandidateReviewView[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ text: string; kind: "success" | "warning" } | null>(null);
  const [correction, setCorrection] = useState<ResumeCorrection | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const comparisonHref = useMemo(() => comparisonIds.length === 2 ? `/jobs/${job.id}/compare?candidateIds=${comparisonIds.join(",")}` : "", [comparisonIds, job.id]);
  const visibleCandidates = useMemo(() => statusFilter === "ALL" ? candidates : candidates.filter((candidate) => candidate.status === statusFilter), [candidates, statusFilter]);
  const statuses = useMemo(() => [...new Set(candidates.map((candidate) => candidate.status))], [candidates]);

  async function uploadResume(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy("resume"); setNotice(null);
    try {
      const form = new FormData(); form.append("jobId", job.id); form.append("file", file);
      const response = await fetch("/api/resumes/parse", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "简历解析失败");
      setFile(null);
      if (payload.needsCorrection) {
        setCorrection(payload.resumeImport);
        setNotice({ text: "OCR 文本需要人工确认。", kind: "warning" });
      } else {
        setNotice({ text: "简历已解析，候选人已加入当前岗位。", kind: "success" });
        router.refresh();
      }
    } catch (reason) { setNotice({ text: (reason as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function confirmCorrection(event: React.FormEvent) {
    event.preventDefault();
    if (!correction) return;
    setBusy("correction"); setNotice(null);
    try {
      const response = await fetch("/api/resumes/correct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: correction.id, correctedText: correction.sourceText }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "确认 OCR 文本失败");
      setCorrection(null); setNotice({ text: "OCR 文本已确认，候选人已加入。", kind: "success" }); router.refresh();
    } catch (reason) { setNotice({ text: (reason as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  return <div className="page-stack">
    <section className="content-band">
      <div className="section-heading"><div><h2>上传候选人</h2><p>支持文本 PDF 和扫描件 OCR。简历原文只保存在本地。</p></div></div>
      <form className="inline-upload" onSubmit={uploadResume}>
        <input aria-label="PDF 简历" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="button" disabled={!file || busy === "resume"}>{busy === "resume" ? "解析中…" : "上传并解析"}</button>
      </form>
      {notice && <div className={`notice ${notice.kind}`} role="status">{notice.text}</div>}
    </section>

    {correction && <section className="content-band"><form onSubmit={confirmCorrection}>
      <div className="section-heading"><div><h2>确认 OCR 文本</h2><p>平均置信度 {Math.round(correction.averageConfidence * 100)}% · {correction.pages.length} 页</p></div></div>
      {correction.warnings.length > 0 && <div className="notice warning">{correction.warnings.join("；")}</div>}
      <div className="field"><label htmlFor="correction-text">识别文本</label><textarea id="correction-text" value={correction.sourceText} onChange={(event) => setCorrection({ ...correction, sourceText: event.target.value })} /></div>
      <div className="button-row"><button className="button accent" disabled={busy === "correction"}>确认并解析</button><button className="button secondary" type="button" onClick={() => setCorrection(null)}>取消</button></div>
    </form></section>}

    <details className="content-band collapsible-band"><summary>岗位评分量表 · {job.dimensions.length} 个维度</summary><div className="rubric-list">{job.dimensions.map((dimension) => <div key={dimension.name}><strong>{dimension.name}</strong><span>{dimension.weight}%</span><p>{dimension.description}</p></div>)}</div></details>

    <section className="content-band">
      <div className="section-heading"><div><h2>候选人</h2><p>{candidates.length} 人 · 仅已生成报告的候选人可加入对比</p></div><div className="candidate-tools"><select aria-label="按状态筛选候选人" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">全部状态</option>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select>{comparisonHref ? <a className="button accent" href={comparisonHref} target="_blank" rel="noreferrer">对比已选两人</a> : <span className="selection-count">已选 {comparisonIds.length} / 2</span>}</div></div>
      {candidates.length === 0 ? <div className="empty">当前岗位还没有候选人。</div> : visibleCandidates.length === 0 ? <div className="empty">当前筛选条件下没有候选人。</div> : <div className="candidate-table">
        <div className="candidate-table-head"><span>对比</span><span>候选人</span><span>状态</span><span>报告分数</span><span /></div>
        {visibleCandidates.map((candidate) => <div className="candidate-table-row" key={candidate.id}>
          <label className="compare-check"><input type="checkbox" aria-label={`选择 ${candidate.name} 进行对比`} checked={comparisonIds.includes(candidate.id)} disabled={!candidate.report} onChange={() => setComparisonIds((current) => toggleComparisonCandidate(current, candidate.id))} /></label>
          <div><strong>{candidate.name}</strong><small>{candidate.email || "未识别邮箱"}</small></div>
          <span className={`status ${candidate.status}`}>{candidate.status}</span>
          <span>{candidate.report ? candidate.report.totalScore : "未生成"}</span>
          <a className="text-link" href={`/candidates/${candidate.id}`} target="_blank" rel="noreferrer">打开档案</a>
        </div>)}
      </div>}
    </section>
  </div>;
}

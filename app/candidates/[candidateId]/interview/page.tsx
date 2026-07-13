import { ReviewerShell } from "@/components/reviewer-shell";
import { buildCandidateReviewView } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function answerPreview(answer: string): string {
  const normalized = answer.replace(/\s+/g, " ").trim();
  return normalized.length > 100 ? `${normalized.slice(0, 100)}…` : normalized || "未回答";
}

export default async function CandidateInterviewPage({ params }: { params: { candidateId: string } }) {
  const candidate = buildCandidateReviewView(await readStore(), params.candidateId);
  if (!candidate) notFound();
  const session = candidate.session;
  return <ReviewerShell eyebrow={`${candidate.job.title} · 问答记录`} title={candidate.name} description={session ? `${session.status} · ${session.turns.length} 条记录 · 追问 ${session.followUpCount}/${session.maxFollowUps}` : "尚未创建面试会话"} actions={<a className="button secondary" href={`/candidates/${candidate.id}/report`} target="_blank" rel="noreferrer">打开报告</a>}>
    {!session ? <div className="empty">该候选人尚未创建面试会话。</div> : <div className="interview-list">
      {session.needsManualReview && <div className="notice warning">该会话存在模型降级记录，需要人工复核。</div>}
      {session.turns.map((turn, index) => <details className={`interview-item ${turn.kind === "FOLLOW_UP" ? "follow-up" : ""}`} id={`turn-${turn.id}`} key={turn.id}>
        <summary><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{turn.text}</strong><small>{turn.kind === "FOLLOW_UP" ? "AI 追问" : "主问题"} · {turn.disposition === "DECLINED" ? "未回答" : turn.status === "CURRENT" ? "等待回答" : "已回答"}</small><p>{answerPreview(turn.answer)}</p></div></summary>
        <div className="interview-answer"><p>{turn.disposition === "DECLINED" ? "候选人选择不回答" : turn.answer || "暂无回答"}</p>{turn.modelError && <details className="technical-detail"><summary>模型降级技术详情</summary><pre>{turn.modelError}</pre></details>}</div>
      </details>)}
    </div>}
  </ReviewerShell>;
}

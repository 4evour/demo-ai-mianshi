"use client";

import { createManualQuestion, questionPlanSchema, removeQuestion } from "@/lib/question-plan";
import type { CandidateReviewView } from "@/lib/reviewer-data";
import type { Question } from "@/lib/types";
import { useEffect, useState } from "react";

export function CandidateWorkflow({ candidate }: { candidate: CandidateReviewView }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [maxFollowUps, setMaxFollowUps] = useState(3);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ text: string; kind: "success" | "warning" } | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    if (candidate.session) setInviteUrl(`${window.location.origin}/candidate/${candidate.session.token}`);
  }, [candidate.session]);

  async function generateQuestions() {
    setBusy("questions"); setNotice(null);
    try {
      const response = await fetch("/api/questions/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "生成问题失败");
      setQuestions(payload.questions); setEditorOpen(true);
    } catch (reason) { setNotice({ text: (reason as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function publishQuestions() {
    const parsed = questionPlanSchema.safeParse(questions);
    if (!parsed.success) { setNotice({ text: parsed.error.issues[0]?.message ?? "请检查问题列表", kind: "warning" }); return; }
    setBusy("publish"); setNotice(null);
    try {
      const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id, questions: parsed.data, maxFollowUps }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "发布问题失败");
      setInviteUrl(`${window.location.origin}/candidate/${payload.session.token}`);
      setNotice({ text: "候选人答题链接已生成。", kind: "success" });
    } catch (reason) { setNotice({ text: (reason as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  if (candidate.session && !editorOpen) return <section className="content-band">
    <div className="section-heading"><div><h2>面试流程</h2><p>状态：{candidate.session.status} · 追问 {candidate.session.followUpCount}/{candidate.session.maxFollowUps}</p></div></div>
    <div className="link-box"><input aria-label="候选人答题链接" value={inviteUrl} readOnly /><button className="button secondary" onClick={() => navigator.clipboard.writeText(inviteUrl)}>复制</button></div>
  </section>;

  return <section className="content-band">
    <div className="section-heading"><div><h2>面试问题</h2><p>生成后可人工增删改，再发布候选人链接。</p></div>{!editorOpen && <button className="button" onClick={generateQuestions} disabled={busy === "questions"}>{busy === "questions" ? "生成中…" : "生成个性化问题"}</button>}</div>
    {notice && <div className={`notice ${notice.kind}`} role="status">{notice.text}</div>}
    {editorOpen && <>
      {questions.length === 0 ? <div className="empty">当前没有问题，请新增后再发布。</div> : <div className="question-list">{questions.map((question, index) => <div className="question-row" key={question.id}>
        <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
        <div className="question-editor">
          <textarea aria-label={`问题 ${index + 1} 内容`} value={question.text} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))} />
          <div className="question-fields"><input aria-label={`问题 ${index + 1} 考察维度`} placeholder="考察维度（可选）" value={question.dimension} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, dimension: event.target.value } : item))} /><input aria-label={`问题 ${index + 1} 考察目的`} placeholder="考察目的（可选）" value={question.purpose} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, purpose: event.target.value } : item))} /></div>
          <label className="question-required"><input type="checkbox" checked={question.required} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, required: event.target.checked } : item))} />必答</label>
        </div>
        <button className="icon-button" type="button" aria-label={`删除问题 ${index + 1}`} onClick={() => setQuestions((current) => removeQuestion(current, question.id))}>×</button>
      </div>)}</div>}
      <div className="workflow-footer"><button className="button secondary" type="button" onClick={() => setQuestions((current) => [...current, createManualQuestion()])}>+ 新增问题</button><label>整场追问上限 <input type="number" min="0" max="3" value={maxFollowUps} onChange={(event) => setMaxFollowUps(Math.max(0, Math.min(3, Number(event.target.value))))} /></label><button className="button accent" onClick={publishQuestions} disabled={busy === "publish"}>{busy === "publish" ? "发布中…" : "发布答题链接"}</button></div>
      {inviteUrl && <div className="link-box"><input aria-label="候选人答题链接" value={inviteUrl} readOnly /><button className="button secondary" onClick={() => navigator.clipboard.writeText(inviteUrl)}>复制</button></div>}
    </>}
  </section>;
}

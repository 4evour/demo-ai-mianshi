"use client";

import type { Candidate, Job, Question, Report, Session } from "@/lib/types";
import { createManualQuestion, questionPlanSchema, removeQuestion } from "@/lib/question-plan";
import { useEffect, useMemo, useState } from "react";

type CandidateView = Candidate & { session: Session | null; report: Report | null };
type ResumeCorrection = { id: string; sourceText: string; source: "PDF_TEXT" | "OCR"; averageConfidence: number; warnings: string[]; pages: Array<{ page: number; confidence: number }> };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload as T;
}

function evidenceTurnId(evidence: string): string | null {
  return evidence.match(/^\[TURN:([^\]]+)\]/)?.[1] ?? null;
}

export function ReviewerDashboard() {
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("AI 应用开发实习生");
  const [jd, setJd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resumeCorrection, setResumeCorrection] = useState<ResumeCorrection | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false);
  const [maxFollowUps, setMaxFollowUps] = useState(3);
  const [inviteUrl, setInviteUrl] = useState("");
  const [notice, setNotice] = useState<{ text: string; kind?: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const selected = useMemo(() => candidates.find((item) => item.id === selectedId) ?? null, [candidates, selectedId]);

  async function refresh(jobId: string) {
    const data = await api<{ candidates: CandidateView[] }>(`/api/candidates?jobId=${jobId}`);
    setCandidates(data.candidates);
    if (!selectedId && data.candidates[0]) setSelectedId(data.candidates[0].id);
  }

  useEffect(() => {
    void api<{ jobs: Job[] }>("/api/jobs").then((data) => {
      const first = data.jobs[0];
      if (first) {
        setJob(first);
        setTitle(first.title);
        void refresh(first.id);
      }
    }).catch((error) => setNotice({ text: error.message, kind: "warning" }));
  }, []);

  async function createJob(event: React.FormEvent) {
    event.preventDefault();
    setBusy("job"); setNotice(null);
    try {
      const data = await api<{ job: Job }>("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, jd }) });
      setJob(data.job); setCandidates([]); setSelectedId("");
      setNotice({ text: "岗位已创建，DeepSeek 已生成评分维度。", kind: "success" });
    } catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function parseResume(event: React.FormEvent) {
    event.preventDefault();
    if (!job || !file) return;
    setBusy("resume"); setNotice(null);
    try {
      const form = new FormData(); form.append("jobId", job.id); form.append("file", file);
      const data = await api<{ candidate?: Candidate; needsCorrection?: boolean; resumeImport?: ResumeCorrection }>("/api/resumes/parse", { method: "POST", body: form });
      setFile(null);
      if (data.needsCorrection && data.resumeImport) {
        setResumeCorrection(data.resumeImport);
        setNotice({ text: "扫描件已完成 OCR，但识别结果需要人工确认。确认前不会发送给 DeepSeek。", kind: "warning" });
      } else if (data.candidate) {
        setResumeCorrection(null); await refresh(job.id); setSelectedId(data.candidate.id);
        setNotice({ text: "简历已解析。模型只接收脱敏文本，原文保存在本地试验数据中。", kind: "success" });
      }
    } catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function correctResume(event: React.FormEvent) {
    event.preventDefault();
    if (!job || !resumeCorrection) return;
    setBusy("correction"); setNotice(null);
    try {
      const data = await api<{ candidate: Candidate }>("/api/resumes/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: resumeCorrection.id, correctedText: resumeCorrection.sourceText }),
      });
      setResumeCorrection(null); await refresh(job.id); setSelectedId(data.candidate.id);
      setNotice({ text: "修正文本已确认并完成脱敏解析。", kind: "success" });
    } catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function generateQuestionPlan() {
    if (!selected) return;
    setBusy("questions"); setNotice(null);
    try {
      const data = await api<{ questions: Question[] }>("/api/questions/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: selected.id }) });
      setQuestions(data.questions); setQuestionEditorOpen(true); setInviteUrl("");
      setNotice({ text: "问题已生成，请审核、修改后发布。", kind: "success" });
    } catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function publishQuestions() {
    if (!selected) return;
    const parsed = questionPlanSchema.safeParse(questions);
    if (!parsed.success) {
      setNotice({ text: parsed.error.issues[0]?.message ?? "请检查问题列表", kind: "warning" });
      return;
    }
    setBusy("publish"); setNotice(null);
    try {
      const data = await api<{ session: { token: string } }>("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: selected.id, questions: parsed.data, maxFollowUps }) });
      setInviteUrl(`${window.location.origin}/candidate/${data.session.token}`);
      await refresh(job!.id); setNotice({ text: "一次性答题链接已生成。", kind: "success" });
    } catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function generateReport() {
    if (!selected?.session) return;
    setBusy("report"); setNotice(null);
    try {
      await api("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: selected.session.id }) });
      await refresh(job!.id); setNotice({ text: "AI 报告已生成，请结合证据进行人工判断。", kind: "success" });
    } catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  async function saveDecision(decision: "ADVANCED" | "REJECTED" | "ON_HOLD") {
    if (!selected) return;
    setBusy("decision");
    try { await api("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: selected.id, decision, note }) }); await refresh(job!.id); setNotice({ text: "人工决策已保存。", kind: "success" }); }
    catch (error) { setNotice({ text: (error as Error).message, kind: "warning" }); }
    finally { setBusy(""); }
  }

  return <div className="shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">筛</div><div><h1>候选人筛选工作台</h1><p>独立 MVP · DeepSeek 辅助分析</p></div></div><div className="top-meta">AI 只提供建议，最终决定由审核员完成</div></header>
    <main className="workspace">
      <div className="page-intro"><div><p className="eyebrow">Screening MVP</p><h2>把简历、问答和证据放在一起判断</h2><p>先创建一个岗位，再上传一份简历走通完整链路。当前版本面向本地试验，数据保存在服务端 `data/`。</p></div></div>
      {notice && <div className={`notice ${notice.kind === "success" ? "success" : "warning"}`} role="status">{notice.text}</div>}
      <div className="layout-grid" style={{ marginTop: 20 }}>
        <div className="stack">
          <section className="panel"><div className="panel-header"><h3>01 / 创建岗位</h3><span>{job ? "已配置" : "等待输入"}</span></div>
            <form onSubmit={createJob}><div className="field"><label htmlFor="title">岗位名称</label><input id="title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="field"><label htmlFor="jd">岗位 JD</label><textarea id="jd" value={jd} onChange={(event) => setJd(event.target.value)} placeholder="粘贴岗位职责、技术要求和工作内容，至少 30 个字符。" required /><small>DeepSeek 会从 JD 生成要求和评分维度。</small></div><button className="button accent" disabled={busy === "job"}>{busy === "job" ? "解析中…" : job ? "重新解析岗位" : "解析并创建岗位"}</button></form>
          </section>
          {job && <section className="panel"><div className="panel-header"><h3>02 / 上传简历</h3><span>文本 PDF + 扫描件 OCR</span></div><form onSubmit={parseResume}><div className="field"><label htmlFor="resume">PDF 简历</label><input id="resume" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /><small>原文和 OCR 文本只保存在本地；发送给模型前会脱敏姓名、邮箱、手机号和学校。</small></div><button className="button" disabled={busy === "resume" || !file}>{busy === "resume" ? "解析中…" : "上传并解析"}</button></form></section>}
          {resumeCorrection && <section className="panel"><div className="panel-header"><h3>确认 OCR 文本</h3><span>{Math.round(resumeCorrection.averageConfidence * 100)}% 置信度</span></div><form onSubmit={correctResume}><div className="notice warning" style={{ marginBottom: 14 }}>{resumeCorrection.warnings.join("；") || "请核对识别文本"}</div><div className="field"><label htmlFor="ocr-text">识别文本</label><textarea id="ocr-text" value={resumeCorrection.sourceText} onChange={(event) => setResumeCorrection((current) => current ? { ...current, sourceText: event.target.value } : current)} /><small>共 {resumeCorrection.pages.length} 页。确认后才会脱敏并发送给 DeepSeek 结构化。</small></div><div className="button-row"><button className="button accent" disabled={busy === "correction"}>{busy === "correction" ? "解析中…" : "确认文本并解析"}</button><button className="button secondary" type="button" onClick={() => setResumeCorrection(null)}>取消</button></div></form></section>}
          {job && <section className="panel"><div className="panel-header"><h3>岗位评分量表</h3><span>{job.dimensions.length} 个维度</span></div><div className="dimension-list">{job.dimensions.map((item) => <div className="dimension" key={item.name}><div className="dimension-head"><span style={{ color: "var(--ink)" }}>{item.name}</span><span>{item.weight}%</span></div><p>{item.description}</p></div>)}</div></section>}
        </div>
        <div className="stack">
          <section className="panel"><div className="panel-header"><h3>候选人</h3><span>{candidates.length} 人</span></div>{candidates.length === 0 ? <div className="empty">上传第一份简历后，候选人会出现在这里。</div> : <div className="candidate-list">{candidates.map((candidate) => <button className={`candidate-item ${candidate.id === selectedId ? "active" : ""}`} key={candidate.id} onClick={() => { setSelectedId(candidate.id); setQuestions([]); setQuestionEditorOpen(false); setInviteUrl(candidate.session ? `${window.location.origin}/candidate/${candidate.session.token}` : ""); }}><span><strong>{candidate.name}</strong><small>{candidate.email || "未识别邮箱"}</small></span><span className={`status ${candidate.status}`}>{candidate.status}</span></button>)}</div>}</section>
          {selected && <section className="panel"><div className="panel-header"><h3>候选人档案</h3><span>{selected.resume.projects?.length ?? 0} 个项目</span></div><div className="job-summary"><p className="helper">{selected.resume.summary || "暂无摘要"}</p>{selected.resume.extraction && <p className="helper">来源：{selected.resume.extraction.source === "OCR" ? "扫描件 OCR" : "PDF 文本层"} · 置信度 {Math.round(selected.resume.extraction.averageConfidence * 100)}%</p>}{selected.resume.education && selected.resume.education.length > 0 && <div><h4>教育背景</h4>{selected.resume.education.map((item) => <p className="helper" key={`${item.school}-${item.period}`}><b>{item.school}</b> · {item.major}{item.degree ? `（${item.degree}）` : ""}{item.period ? ` · ${item.period}` : ""}</p>)}</div>}<div><h4>专业技能</h4><div className="tag-list">{(selected.resume.skills ?? []).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div>{selected.resume.projects?.map((project) => <div className="project-detail" key={project.name}><div className="dimension-head"><span style={{ color: "var(--ink)" }}>{project.name}</span>{project.role && <span>{project.role}</span>}</div>{project.description && <p>{project.description}</p>}{project.technologies.length > 0 && <div className="tag-list">{project.technologies.map((technology) => <span className="tag" key={technology}>{technology}</span>)}</div>}{project.claims.length > 0 && <ul className="project-claims">{project.claims.map((claim) => <li key={claim}>{claim}</li>)}</ul>}</div>)}{selected.resume.honors && selected.resume.honors.length > 0 && <div><h4>荣誉证书</h4><ul className="project-claims">{selected.resume.honors.map((honor) => <li key={honor}>{honor}</li>)}</ul></div>}{selected.resume.artifactLinks?.length > 0 && <div><p className="helper">公开作品链接</p>{selected.resume.artifactLinks.map((link) => <a className="helper" style={{ display: "block", color: "var(--accent)" }} href={link} target="_blank" rel="noreferrer" key={link}>{link}</a>)}</div>}<button className="button" onClick={generateQuestionPlan} disabled={busy === "questions"}>{busy === "questions" ? "生成中…" : "生成个性化问题"}</button></div></section>}
          {selected && questionEditorOpen && <section className="panel">
            <div className="panel-header"><h3>03 / 审核问题并发布</h3><span>{questions.length} 道题</span></div>
            {questions.length === 0 ? <div className="empty">当前没有问题，请新增后再发布。</div> : <div className="question-list">{questions.map((question, index) => <div className="question-row" key={question.id}>
              <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="question-editor">
                <textarea aria-label={`问题 ${index + 1} 内容`} placeholder="输入问题内容" value={question.text} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))} />
                <div className="question-fields">
                  <input type="text" aria-label={`问题 ${index + 1} 考察维度`} placeholder="考察维度（可选）" value={question.dimension} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, dimension: event.target.value } : item))} />
                  <input type="text" aria-label={`问题 ${index + 1} 考察目的`} placeholder="考察目的（可选）" value={question.purpose} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, purpose: event.target.value } : item))} />
                </div>
                <label className="question-required"><input type="checkbox" checked={question.required} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, required: event.target.checked } : item))} />必答</label>
              </div>
              <button className="icon-button" type="button" aria-label={`删除问题 ${index + 1}`} title="删除问题" onClick={() => setQuestions((current) => removeQuestion(current, question.id))}>×</button>
            </div>)}</div>}
            <div className="button-row question-actions"><button className="button secondary" type="button" onClick={() => setQuestions((current) => [...current, createManualQuestion()])}>+ 新增问题</button></div>
            <div className="field follow-up-setting"><label htmlFor="max-follow-ups">整场追问上限</label><input id="max-follow-ups" type="number" min="0" max="3" value={maxFollowUps} onChange={(event) => setMaxFollowUps(Math.max(0, Math.min(3, Number(event.target.value))))} /><small>单个主问题最多追问 2 次。</small></div>
            <div className="button-row" style={{ marginTop: 16 }}><button className="button accent" onClick={publishQuestions} disabled={busy === "publish"}>{busy === "publish" ? "发布中…" : "确认并生成候选人链接"}</button></div>
            {inviteUrl && <div style={{ marginTop: 14 }}><div className="link-box"><input value={inviteUrl} readOnly aria-label="候选人答题链接" /><button className="button secondary" onClick={() => navigator.clipboard.writeText(inviteUrl)}>复制</button></div><a className="helper" style={{ display: "block", marginTop: 8, color: "var(--accent)" }} href={inviteUrl} target="_blank" rel="noreferrer">在新标签页打开候选人页面</a></div>}
          </section>}
          {selected?.session && <section className="panel"><div className="panel-header"><h3>面试时间线</h3><span>{selected.session.followUpCount ?? 0} / {selected.session.maxFollowUps ?? 3} 次追问</span></div>{selected.session.needsManualReview && <div className="notice warning" style={{ marginBottom: 14 }}>需要人工复核：{(selected.session.reviewReasons ?? []).join("；")}</div>}<div className="timeline">{(selected.session.turns ?? []).map((turn) => <div id={`turn-${turn.id}`} className={`timeline-item ${turn.kind === "FOLLOW_UP" ? "follow-up" : ""}`} key={turn.id}><div className="timeline-meta"><span>{turn.kind === "MAIN" ? "主问题" : "AI 追问"}</span><span>{turn.reason ?? turn.dimension}</span><code>{turn.id.slice(0, 8)}</code></div><p className="timeline-question">{turn.text}</p>{turn.status === "ANSWERED" ? <p className="timeline-answer">{turn.disposition === "DECLINED" ? "候选人选择不回答" : turn.answer}</p> : <p className="helper">等待候选人回答</p>}{turn.modelError && <p className="helper">模型降级：{turn.modelError}</p>}</div>)}</div></section>}
          {selected?.session?.status === "SUBMITTED" && !selected.report && <section className="panel"><div className="panel-header"><h3>04 / 生成报告</h3><span>候选人已提交</span></div><p className="helper">报告会引用脱敏简历和具体问答。没有证据的维度会标为待确认。</p><button className="button accent" onClick={generateReport} disabled={busy === "report"}>{busy === "report" ? "分析中…" : "调用 DeepSeek 生成报告"}</button></section>}
          {selected?.report && <section className="panel"><div className="panel-header"><h3>报告与人工决策</h3><span>{selected.report.humanDecision ? "已决策" : "待审核"}</span></div><div className="report-score"><div className="score">{selected.report.totalScore}<span>证据调整后总分</span></div><p className="report-summary">{selected.report.summary}</p></div><div className="dimension-list">{selected.report.dimensions.map((item) => <div className="dimension" key={item.name}><div className="dimension-head"><span style={{ color: "var(--ink)" }}>{item.name}</span><span>{item.level}/4 · {Math.round(item.evidenceConfidence * 100)}%</span></div><p>{item.reason}</p><ul className="evidence">{item.evidence.map((evidence) => { const turnId = evidenceTurnId(evidence); return <li key={evidence}>{turnId ? <a href={`#turn-${turnId}`}>{evidence}</a> : evidence}</li>; })}</ul></div>)}</div><div className="two-col" style={{ marginTop: 18 }}><div><h4>优势</h4><ul>{selected.report.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h4>待确认</h4><ul>{[...selected.report.gaps, ...selected.report.pendingChecks].map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="field" style={{ marginTop: 16 }}><label htmlFor="note">人工备注</label><textarea id="note" style={{ minHeight: 80 }} value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录改分或最终决策原因。" /></div><div className="button-row"><button className="button accent" onClick={() => saveDecision("ADVANCED")} disabled={busy === "decision"}>进入下一轮</button><button className="button secondary" onClick={() => saveDecision("ON_HOLD")} disabled={busy === "decision"}>待确认</button><button className="button secondary" onClick={() => saveDecision("REJECTED")} disabled={busy === "decision"}>不进入下一轮</button></div></section>}
        </div>
      </div>
    </main>
  </div>;
}

"use client";

import { useState } from "react";

type CreatedJob = { id: string; title: string };

export function NewJobForm() {
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedJob | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setCreated(null);
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, jd }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "创建岗位失败");
      setCreated(payload.job);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <form className="form-surface" onSubmit={submit}>
    <div className="field"><label htmlFor="new-job-title">岗位名称</label><input id="new-job-title" value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
    <div className="field"><label htmlFor="new-job-jd">岗位 JD</label><textarea id="new-job-jd" value={jd} onChange={(event) => setJd(event.target.value)} minLength={30} required /><small>DeepSeek 会从 JD 提取岗位要求和评分维度。</small></div>
    <button className="button accent" disabled={busy}>{busy ? "解析中…" : "解析并创建岗位"}</button>
    {error && <div className="notice warning" role="alert">{error}</div>}
    {created && <div className="notice success" role="status">岗位“{created.title}”已创建。<a href={`/jobs/${created.id}`} target="_blank" rel="noreferrer">在新标签页打开</a></div>}
  </form>;
}

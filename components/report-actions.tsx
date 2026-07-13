"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportActions({ candidateId, sessionId, hasReport }: { candidateId: string; sessionId?: string; hasReport: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function generateReport() {
    if (!sessionId) return;
    setBusy("report"); setError("");
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "报告生成失败");
      router.refresh();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function saveDecision(decision: "ADVANCED" | "REJECTED" | "ON_HOLD") {
    setBusy("decision"); setError("");
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId, decision, note }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存决策失败");
      router.refresh();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  if (!hasReport) return <section className="content-band"><div className="section-heading"><div><h2>生成报告</h2><p>报告会引用脱敏简历和具体问答证据。</p></div></div><button className="button accent" onClick={generateReport} disabled={!sessionId || busy === "report"}>{busy === "report" ? "分析中…" : "调用 DeepSeek 生成报告"}</button>{error && <div className="notice warning" role="alert">{error}</div>}</section>;
  return <section className="content-band"><div className="field"><label htmlFor="decision-note">人工备注</label><textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="button-row"><button className="button accent" onClick={() => saveDecision("ADVANCED")} disabled={busy === "decision"}>进入下一轮</button><button className="button secondary" onClick={() => saveDecision("ON_HOLD")} disabled={busy === "decision"}>待确认</button><button className="button secondary" onClick={() => saveDecision("REJECTED")} disabled={busy === "decision"}>不进入下一轮</button></div>{error && <div className="notice warning" role="alert">{error}</div>}</section>;
}

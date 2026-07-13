"use client";

import { useEffect, useState } from "react";

type Turn = {
  id: string;
  kind: "MAIN" | "FOLLOW_UP";
  text: string;
  required: boolean;
  answer: string;
  reason?: string;
};

type HistoryTurn = Pick<Turn, "id" | "kind" | "text" | "required" | "answer" | "reason"> & { disposition?: "ANSWERED" | "DECLINED" };
type SessionView = {
  status: "INVITED" | "IN_PROGRESS" | "READY_TO_SUBMIT" | "SUBMITTED";
  currentTurn: Turn | null;
  history: HistoryTurn[];
  progress: { currentMainQuestion: number; totalMainQuestions: number; followUpCount: number; maxFollowUps: number };
  jobTitle: string;
  candidateName: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload as T;
}

export function CandidateSession({ token }: { token: string }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState("正在加载");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentTurnId = session?.currentTurn?.id;
  const sessionStatus = session?.status;

  useEffect(() => {
    void request<{ session: SessionView }>(`/api/sessions/${token}`).then((data) => {
      setSession(data.session);
      setAnswer(data.session.currentTurn?.answer ?? "");
      setState(data.session.status === "SUBMITTED" ? "已提交" : "草稿未提交");
    }).catch((reason) => setError(reason.message));
  }, [token]);

  useEffect(() => {
    if (!currentTurnId || sessionStatus === "SUBMITTED" || busy) return;
    const timer = setTimeout(() => {
      void request<{ session: SessionView }>(`/api/sessions/${token}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId: currentTurnId, answer }),
      }).then((data) => {
        setSession(data.session);
        setState("已自动保存");
      }).catch(() => setState("自动保存失败，请手动保存"));
    }, 700);
    return () => clearTimeout(timer);
  }, [answer, busy, currentTurnId, sessionStatus, token]);

  async function saveDraft() {
    const turn = session?.currentTurn;
    if (!turn) return;
    setBusy(true); setError(""); setState("保存中");
    try {
      const data = await request<{ session: SessionView }>(`/api/sessions/${token}/draft`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId: turn.id, answer }),
      });
      setSession(data.session); setState("已保存");
    } catch (reason) { setError((reason as Error).message); setState("未保存"); }
    finally { setBusy(false); }
  }

  async function submitTurn(declined = false) {
    const turn = session?.currentTurn;
    if (!turn) return;
    if (!declined && turn.required && !answer.trim()) { setError("请先填写当前问题的回答。"); return; }
    setBusy(true); setError(""); setState(declined ? "记录中" : "正在分析回答");
    try {
      const data = await request<{ session: SessionView }>(`/api/sessions/${token}/turns/${turn.id}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer, declined }),
      });
      setSession(data.session); setAnswer(data.session.currentTurn?.answer ?? "");
      setState(data.session.status === "READY_TO_SUBMIT" ? "已完成全部问题" : "已进入下一题");
    } catch (reason) { setError((reason as Error).message); setState("未提交"); }
    finally { setBusy(false); }
  }

  async function submitInterview() {
    setBusy(true); setError(""); setState("提交中");
    try {
      const data = await request<{ session: SessionView }>(`/api/sessions/${token}/submit`, { method: "POST" });
      setSession(data.session); setState("已提交");
    } catch (reason) { setError((reason as Error).message); setState("未提交"); }
    finally { setBusy(false); }
  }

  if (error && !session) return <div className="candidate-shell"><main className="candidate-main"><div className="notice warning">{error}</div></main></div>;
  if (!session) return <div className="candidate-shell"><main className="candidate-main"><div className="loading">正在准备答题页面…</div></main></div>;
  if (session.status === "SUBMITTED") return <div className="candidate-shell"><main className="candidate-main"><div className="candidate-header"><p className="eyebrow">{session.jobTitle}</p><h1>回答已提交</h1><p>感谢你的时间。招聘团队会结合回答和岗位要求进行人工审核。</p></div><div className="notice success">本页面已锁定，不能再次修改。</div></main></div>;

  const turn = session.currentTurn;
  return <div className="candidate-shell"><main className="candidate-main">
    <div className="candidate-header"><p className="eyebrow">{session.jobTitle}</p><h1>你好，{session.candidateName}</h1><p>请基于你实际参与过的项目回答。可以描述实现过程、个人贡献、取舍和遇到的问题。</p></div>
    <div className="candidate-progress"><span>主问题 {session.progress.currentMainQuestion} / {session.progress.totalMainQuestions}</span><span>追问 {session.progress.followUpCount} / {session.progress.maxFollowUps}</span><span>{state}</span></div>
    {turn ? <section className="answer-card focus-question"><p className="eyebrow">{turn.kind === "FOLLOW_UP" ? "基于上一回答的追问" : `主问题 ${String(session.progress.currentMainQuestion).padStart(2, "0")}`} · {turn.required ? "必答" : "选答"}</p><h2>{turn.text}</h2><label htmlFor="current-answer">{turn.required ? "你的回答" : "你的回答（选答）"}</label><textarea id="current-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="请写下你的实际经历和思考。" disabled={busy} /><div className="candidate-footer"><span className="save-state">提交本题后将锁定回答</span><div className="button-row"><button className="button secondary" onClick={saveDraft} disabled={busy}>保存进度</button><button className="button secondary" onClick={() => void submitTurn(true)} disabled={busy}>不方便回答</button><button className="button accent" onClick={() => void submitTurn()} disabled={busy}>{busy ? "处理中…" : "提交本题"}</button></div></div></section> : <section className="answer-card focus-question"><p className="eyebrow">全部主问题已完成</p><h2>确认提交本次答题</h2><p className="helper">提交后招聘团队可生成 AI 辅助报告并进行人工审核。</p><div className="candidate-footer"><span className="save-state">{state}</span><button className="button accent" onClick={() => void submitInterview()} disabled={busy}>{busy ? "提交中…" : "确认并提交"}</button></div></section>}
    {session.history.length > 0 && <section className="answer-history"><h2>已完成问答</h2>{session.history.map((item) => <details key={item.id}><summary>{item.kind === "FOLLOW_UP" ? "追问" : "主问题"} · {item.required ? "必答" : "选答"} · {item.disposition === "DECLINED" ? "未回答" : "已完成"}</summary><p><b>{item.text}</b></p><p>{item.answer}</p></details>)}</section>}
    {error && <div className="notice warning" style={{ marginTop: 14 }}>{error}</div>}
  </main></div>;
}

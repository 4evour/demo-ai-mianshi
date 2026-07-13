import Link from "next/link";
import type { ReactNode } from "react";

export function ReviewerShell({ children, eyebrow, title, description, actions }: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <div className="shell">
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">筛</span>
        <span><strong>候选人筛选工作台</strong><small>独立 MVP · DeepSeek 辅助分析</small></span>
      </Link>
      <div className="top-meta">AI 只提供建议，最终决定由审核员完成</div>
    </header>
    <main className="reviewer-page">
      <header className="reviewer-page-header">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {children}
    </main>
  </div>;
}

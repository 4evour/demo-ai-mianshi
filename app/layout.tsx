import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "候选人筛选工作台",
  description: "AI 辅助的候选人线上初筛 MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

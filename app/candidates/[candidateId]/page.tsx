import { CandidateWorkflow } from "@/components/candidate-workflow";
import { ReviewerShell } from "@/components/reviewer-shell";
import { buildCandidateReviewView } from "@/lib/reviewer-data";
import { readStore } from "@/lib/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage({ params }: { params: { candidateId: string } }) {
  const candidate = buildCandidateReviewView(await readStore(), params.candidateId);
  if (!candidate) notFound();
  return <ReviewerShell eyebrow={candidate.job.title} title={candidate.name} description={`${candidate.status} · ${candidate.email || "未识别邮箱"}`} actions={<><a className="button secondary" href={`/candidates/${candidate.id}/interview`} target="_blank" rel="noreferrer">问答记录</a><a className="button accent" href={`/candidates/${candidate.id}/report`} target="_blank" rel="noreferrer">面试报告</a></>}>
    <div className="page-stack">
      <section className="content-band profile-summary"><p>{candidate.resume.summary || "暂无简历摘要"}</p>{candidate.resume.education?.map((item) => <div key={`${item.school}-${item.period}`}><strong>{item.school}</strong><span>{item.major}{item.degree ? `（${item.degree}）` : ""} · {item.period}</span></div>)}</section>
      <section className="content-band"><div className="section-heading"><div><h2>专业技能</h2><p>{candidate.resume.skills.length} 项</p></div></div><div className="tag-list">{candidate.resume.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></section>
      <section className="content-band"><div className="section-heading"><div><h2>项目经历</h2><p>{candidate.resume.projects.length} 个项目，点击展开完整内容</p></div></div><div className="project-accordion">{candidate.resume.projects.map((project) => <details key={project.name}><summary>{project.name}{project.role ? ` · ${project.role}` : ""}</summary>{project.description && <p>{project.description}</p>}<div className="tag-list">{project.technologies.map((technology) => <span className="tag" key={technology}>{technology}</span>)}</div>{project.claims.length > 0 && <ul>{project.claims.map((claim) => <li key={claim}>{claim}</li>)}</ul>}</details>)}</div></section>
      {candidate.resume.honors && candidate.resume.honors.length > 0 && <section className="content-band"><div className="section-heading"><div><h2>荣誉证书</h2></div></div><ul className="compact-list">{candidate.resume.honors.map((honor) => <li key={honor}>{honor}</li>)}</ul></section>}
      <CandidateWorkflow candidate={candidate} />
    </div>
  </ReviewerShell>;
}

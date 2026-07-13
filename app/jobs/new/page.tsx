import { NewJobForm } from "@/components/new-job-form";
import { ReviewerShell } from "@/components/reviewer-shell";

export default function NewJobPage() {
  return <ReviewerShell eyebrow="岗位管理" title="新建岗位" description="输入岗位 JD，生成可审核的要求和评分量表。">
    <NewJobForm />
  </ReviewerShell>;
}

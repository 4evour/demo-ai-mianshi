import { extractJson } from "./json";
import { followUpAiSchema, jobAiSchema, questionsAiSchema, reportAiSchema, resumeAiSchema, type FollowUpAiOutput, type JobAiOutput, type QuestionsAiOutput, type ReportAiOutput, type ResumeAiOutput } from "./schemas";
import type { Candidate, InterviewTurn, Job, Session } from "./types";

export type Message = { role: "system" | "user"; content: string };

async function callDeepSeek<T>(messages: Message[], schema: { parse: (value: unknown) => T }, operation: string): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`DeepSeek ${operation} 失败（${response.status}）：${detail.slice(0, 240)}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error(`DeepSeek ${operation} 返回为空`);
    return schema.parse(extractJson(content));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`DeepSeek ${operation} 超时`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function analyzeJob(title: string, jd: string): Promise<JobAiOutput> {
  return callDeepSeek([
    {
      role: "system",
      content: "你是招聘审核助手。只根据岗位 JD 生成结构化 JSON，不使用年龄、性别、学校层级等敏感属性做判断。输出 requirements、niceToHave、dimensions 三个字段。dimensions 的 weight 总和应为 100，维度数量 4 到 6 个。",
    },
    { role: "user", content: `岗位名称：${title}\n岗位 JD：\n${jd}` },
  ], jobAiSchema, "解析岗位");
}

export function analyzeResume(redactedText: string): Promise<ResumeAiOutput> {
  return callDeepSeek([
    {
      role: "system",
      content: "你是简历解析助手。输入文本已经脱敏。只输出 JSON：summary、skills、projects、honors、artifactLinks。每个 project 必须包含 name、role、description、technologies、claims；原文未说明 role 或 description 时输出空字符串。完整保留每个项目中明确写出的架构、个人实现、量化结果和功能模块，每条独立内容放入 claims，不要只生成概括。honors 收集原文中的竞赛、奖项和证书。不要猜测文本中没有出现的经历，不要把脱敏占位符还原成真实身份。",
    },
    { role: "user", content: `脱敏简历文本：\n${redactedText.slice(0, 30_000)}` },
  ], resumeAiSchema, "解析简历");
}

export function generateQuestions(job: Job, candidate: Candidate): Promise<QuestionsAiOutput> {
  const resume = candidate.resume.redactedText.slice(0, 30_000);
  return callDeepSeek([
    {
      role: "system",
      content: "你是结构化面试出题助手。只输出 JSON questions 数组。问题应验证候选人的实际贡献、实现细节、取舍、排错和边界，不询问敏感属性，不要求泄露前雇主机密。每题包含 text、purpose、dimension、required。",
    },
    {
      role: "user",
      content: `岗位：${job.title}\n岗位要求：${job.requirements.join("；")}\n评分维度：${job.dimensions.map((item) => `${item.name}(${item.weight})`).join("；")}\n脱敏简历：\n${resume}`,
    },
  ], questionsAiSchema, "生成问题");
}

export function buildFollowUpMessages(job: Job, candidate: Candidate, session: Session, turn: InterviewTurn, answer: string): Message[] {
  const relatedHistory = session.turns
    .filter((item) => item.questionId === turn.questionId && item.status === "ANSWERED")
    .map((item) => `${item.kind === "MAIN" ? "主问题" : "追问"}：${item.text}\n回答：${item.answer}`)
    .join("\n\n");
  const remaining = Math.max(0, session.maxFollowUps - session.followUpCount);
  return [
    {
      role: "system",
      content: "你是受控的技术面试追问助手。只输出一个 JSON 动作，格式必须是以下三种之一：{\"action\":\"ASK_FOLLOW_UP\",\"reason\":\"EVIDENCE_GAP\",\"question\":\"具体追问\"}、{\"action\":\"NEXT_QUESTION\",\"reason\":\"SUFFICIENT\"}、{\"action\":\"END_INTERVIEW\",\"reason\":\"SUFFICIENT\"}。reason 必须使用 SHORT_ANSWER、OFF_TOPIC、CONTRIBUTION_UNCLEAR、CLAIM_CONFLICT、EVIDENCE_GAP、DECLINED 或 SUFFICIENT。回答过短、答非所问、个人贡献不清、声明矛盾或关键证据缺失时必须 ASK_FOLLOW_UP。回答提出了具体技术实现但仍可验证深度时，也应优先 ASK_FOLLOW_UP，并只选择一个最有价值的专业知识点，围绕技术原理、关键参数、失败场景、性能边界、方案取舍、量化验证继续深挖。不得泛泛重复原问题，不得询问敏感属性、要求泄露机密或重复已问内容。只有回答已经说明实现细节，并覆盖验证依据、边界或取舍中的至少一项时才 NEXT_QUESTION；只有最后主问题完成时才能 END_INTERVIEW。",
    },
    {
      role: "user",
      content: `岗位：${job.title}\n岗位要求：${job.requirements.join("；")}\n脱敏简历：\n${candidate.resume.redactedText.slice(0, 20_000)}\n当前维度：${turn.dimension}\n当前问题：${turn.text}\n${relatedHistory ? `同一主问题历史：\n${relatedHistory}\n` : ""}当前回答：${answer}\n剩余整场追问次数：${remaining}`,
    },
  ];
}

export function generateFollowUpDecision(job: Job, candidate: Candidate, session: Session, turn: InterviewTurn, answer: string): Promise<FollowUpAiOutput> {
  return callDeepSeek(buildFollowUpMessages(job, candidate, session, turn, answer), followUpAiSchema, "判断动态追问");
}

export function buildReportMessages(job: Job, candidate: Candidate, session: Session): Message[] {
  const qa = (session.turns ?? []).map((turn) => `[TURN:${turn.id}] ${turn.kind === "MAIN" ? "主问题" : "追问"}：${turn.text}\n回答：${turn.answer || "（未回答）"}`).join("\n\n");
  return [
    {
      role: "system",
      content: "你是招聘报告分析助手。只输出 JSON，字段为 summary、dimensions、strengths、gaps、followUps、pendingChecks。dimensions 必须是 JSON 数组，每项必须包含 name、level、evidenceConfidence、reason、evidence；不得把 dimensions 输出成以维度名为键的对象。评分等级 level 为 0 到 4，evidenceConfidence 为 0 到 1；0 表示没有有效证据，4 表示能深入分析边界、失败模式和改进。每条 evidence 必须以 [TURN:实际ID] 或 [RESUME] 开头；不得编造 ID。没有证据时 level 为 0、evidenceConfidence 为 0，并加入 pendingChecks。禁止根据姓名、邮箱、手机号、学校、性别或年龄推断能力。",
    },
    {
      role: "user",
      content: `岗位：${job.title}\n岗位要求：${job.requirements.join("；")}\n评分维度：${job.dimensions.map((item) => `${item.name}（权重 ${item.weight}）：${item.description}`).join("\n")}\n脱敏简历：\n${candidate.resume.redactedText.slice(0, 30_000)}\n\n面试问答：\n${qa}`,
    },
  ];
}

export function validateReportEvidence(report: ReportAiOutput, session: Session): ReportAiOutput {
  const validTurnIds = new Set((session.turns ?? []).map((turn) => turn.id));
  let invalidCount = 0;
  const dimensions = report.dimensions.map((dimension) => {
    const evidence = dimension.evidence.filter((item) => {
      if (item.startsWith("[RESUME]")) return true;
      const turnId = item.match(/^\[TURN:([^\]]+)\]/)?.[1];
      const valid = Boolean(turnId && validTurnIds.has(turnId));
      if (!valid) invalidCount += 1;
      return valid;
    });
    return evidence.length > 0 ? { ...dimension, evidence } : {
      ...dimension,
      level: 0,
      evidenceConfidence: 0,
      reason: "没有可验证的有效证据，需要人工确认。",
      evidence,
    };
  });
  return {
    ...report,
    dimensions,
    pendingChecks: invalidCount > 0
      ? [...report.pendingChecks, `模型返回 ${invalidCount} 条无效证据引用，已移除并需要人工确认。`]
      : report.pendingChecks,
  };
}

export async function generateReport(job: Job, candidate: Candidate, session: Session): Promise<ReportAiOutput> {
  const report = await callDeepSeek(buildReportMessages(job, candidate, session), reportAiSchema, "生成报告");
  return validateReportEvidence(report, session);
}

# ADR-001：基于开源 AI 面试平台构建 MVP

## 状态

Accepted

## 日期

2026-07-12

## 背景

项目需要在 1～2 周内交付单岗位、约 100 位候选人的文字初筛 MVP。核心功能包括问题编辑、一次性面试链接、动态追问、报告、简历解析、JD 匹配、公开作品验证、证据评分和人工审核。

从零开发 React 前端、FastAPI 后端、认证、会话、异步任务和审核页面，会把大量时间用于通用 Web 能力，压缩证据链和评分机制的实现时间。调研发现 MIT 许可的 `yuanzhongqiao/ai-interview-platform` 已提供 Next.js、Supabase、问题编辑、候选人会话、文字追问和报告页面，与 MVP 的通用壳层高度重合。

## 决策

Fork `ai-interview-platform` 并锁定提交版本，将代码维护在 `4evour/demo-ai-mianshi`。保留 Next.js 14、React 18、TypeScript、tRPC、Supabase、问题编辑、分享链接、文字面试和报告 UI。

新增 BullMQ Worker、LangGraph.js、PDF.js、PaddleOCR、GitHub 只读采集器和证据评分模块。关闭语音、视频、反作弊和复杂组织能力。

以下模块必须重写：

- 简历解析：先在本地规则层提取和脱敏身份信息，禁止把完整身份数据发送给 DeepSeek。
- 会话推进：使用 Zod 校验的结构化动作代替自由文本标记。
- 评分：使用冻结量表、证据 ID、证据系数和确定性计算代替简单平均分。
- 项目真实性：新增声明—证据关系、GitHub 只读采集、矛盾和证据不足状态。

## 替代方案

### 从零搭建 React + FastAPI

- 优点：Python AI/OCR 生态成熟，边界干净，不继承开源项目历史设计。
- 缺点：需要重新实现认证、候选人会话、问题编辑、审核报告和前后端契约。
- 结论：更适合 3～4 周以上项目，不满足当前 1～2 周约束。

### 全部使用低代码 LLM 工作流平台

- 优点：Prompt 和节点编排速度快。
- 缺点：候选人状态、人工审核、证据关系、PII 隔离和定制 UI 难以可靠表达。
- 结论：不作为核心系统，可用于内部 Prompt 实验。

### 直接部署开源面试平台

- 优点：最快获得可演示界面。
- 缺点：当前简历解析会向模型发送身份信息，评分缺少证据追溯，无法验证项目真实性。
- 结论：只能作为壳层，不能原样上线。

## 后果

- 单人 10 个工作日内交付完整主流程的可行性提高。
- 团队需要维护 TypeScript Worker 和一个独立 PaddleOCR 容器。
- 继承开源项目升级成本；MVP 阶段必须固定版本，避免同步上游大改。
- Fork 后需要保留 MIT 许可证和版权声明，并建立上游安全补丁跟踪机制。
- Supabase 服务角色、DeepSeek Key 和 GitHub 只读凭证只能存在于服务端环境。
- 若后续证据处理规模或 Python 算法需求显著增加，可将 Worker 独立迁移到 Python 服务，不影响 Web 和数据契约。

## 参考

- https://github.com/yuanzhongqiao/ai-interview-platform
- https://github.com/4evour/demo-ai-mianshi
- https://github.com/srbhr/Resume-Matcher
- https://api-docs.deepseek.com/guides/json_mode
- https://docs.langchain.com/oss/javascript/langgraph/interrupts
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

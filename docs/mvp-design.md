# 独立招聘筛选 MVP 设计

## 目标

提供一条可实际试验的招聘筛选链路：审核员输入岗位 JD、上传 PDF 简历、生成个性化问题并发布候选人链接；候选人通过链接逐题完成文字答题，DeepSeek 根据回答决定是否追问；服务最终生成带证据摘要的评分报告。

本版本是单机试验服务，优先验证产品流程和 AI 输出，不依赖现有 `demo-ai-mianshi`、Supabase、Redis 或队列系统。

## 范围

### 本版本包含

- 审核员工作台：岗位、候选人、问题计划、报告。
- DeepSeek JD 结构化和评分维度生成。
- 普通文本 PDF 的本地文本提取。
- 扫描件 PDF 的本地 PaddleOCR 降级识别。
- 发送给 DeepSeek 前的姓名、邮箱、手机号和学校字段脱敏。
- 简历项目和公开作品链接提取。
- 个性化问题生成，审核员可编辑和发布。
- 聚焦式逐题答题、当前题草稿保存和最终提交。
- 受控动态追问，审核员可配置整场 0～3 次追问。
- 基于回答的 AI 建议评分、证据摘要和待确认项。
- 本地 JSON 文件持久化。

### 本版本不包含

- 用户认证、多租户、Supabase、Redis 和异步任务。
- GitHub API 或其他外部作品采集器。
- 候选人代码执行、自动淘汰或自动录用。
- 语音、视频、反作弊和跨候选人知识库。

## 技术方案

- Next.js 14 App Router + TypeScript。
- 服务端通过 `fetch` 调用 DeepSeek OpenAI-compatible API。
- 使用 `pdf-parse` 提取 PDF 文本，使用 `zod` 校验 AI JSON。
- 独立的本地 Python/PaddleOCR 服务处理无文本层或文本过少的 PDF，服务只允许 Next.js 服务端访问。
- `data/*.json` 存储岗位、候选人、会话和报告，服务启动时自动创建目录。
- 审核员页面使用同源 API；候选人页面只通过随机 token 访问对应会话。

## 数据流

```text
JD -> DeepSeek -> 岗位要求与评分维度
PDF -> pdf-parse -> 文本质量检测
                    | 正常 -> 逐页文本
                    | 无文本/文本过少 -> 本地 PaddleOCR -> 逐页文本与置信度
逐页文本 -> PII 识别与脱敏 -> DeepSeek -> 候选人/项目/链接
JD + 脱敏简历 -> DeepSeek -> 问题计划 -> 审核员配置追问上限并发布
当前问题 + 当前回答 + 相关脱敏上下文 -> DeepSeek -> ASK_FOLLOW_UP / NEXT_QUESTION / END_INTERVIEW
全部主问题与追问 -> DeepSeek -> 建议分/证据/待确认项 -> 本地总分
```

## 简历 OCR 降级

服务先使用 `pdf-parse` 读取文本层；文本为空、字符量低于配置阈值或可读字符比例异常时，才把原始 PDF 发送给本地 PaddleOCR 服务。OCR 服务返回逐页文本、页码、平均置信度和异常信息，不负责调用外部模型。

- 原始 PDF、页面图片和未脱敏 OCR 文本不离开本地环境。
- PDF 页面在 OCR 容器内栅格化为内存图像，不写入持久文件。
- PDF 大小和页数受配置限制，超限后转人工处理。
- OCR 失败或置信度低时标记为 `NEEDS_CORRECTION`，审核员可修改或粘贴文本后重新解析。
- 只有通过 PII 识别和脱敏后的文本可以发送给 DeepSeek。

## 动态追问

候选人页面采用聚焦式逐题卡片，每屏只展示当前主问题或追问。顶部持续显示主问题进度、追问次数和草稿保存状态；已完成问答以只读折叠记录展示。单题提交后回答锁定，因为后续追问分支已经依赖该回答。

会话保留审核员发布的 `questions`，并新增运行时 `turns`、`currentQuestionIndex`、`followUpCount`、`maxFollowUps` 和 `needsManualReview`。每个 turn 记录主问题或追问、回答、顺序、触发关系和追问原因，使报告能够引用具体 `turnId`。

审核员工作台展示完整问答时间线，区分主问题、AI 追问和候选人回答。每条追问显示触发原因；模型降级跳过的节点显示“需要人工复核”，不能伪装为正常判断。

动态追问 Agent 只允许三个动作：

- `ASK_FOLLOW_UP`：围绕当前主问题追加一条追问。
- `NEXT_QUESTION`：进入下一道审核员已发布的主问题。
- `END_INTERVIEW`：主问题完成后进入最终确认页。

允许的追问原因限定为回答过短、答非所问、个人贡献不清、声明矛盾和关键证据缺失。单个主问题最多追问 2 次，整场默认最多 3 次，由审核员在 0～3 之间配置。候选人明确拒答时记录 `DECLINED` 并进入下一题，不继续施压。达到任一上限时，服务端强制把追问动作降为 `NEXT_QUESTION`。

DeepSeek 超时、空响应或输出不符合 Schema 时，服务保留当前回答、设置 `needsManualReview` 并进入下一题，不能阻塞候选人完成答题。

## API

- `POST /api/jobs`：创建岗位并调用 DeepSeek 结构化 JD。
- `GET /api/jobs`：读取当前试验岗位。
- `POST /api/resumes/parse`：上传 PDF，提取并脱敏后调用 DeepSeek。
- `POST /api/questions/generate`：生成问题计划。
- `POST /api/sessions`：创建带随机 token 的候选人逐题答题会话。
- `GET /api/sessions/:token`：读取候选人会话。
- `PUT /api/sessions/:token/draft`：只保存当前题草稿。
- `POST /api/sessions/:token/turns/:turnId/answer`：提交并锁定当前题，返回受控追问或下一题。
- `POST /api/sessions/:token/submit`：完成最终确认并提交整场会话。
- `POST /api/reports/generate`：调用 DeepSeek 生成评分报告。

PaddleOCR 服务只提供内部接口 `POST /ocr`，接收 PDF，完成页面栅格化和 OCR 后返回逐页文本、页码、平均置信度和异常列表。该接口不暴露给浏览器。

## AI 约束

- API Key 只在服务端读取，浏览器不接触密钥。
- 姓名、邮箱、手机号和学校在进入模型前替换为 `[REDACTED_*]`。
- 模型只生成建议，不改变候选人最终状态。
- 每个 JSON 输出都经过 Zod 校验；失败时返回错误，不使用伪造结果。
- 动态追问只接收受控动作、枚举原因和可选追问文本，服务端负责执行上限和状态校验。
- 报告提示词要求区分“候选人自述”“问答证据”和“待确认”，禁止无证据补全。

## 验收标准

1. `npm run dev` 可以启动服务，审核员首页可打开。
2. 普通文本 PDF 不调用 OCR；扫描件 PDF 自动调用本地 PaddleOCR，并保留页码和置信度。
3. OCR 失败、低置信度和文件超限时进入人工修正，不把乱码发送给 DeepSeek。
4. 配置 `DEEPSEEK_API_KEY` 后，JD、简历、问题、动态追问和报告五个 AI 节点均能真实调用 DeepSeek。
5. 简历和追问请求发送前不包含原始姓名、邮箱、手机号和学校。
6. 候选人链接可以逐题自动保存、提交回答、触发受控追问并最终提交。
7. 追问符合单题最多 2 次、整场最多 3 次、拒答后停止和模型失败不阻塞的约束。
8. 报告包含维度分数、理由、证据摘要、待确认项，并能引用主问题和追问的 `turnId`。
9. 无 API Key 或模型返回非法 JSON 时，页面显示可理解的错误或按动态追问降级规则继续。
10. 核心脱敏、OCR 分流、JSON 解析、追问状态机、评分和会话状态测试通过，生产构建通过。

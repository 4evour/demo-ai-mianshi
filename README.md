# Screening MVP

独立的 AI 候选人线上初筛 MVP。项目用于验证一条招聘筛选流程：审核员创建岗位、上传候选人 PDF 简历、生成并审核个性化问题，候选人通过一次性链接逐题作答，系统基于简历和问答生成带证据的 AI 评估报告，最终由审核员做人工决策。

本项目就是当前仓库中的独立 MVP，用于本地试验和演示；它不接入认证、多租户、Supabase、Redis、异步队列或外部 GitHub 采集器。

## 项目用途

- 验证“简历解析 + AI 追问 + 证据化报告”的招聘初筛产品链路。
- 帮审核员把岗位要求、简历项目、候选人回答和 AI 建议放在同一个工作台里审阅。
- 用本地 PaddleOCR 处理扫描件 PDF，避免扫描简历直接解析失败。
- 在调用 DeepSeek 前脱敏姓名、邮箱、手机号和学校，减少隐私信息外发。
- 通过受控状态机限制动态追问，避免模型无限追问、越权改状态或阻塞候选人提交。

## 核心角色

### 审核员

审核员负责创建岗位、上传简历、审核问题、发布候选人链接、查看问答时间线、生成报告，并做最终人工决策。AI 只提供结构化、追问和评分建议，不自动录用或淘汰候选人。

### 候选人

候选人通过随机 token 链接进入答题页。页面一次只展示当前问题，支持当前题草稿保存。单题提交后答案锁定，系统可能基于回答追加追问，也可能进入下一题。所有主问题完成后候选人确认并提交整场会话。

## 端到端流程

1. 审核员创建岗位，填写岗位名称和 JD。
2. 服务端调用 DeepSeek，从 JD 中提取岗位要求、加分项和评分维度。
3. 审核员上传候选人 PDF 简历。
4. 系统优先使用 `pdf-parse` 读取 PDF 文本层。
5. 如果文本为空、过短或质量异常，服务端调用本地 PaddleOCR 服务识别扫描件。
6. OCR 低置信度或失败时，系统进入人工修正流程；确认前不会把文本发送给 DeepSeek。
7. 简历文本通过后，系统先做姓名、邮箱、手机号和学校脱敏，再调用 DeepSeek 结构化候选人信息、项目经历和公开作品链接。
8. 审核员生成个性化问题，手动编辑、删除或新增问题，并配置整场追问上限。
9. 系统生成候选人一次性答题链接。
10. 候选人逐题作答；每次提交后，DeepSeek 只能返回受控动作：追问、下一题或结束。
11. 服务端状态机会再次校验追问上限、当前题、重复提交和拒答规则。
12. 候选人完成全部主问题和追问后提交整场会话。
13. 审核员生成 AI 报告；报告引用具体问答 turn 或简历证据。
14. 审核员结合报告、证据和人工备注，选择进入下一轮、待确认或不进入下一轮。

## AI 与安全边界

- DeepSeek API Key 只在服务端读取，浏览器不接触密钥。
- 原始 PDF、OCR 页面图像和未脱敏 OCR 文本不发送给 DeepSeek。
- 姓名、邮箱、手机号和学校在进入模型前替换为 `[REDACTED_*]`。
- 模型输出必须通过 Zod Schema 校验；非法 JSON 或缺字段会被拒绝。
- 动态追问只允许 `ASK_FOLLOW_UP`、`NEXT_QUESTION`、`END_INTERVIEW` 三类动作。
- 单个主问题最多追问 2 次，整场追问上限由审核员在 0 到 3 次之间配置。
- 候选人拒答时记录 `DECLINED` 并进入下一题，不继续施压。
- 模型超时、空响应或格式错误不会阻塞答题；系统会标记人工复核并继续流程。
- AI 报告只作为建议，最终决策必须由审核员保存。

## 技术架构

- 前端与服务端：Next.js 14 App Router + React + TypeScript。
- AI 调用：服务端通过 OpenAI-compatible HTTP API 调用 DeepSeek。
- PDF 文本：`pdf-parse`。
- AI JSON 校验：`zod`。
- OCR：独立 Python FastAPI + PaddleOCR 服务。
- 本地数据：`data/*.json`，由服务端读写，适合本地 MVP 试验。
- 候选人访问：随机 token 会话链接，不提供账号体系。

## 主要目录

```text
app/                  Next.js 页面和 API 路由
components/           审核员工作台、候选人答题页等 UI 组件
lib/                  AI 调用、状态机、简历解析、评分、存储和 Schema
ocr-service/          本地 PaddleOCR 服务
tests/                Node 测试
docs/                 MVP 设计、实施计划和交互规格
data/                 本地运行数据，默认被 .gitignore 排除
```

## 启动方式

先安装 Node 依赖：

```powershell
npm install
```

复制环境变量模板：

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local`，至少填写 `DEEPSEEK_API_KEY`。普通文本 PDF 不依赖 OCR 服务；如果要处理扫描件，需要启动本地 PaddleOCR 服务。

启动 OCR 服务：

```powershell
docker build -t screening-mvp-ocr ./ocr-service
docker run --rm --name screening-mvp-ocr -p 127.0.0.1:8001:8000 screening-mvp-ocr
```

首次处理扫描件时，PaddleOCR 会下载官方模型。随后启动 Next.js：

```powershell
npm run dev
```

打开 <http://localhost:3001>。

## 环境变量

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
NEXT_PUBLIC_APP_URL=http://localhost:3001
OCR_SERVICE_URL=http://localhost:8001
OCR_TIMEOUT_MS=120000
OCR_MIN_CONFIDENCE=0.65
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务，端口 3001 |
| `npm test` | 运行 TypeScript/Node 测试 |
| `npm run build` | 运行 Next.js 生产构建 |
| `npm start` | 启动生产模式服务，端口 3001 |
| `python -m unittest discover -s ocr-service/tests` | 运行 OCR 服务单元测试 |

## 主要 API

- `POST /api/jobs`：创建岗位并结构化 JD。
- `GET /api/jobs`：读取岗位列表。
- `POST /api/resumes/parse`：上传 PDF 简历，执行文本提取、OCR 分流、脱敏和结构化解析。
- `POST /api/resumes/correct`：确认人工修正后的 OCR 文本并继续解析。
- `POST /api/questions/generate`：为候选人生成个性化问题。
- `POST /api/sessions`：发布候选人答题会话并生成随机 token。
- `GET /api/sessions/:token`：读取候选人公开会话。
- `PUT /api/sessions/:token/draft`：保存当前题草稿。
- `POST /api/sessions/:token/turns/:turnId/answer`：提交当前题答案并执行受控追问决策。
- `POST /api/sessions/:token/submit`：提交整场答题。
- `POST /api/reports`：生成 AI 评估报告。
- `POST /api/reviews`：保存审核员人工决策。

## 报告证据规则

报告证据使用两类引用：

- `[TURN:<id>]`：引用候选人某一道主问题或追问的实际回答。
- `[RESUME]`：引用简历中的项目、技能、教育或公开作品信息。

服务端会移除不存在的 turn 引用。缺少可靠证据的维度会降低证据置信度，并进入待确认项。

## 当前限制

- 只适合本地 MVP 试验，不是生产招聘系统。
- 没有用户登录、权限隔离、多租户和审计日志。
- 本地 JSON 存储不适合多人并发写入。
- OCR 服务需要本地 Docker/Python 环境支持。
- 不执行候选人代码，不自动验证 GitHub 项目真实性。
- AI 结果可能出错，必须由审核员结合证据复核。

## 验证

```powershell
python -m unittest discover -s ocr-service/tests
npm test
npm run build
```

PaddleOCR Python 集成遵循官方 `PaddleOCR(...).predict(...)` 接口：<https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/OCR.html>。文件上传使用 FastAPI `UploadFile`：<https://fastapi.tiangolo.com/tutorial/request-files/>。

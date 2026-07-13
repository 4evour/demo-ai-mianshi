# 独立招聘筛选 MVP 实施计划

## 实施状态

2026-07-13 已完成 OCR 服务代码、OCR 分流与人工纠错、动态追问状态机、逐题 API、候选人页面、审核时间线和报告证据校验。Python 单元测试、43 项 Node 测试和 Next.js 生产构建通过。Docker CLI 已安装，但本机 Docker Desktop 未启动 Linux 引擎，`docker build` 的实际镜像验证仍待宿主引擎恢复后执行。

## 概述

在现有 `screening-mvp` 主链路上补齐两个已确认的 P0 能力：文本 PDF 失败时使用本地 PaddleOCR 降级识别；候选人采用聚焦式逐题答题，并由受控状态机执行 DeepSeek 动态追问。实现保持单岗位、本地 JSON 存储和人工最终决策，不接入 GitHub、认证、数据库或队列。

## 架构决策

- 文本 PDF 始终先走 `pdf-parse`；只有文本质量检测不通过时才调用 OCR。
- PaddleOCR 运行在独立的本地 Python 容器中，通过仅服务端可用的 `POST /ocr` 接口访问。
- 动态追问由确定性状态机执行；DeepSeek 只能建议 `ASK_FOLLOW_UP`、`NEXT_QUESTION` 或 `END_INTERVIEW`。
- 主问题计划与运行时问答分离：`questions` 保持审核员发布内容，`turns` 保存实际主问题、追问和回答。
- 候选人只可修改当前题草稿；单题提交后锁定，避免追问分支与证据失效。
- 每个行为变化先写失败测试，再实现最小代码使其通过。

## 依赖关系

```text
OCR 服务冒烟验证 -> OCR 客户端与文本分流 -> 简历上传与人工纠错

会话状态机 -> DeepSeek 受控动作 -> 答案/草稿/提交 API
                                      -> 候选人逐题界面
                                      -> 审核时间线与证据报告

两条链路完成 -> 端到端验证与文档更新
```

## 阶段一：优先验证高风险基础

### 任务 1：建立 PaddleOCR 本地服务

**说明：** 创建最小 Python HTTP 服务，接收 PDF，限制大小和页数，逐页栅格化并调用 PaddleOCR，返回页码、文本、置信度和异常列表。临时图片必须在请求结束后清理。

**验收标准：**

- [ ] 健康检查能区分服务可用和模型未就绪。
- [ ] 文本夹具或扫描 PDF 夹具可以返回逐页 OCR 结果。
- [ ] 超限、损坏 PDF 和 OCR 异常返回稳定错误结构，临时文件被删除。

**验证：**

- [ ] Python 测试：`python -m unittest discover -s ocr-service/tests`
- [ ] 容器构建：`docker build -t screening-mvp-ocr ./ocr-service`
- [ ] 手动冒烟：`docker run --rm -p 8001:8000 screening-mvp-ocr` 后调用健康检查和一次本地 OCR 请求。

**依赖：** 无。

**预计涉及文件：**

- `ocr-service/app.py`
- `ocr-service/ocr.py`
- `ocr-service/requirements.txt`
- `ocr-service/tests/test_ocr.py`
- `ocr-service/Dockerfile`

**规模：** 中等。

### 任务 2：实现文本质量判断与 OCR 客户端

**说明：** 在 TypeScript 层定义统一的简历文本提取结果；普通 PDF 直接返回文本，空文本、文本过少或可读字符比例异常时调用可注入的 OCR 客户端。

**验收标准：**

- [ ] 普通文本 PDF 不调用 OCR。
- [ ] 扫描件或低质量文本触发 OCR，并保留页码和置信度。
- [ ] OCR 不可用、低置信度或返回空文本时得到 `NEEDS_CORRECTION`，不调用 DeepSeek。

**验证：**

- [ ] 先观察新增测试因缺少实现而失败：`node --import tsx --test tests/resume.test.ts`
- [ ] 实现后同一命令通过。
- [ ] 全量测试：`npm test`

**依赖：** 任务 1 的接口契约。

**预计涉及文件：**

- `lib/resume.ts`
- `lib/ocr.ts`
- `lib/types.ts`
- `tests/resume.test.ts`
- `.env.example`

**规模：** 中等。

### 检查点 A

- [ ] Python OCR 测试通过。
- [ ] Node 全量测试通过。
- [ ] 文本 PDF 与扫描 PDF 分别命中正确分支。
- [ ] OCR 原文没有发送给外部模型。

## 阶段二：完成简历 OCR 纵向链路

### 任务 3：接入简历上传与人工纠错

**说明：** 将统一提取结果接入现有上传接口。成功时沿用身份提取、脱敏和 DeepSeek 解析；需要纠错时保存本地解析记录并在工作台展示可编辑文本，审核员确认后再进入模型解析。

**验收标准：**

- [ ] OCR 成功后只把脱敏文本发送给 DeepSeek。
- [ ] OCR 低置信度时工作台显示原因、页码和可编辑文本，不创建伪造的候选人分析。
- [ ] 审核员修正文本后可以重新执行身份提取、脱敏和简历结构化。

**验证：**

- [ ] 新增路由/流程测试先失败再通过。
- [ ] `npm test`
- [ ] 浏览器手动验证普通 PDF、扫描 PDF 和 OCR 失败三条路径。

**依赖：** 任务 2。

**预计涉及文件：**

- `app/api/resumes/parse/route.ts`
- `app/api/resumes/correct/route.ts`
- `components/reviewer-dashboard.tsx`
- `lib/store.ts`
- `tests/resume-flow.test.ts`

**规模：** 中等。

## 阶段三：受控动态追问

### 任务 4：实现纯会话状态机

**说明：** 先用纯函数定义 turn 创建、当前题校验、单题提交、追问上限、拒答和模型失败降级，不在状态机中直接访问文件或 DeepSeek。

**验收标准：**

- [ ] 会话从第一道主问题开始，只接受当前未完成 turn 的回答。
- [ ] 单题最多 2 次、整场最多配置次数，达到上限时强制进入下一题。
- [ ] `DECLINED` 和模型失败都不阻塞后续主问题，失败会设置人工复核标记。

**验证：**

- [ ] 先观察新增测试失败：`node --import tsx --test tests/interview-state.test.ts`
- [ ] 实现后状态机测试和 `npm test` 通过。

**依赖：** 无，可与任务 1～3 的设计独立，但按顺序实施以减少共享文件冲突。

**预计涉及文件：**

- `lib/interview-state.ts`
- `lib/types.ts`
- `lib/schemas.ts`
- `tests/interview-state.test.ts`

**规模：** 中等。

### 任务 5：接入 DeepSeek 追问决策

**说明：** 增加受控动作 Schema 和提示词，只传递脱敏简历、当前主问题、相关问答及剩余上限。服务端在执行前再次应用状态机约束，不信任模型自行遵守上限。

**验收标准：**

- [ ] 三种动作和五种追问原因均经过 Zod 校验。
- [ ] `ASK_FOLLOW_UP` 缺少问题文本、未知动作或未知原因时拒绝模型输出。
- [ ] 请求体不含身份字段、完整 PDF、人工备注或其他候选人数据。

**验证：**

- [ ] 新增 Schema 与提示词输入测试先失败再通过。
- [ ] `node --import tsx --test tests/follow-up.test.ts`
- [ ] `npm test`

**依赖：** 任务 4。

**预计涉及文件：**

- `lib/ai.ts`
- `lib/schemas.ts`
- `lib/interview-state.ts`
- `tests/follow-up.test.ts`

**规模：** 中等。

### 任务 6：完成会话初始化与当前题草稿 API

**说明：** 调整会话创建与公开读取，并新增当前题草稿端点。候选人只收到当前题、进度、已完成只读记录和公开状态，不暴露评分或内部模型数据。

**验收标准：**

- [ ] 草稿只能写入当前 turn，重复提交或非当前 turn 返回冲突。
- [ ] 新会话自动初始化第一道主问题 turn，并保留审核员配置的追问上限。
- [ ] 公开读取只返回候选人完成答题所需的数据。

**验证：**

- [ ] API 行为测试先失败再通过。
- [ ] `node --import tsx --test tests/session-draft.test.ts`
- [ ] `npm test`

**依赖：** 任务 5。

**预计涉及文件：**

- `app/api/sessions/route.ts`
- `app/api/sessions/[token]/route.ts`
- `app/api/sessions/[token]/draft/route.ts`
- `tests/session-draft.test.ts`

**规模：** 中等。

### 任务 7：完成单题回答与最终提交 API

**说明：** 创建单题回答和最终提交端点。单题回答先持久化，再调用受控追问决策并通过状态机返回追问、下一题或结束状态。

**验收标准：**

- [ ] 单题提交原子地锁定当前回答，重复提交或提交非当前 turn 返回冲突。
- [ ] DeepSeek 成功时返回受上限约束的追问或下一题；失败时标记人工复核并继续。
- [ ] 最终提交前验证所有必答主问题已完成，提交后所有写接口锁定。

**验证：**

- [ ] API 行为测试先失败再通过。
- [ ] `node --import tsx --test tests/session-flow.test.ts`
- [ ] `npm test`

**依赖：** 任务 6。

**预计涉及文件：**

- `app/api/sessions/[token]/turns/[turnId]/answer/route.ts`
- `app/api/sessions/[token]/submit/route.ts`
- `lib/interview-state.ts`
- `tests/session-flow.test.ts`

**规模：** 中等。

### 检查点 B

- [ ] 状态机、AI 动作和会话 API 测试全部通过。
- [ ] DeepSeek 失败时候选人仍能完成后续问题。
- [ ] 服务端不会突破审核员配置的追问上限。
- [ ] `npm run build` 通过。

## 阶段四：候选人与审核员界面

### 任务 8：改造候选人聚焦式逐题页面

**说明：** 将现有整页问卷替换为已确认的 A 方案。页面显示当前题、主问题进度、追问次数、草稿状态和只读历史；单题提交后显示分析状态，最后进入整场确认页。

**验收标准：**

- [ ] 桌面端和移动端每次只显示一个可编辑问题。
- [ ] 自动保存、提交锁定、AI 分析、降级继续和最终提交状态均有明确反馈。
- [ ] 已完成问答只读，追问明确标记为基于上一回答触发。

**验证：**

- [ ] `npm test`
- [ ] `npm run build`
- [ ] 浏览器验证桌面和移动视口，检查控制台无错误。

**依赖：** 任务 7。

**预计涉及文件：**

- `components/candidate-session.tsx`
- `app/globals.css`
- `app/candidate/[token]/page.tsx`

**规模：** 中等。

### 任务 9：补齐审核时间线和报告证据

**说明：** 在候选人档案中展示面试进度、问答时间线、追问原因和人工复核标记；报告生成改用 turns，并让每条证据引用实际 `turnId`。

**验收标准：**

- [ ] 审核员能区分主问题、追问、回答和模型降级节点。
- [ ] 报告输入包含所有已提交 turns，报告证据可以定位到存在的 `turnId`。
- [ ] AI 建议不直接改变人工决策，现有人工备注和决策流程保持可用。

**验证：**

- [ ] 报告证据测试先失败再通过。
- [ ] `node --import tsx --test tests/report-evidence.test.ts`
- [ ] `npm test && npm run build`
- [ ] 浏览器手动走通一次“主问题 → 两次追问 → 报告 → 人工决策”。

**依赖：** 任务 7、任务 8。

**预计涉及文件：**

- `components/reviewer-dashboard.tsx`
- `app/api/reports/route.ts`
- `lib/ai.ts`
- `lib/types.ts`
- `tests/report-evidence.test.ts`

**规模：** 中等。

## 阶段五：最终验收

### 任务 10：运行全链路验收并同步运行文档

**说明：** 完成两条 P0 链路的自动化和浏览器验证，补充 OCR 服务启动方式、环境变量、故障处理和当前限制，不扩展新功能。

**验收标准：**

- [ ] `npm test`、`npm run build` 和 Python 测试全部通过。
- [ ] 普通 PDF、扫描 PDF、OCR 失败、正常追问、追问上限、拒答和 DeepSeek 失败均有明确结果。
- [ ] README、环境变量示例、MVP 设计和变更记录与最终实现一致。

**验证：**

- [ ] `python -m unittest discover -s ocr-service/tests`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] 浏览器完整主流程验证和控制台检查。

**依赖：** 任务 3、任务 9。

**预计涉及文件：**

- `README.md`
- `.env.example`
- `docs/mvp-design.md`
- 根目录 `../CHANGELOG.md`

**规模：** 小。

## 完成检查点

- [ ] 所有新增行为都经历测试先失败、实现后通过。
- [ ] OCR 原始内容和身份字段没有外发。
- [ ] 每个评分证据引用真实存在的主问题或追问 turn。
- [ ] 候选人无法通过重复请求突破状态或追问上限。
- [ ] 生产构建通过，桌面端和移动端主流程可用。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| PaddleOCR 镜像和模型体积较大，首次启动慢 | 中 | 任务 1 先做构建和健康检查；README 明确首次下载行为 |
| Windows、Docker 和 PDF 栅格化依赖差异 | 高 | OCR 完全封装在 Linux 容器中，不依赖宿主 Python 包 |
| 本地 JSON 更新没有数据库事务 | 中 | 单进程 MVP 内集中使用 `updateStore`；答案端点校验当前 turn 和重复提交 |
| DeepSeek 延迟影响单题提交体验 | 中 | 先保存回答，展示分析状态；超时后标记人工复核并继续下一题 |
| 模型生成重复或越界追问 | 高 | Zod Schema、原因枚举、单题/整场上限和服务端动作降级共同约束 |
| 旧会话没有 `turns` 字段 | 中 | 读取时执行最小兼容初始化，不迁移或删除现有本地数据 |

## 非本轮范围

- GitHub 或演示站自动采集。
- 扫描件以外的图片格式上传。
- 用户认证、多租户、Supabase、Redis 和异步队列。
- 语音、视频、反作弊、自动淘汰和自动录用。
- 对现有 `demo-ai-mianshi` 项目的任何修改。

## 开放问题

无。实现中若 PaddleOCR 当前稳定版与 Python 3.11 或目标容器不兼容，将先停在任务 1 汇报实际构建证据，不静默改用外部 OCR 服务。

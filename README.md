# Screening MVP

独立的 AI 候选人线上初筛试验服务。该服务不依赖项目中的 `demo-ai-mianshi`。

## 启动

先启动本地 PaddleOCR 服务：

```powershell
docker build -t screening-mvp-ocr ./ocr-service
docker run --rm --name screening-mvp-ocr -p 127.0.0.1:8001:8000 screening-mvp-ocr
```

首次处理扫描件时，PaddleOCR 会下载官方模型。普通文本 PDF 不调用 OCR 服务。

再启动 Next.js：

```powershell
Copy-Item .env.example .env.local
# 编辑 .env.local，至少填写 DEEPSEEK_API_KEY
npm install
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

数据保存在 `data/`，仅用于本地 MVP 试验。

## 当前流程

1. 审核员创建岗位并上传 PDF 简历。
2. 文本 PDF 直接解析；扫描件调用本地 PaddleOCR。低置信度结果必须人工修正后才会脱敏并发送给 DeepSeek。
3. 审核员编辑问题，配置整场 0～3 次追问并发布随机 token 链接。
4. 候选人逐题作答；每题提交后锁定，DeepSeek 只能建议追问、下一题或结束。
5. 模型失败不会阻塞答题，系统会标记人工复核并进入下一题。
6. 报告证据使用 `[TURN:<id>]` 或 `[RESUME]`，未知 turn 引用会被移除。

## 验证

```powershell
python -m unittest discover -s ocr-service/tests
npm test
npm run build
```

PaddleOCR Python 集成遵循官方 `PaddleOCR(...).predict(...)` 接口：<https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/OCR.html>。文件上传使用 FastAPI `UploadFile`：<https://fastapi.tiangolo.com/tutorial/request-files/>。

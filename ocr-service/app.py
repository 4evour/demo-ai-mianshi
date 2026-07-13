from __future__ import annotations

import os
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile

from ocr import OcrError, OcrLimits, PaddleRecognizer, PdfiumRenderer, process_pdf


app = FastAPI(title="Screening MVP OCR", docs_url=None, redoc_url=None)


@lru_cache(maxsize=1)
def get_recognizer() -> PaddleRecognizer:
    return PaddleRecognizer()


def get_limits() -> OcrLimits:
    return OcrLimits(
        max_bytes=int(os.getenv("OCR_MAX_BYTES", str(10 * 1024 * 1024))),
        max_pages=int(os.getenv("OCR_MAX_PAGES", "20")),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "model": "ready" if get_recognizer.cache_info().currsize else "cold",
    }


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> dict[str, object]:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(
            status_code=415,
            detail={"code": "UNSUPPORTED_FILE", "message": "只支持 PDF"},
        )

    limits = get_limits()
    content = await file.read(limits.max_bytes + 1)
    try:
        result = process_pdf(
            content,
            render_pages=PdfiumRenderer(max_pages=limits.max_pages),
            recognize=get_recognizer(),
            limits=limits,
        )
        return result.to_dict()
    except OcrError as error:
        raise HTTPException(
            status_code=422, detail={"code": error.code, "message": str(error)}
        ) from error
    finally:
        await file.close()

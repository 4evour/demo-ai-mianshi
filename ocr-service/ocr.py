from __future__ import annotations

from dataclasses import asdict, dataclass
from statistics import fmean
from typing import Any, Callable, Iterable, Sequence


class OcrError(Exception):
    def __init__(self, message: str, code: str = "OCR_FAILED") -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class OcrLimits:
    max_bytes: int = 10 * 1024 * 1024
    max_pages: int = 20


@dataclass(frozen=True)
class OcrPage:
    page: int
    text: str
    confidence: float


@dataclass(frozen=True)
class OcrResult:
    pages: list[OcrPage]
    average_confidence: float
    warnings: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "pages": [asdict(page) for page in self.pages],
            "averageConfidence": self.average_confidence,
            "warnings": self.warnings,
        }


RenderPages = Callable[[bytes], Iterable[tuple[int, Any]]]
RecognizePage = Callable[[Any], tuple[Sequence[str], Sequence[float]]]


def process_pdf(
    content: bytes,
    *,
    render_pages: RenderPages,
    recognize: RecognizePage,
    limits: OcrLimits,
) -> OcrResult:
    if len(content) > limits.max_bytes:
        max_mb = limits.max_bytes / (1024 * 1024)
        raise OcrError(f"PDF 不能超过 {max_mb:g} MB", "FILE_TOO_LARGE")

    try:
        rendered = list(render_pages(content))
    except OcrError:
        raise
    except Exception as error:
        raise OcrError("PDF 无法读取或页面栅格化失败", "INVALID_PDF") from error

    if not rendered:
        raise OcrError("PDF 没有可识别的页面", "EMPTY_PDF")
    if len(rendered) > limits.max_pages:
        raise OcrError(f"PDF 不能超过 {limits.max_pages} 页", "TOO_MANY_PAGES")

    pages: list[OcrPage] = []
    warnings: list[str] = []
    all_scores: list[float] = []

    for page_number, image in rendered:
        try:
            texts, scores = recognize(image)
        except Exception as error:
            raise OcrError(
                f"第 {page_number} 页 OCR 失败", "PAGE_OCR_FAILED"
            ) from error

        cleaned_texts = [text.strip() for text in texts if text and text.strip()]
        valid_scores = [float(score) for score in scores if 0 <= float(score) <= 1]
        confidence = fmean(valid_scores) if valid_scores else 0.0
        all_scores.extend(valid_scores)
        text = "\n".join(cleaned_texts)
        if not text:
            warnings.append(f"第 {page_number} 页未识别到文本")
        pages.append(OcrPage(page=page_number, text=text, confidence=confidence))

    return OcrResult(
        pages=pages,
        average_confidence=fmean(all_scores) if all_scores else 0.0,
        warnings=warnings,
    )


class PdfiumRenderer:
    def __init__(self, scale: float = 2.0, max_pages: int | None = None) -> None:
        self.scale = scale
        self.max_pages = max_pages

    def __call__(self, content: bytes) -> list[tuple[int, Any]]:
        import numpy as np
        import pypdfium2 as pdfium

        document = pdfium.PdfDocument(content)
        pages: list[tuple[int, Any]] = []
        try:
            if self.max_pages is not None and len(document) > self.max_pages:
                raise OcrError(f"PDF 不能超过 {self.max_pages} 页", "TOO_MANY_PAGES")
            for index in range(len(document)):
                page = document[index]
                try:
                    bitmap = page.render(scale=self.scale)
                    image = bitmap.to_pil().convert("RGB")
                    pages.append((index + 1, np.asarray(image)))
                finally:
                    page.close()
        finally:
            document.close()
        return pages


class PaddleRecognizer:
    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        self.pipeline = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )

    def __call__(self, image: Any) -> tuple[list[str], list[float]]:
        texts: list[str] = []
        scores: list[float] = []
        for result in self.pipeline.predict(image):
            payload = result.json
            data = payload.get("res", payload)
            texts.extend(str(value) for value in data.get("rec_texts", []))
            scores.extend(float(value) for value in data.get("rec_scores", []))
        return texts, scores

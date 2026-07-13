import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ocr import OcrError, OcrLimits, process_pdf


class OcrServiceTests(unittest.TestCase):
    def test_returns_page_text_and_average_confidence(self):
        rendered = [(1, b"page-one"), (2, b"page-two")]

        result = process_pdf(
            b"pdf",
            render_pages=lambda _content: rendered,
            recognize=lambda image: (
                (["姓名：张三", "Python"], [0.9, 0.7])
                if image == b"page-one"
                else (["项目经历"], [0.8])
            ),
            limits=OcrLimits(max_bytes=1024, max_pages=3),
        )

        self.assertEqual(
            [page.text for page in result.pages], ["姓名：张三\nPython", "项目经历"]
        )
        self.assertAlmostEqual(result.pages[0].confidence, 0.8)
        self.assertAlmostEqual(result.average_confidence, 0.8)
        self.assertEqual(result.warnings, [])

    def test_rejects_pdf_over_size_limit(self):
        with self.assertRaisesRegex(OcrError, "PDF 不能超过"):
            process_pdf(
                b"too-large",
                render_pages=lambda _content: [],
                recognize=lambda _image: ([], []),
                limits=OcrLimits(max_bytes=3, max_pages=3),
            )

    def test_rejects_pdf_over_page_limit(self):
        with self.assertRaisesRegex(OcrError, "PDF 不能超过 1 页"):
            process_pdf(
                b"pdf",
                render_pages=lambda _content: [(1, b"one"), (2, b"two")],
                recognize=lambda _image: (["text"], [0.9]),
                limits=OcrLimits(max_bytes=1024, max_pages=1),
            )

    def test_marks_empty_page_as_warning(self):
        result = process_pdf(
            b"pdf",
            render_pages=lambda _content: [(1, b"empty")],
            recognize=lambda _image: ([], []),
            limits=OcrLimits(max_bytes=1024, max_pages=1),
        )

        self.assertEqual(result.pages[0].text, "")
        self.assertEqual(result.pages[0].confidence, 0)
        self.assertEqual(result.warnings, ["第 1 页未识别到文本"])


if __name__ == "__main__":
    unittest.main()

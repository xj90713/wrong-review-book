#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path


def emit(payload, code=0):
    print(json.dumps(payload, ensure_ascii=False))
    raise SystemExit(code)


def parse_args():
    parser = argparse.ArgumentParser(description='Local OCR runner based on RapidOCR')
    parser.add_argument('--input', required=True, help='Image file path')
    return parser.parse_args()


def flatten_rapidocr_result(result):
    texts = []
    if not result:
        return texts

    for item in result:
        # rapidocr_onnxruntime item usually: [box, text, score]
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            text = item[1]
            if isinstance(text, str):
                text = text.strip()
                if text:
                    texts.append(text)
        elif isinstance(item, str):
            text = item.strip()
            if text:
                texts.append(text)

    return texts


def main():
    args = parse_args()
    image_path = Path(args.input)

    if not image_path.exists():
        emit({'ok': False, 'error': f'image file not found: {image_path}'}, code=2)

    mock_text = os.getenv('MOCK_OCR_TEXT')
    if mock_text:
        emit(
            {
                'ok': True,
                'engine': 'rapidocr(mock)',
                'text': mock_text,
                'lines': [line for line in mock_text.splitlines() if line.strip()],
            }
        )

    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as error:  # pragma: no cover
        emit(
            {
                'ok': False,
                'error': (
                    'rapidocr_onnxruntime not installed. '\
                    'Run: pip install rapidocr_onnxruntime\n'\
                    f'Detail: {error}'
                ),
            },
            code=3,
        )

    try:
        engine = RapidOCR()
        result, _ = engine(str(image_path))
        lines = flatten_rapidocr_result(result)
        emit(
            {
                'ok': True,
                'engine': 'rapidocr',
                'text': '\n'.join(lines),
                'lines': lines,
            }
        )
    except Exception as error:  # pragma: no cover
        emit({'ok': False, 'error': f'ocr runtime error: {error}'}, code=4)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


def emit(payload, code=0):
    print(json.dumps(payload, ensure_ascii=False))
    raise SystemExit(code)


def parse_args():
    parser = argparse.ArgumentParser(description='Local transcription runner based on faster-whisper')
    parser.add_argument('--input', required=True, help='Audio file path')
    parser.add_argument('--language', default='zh', help='Language code, default zh')
    parser.add_argument('--model', default='small', help='faster-whisper model size')
    parser.add_argument('--device', default='auto', help='cpu/cuda/auto')
    parser.add_argument('--compute-type', default='int8', help='float16/int8/int8_float16')
    return parser.parse_args()


def main():
    args = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        emit({'ok': False, 'error': f'audio file not found: {input_path}'}, code=2)

    mock_text = os.getenv('MOCK_TRANSCRIBE_TEXT')
    if mock_text:
        emit(
            {
                'ok': True,
                'engine': 'faster-whisper(mock)',
                'language': args.language,
                'text': mock_text,
            }
        )

    try:
        from faster_whisper import WhisperModel
    except Exception as error:  # pragma: no cover
        emit(
            {
                'ok': False,
                'error': (
                    'faster-whisper not installed. '
                    'Run: pip install faster-whisper\n'
                    f'Detail: {error}'
                ),
            },
            code=3,
        )

    try:
        model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
        segments, info = model.transcribe(str(input_path), language=args.language, vad_filter=True)

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        emit(
            {
                'ok': True,
                'engine': 'faster-whisper',
                'language': getattr(info, 'language', args.language),
                'duration': getattr(info, 'duration', None),
                'text': ' '.join([piece for piece in text_parts if piece]),
            }
        )
    except Exception as error:  # pragma: no cover
        emit({'ok': False, 'error': f'transcribe runtime error: {error}'}, code=4)


if __name__ == '__main__':
    main()

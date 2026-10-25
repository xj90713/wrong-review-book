import test from 'node:test';
import assert from 'node:assert/strict';

import { postImageForOcr } from '../web/src/ocr-client.js';

test('postImageForOcr returns payload when response is ok', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { ok: true, engine: 'rapidocr(mock)', text: '识别文本' };
    }
  });

  const result = await postImageForOcr(new Blob(['x'], { type: 'image/png' }));
  assert.equal(result.ok, true);
  assert.equal(result.engine, 'rapidocr(mock)');
});

test('postImageForOcr throws when backend fails', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => ({
    ok: false,
    async json() {
      return { ok: false, error: 'ocr failed' };
    }
  });

  await assert.rejects(() => postImageForOcr(new Blob(['x'], { type: 'image/png' })), /ocr failed/);
});

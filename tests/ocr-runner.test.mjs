import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  cleanupTempImageFile,
  extensionFromImageContentType,
  runImageOcrRecognition,
  writeTempImageFile
} from '../server/ocr-runner.mjs';

test('extensionFromImageContentType maps common image content types', () => {
  assert.equal(extensionFromImageContentType('image/png'), '.png');
  assert.equal(extensionFromImageContentType('image/jpeg'), '.jpg');
  assert.equal(extensionFromImageContentType('image/webp'), '.webp');
  assert.equal(extensionFromImageContentType('image/heic'), '.heic');
  assert.equal(extensionFromImageContentType('unknown/type'), '.bin');
});

test('writeTempImageFile writes and cleanupTempImageFile removes file', async () => {
  const filePath = await writeTempImageFile(Buffer.from('img-bytes'), '.png');
  const content = await fs.readFile(filePath, 'utf8');
  assert.equal(content, 'img-bytes');
  await cleanupTempImageFile(filePath);
  await assert.rejects(() => fs.access(filePath));
});

test('runImageOcrRecognition supports mock output contract', async () => {
  const imagePath = path.join(os.tmpdir(), 'mock-image.png');
  await fs.writeFile(imagePath, 'fake-image-content');

  const result = await runImageOcrRecognition({
    imagePath,
    env: {
      ...process.env,
      MOCK_OCR_TEXT: '数学应用题\n单位漏写'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.engine, 'rapidocr(mock)');
  assert.match(result.text, /单位漏写/);
  assert.deepEqual(result.lines, ['数学应用题', '单位漏写']);

  await fs.unlink(imagePath);
});

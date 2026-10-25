import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createImageStore } from '../server/image-store.mjs';
import { cropRectangle, normalizeQuestionImage } from '../web/src/question-images.js';
import { createMistakeRecord, updateMistakeRecord } from '../web/src/mistake-book.js';
import { createEmptyState } from '../web/src/storage.js';
import { createBackupBundle, parseBackupBundleText } from '../web/src/backup.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT9sAAAAASUVORK5CYII=', 'base64');
const image = { original: `/api/images/${'a'.repeat(64)}.png`, crop: `/api/images/${'b'.repeat(64)}.png` };

test('image store preserves original bytes, deduplicates, rejects non-images and traversal', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'question-images-'));
  try {
    const store = createImageStore(root);
    const saved = await store.save(png);
    assert.deepEqual(await store.save(png), saved);
    assert.deepEqual((await store.read(saved.url.split('/').at(-1))).buffer, png);
    await assert.rejects(store.save(Buffer.from('<svg onload="alert(1)">')), /图片/);
    await assert.rejects(store.read('../secret'), /图片/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('crop normalizes reverse drags, clamps bounds and maps to source pixels', () => {
  assert.deepEqual(cropRectangle({ x: 90, y: 80 }, { x: -10, y: 20 }, 100, 100, 1000, 500), { x: 0, y: 100, width: 900, height: 300 });
  assert.equal(cropRectangle({ x: 1, y: 1 }, { x: 1, y: 1 }, 100, 100, 1000, 500), null);
});

test('image-only mistakes survive editing and backup; unsafe URLs cannot replace text', () => {
  const state = { ...createEmptyState(), children: [{ id: 'c', userId: 'u' }] };
  const result = createMistakeRecord(state, 'u', { childId: 'c', subject: '数学', questionImage: image });
  assert.equal(result.ok, true);
  assert.deepEqual(result.record.questionImage, image);
  const edited = updateMistakeRecord(result.state, 'u', result.record.id, { analysis: '平移' });
  assert.equal(edited.ok, true);
  assert.deepEqual(edited.record.questionImage, image);
  const restored = parseBackupBundleText(JSON.stringify(createBackupBundle(edited.state)));
  assert.deepEqual(restored.state.mistakes[0].questionImage, image);
  assert.equal(normalizeQuestionImage({ original: 'javascript:alert(1)' }), null);
  assert.equal(createMistakeRecord(state, 'u', { childId: 'c', subject: '数学', questionImage: { original: 'https://example.com/a.png' } }).ok, false);
});

test('portable backup includes image bytes, deduplicates and restores before loading state', async () => {
  const { embedBackupImages, restoreBackupImages } = await import('../web/src/question-images.js');
  const state = { ...createEmptyState(), mistakes: [{ questionImage: image }, { questionImage: image }] };
  let reads = 0;
  const bundled = await embedBackupImages(createBackupBundle(state), async () => {
    reads++;
    return new Response(png);
  });
  assert.equal(reads, 2);
  const parsed = parseBackupBundleText(JSON.stringify(bundled));
  assert.equal(parsed.images[image.original], png.toString('base64'));
  const urls = [image.original, image.crop];
  let uploads = 0;
  await restoreBackupImages(parsed.state, parsed.images, async (blob) => {
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png);
    return urls[uploads++];
  });
  assert.equal(uploads, 2);
  await assert.rejects(restoreBackupImages(parsed.state, parsed.images, async () => '/wrong'), /校验/);
  await assert.rejects(restoreBackupImages(parsed.state, {}, undefined, async () => new Response('', { status: 404 })), /缺少图片/);
  await assert.rejects(embedBackupImages(createBackupBundle(state), async () => new Response('', { status: 404 })), /备份中止/);
});

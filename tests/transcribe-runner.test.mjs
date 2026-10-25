import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  cleanupTempFile,
  extensionFromContentType,
  runWhisperTranscription,
  writeTempAudioFile
} from '../server/transcribe-runner.mjs';

test('extensionFromContentType maps audio types', () => {
  assert.equal(extensionFromContentType('audio/webm;codecs=opus'), '.webm');
  assert.equal(extensionFromContentType('audio/wav'), '.wav');
  assert.equal(extensionFromContentType('audio/mpeg'), '.mp3');
  assert.equal(extensionFromContentType('unknown'), '.bin');
});

test('writeTempAudioFile writes and cleanupTempFile removes the file', async () => {
  const filePath = await writeTempAudioFile(Buffer.from('abc'), '.webm');
  const content = await fs.readFile(filePath, 'utf8');
  assert.equal(content, 'abc');
  await cleanupTempFile(filePath);
  await assert.rejects(() => fs.access(filePath));
});

test('runWhisperTranscription supports mock output contract', async () => {
  const audioPath = path.join(os.tmpdir(), 'mock-audio.wav');
  await fs.writeFile(audioPath, 'mock-audio-content');

  const result = await runWhisperTranscription({
    audioPath,
    env: {
      ...process.env,
      MOCK_TRANSCRIBE_TEXT: '今天的语文错别字，拔河写成拨河'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.engine, 'faster-whisper(mock)');
  assert.match(result.text, /拔河写成拨河/);
  await fs.unlink(audioPath);
});

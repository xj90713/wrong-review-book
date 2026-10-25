import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const scriptPath = path.resolve('scripts/transcribe.py');

export function extensionFromContentType(contentType) {
  const type = String(contentType ?? '').toLowerCase();
  if (type.includes('audio/webm')) return '.webm';
  if (type.includes('audio/wav')) return '.wav';
  if (type.includes('audio/mpeg')) return '.mp3';
  if (type.includes('audio/mp4')) return '.m4a';
  if (type.includes('audio/ogg')) return '.ogg';
  return '.bin';
}

export async function writeTempAudioFile(buffer, extension) {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const filename = `mistake-book-audio-${randomUUID()}${ext}`;
  const fullPath = path.join(os.tmpdir(), filename);
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}

export function runWhisperTranscription({
  audioPath,
  language = 'zh',
  model = 'small',
  pythonBin,
  env = process.env
}) {
  const resolvedPythonBin = String(pythonBin || env.PYTHON_BIN || 'python3');
  return new Promise((resolve, reject) => {
    const args = [scriptPath, '--input', audioPath, '--language', language, '--model', model];
    const child = spawn(resolvedPythonBin, args, {
      env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `transcribe failed with code ${code}: ${stderr || stdout || 'unknown error'}`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        reject(new Error(`invalid transcribe output: ${stdout}`));
      }
    });
  });
}

export async function cleanupTempFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors.
  }
}

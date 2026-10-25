import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const scriptPath = path.resolve('scripts/ocr.py');

export function extensionFromImageContentType(contentType) {
  const type = String(contentType ?? '').toLowerCase();
  if (type.includes('image/png')) return '.png';
  if (type.includes('image/jpeg')) return '.jpg';
  if (type.includes('image/webp')) return '.webp';
  if (type.includes('image/heic')) return '.heic';
  if (type.includes('image/heif')) return '.heif';
  if (type.includes('image/bmp')) return '.bmp';
  return '.bin';
}

export async function writeTempImageFile(buffer, extension) {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const filename = `mistake-book-image-${randomUUID()}${ext}`;
  const fullPath = path.join(os.tmpdir(), filename);
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}

export function runImageOcrRecognition({
  imagePath,
  pythonBin,
  env = process.env
}) {
  const resolvedPythonBin = String(pythonBin || env.PYTHON_BIN || 'python3');
  return new Promise((resolve, reject) => {
    const args = [scriptPath, '--input', imagePath];
    const child = spawn(resolvedPythonBin, args, { env });

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
        reject(new Error(`ocr failed with code ${code}: ${stderr || stdout || 'unknown error'}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        reject(new Error(`invalid ocr output: ${stdout}`));
      }
    });
  });
}

export async function cleanupTempImageFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors.
  }
}

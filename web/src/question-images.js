import { requestJson } from './api-client.js';

export function normalizeQuestionImage(value) {
  const valid = (url) => typeof url === 'string' && /^\/api\/images\/[a-f0-9]{64}\.(png|jpg|webp|bmp)$/.test(url);
  if (!valid(value?.original)) return null;
  return { original: value.original, crop: valid(value.crop) ? value.crop : null };
}

export function cropRectangle(start, end, width, height, sourceWidth, sourceHeight) {
  if (![start.x, start.y, end.x, end.y, width, height, sourceWidth, sourceHeight].every(Number.isFinite) || width <= 0 || height <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  const x1 = Math.round(clamp(Math.min(start.x, end.x), width) / width * sourceWidth);
  const y1 = Math.round(clamp(Math.min(start.y, end.y), height) / height * sourceHeight);
  const x2 = Math.round(clamp(Math.max(start.x, end.x), width) / width * sourceWidth);
  const y2 = Math.round(clamp(Math.max(start.y, end.y), height) / height * sourceHeight);
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
}

export async function uploadQuestionImage(blob) {
  const result = await requestJson('/api/images', {
    method: 'POST', headers: { 'Content-Type': blob.type }, body: blob
  }, { fallbackMessage: '图片保存失败，请重试。' });
  return result.url;
}

export function renderQuestionImage(value) {
  const image = normalizeQuestionImage(value);
  if (!image) return '';
  return `<figure class="question-image"><a href="${image.crop || image.original}" target="_blank" rel="noopener"><img src="${image.crop || image.original}" alt="错题图片，点击查看大图" loading="lazy" /></a><figcaption>${image.crop ? '裁剪图 · ' : ''}<a href="${image.original}" target="_blank" rel="noopener">查看完整原图</a></figcaption></figure>`;
}

export async function embedBackupImages(bundle, fetchImpl = fetch) {
  const images = {};
  for (const mistake of bundle.state.mistakes) {
    const image = normalizeQuestionImage(mistake.questionImage);
    for (const url of image ? [image.original, image.crop].filter(Boolean) : []) {
      if (images[url]) continue;
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error('备份中止：有图片读取失败，请检查本地服务。');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      images[url] = btoa(binary);
    }
  }
  return { ...bundle, images };
}

export async function restoreBackupImages(state, images = {}, upload = uploadQuestionImage, fetchImpl = fetch) {
  for (const mistake of state.mistakes) {
    if (mistake.questionImage && !normalizeQuestionImage(mistake.questionImage)) throw new Error('备份包含无效图片地址。');
  }
  const urls = new Set(state.mistakes.flatMap((m) => {
    const image = normalizeQuestionImage(m.questionImage);
    return image ? [image.original, image.crop].filter(Boolean) : [];
  }));
  for (const url of urls) {
    if (typeof images[url] === 'string') {
      const bytes = Uint8Array.from(atob(images[url]), (c) => c.charCodeAt(0));
      if (await upload(new Blob([bytes])) !== url) throw new Error('备份图片校验失败，恢复已中止。');
    } else {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error('备份缺少图片文件，恢复已中止。');
    }
  }
}

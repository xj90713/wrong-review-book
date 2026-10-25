import path from 'node:path';

function decodePathComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveStaticPath(webRoot, urlPath) {
  const root = path.resolve(String(webRoot ?? ''));
  const rawPath = String(urlPath ?? '/').split('?')[0] || '/';
  const decodedPath = decodePathComponent(rawPath);
  const targetPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const fullPath = path.resolve(path.join(root, targetPath));
  const relative = path.relative(root, fullPath);

  if (!relative || relative === '') {
    return fullPath;
  }

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return fullPath;
}

export function getApiErrorStatus(error) {
  return error?.message === 'payload_too_large' ? 413 : 500;
}

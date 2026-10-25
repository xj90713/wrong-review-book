import { normalizeState } from './storage.js';

export const BACKUP_VERSION = 'mistake-book-backup-v1';

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function buildBackupFileName(now = new Date()) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  const second = pad2(date.getSeconds());
  return `错题本备份_${year}${month}${day}_${hour}${minute}${second}.json`;
}

export function createBackupBundle(state, now = new Date()) {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: (now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()).toISOString(),
    app: 'review-notebook',
    state: normalizeState(state)
  };
}

export function serializeBackupBundle(bundle) {
  return JSON.stringify(bundle, null, 2);
}

function hasStateShape(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Array.isArray(value.users) ||
      Array.isArray(value.children) ||
      Array.isArray(value.mistakes) ||
      Array.isArray(value.exports))
  );
}

export function parseBackupBundleText(rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) {
    return { ok: false, error: '备份文件为空。' };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: '备份文件不是合法 JSON。' };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (hasStateShape(parsed.state)) {
      const backupVersion = String(parsed.backupVersion ?? BACKUP_VERSION).trim() || BACKUP_VERSION;
      return {
        ok: true,
        state: normalizeState(parsed.state),
        images: parsed.images && typeof parsed.images === 'object' ? parsed.images : {},
        meta: {
          backupVersion,
          exportedAt:
            typeof parsed.exportedAt === 'string' && parsed.exportedAt.trim()
              ? parsed.exportedAt.trim()
              : null
        }
      };
    }

    if (hasStateShape(parsed)) {
      return {
        ok: true,
        state: normalizeState(parsed),
        meta: {
          backupVersion: 'legacy-state-json',
          exportedAt: null
        }
      };
    }
  }

  return { ok: false, error: '备份文件格式不正确。' };
}

const MAX_AUDIT_LOGS = 200;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeResult(value) {
  const text = normalizeText(value).toLowerCase();
  if (text === 'success' || text === 'failed' || text === 'cancelled') {
    return text;
  }
  return 'success';
}

function normalizeAuditItem(value) {
  if (!isObject(value)) {
    return null;
  }
  const action = normalizeText(value.action);
  const createdAt = normalizeText(value.createdAt);
  if (!action || !createdAt) {
    return null;
  }
  return {
    id: normalizeText(value.id) || `audit_${createdAt}_${Math.random().toString(16).slice(2, 8)}`,
    userId: normalizeText(value.userId) || null,
    action,
    result: normalizeResult(value.result),
    detail: normalizeText(value.detail),
    createdAt
  };
}

export function normalizeAuditLogs(value, max = MAX_AUDIT_LOGS) {
  const list = Array.isArray(value) ? value : [];
  const normalized = list.map(normalizeAuditItem).filter(Boolean);
  return normalized.slice(-Math.max(1, max));
}

export function createAuditLogEntry(input, now = new Date()) {
  const createdAt = now.toISOString();
  return {
    id: `audit_${now.getTime()}_${Math.random().toString(16).slice(2, 8)}`,
    userId: normalizeText(input?.userId) || null,
    action: normalizeText(input?.action) || 'unknown.action',
    result: normalizeResult(input?.result),
    detail: normalizeText(input?.detail),
    createdAt
  };
}

export function appendAuditLog(state, input, now = new Date()) {
  const nextEntry = createAuditLogEntry(input, now);
  const current = normalizeAuditLogs(state?.auditLogs, MAX_AUDIT_LOGS);
  return {
    ...state,
    auditLogs: [...current, nextEntry].slice(-MAX_AUDIT_LOGS)
  };
}

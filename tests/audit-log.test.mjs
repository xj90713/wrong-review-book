import test from 'node:test';
import assert from 'node:assert/strict';

import { appendAuditLog, createAuditLogEntry, normalizeAuditLogs } from '../web/src/audit-log.js';
import { createEmptyState } from '../web/src/storage.js';

test('createAuditLogEntry creates normalized entry', () => {
  const entry = createAuditLogEntry(
    {
      userId: 'u1',
      action: 'backup.import',
      result: 'failed',
      detail: '口令错误'
    },
    new Date('2026-04-19T10:00:00.000Z')
  );

  assert.equal(entry.userId, 'u1');
  assert.equal(entry.action, 'backup.import');
  assert.equal(entry.result, 'failed');
  assert.equal(entry.detail, '口令错误');
  assert.equal(entry.createdAt, '2026-04-19T10:00:00.000Z');
});

test('appendAuditLog appends and keeps max length', () => {
  let state = { ...createEmptyState(), auditLogs: [] };
  for (let i = 0; i < 205; i += 1) {
    state = appendAuditLog(
      state,
      { userId: 'u1', action: `action.${i}`, result: 'success', detail: '' },
      new Date(`2026-04-19T10:00:${String(i % 60).padStart(2, '0')}.000Z`)
    );
  }
  assert.equal(state.auditLogs.length, 200);
  assert.equal(state.auditLogs[0].action, 'action.5');
  assert.equal(state.auditLogs[199].action, 'action.204');
});

test('normalizeAuditLogs filters invalid items', () => {
  const normalized = normalizeAuditLogs([
    null,
    { action: 'x' },
    { action: 'export.manual', createdAt: '2026-04-19T10:00:00.000Z', result: 'unknown' }
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].result, 'success');
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultAutoExport,
  evaluateAutoExport,
  getCurrentDueTime,
  getNextAutoExportTime,
  normalizeAutoExportConfig
} from '../web/src/auto-export.js';

test('normalizeAutoExportConfig keeps safe defaults', () => {
  const config = normalizeAutoExportConfig({ enabled: true, cycle: 'invalid', format: 'x' });
  assert.equal(config.enabled, true);
  assert.equal(config.cycle, 'week');
  assert.equal(config.format, 'pdf');
  assert.equal(config.template, 'compact');
});

test('daily auto export should trigger when due and not generated', () => {
  const now = new Date('2026-04-18T12:00:00.000Z');
  const config = normalizeAutoExportConfig({
    ...createDefaultAutoExport(),
    enabled: true,
    cycle: 'day',
    time: '08:00',
    lastGeneratedAt: null
  });

  const result = evaluateAutoExport(config, now);
  assert.equal(result.shouldGenerate, true);
  assert.ok(result.nextAt > now);
});

test('daily auto export should not trigger twice in same window', () => {
  const now = new Date('2026-04-18T12:00:00.000Z');
  const config = normalizeAutoExportConfig({
    ...createDefaultAutoExport(),
    enabled: true,
    cycle: 'day',
    time: '08:00',
    lastGeneratedAt: '2026-04-18T09:00:00.000Z'
  });

  const result = evaluateAutoExport(config, now);
  assert.equal(result.shouldGenerate, false);
});

test('weekly auto export due and next can be calculated', () => {
  const now = new Date('2026-04-18T12:00:00.000Z'); // Saturday
  const config = normalizeAutoExportConfig({
    ...createDefaultAutoExport(),
    enabled: true,
    cycle: 'week',
    weekday: 5,
    time: '10:00'
  });

  const dueAt = getCurrentDueTime(config, now);
  const nextAt = getNextAutoExportTime(config, now);
  assert.ok(dueAt <= now);
  assert.ok(nextAt > now);
});

test('monthly auto export due and next can be calculated', () => {
  const now = new Date('2026-04-18T12:00:00.000Z');
  const config = normalizeAutoExportConfig({
    ...createDefaultAutoExport(),
    enabled: true,
    cycle: 'month',
    dayOfMonth: 15,
    time: '10:00'
  });

  const dueAt = getCurrentDueTime(config, now);
  const nextAt = getNextAutoExportTime(config, now);
  assert.ok(dueAt <= now);
  assert.ok(nextAt > now);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDateRangeByCycle,
  getExportCycleOptions,
  normalizeExportCycle,
  resolveExportRangeForCycleChange,
  resolveExportRangeForSubmit,
  shouldDisableExportDateInputs
} from '../web/src/export-cycle.js';

test('getExportCycleOptions includes required cycles', () => {
  assert.deepEqual(getExportCycleOptions(), ['day', 'week', 'month', 'custom']);
});

test('normalizeExportCycle falls back to week', () => {
  assert.equal(normalizeExportCycle('day'), 'day');
  assert.equal(normalizeExportCycle('unknown'), 'week');
});

test('getDateRangeByCycle(day) returns today only', () => {
  const range = getDateRangeByCycle('day', new Date('2026-04-18T10:00:00.000Z'));
  assert.equal(range.startDate, '2026-04-18');
  assert.equal(range.endDate, '2026-04-18');
});

test('getDateRangeByCycle(week) returns Monday to Sunday', () => {
  const range = getDateRangeByCycle('week', new Date('2026-04-18T10:00:00.000Z')); // Saturday
  assert.equal(range.startDate, '2026-04-13');
  assert.equal(range.endDate, '2026-04-19');
});

test('getDateRangeByCycle(month) returns first and last day of month', () => {
  const range = getDateRangeByCycle('month', new Date('2026-02-10T10:00:00.000Z'));
  assert.equal(range.startDate, '2026-02-01');
  assert.equal(range.endDate, '2026-02-28');
});

test('getDateRangeByCycle(custom) defaults to recent 7 days', () => {
  const range = getDateRangeByCycle('custom', new Date('2026-04-18T10:00:00.000Z'));
  assert.equal(range.startDate, '2026-04-12');
  assert.equal(range.endDate, '2026-04-18');
});

test('export date inputs remain editable for every cycle', () => {
  for (const cycle of getExportCycleOptions()) {
    assert.equal(shouldDisableExportDateInputs(cycle), false);
  }
});

test('resolveExportRangeForCycleChange refreshes preset ranges and preserves custom values', () => {
  const now = new Date('2026-04-18T10:00:00.000Z');
  assert.deepEqual(resolveExportRangeForCycleChange('week', '', '', now), {
    startDate: '2026-04-13',
    endDate: '2026-04-19'
  });
  assert.deepEqual(resolveExportRangeForCycleChange('custom', '2026-04-02', '2026-04-08', now), {
    startDate: '2026-04-02',
    endDate: '2026-04-08'
  });
});

test('resolveExportRangeForSubmit preserves manually selected dates for preset cycles', () => {
  const now = new Date('2026-04-18T10:00:00.000Z');
  assert.deepEqual(resolveExportRangeForSubmit('week', '2026-04-05', '2026-04-10', now), {
    startDate: '2026-04-05',
    endDate: '2026-04-10'
  });
  assert.deepEqual(resolveExportRangeForSubmit('month', '', '', now), {
    startDate: '2026-04-01',
    endDate: '2026-04-30'
  });
});

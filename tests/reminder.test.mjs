import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultReminder,
  evaluateReminder,
  getNextReminderTime,
  normalizeReminder
} from '../web/src/reminder.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

test('normalizeReminder keeps safe defaults', () => {
  const normalized = normalizeReminder({ enabled: true, weekday: 12, cycle: 'x' });
  assert.equal(normalized.enabled, true);
  assert.equal(normalized.cycle, 'weekly');
  assert.equal(normalized.weekday, 5);
  assert.equal(normalized.time, '20:00');
});

test('getNextReminderTime returns null when disabled', () => {
  const reminder = createDefaultReminder();
  const nextAt = getNextReminderTime(reminder, new Date());
  assert.equal(nextAt, null);
});

test('weekly reminder triggers when due and not notified', () => {
  const now = new Date();
  const minuteBefore = new Date(now.getTime() - 60 * 1000);
  const reminder = normalizeReminder({
    enabled: true,
    cycle: 'weekly',
    weekday: now.getDay(),
    time: `${pad(minuteBefore.getHours())}:${pad(minuteBefore.getMinutes())}`,
    lastNotifiedAt: null
  });

  const evaluation = evaluateReminder(reminder, now);
  assert.equal(evaluation.shouldNotify, true);
  assert.ok(evaluation.nextAt > now);
});

test('weekly reminder does not trigger twice in same due window', () => {
  const now = new Date();
  const minuteBefore = new Date(now.getTime() - 60 * 1000);
  const reminder = normalizeReminder({
    enabled: true,
    cycle: 'weekly',
    weekday: now.getDay(),
    time: `${pad(minuteBefore.getHours())}:${pad(minuteBefore.getMinutes())}`,
    lastNotifiedAt: now.toISOString()
  });

  const evaluation = evaluateReminder(reminder, now);
  assert.equal(evaluation.shouldNotify, false);
});

test('monthly reminder day is clamped and can calculate next run', () => {
  const now = new Date();
  const reminder = normalizeReminder({
    enabled: true,
    cycle: 'monthly',
    dayOfMonth: 40,
    time: '08:00'
  });

  assert.equal(reminder.dayOfMonth, 28);
  const nextAt = getNextReminderTime(reminder, now);
  assert.ok(nextAt instanceof Date);
  assert.ok(nextAt > now);
});

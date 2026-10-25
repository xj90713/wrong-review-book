import test from 'node:test';
import assert from 'node:assert/strict';

import { loginWithLocalState } from '../web/src/auth.js';
import {
  createChildProfile,
  createMistakeRecord,
  detectPotentialDuplicateMistakes,
  filterMistakesForUser,
  updateMistakeStatus
} from '../web/src/mistake-book.js';
import { createBackupBundle, parseBackupBundleText, serializeBackupBundle } from '../web/src/backup.js';
import { evaluateAutoExport, normalizeAutoExportConfig } from '../web/src/auto-export.js';
import { buildExportPayload, generateMarkdownDocument } from '../web/src/exporter.js';
import { evaluateReminder, normalizeReminder } from '../web/src/reminder.js';
import { createEmptyState } from '../web/src/storage.js';
import { filterMistakesByRecentDays, summarizeWeakPoints } from '../web/src/weak-points.js';

test('realistic end-to-end workflow remains consistent', () => {
  const now = new Date('2026-04-19T09:30:00.000Z');

  let state = createEmptyState();
  const loginResult = loginWithLocalState(
    state,
    { identifier: 'parent@example.com', displayName: '妈妈' },
    now
  );
  assert.equal(loginResult.ok, true);
  state = loginResult.state;
  const userId = loginResult.user.id;

  const childResult = createChildProfile(
    state,
    userId,
    { name: '小明', grade: '三年级', stage: '小学', subjects: ['语文', '数学', '英语'] },
    now
  );
  assert.equal(childResult.ok, true);
  state = childResult.state;
  const childId = childResult.child.id;

  const firstMistake = createMistakeRecord(
    state,
    userId,
    {
      childId,
      recordDate: '2026-04-10',
      subject: '语文',
      category: '错别字',
      originalQuestion: '把“拔河”写成“拨河”',
      wrongAnswer: '拨河',
      correctAnswer: '拔河',
      analysis: '形近字混淆',
      reviewTip: '每天默写 2 次',
      source: 'manual',
      status: '未复习',
      tags: '高频,期中'
    },
    now
  );
  assert.equal(firstMistake.ok, true);
  state = firstMistake.state;

  const secondMistake = createMistakeRecord(
    state,
    userId,
    {
      childId,
      recordDate: '2026-04-16',
      subject: '数学',
      category: '单位错误',
      originalQuestion: '应用题答案漏写单位 cm',
      wrongAnswer: '只写了数字',
      correctAnswer: '答案需补单位',
      analysis: '审题不完整',
      reviewTip: '解题后检查单位',
      source: 'photo',
      status: '需再次复习',
      tags: '单位,应用题'
    },
    now
  );
  assert.equal(secondMistake.ok, true);
  state = secondMistake.state;

  const duplicates = detectPotentialDuplicateMistakes(
    state,
    userId,
    childId,
    {
      subject: '语文',
      category: '错别字',
      originalQuestion: '把拔河写成拨河',
      wrongAnswer: '拨河'
    },
    { maxCount: 3 }
  );
  assert.ok(duplicates.length >= 1);
  assert.equal(duplicates[0].id, firstMistake.record.id);

  const statusResult = updateMistakeStatus(
    state,
    userId,
    firstMistake.record.id,
    '已复习',
    now
  );
  assert.equal(statusResult.ok, true);
  state = statusResult.state;

  const filtered = filterMistakesForUser(state, userId, {
    childId,
    subject: '数学',
    status: '需再次复习'
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, secondMistake.record.id);

  const exportResult = buildExportPayload({
    state,
    userId,
    childId,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'detailed',
    excludeMastered: true,
    prioritizeNeedReview: true,
    now
  });
  assert.equal(exportResult.ok, true);
  assert.equal(exportResult.payload.mistakes.length, 2);
  const markdown = generateMarkdownDocument(exportResult.payload);
  assert.match(markdown, /错题本复习材料/);
  assert.match(markdown, /需再次复习优先/);

  const weakPointInput = filterMistakesByRecentDays(state.mistakes, 90, now);
  const weakSummary = summarizeWeakPoints(weakPointInput, {
    minSample: 2,
    minFrequency: 1,
    minConsecutiveWeeks: 1,
    topN: 5
  });
  assert.equal(weakSummary.sufficient, true);
  assert.ok(weakSummary.highFrequency.length >= 1);

  const backupText = serializeBackupBundle(createBackupBundle(state, now));
  const parsedBackup = parseBackupBundleText(backupText);
  assert.equal(parsedBackup.ok, true);
  assert.equal(parsedBackup.state.mistakes.length, state.mistakes.length);

  const reminder = normalizeReminder({
    enabled: true,
    cycle: 'weekly',
    weekday: 0,
    time: '09:00',
    lastNotifiedAt: '2026-04-12T09:00:00.000Z'
  });
  const reminderStatus = evaluateReminder(reminder, now);
  assert.equal(reminderStatus.shouldNotify, true);

  const autoExport = normalizeAutoExportConfig({
    enabled: true,
    cycle: 'week',
    weekday: 0,
    time: '08:00',
    targetChildId: 'current',
    template: 'compact',
    format: 'pdf',
    lastGeneratedAt: '2026-04-12T08:00:00.000Z'
  });
  const autoExportStatus = evaluateAutoExport(autoExport, now);
  assert.equal(autoExportStatus.shouldGenerate, true);
});

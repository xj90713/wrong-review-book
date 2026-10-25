import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterMistakesByRecentDays,
  summarizeWeakPoints
} from '../web/src/weak-points.js';

function makeMistake({ id, date, subject, category, question = '', tags = [] }) {
  return {
    id,
    recordDate: date,
    subject,
    category,
    originalQuestion: question,
    analysis: '',
    reviewTip: '',
    tags
  };
}

test('filterMistakesByRecentDays keeps only expected window', () => {
  const mistakes = [
    makeMistake({ id: 'm1', date: '2026-04-01', subject: '语文', category: '错别字' }),
    makeMistake({ id: 'm2', date: '2026-04-15', subject: '语文', category: '错别字' }),
    makeMistake({ id: 'm3', date: '2026-04-18', subject: '数学', category: '单位错误' })
  ];

  const filtered = filterMistakesByRecentDays(mistakes, 7, new Date('2026-04-18T10:00:00.000Z'));
  assert.deepEqual(filtered.map((item) => item.id), ['m2', 'm3']);
});

test('summarizeWeakPoints reports insufficient sample when below threshold', () => {
  const mistakes = [
    makeMistake({ id: 'm1', date: '2026-04-18', subject: '语文', category: '错别字' })
  ];
  const summary = summarizeWeakPoints(mistakes, { minSample: 3 });
  assert.equal(summary.sufficient, false);
  assert.equal(summary.sampleCount, 1);
});

test('summarizeWeakPoints outputs high frequency and time range', () => {
  const mistakes = [
    makeMistake({ id: 'm1', date: '2026-04-01', subject: '语文', category: '多音字', question: '多音字读错' }),
    makeMistake({ id: 'm2', date: '2026-04-08', subject: '语文', category: '多音字', question: '多音字读错' }),
    makeMistake({ id: 'm3', date: '2026-04-15', subject: '语文', category: '多音字', question: '多音字读错' }),
    makeMistake({ id: 'm4', date: '2026-04-16', subject: '数学', category: '单位错误', question: '应用题单位漏写 cm' }),
    makeMistake({ id: 'm5', date: '2026-04-17', subject: '数学', category: '单位错误', question: '答案缺单位' }),
    makeMistake({ id: 'm6', date: '2026-04-18', subject: '英语', category: '语法', question: '过去式拼写错误' }),
    makeMistake({ id: 'm7', date: '2026-04-18', subject: '英语', category: '单词拼写', question: 'past tense 拼写错误' })
  ];

  const summary = summarizeWeakPoints(mistakes, {
    minSample: 5,
    minFrequency: 2,
    minConsecutiveWeeks: 3
  });

  assert.equal(summary.sufficient, true);
  assert.equal(summary.dateRange.startDate, '2026-04-01');
  assert.equal(summary.dateRange.endDate, '2026-04-18');

  const top = summary.highFrequency[0];
  assert.equal(top.subject, '语文');
  assert.equal(top.category, '多音字');
  assert.equal(top.count, 3);

  assert.equal(summary.consecutiveWeeks[0].category, '多音字');
  assert.equal(summary.consecutiveWeeks[0].weeks, 3);

  const patternLabels = summary.patterns.map((item) => item.label);
  assert.ok(patternLabels.includes('多音字易错'));
  assert.ok(patternLabels.includes('数学单位问题'));
  assert.ok(patternLabels.includes('英语过去式拼写'));
});

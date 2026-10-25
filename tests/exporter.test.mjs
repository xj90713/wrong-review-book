import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportFileName,
  buildExportPayload,
  buildPdfReviewPages,
  generateMarkdownDocument,
  generatePdfDocument,
  generateTextDocument,
  resolveExportFormat
} from '../web/src/exporter.js';
import { createEmptyState } from '../web/src/storage.js';

function createSampleState() {
  return {
    ...createEmptyState(),
    children: [
      {
        id: 'c1',
        userId: 'u1',
        name: '小明',
        grade: '三年级',
        stage: '小学'
      }
    ],
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-10',
        subject: '语文',
        category: '错别字',
        originalQuestion: '把拔河写成拨河',
        wrongAnswer: '拨河',
        correctAnswer: '拔河',
        analysis: '形近字混淆',
        reviewTip: '每天默写2次',
        source: 'manual',
        status: '未复习',
        tags: ['高频']
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-16',
        subject: '数学',
        category: '单位错误',
        originalQuestion: '应用题单位漏写',
        wrongAnswer: '答案写了数字无单位',
        correctAnswer: '补上单位',
        analysis: '审题不完整',
        reviewTip: '做完先检查单位',
        source: 'photo',
        status: '需再次复习',
        tags: ['单位']
      }
    ]
  };
}

function createStrategyState() {
  return {
    ...createEmptyState(),
    children: [
      {
        id: 'c1',
        userId: 'u1',
        name: '小明',
        grade: '三年级',
        stage: '小学'
      }
    ],
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-10',
        subject: '语文',
        category: '错别字',
        originalQuestion: '样本1',
        wrongAnswer: '',
        correctAnswer: '',
        analysis: '',
        reviewTip: '',
        source: 'manual',
        status: '已掌握',
        tags: [],
        createdAt: '2026-04-10T10:00:00.000Z'
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-11',
        subject: '语文',
        category: '错别字',
        originalQuestion: '样本2',
        wrongAnswer: '',
        correctAnswer: '',
        analysis: '',
        reviewTip: '',
        source: 'manual',
        status: '已复习',
        tags: [],
        createdAt: '2026-04-11T10:00:00.000Z'
      },
      {
        id: 'm3',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-12',
        subject: '语文',
        category: '错别字',
        originalQuestion: '样本3',
        wrongAnswer: '',
        correctAnswer: '',
        analysis: '',
        reviewTip: '',
        source: 'manual',
        status: '需再次复习',
        tags: [],
        createdAt: '2026-04-12T10:00:00.000Z'
      },
      {
        id: 'm4',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-13',
        subject: '语文',
        category: '错别字',
        originalQuestion: '样本4',
        wrongAnswer: '',
        correctAnswer: '',
        analysis: '',
        reviewTip: '',
        source: 'manual',
        status: '未复习',
        tags: [],
        createdAt: '2026-04-13T10:00:00.000Z'
      }
    ]
  };
}

test('buildExportPayload filters by child and date range', () => {
  const result = buildExportPayload({
    state: createSampleState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-12',
    endDate: '2026-04-18',
    template: 'compact',
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.mistakes.length, 1);
  assert.equal(result.payload.mistakes[0].subject, '数学');
  assert.equal(result.payload.from, '2026-04-12');
  assert.equal(result.payload.to, '2026-04-18');
});

test('buildExportPayload can exclude mastered mistakes', () => {
  const result = buildExportPayload({
    state: createStrategyState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'compact',
    excludeMastered: true,
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.payload.mistakes.map((item) => item.id),
    ['m3', 'm4', 'm2']
  );
  assert.equal(result.payload.options.excludeMastered, true);
});

test('buildExportPayload prioritizes need-review mistakes by default', () => {
  const result = buildExportPayload({
    state: createStrategyState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'compact',
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.payload.mistakes.map((item) => item.id),
    ['m3', 'm4', 'm2', 'm1']
  );
  assert.equal(result.payload.options.prioritizeNeedReview, true);
});

test('generateMarkdownDocument includes range/date/subject sections', () => {
  const result = buildExportPayload({
    state: createSampleState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'detailed',
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  assert.equal(result.ok, true);
  const markdown = generateMarkdownDocument(result.payload);
  assert.match(markdown, /导出范围：2026-04-01 至 2026-04-30/);
  assert.match(markdown, /导出策略：包含已掌握；需再次复习优先/);
  assert.match(markdown, /## 语文/);
  assert.match(markdown, /## 数学/);
  assert.match(markdown, /解析：形近字混淆/);
});

test('generatePdfDocument outputs valid PDF header and CJK font marker', () => {
  const result = buildExportPayload({
    state: createSampleState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'compact',
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  const bytes = generatePdfDocument(result.payload);
  const content = Buffer.from(bytes).toString('latin1');
  assert.ok(content.startsWith('%PDF-1.4'));
  assert.match(content, /STSong-Light/);
  assert.match(content, /\/Count 2\b/);
  assert.match(content, /startxref/);
});

test('resolveExportFormat uses clicked submit button value for PDF exports', () => {
  assert.equal(resolveExportFormat(undefined, 'pdf'), 'pdf');
  assert.equal(resolveExportFormat(null, 'txt'), 'txt');
  assert.equal(resolveExportFormat('markdown', ''), 'markdown');
  assert.equal(resolveExportFormat('markdown', 'pdf'), 'pdf');
});

test('buildPdfReviewPages separates child retry questions from answers', () => {
  const result = buildExportPayload({
    state: createSampleState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'detailed',
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  assert.equal(result.ok, true);
  const pages = buildPdfReviewPages(result.payload);
  const answerPageIndex = pages.findIndex((page) =>
    page.some((line) => line.includes('参考答案'))
  );
  assert.ok(answerPageIndex > 0);

  const questionText = pages.slice(0, answerPageIndex).flat().join('\n');
  const answerText = pages.slice(answerPageIndex).flat().join('\n');

  assert.match(questionText, /题目重做/);
  assert.match(questionText, /原题：应用题单位漏写/);
  assert.doesNotMatch(questionText, /正答：补上单位/);
  assert.doesNotMatch(questionText, /解析：审题不完整/);
  assert.match(answerText, /参考答案/);
  assert.match(answerText, /正答：补上单位/);
  assert.match(answerText, /解析：审题不完整/);
});

test('generateTextDocument includes plain text sections', () => {
  const result = buildExportPayload({
    state: createSampleState(),
    userId: 'u1',
    childId: 'c1',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    template: 'detailed',
    now: new Date('2026-04-18T10:00:00.000Z')
  });

  const text = generateTextDocument(result.payload);
  assert.match(text, /错题本复习材料/);
  assert.match(text, /导出范围：2026-04-01 至 2026-04-30/);
  assert.match(text, /\[语文\]/);
  assert.match(text, /解析：形近字混淆/);
});

test('buildExportFileName creates extension by format', () => {
  const markdownFileName = buildExportFileName({
    childName: '小明',
    from: '2026-04-01',
    to: '2026-04-30',
    format: 'markdown'
  });

  const pdfFileName = buildExportFileName({
    childName: '小明',
    from: '2026-04-01',
    to: '2026-04-30',
    format: 'pdf'
  });

  const txtFileName = buildExportFileName({
    childName: '小明',
    from: '2026-04-01',
    to: '2026-04-30',
    format: 'txt'
  });

  assert.match(markdownFileName, /\.md$/);
  assert.match(pdfFileName, /\.pdf$/);
  assert.match(txtFileName, /\.txt$/);
});

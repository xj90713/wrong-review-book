import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectPotentialDuplicateMistakes,
  deleteMistakeRecord,
  filterMistakesForUserChild,
  filterMistakesForUser,
  findMistakeByIdForUser,
  findMistakeByIdForUserChild,
  getCategoryOptionsBySubject,
  createChildProfile,
  createMistakeRecord,
  createOcrDraftFromText,
  guessCategoryByText,
  guessSubjectByText,
  listChildrenByUser,
  listMistakesForUserChild,
  resolveCurrentChildForUser,
  setCurrentChildForUser,
  updateMistakeRecord,
  updateMistakeStatus
} from '../web/src/mistake-book.js';
import { createEmptyState } from '../web/src/storage.js';

const NOW = new Date('2026-04-18T10:00:00.000Z');

test('createChildProfile requires userId and required fields', () => {
  const state = createEmptyState();
  assert.equal(createChildProfile(state, '', { name: '小明', grade: '三年级' }, NOW).ok, false);
  assert.equal(createChildProfile(state, 'u1', { name: '', grade: '三年级' }, NOW).ok, false);
  assert.equal(createChildProfile(state, 'u1', { name: '小明', grade: '' }, NOW).ok, false);
});

test('createChildProfile creates profile and sets current child', () => {
  const state = createEmptyState();
  const result = createChildProfile(
    state,
    'u1',
    {
      name: '小明',
      grade: '三年级',
      stage: '小学',
      subjects: ['语文', '数学']
    },
    NOW
  );

  assert.equal(result.ok, true);
  assert.equal(result.state.children.length, 1);
  assert.equal(result.state.currentChildId, result.child.id);
  assert.deepEqual(listChildrenByUser(result.state, 'u1').map((child) => child.name), ['小明']);
});

test('setCurrentChildForUser validates ownership', () => {
  const state = {
    ...createEmptyState(),
    children: [
      { id: 'c1', userId: 'u1', name: '小明' },
      { id: 'c2', userId: 'u2', name: '小红' }
    ]
  };

  assert.equal(setCurrentChildForUser(state, 'u1', 'c2').ok, false);
  const selected = setCurrentChildForUser(state, 'u1', 'c1');
  assert.equal(selected.ok, true);
  assert.equal(selected.state.currentChildId, 'c1');
});

test('resolveCurrentChildForUser falls back to first child of user', () => {
  const state = {
    ...createEmptyState(),
    currentChildId: 'missing',
    children: [
      { id: 'c1', userId: 'u1', name: '小明' },
      { id: 'c2', userId: 'u1', name: '小华' }
    ]
  };

  const current = resolveCurrentChildForUser(state, 'u1');
  assert.equal(current?.id, 'c1');
});

test('guessSubjectByText and guessCategoryByText infer reasonable values', () => {
  assert.equal(guessSubjectByText('because 拼写错了'), '英语');
  assert.equal(guessSubjectByText('应用题单位漏写了 5cm'), '数学');
  assert.equal(guessSubjectByText('多音字读错了'), '语文');

  assert.equal(guessCategoryByText('英语', '过去式语法错误'), '语法');
  assert.equal(guessCategoryByText('数学', '单位换算错了 cm'), '单位错误');
  assert.equal(guessCategoryByText('语文', '文言文翻译不准确'), '文言文翻译');
});

test('getCategoryOptionsBySubject returns preset categories', () => {
  assert.deepEqual(getCategoryOptionsBySubject('语文'), [
    '错别字',
    '多音字',
    '阅读理解',
    '文言文翻译',
    '古诗文',
    '病句'
  ]);
  assert.deepEqual(getCategoryOptionsBySubject('数学'), [
    '计算错误',
    '概念错误',
    '单位错误',
    '应用题',
    '几何题'
  ]);
  assert.deepEqual(getCategoryOptionsBySubject('invalid'), [
    '错别字',
    '多音字',
    '阅读理解',
    '文言文翻译',
    '古诗文',
    '病句'
  ]);
});

test('createOcrDraftFromText generates photo-source draft', () => {
  const draftResult = createOcrDraftFromText('数学应用题，单位漏写了', NOW);
  assert.equal(draftResult.ok, true);
  assert.equal(draftResult.draft.source, 'photo');
  assert.equal(draftResult.draft.subject, '数学');
  assert.equal(draftResult.draft.recordDate, '2026-04-18');
});

test('createMistakeRecord validates child ownership and required fields', () => {
  const state = {
    ...createEmptyState(),
    children: [{ id: 'c1', userId: 'u1', name: '小明' }]
  };

  assert.equal(createMistakeRecord(state, 'u1', { childId: '', subject: '语文', originalQuestion: 'x' }).ok, false);
  assert.equal(
    createMistakeRecord(state, 'u1', {
      childId: 'c2',
      subject: '语文',
      originalQuestion: 'x'
    }).ok,
    false
  );
  assert.equal(
    createMistakeRecord(state, 'u1', {
      childId: 'c1',
      subject: '未知',
      originalQuestion: 'x'
    }).ok,
    false
  );
  assert.equal(
    createMistakeRecord(state, 'u1', {
      childId: 'c1',
      subject: '语文',
      originalQuestion: ''
    }).ok,
    false
  );
});

test('createMistakeRecord defaults date/status/source and supports tags', () => {
  const state = {
    ...createEmptyState(),
    children: [{ id: 'c1', userId: 'u1', name: '小明' }]
  };

  const result = createMistakeRecord(
    state,
    'u1',
    {
      childId: 'c1',
      subject: '英语',
      category: '单词拼写',
      originalQuestion: 'because 拼错了',
      tags: '高频, 期中'
    },
    NOW
  );

  assert.equal(result.ok, true);
  assert.equal(result.record.recordDate, '2026-04-18');
  assert.equal(result.record.source, 'manual');
  assert.equal(result.record.status, '未复习');
  assert.deepEqual(result.record.tags, ['高频', '期中']);

  const listed = listMistakesForUserChild(result.state, 'u1', 'c1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].subject, '英语');
});

test('createMistakeRecord supports relatedMistakeId for same user and child', () => {
  const state = {
    ...createEmptyState(),
    children: [{ id: 'c1', userId: 'u1', name: '小明' }],
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-17',
        subject: '语文',
        category: '错别字',
        originalQuestion: '把“拔河”写成“拨河”',
        wrongAnswer: '',
        createdAt: '2026-04-17T10:00:00.000Z'
      }
    ]
  };

  const result = createMistakeRecord(
    state,
    'u1',
    {
      childId: 'c1',
      subject: '语文',
      category: '错别字',
      originalQuestion: '今天又把“拔河”写成“拨河”',
      relatedMistakeId: 'm1'
    },
    NOW
  );

  assert.equal(result.ok, true);
  assert.equal(result.record.relatedMistakeId, 'm1');
});

test('createMistakeRecord rejects invalid relatedMistakeId', () => {
  const state = {
    ...createEmptyState(),
    children: [{ id: 'c1', userId: 'u1', name: '小明' }],
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c2',
        recordDate: '2026-04-17',
        subject: '语文',
        category: '错别字',
        originalQuestion: '把“拔河”写成“拨河”',
        wrongAnswer: '',
        createdAt: '2026-04-17T10:00:00.000Z'
      }
    ]
  };

  const result = createMistakeRecord(
    state,
    'u1',
    {
      childId: 'c1',
      subject: '语文',
      category: '错别字',
      originalQuestion: '把“魄力”写成“魂力”',
      relatedMistakeId: 'm1'
    },
    NOW
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /关联历史错题不存在/);
});

test('detectPotentialDuplicateMistakes finds likely duplicates in same child only', () => {
  const state = {
    ...createEmptyState(),
    children: [{ id: 'c1', userId: 'u1', name: '小明' }],
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-10',
        subject: '语文',
        category: '错别字',
        originalQuestion: '今天的语文错别字：把“拔河”写成“拨河”',
        wrongAnswer: '拨河',
        createdAt: '2026-04-10T10:00:00.000Z'
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-11',
        subject: '语文',
        category: '阅读理解',
        originalQuestion: '阅读理解主旨概括错误',
        wrongAnswer: '',
        createdAt: '2026-04-11T10:00:00.000Z'
      },
      {
        id: 'm3',
        userId: 'u1',
        childId: 'c2',
        recordDate: '2026-04-12',
        subject: '语文',
        category: '错别字',
        originalQuestion: '今天的语文错别字：把“拔河”写成“拨河”',
        wrongAnswer: '拨河',
        createdAt: '2026-04-12T10:00:00.000Z'
      },
      {
        id: 'm4',
        userId: 'u2',
        childId: 'c1',
        recordDate: '2026-04-12',
        subject: '语文',
        category: '错别字',
        originalQuestion: '今天的语文错别字：把“拔河”写成“拨河”',
        wrongAnswer: '拨河',
        createdAt: '2026-04-12T10:00:00.000Z'
      }
    ]
  };

  const duplicates = detectPotentialDuplicateMistakes(state, 'u1', 'c1', {
    subject: '语文',
    category: '错别字',
    originalQuestion: '又把“拔河”写成“拨河”',
    wrongAnswer: '拨河'
  });

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].id, 'm1');
  assert.ok(duplicates[0].score >= 0.58);
});

test('filterMistakesForUserChild supports date/subject/status/category/tag filters', () => {
  const state = {
    ...createEmptyState(),
    children: [{ id: 'c1', userId: 'u1', name: '小明' }],
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-10',
        subject: '语文',
        category: '错别字',
        status: '未复习',
        tags: ['语文', '高频'],
        createdAt: '2026-04-10T10:00:00.000Z'
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-18',
        subject: '数学',
        category: '单位错误',
        status: '需再次复习',
        tags: ['单位'],
        createdAt: '2026-04-18T10:00:00.000Z'
      },
      {
        id: 'm3',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-16',
        subject: '英语',
        category: '单词拼写',
        status: '已复习',
        tags: ['期中'],
        createdAt: '2026-04-16T10:00:00.000Z'
      }
    ]
  };

  const filteredByDate = filterMistakesForUserChild(state, 'u1', 'c1', {
    startDate: '2026-04-15',
    endDate: '2026-04-18'
  });
  assert.deepEqual(
    filteredByDate.map((item) => item.id),
    ['m2', 'm3']
  );

  const filteredBySubjectStatus = filterMistakesForUserChild(state, 'u1', 'c1', {
    subject: '数学',
    status: '需再次复习'
  });
  assert.deepEqual(
    filteredBySubjectStatus.map((item) => item.id),
    ['m2']
  );

  const filteredByCategoryTag = filterMistakesForUserChild(state, 'u1', 'c1', {
    category: '拼写',
    tag: '期'
  });
  assert.deepEqual(
    filteredByCategoryTag.map((item) => item.id),
    ['m3']
  );
});

test('findMistakeByIdForUserChild returns owned record only', () => {
  const state = {
    ...createEmptyState(),
    mistakes: [
      { id: 'm1', userId: 'u1', childId: 'c1' },
      { id: 'm2', userId: 'u2', childId: 'c1' }
    ]
  };

  assert.equal(findMistakeByIdForUserChild(state, 'u1', 'c1', 'm1')?.id, 'm1');
  assert.equal(findMistakeByIdForUserChild(state, 'u1', 'c1', 'm2'), null);
  assert.equal(findMistakeByIdForUserChild(state, 'u1', 'c1', ''), null);
});

test('filterMistakesForUser supports all-children mode and child-specific mode', () => {
  const state = {
    ...createEmptyState(),
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-10',
        subject: '语文',
        category: '错别字',
        status: '未复习',
        tags: ['语文'],
        createdAt: '2026-04-10T10:00:00.000Z'
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c2',
        recordDate: '2026-04-18',
        subject: '数学',
        category: '单位错误',
        status: '需再次复习',
        tags: ['单位'],
        createdAt: '2026-04-18T10:00:00.000Z'
      },
      {
        id: 'm3',
        userId: 'u2',
        childId: 'c3',
        recordDate: '2026-04-18',
        subject: '英语',
        category: '语法',
        status: '已复习',
        tags: ['语法'],
        createdAt: '2026-04-18T10:00:00.000Z'
      }
    ]
  };

  const allChildren = filterMistakesForUser(state, 'u1', { childId: 'all' });
  assert.deepEqual(
    allChildren.map((item) => item.id),
    ['m2', 'm1']
  );

  const onlyC1 = filterMistakesForUser(state, 'u1', { childId: 'c1' });
  assert.deepEqual(
    onlyC1.map((item) => item.id),
    ['m1']
  );
});

test('findMistakeByIdForUser returns owned record only', () => {
  const state = {
    ...createEmptyState(),
    mistakes: [
      { id: 'm1', userId: 'u1', childId: 'c1' },
      { id: 'm2', userId: 'u2', childId: 'c1' }
    ]
  };

  assert.equal(findMistakeByIdForUser(state, 'u1', 'm1')?.id, 'm1');
  assert.equal(findMistakeByIdForUser(state, 'u1', 'm2'), null);
});

test('deleteMistakeRecord removes owned record and clears related links', () => {
  const state = {
    ...createEmptyState(),
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        relatedMistakeId: null,
        updatedAt: '2026-04-10T10:00:00.000Z'
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c1',
        relatedMistakeId: 'm1',
        updatedAt: '2026-04-11T10:00:00.000Z'
      },
      {
        id: 'm3',
        userId: 'u2',
        childId: 'c1',
        relatedMistakeId: 'm1',
        updatedAt: '2026-04-12T10:00:00.000Z'
      }
    ]
  };

  const result = deleteMistakeRecord(state, 'u1', 'm1', NOW);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.state.mistakes.map((item) => item.id),
    ['m2', 'm3']
  );
  assert.equal(result.state.mistakes.find((item) => item.id === 'm2')?.relatedMistakeId, null);
  assert.equal(result.state.mistakes.find((item) => item.id === 'm3')?.relatedMistakeId, 'm1');
});

test('deleteMistakeRecord validates ownership and id', () => {
  const state = {
    ...createEmptyState(),
    mistakes: [{ id: 'm1', userId: 'u1', childId: 'c1', relatedMistakeId: null }]
  };

  assert.equal(deleteMistakeRecord(state, '', 'm1', NOW).ok, false);
  assert.equal(deleteMistakeRecord(state, 'u1', '', NOW).ok, false);
  assert.equal(deleteMistakeRecord(state, 'u2', 'm1', NOW).ok, false);
});

test('updateMistakeRecord updates fields and keeps ownership constraints', () => {
  const state = {
    ...createEmptyState(),
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
        tags: ['高频'],
        relatedMistakeId: null,
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:00.000Z'
      }
    ]
  };

  const result = updateMistakeRecord(
    state,
    'u1',
    'm1',
    {
      subject: '英语',
      category: '单词拼写',
      originalQuestion: 'because 拼错',
      wrongAnswer: 'becase',
      status: '需再次复习',
      tags: '英语, 高频'
    },
    NOW
  );

  assert.equal(result.ok, true);
  assert.equal(result.record.subject, '英语');
  assert.equal(result.record.category, '单词拼写');
  assert.equal(result.record.status, '需再次复习');
  assert.deepEqual(result.record.tags, ['英语', '高频']);
  assert.equal(result.record.updatedAt, NOW.toISOString());
  assert.equal(result.record.childId, 'c1');
});

test('updateMistakeRecord validates required and enum fields', () => {
  const state = {
    ...createEmptyState(),
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
        analysis: '',
        reviewTip: '',
        source: 'manual',
        status: '未复习',
        tags: [],
        relatedMistakeId: null,
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:00.000Z'
      }
    ]
  };

  assert.equal(updateMistakeRecord(state, '', 'm1', { subject: '语文' }, NOW).ok, false);
  assert.equal(updateMistakeRecord(state, 'u1', '', { subject: '语文' }, NOW).ok, false);
  assert.equal(updateMistakeRecord(state, 'u1', 'm2', { subject: '语文' }, NOW).ok, false);
  assert.equal(updateMistakeRecord(state, 'u1', 'm1', { subject: '未知' }, NOW).ok, false);
  assert.equal(updateMistakeRecord(state, 'u1', 'm1', { source: 'unknown' }, NOW).ok, false);
  assert.equal(updateMistakeRecord(state, 'u1', 'm1', { status: 'x' }, NOW).ok, false);
  assert.equal(updateMistakeRecord(state, 'u1', 'm1', { originalQuestion: '' }, NOW).ok, false);
});

test('updateMistakeStatus updates only status with validation', () => {
  const state = {
    ...createEmptyState(),
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        recordDate: '2026-04-10',
        subject: '语文',
        category: '错别字',
        originalQuestion: '把拔河写成拨河',
        wrongAnswer: '',
        correctAnswer: '',
        analysis: '',
        reviewTip: '',
        source: 'manual',
        status: '未复习',
        tags: [],
        relatedMistakeId: null,
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:00.000Z'
      }
    ]
  };

  assert.equal(updateMistakeStatus(state, 'u1', 'm1', 'invalid', NOW).ok, false);
  const updated = updateMistakeStatus(state, 'u1', 'm1', '已掌握', NOW);
  assert.equal(updated.ok, true);
  assert.equal(updated.record.status, '已掌握');
  assert.equal(updated.record.subject, '语文');
});

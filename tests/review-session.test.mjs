import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareReviewAnswer,
  getReviewSessionProgress,
  isReviewSessionActive,
  listReviewAttemptsForChild,
  recordWeakPointView,
  resumeOrCreateReviewSession,
  stopReviewSession,
  submitReviewAnswer
} from '../web/src/review-session.js';
import { createEmptyState } from '../web/src/storage.js';

const NOW = new Date('2026-05-17T10:00:00.000Z');

function createReviewState() {
  return {
    ...createEmptyState(),
    mistakes: [
      {
        id: 'm1',
        userId: 'u1',
        childId: 'c1',
        subject: '数学',
        category: '单位错误',
        originalQuestion: '一盒彩笔有12支，3盒共有多少支？',
        correctAnswer: '36支',
        status: '未复习',
        recordDate: '2026-05-15',
        createdAt: '2026-05-15T08:00:00.000Z'
      },
      {
        id: 'm2',
        userId: 'u1',
        childId: 'c1',
        subject: '语文',
        category: '错别字',
        originalQuestion: '拔河的拔怎么写？',
        correctAnswer: '拔',
        status: '需再次复习',
        recordDate: '2026-05-16',
        createdAt: '2026-05-16T08:00:00.000Z'
      }
    ],
    reviewSessions: [],
    reviewAttempts: [],
    weakPointViews: []
  };
}

test('compareReviewAnswer normalizes whitespace and punctuation', () => {
  assert.equal(compareReviewAnswer(' 36 支。', '36支').isCorrect, true);
  assert.equal(compareReviewAnswer('36', '36支').isCorrect, false);
});

test('review session resumes stopped progress and remembers pending mistakes', () => {
  let state = createReviewState();
  const started = resumeOrCreateReviewSession(state, {
    userId: 'u1',
    childId: 'c1',
    mistakeIds: ['m1', 'm2'],
    now: NOW
  });
  state = started.state;

  const answered = submitReviewAnswer(state, {
    userId: 'u1',
    sessionId: started.session.id,
    mistakeId: 'm1',
    userAnswer: '36支',
    processNote: '12 * 3 = 36',
    correctAnswer: '36支',
    now: new Date('2026-05-17T10:01:00.000Z')
  });
  assert.equal(answered.ok, true);
  state = answered.state;

  const stopped = stopReviewSession(state, {
    userId: 'u1',
    sessionId: started.session.id,
    now: new Date('2026-05-17T10:02:00.000Z')
  });
  assert.equal(stopped.ok, true);
  state = stopped.state;

  const resumed = resumeOrCreateReviewSession(state, {
    userId: 'u1',
    childId: 'c1',
    mistakeIds: ['m1', 'm2'],
    now: new Date('2026-05-17T10:03:00.000Z')
  });
  const progress = getReviewSessionProgress(resumed.session);

  assert.equal(resumed.isNewSession, false);
  assert.equal(progress.reviewedCount, 1);
  assert.deepEqual(progress.pendingMistakeIds, ['m2']);
  assert.equal(resumed.currentMistakeId, 'm2');
});

test('stopped review sessions are resumable but not active', () => {
  const started = resumeOrCreateReviewSession(createReviewState(), {
    userId: 'u1',
    childId: 'c1',
    mistakeIds: ['m1', 'm2'],
    now: NOW
  });
  const stopped = stopReviewSession(started.state, {
    userId: 'u1',
    sessionId: started.session.id,
    now: new Date('2026-05-17T10:02:00.000Z')
  });

  assert.equal(stopped.ok, true);
  assert.equal(isReviewSessionActive(stopped.session), false);
});

test('submitReviewAnswer records attempt, updates status, and advances next mistake', () => {
  const started = resumeOrCreateReviewSession(createReviewState(), {
    userId: 'u1',
    childId: 'c1',
    mistakeIds: ['m1', 'm2'],
    now: NOW
  });

  const result = submitReviewAnswer(started.state, {
    userId: 'u1',
    sessionId: started.session.id,
    mistakeId: 'm1',
    userAnswer: '36',
    processNote: '只写了数字',
    correctAnswer: '36支',
    now: new Date('2026-05-17T10:01:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempt.isCorrect, false);
  assert.equal(result.nextMistakeId, 'm2');
  assert.equal(result.state.reviewAttempts.length, 1);
  assert.equal(result.state.mistakes.find((item) => item.id === 'm1').status, '需再次复习');
});

test('review attempts remain countable after a mistake leaves the pending queue', () => {
  const started = resumeOrCreateReviewSession(createReviewState(), {
    userId: 'u1',
    childId: 'c1',
    mistakeIds: ['m1'],
    now: NOW
  });
  const result = submitReviewAnswer(started.state, {
    userId: 'u1',
    sessionId: started.session.id,
    mistakeId: 'm1',
    userAnswer: '36支',
    processNote: '12 * 3 = 36',
    correctAnswer: '36支',
    now: new Date('2026-05-17T10:01:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.mistakes.find((item) => item.id === 'm1').status, '已复习');
  assert.equal(listReviewAttemptsForChild(result.state, 'u1', 'c1').length, 1);
});

test('recordWeakPointView tracks repeated insight visits per user', () => {
  const first = recordWeakPointView(createReviewState(), {
    userId: 'u1',
    scope: 'current',
    now: NOW
  });
  const second = recordWeakPointView(first.state, {
    userId: 'u1',
    scope: 'current',
    now: new Date('2026-05-17T11:00:00.000Z')
  });

  assert.equal(second.entry.viewCount, 2);
  assert.equal(second.state.weakPointViews.length, 1);
});

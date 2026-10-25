function makeId(prefix, now = new Date()) {
  return `${prefix}_${now.getTime()}_${Math.random().toString(16).slice(2, 8)}`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeAnswerForCompare(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’（）()\[\]【】]/g, '')
    .replace(/\s+/g, '');
}

export function compareReviewAnswer(userAnswer, correctAnswer) {
  const normalizedUserAnswer = normalizeAnswerForCompare(userAnswer);
  const normalizedCorrectAnswer = normalizeAnswerForCompare(correctAnswer);
  return {
    normalizedUserAnswer,
    normalizedCorrectAnswer,
    isCorrect:
      normalizedUserAnswer.length > 0 &&
      normalizedCorrectAnswer.length > 0 &&
      normalizedUserAnswer === normalizedCorrectAnswer
  };
}

function getSessionMistakeIds(session) {
  return ensureArray(session?.mistakeIds).filter(Boolean);
}

function unique(values) {
  return [...new Set(ensureArray(values).filter(Boolean))];
}

function getPendingMistakeIds(session) {
  const reviewed = new Set(ensureArray(session?.reviewedMistakeIds));
  return getSessionMistakeIds(session).filter((id) => !reviewed.has(id));
}

function normalizeSessionQueue(session, mistakeIds) {
  return unique([...getSessionMistakeIds(session), ...ensureArray(mistakeIds)]);
}

export function getReviewSessionProgress(session) {
  const mistakeIds = getSessionMistakeIds(session);
  const reviewedMistakeIds = unique(session?.reviewedMistakeIds);
  const skippedMistakeIds = unique(session?.skippedMistakeIds);
  const pendingMistakeIds = getPendingMistakeIds(session);
  return {
    totalCount: mistakeIds.length,
    reviewedCount: reviewedMistakeIds.length,
    pendingCount: pendingMistakeIds.length,
    reviewedMistakeIds,
    skippedMistakeIds,
    pendingMistakeIds,
    isComplete: mistakeIds.length > 0 && pendingMistakeIds.length === 0
  };
}

export function getCurrentReviewMistakeId(session) {
  return getPendingMistakeIds(session)[0] ?? null;
}

function findResumableSession(state, userId, childId) {
  return ensureArray(state.reviewSessions)
    .filter(
      (session) =>
        session.userId === userId &&
        session.childId === childId &&
        !session.completedAt
    )
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] ?? null;
}

export function isReviewSessionActive(session) {
  return Boolean(session && !session.completedAt && !session.stoppedAt);
}

export function listReviewAttemptsForChild(state, userId, childId) {
  const mistakeIds = new Set(
    ensureArray(state.mistakes)
      .filter((mistake) => mistake.userId === userId && mistake.childId === childId)
      .map((mistake) => mistake.id)
  );
  return ensureArray(state.reviewAttempts).filter(
    (attempt) => attempt.userId === userId && mistakeIds.has(attempt.mistakeId)
  );
}

export function resumeOrCreateReviewSession(state, { userId, childId, mistakeIds, now = new Date() }) {
  const timestamp = now.toISOString();
  const sessions = ensureArray(state.reviewSessions);
  const existing = findResumableSession(state, userId, childId);

  if (existing) {
    const nextSession = {
      ...existing,
      mistakeIds: normalizeSessionQueue(existing, mistakeIds),
      stoppedAt: null,
      resumedAt: timestamp,
      updatedAt: timestamp
    };
    const nextSessions = sessions.map((session) =>
      session.id === existing.id ? nextSession : session
    );
    return {
      state: { ...state, reviewSessions: nextSessions },
      session: nextSession,
      currentMistakeId: getCurrentReviewMistakeId(nextSession),
      isNewSession: false
    };
  }

  const session = {
    id: makeId('review_session', now),
    userId,
    childId,
    mistakeIds: unique(mistakeIds),
    reviewedMistakeIds: [],
    skippedMistakeIds: [],
    correctMistakeIds: [],
    incorrectMistakeIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    stoppedAt: null,
    completedAt: null
  };

  return {
    state: { ...state, reviewSessions: [...sessions, session] },
    session,
    currentMistakeId: getCurrentReviewMistakeId(session),
    isNewSession: true
  };
}

export function stopReviewSession(state, { userId, sessionId, now = new Date() }) {
  const sessions = ensureArray(state.reviewSessions);
  const session = sessions.find((item) => item.id === sessionId && item.userId === userId);
  if (!session) {
    return { ok: false, error: '复习会话不存在。' };
  }

  const timestamp = now.toISOString();
  const nextSession = {
    ...session,
    stoppedAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ok: true,
    state: {
      ...state,
      reviewSessions: sessions.map((item) => (item.id === session.id ? nextSession : item))
    },
    session: nextSession
  };
}

function updateMistakeAfterAttempt(mistake, attempt, now) {
  if (!mistake) return mistake;
  return {
    ...mistake,
    status: attempt.isCorrect ? '已复习' : '需再次复习',
    reviewCount: Number(mistake.reviewCount || 0) + 1,
    lastReviewedAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export function submitReviewAnswer(
  state,
  { userId, sessionId, mistakeId, userAnswer, processNote, correctAnswer, now = new Date() }
) {
  const sessions = ensureArray(state.reviewSessions);
  const session = sessions.find((item) => item.id === sessionId && item.userId === userId);
  if (!session) {
    return { ok: false, error: '复习会话不存在。' };
  }
  if (!getSessionMistakeIds(session).includes(mistakeId)) {
    return { ok: false, error: '该错题不在当前复习队列中。' };
  }

  const timestamp = now.toISOString();
  const comparison = compareReviewAnswer(userAnswer, correctAnswer);
  const attempt = {
    id: makeId('review_attempt', now),
    userId,
    sessionId,
    mistakeId,
    userAnswer: String(userAnswer ?? '').trim(),
    processNote: String(processNote ?? '').trim(),
    correctAnswerSnapshot: String(correctAnswer ?? '').trim(),
    isCorrect: comparison.isCorrect,
    normalizedUserAnswer: comparison.normalizedUserAnswer,
    normalizedCorrectAnswer: comparison.normalizedCorrectAnswer,
    createdAt: timestamp
  };

  const reviewedMistakeIds = unique([...session.reviewedMistakeIds, mistakeId]);
  const correctMistakeIds = attempt.isCorrect
    ? unique([...session.correctMistakeIds, mistakeId])
    : unique(ensureArray(session.correctMistakeIds).filter((id) => id !== mistakeId));
  const incorrectMistakeIds = attempt.isCorrect
    ? unique(ensureArray(session.incorrectMistakeIds).filter((id) => id !== mistakeId))
    : unique([...session.incorrectMistakeIds, mistakeId]);
  const nextSessionDraft = {
    ...session,
    reviewedMistakeIds,
    correctMistakeIds,
    incorrectMistakeIds,
    stoppedAt: null,
    updatedAt: timestamp
  };
  const progress = getReviewSessionProgress(nextSessionDraft);
  const nextSession = {
    ...nextSessionDraft,
    completedAt: progress.isComplete ? timestamp : null
  };
  const nextMistakeId = getCurrentReviewMistakeId(nextSession);
  const mistakes = ensureArray(state.mistakes).map((mistake) =>
    mistake.id === mistakeId && mistake.userId === userId
      ? updateMistakeAfterAttempt(mistake, attempt, now)
      : mistake
  );

  return {
    ok: true,
    state: {
      ...state,
      mistakes,
      reviewSessions: sessions.map((item) => (item.id === session.id ? nextSession : item)),
      reviewAttempts: [...ensureArray(state.reviewAttempts), attempt]
    },
    session: nextSession,
    attempt,
    nextMistakeId
  };
}

export function recordWeakPointView(state, { userId, scope = 'current', now = new Date() }) {
  const timestamp = now.toISOString();
  const views = ensureArray(state.weakPointViews);
  const existing = views.find((item) => item.userId === userId && item.scope === scope);
  const entry = existing
    ? {
        ...existing,
        viewCount: Number(existing.viewCount || 0) + 1,
        lastViewedAt: timestamp,
        updatedAt: timestamp
      }
    : {
        id: makeId('weak_view', now),
        userId,
        scope,
        viewCount: 1,
        firstViewedAt: timestamp,
        lastViewedAt: timestamp,
        updatedAt: timestamp
      };

  return {
    state: {
      ...state,
      weakPointViews: existing
        ? views.map((item) => (item.id === existing.id ? entry : item))
        : [...views, entry]
    },
    entry
  };
}

import { normalizeQuestionImage } from './question-images.js';
const SUBJECT_OPTIONS = ['语文', '数学', '英语'];
const REVIEW_STATUS_OPTIONS = ['未复习', '已复习', '已掌握', '需再次复习'];
const SOURCE_OPTIONS = ['manual', 'voice', 'photo'];
const STAGE_OPTIONS = ['小学', '初中', '高中'];
const CATEGORY_MAP = {
  语文: ['错别字', '多音字', '阅读理解', '文言文翻译', '古诗文', '病句'],
  数学: ['计算错误', '概念错误', '单位错误', '应用题', '几何题'],
  英语: ['单词拼写', '句型', '语法', '阅读理解', '翻译']
};

function randomIdSuffix() {
  return Math.random().toString(16).slice(2, 8);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

function normalizeSubject(value) {
  const text = String(value ?? '').trim();
  return SUBJECT_OPTIONS.includes(text) ? text : null;
}

function normalizeStage(value) {
  const text = String(value ?? '').trim();
  return STAGE_OPTIONS.includes(text) ? text : '小学';
}

function normalizeSource(value) {
  const text = String(value ?? '').trim();
  return SOURCE_OPTIONS.includes(text) ? text : 'manual';
}

function parseSource(value) {
  const text = String(value ?? '').trim();
  return SOURCE_OPTIONS.includes(text) ? text : null;
}

function normalizeReviewStatus(value) {
  const text = String(value ?? '').trim();
  return REVIEW_STATUS_OPTIONS.includes(text) ? text : '未复习';
}

function parseReviewStatus(value) {
  const text = String(value ?? '').trim();
  return REVIEW_STATUS_OPTIONS.includes(text) ? text : null;
}

function hasOwn(value, key) {
  return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeRecordDate(value, now = new Date()) {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return localDateString(now);
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return normalizeArray(value);
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return [];
  }
  return text
    .split(/[,\uFF0C]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFilterText(value) {
  return String(value ?? '').trim();
}

function normalizedTextForCompare(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？；：“”"'（）()、,.!?;:]/g, '');
}

function makeNgrams(text, n = 2) {
  const chars = Array.from(text);
  if (chars.length === 0) return new Set();
  if (chars.length < n) return new Set([chars.join('')]);
  const set = new Set();
  for (let i = 0; i <= chars.length - n; i += 1) {
    set.add(chars.slice(i, i + n).join(''));
  }
  return set;
}

function jaccardSimilarity(textA, textB) {
  const a = normalizedTextForCompare(textA);
  const b = normalizedTextForCompare(textB);
  if (!a && !b) return 0;
  if (a && b && a === b) return 1;
  const gramsA = makeNgrams(a, 2);
  const gramsB = makeNgrams(b, 2);
  const union = new Set([...gramsA, ...gramsB]);
  if (union.size === 0) return 0;
  let intersectionCount = 0;
  gramsA.forEach((value) => {
    if (gramsB.has(value)) {
      intersectionCount += 1;
    }
  });
  return intersectionCount / union.size;
}

export function getSubjectOptions() {
  return [...SUBJECT_OPTIONS];
}

export function getReviewStatusOptions() {
  return [...REVIEW_STATUS_OPTIONS];
}

export function getSourceOptions() {
  return [...SOURCE_OPTIONS];
}

export function getCategoryOptionsBySubject(subject) {
  const key = normalizeSubject(subject) ?? '语文';
  return [...(CATEGORY_MAP[key] ?? CATEGORY_MAP['语文'])];
}

export function listChildrenByUser(state, userId) {
  return state.children.filter((child) => child.userId === userId);
}

export function setCurrentChildForUser(state, userId, childId) {
  const found = state.children.find((child) => child.id === childId && child.userId === userId);
  if (!found) {
    return { ok: false, error: '找不到该孩子档案。' };
  }

  return {
    ok: true,
    state: {
      ...state,
      currentChildId: found.id
    },
    child: found
  };
}

export function createChildProfile(state, userId, input, now = new Date()) {
  if (!userId) {
    return { ok: false, error: '请先登录家长账号。' };
  }

  const name = String(input?.name ?? '').trim();
  const grade = String(input?.grade ?? '').trim();
  if (!name) {
    return { ok: false, error: '孩子姓名/昵称不能为空。' };
  }
  if (!grade) {
    return { ok: false, error: '年级不能为空。' };
  }

  const child = {
    id: `child_${now.getTime()}_${randomIdSuffix()}`,
    userId,
    name,
    grade,
    stage: normalizeStage(input?.stage),
    subjects: normalizeArray(input?.subjects?.length ? input.subjects : SUBJECT_OPTIONS),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  return {
    ok: true,
    child,
    state: {
      ...state,
      children: [...state.children, child],
      currentChildId: child.id
    }
  };
}

export function resolveCurrentChildForUser(state, userId) {
  const byUser = listChildrenByUser(state, userId);
  if (byUser.length === 0) {
    return null;
  }
  const matched = byUser.find((item) => item.id === state.currentChildId);
  return matched ?? byUser[0];
}

export function guessSubjectByText(text) {
  const content = String(text ?? '').trim();
  if (!content) return '语文';

  const mathPattern = /[\d+\-*/=]|单位|应用题|方程|几何|计算|厘米|米|千克|kg|cm|m\b/i;
  if (mathPattern.test(content)) {
    return '数学';
  }

  const englishPattern = /because|grammar|word|sentence|拼写|句型|语法|时态|阅读/i;
  if (englishPattern.test(content) || /[A-Za-z]{3,}/.test(content)) {
    return '英语';
  }

  return '语文';
}

export function guessCategoryByText(subject, text) {
  const content = String(text ?? '').trim();
  if (subject === '语文') {
    if (/多音字/.test(content)) return '多音字';
    if (/文言文|翻译/.test(content)) return '文言文翻译';
    if (/阅读/.test(content)) return '阅读理解';
    if (/病句/.test(content)) return '病句';
    if (/古诗|诗词/.test(content)) return '古诗文';
    return '错别字';
  }
  if (subject === '数学') {
    if (/单位|kg|cm|米|千克/i.test(content)) return '单位错误';
    if (/几何|面积|周长|角/.test(content)) return '几何题';
    if (/概念/.test(content)) return '概念错误';
    if (/应用题/.test(content)) return '应用题';
    return '计算错误';
  }
  if (/语法|时态|be动词/i.test(content)) return '语法';
  if (/阅读/.test(content)) return '阅读理解';
  if (/翻译/.test(content)) return '翻译';
  if (/句型/.test(content)) return '句型';
  return '单词拼写';
}

export function createOcrDraftFromText(rawText, now = new Date()) {
  const text = String(rawText ?? '').trim();
  if (!text) {
    return { ok: false, error: 'OCR 原文不能为空。' };
  }

  const subject = guessSubjectByText(text);
  const category = guessCategoryByText(subject, text);

  return {
    ok: true,
    draft: {
      subject,
      category,
      source: 'photo',
      recordDate: localDateString(now),
      originalQuestion: text
    }
  };
}

export function createMistakeRecord(state, userId, input, now = new Date()) {
  if (!userId) {
    return { ok: false, error: '请先登录家长账号。' };
  }

  const childId = String(input?.childId ?? '').trim();
  if (!childId) {
    return { ok: false, error: '请选择孩子档案。' };
  }

  const child = state.children.find((item) => item.id === childId && item.userId === userId);
  if (!child) {
    return { ok: false, error: '该孩子档案不存在或不属于当前账号。' };
  }

  const subject = normalizeSubject(input?.subject);
  if (!subject) {
    return { ok: false, error: '请选择学科（语文/数学/英语）。' };
  }

  const originalQuestion = String(input?.originalQuestion ?? '').trim();
  const questionImage = normalizeQuestionImage(input?.questionImage);
  if (!originalQuestion && !questionImage) {
    return { ok: false, error: '原题内容不能为空。请填写文字或添加题目图片。' };
  }

  const relatedMistakeId = String(input?.relatedMistakeId ?? '').trim();
  if (relatedMistakeId) {
    const related = state.mistakes.find(
      (item) =>
        item.id === relatedMistakeId && item.userId === userId && item.childId === childId
    );
    if (!related) {
      return { ok: false, error: '关联历史错题不存在，或不属于当前孩子。' };
    }
  }

  const createdAt = now.toISOString();
  const record = {
    id: `mistake_${now.getTime()}_${randomIdSuffix()}`,
    userId,
    childId: child.id,
    recordDate: normalizeRecordDate(input?.recordDate, now),
    subject,
    category: String(input?.category ?? '').trim() || '未分类',
    originalQuestion,
    questionImage,
    wrongAnswer: String(input?.wrongAnswer ?? '').trim(),
    correctAnswer: String(input?.correctAnswer ?? '').trim(),
    analysis: String(input?.analysis ?? '').trim(),
    reviewTip: String(input?.reviewTip ?? '').trim(),
    source: normalizeSource(input?.source),
    status: normalizeReviewStatus(input?.status),
    tags: normalizeTags(input?.tags),
    relatedMistakeId: relatedMistakeId || null,
    createdAt,
    updatedAt: createdAt
  };

  return {
    ok: true,
    record,
    state: {
      ...state,
      mistakes: [...state.mistakes, record],
      currentChildId: child.id
    }
  };
}

export function deleteMistakeRecord(state, userId, mistakeId, now = new Date()) {
  if (!userId) {
    return { ok: false, error: '请先登录家长账号。' };
  }

  const id = normalizeFilterText(mistakeId);
  if (!id) {
    return { ok: false, error: '缺少要删除的错题 ID。' };
  }

  const target = state.mistakes.find((item) => item.id === id && item.userId === userId);
  if (!target) {
    return { ok: false, error: '要删除的错题不存在。' };
  }

  const updatedAt = now.toISOString();
  const nextMistakes = state.mistakes
    .filter((item) => !(item.id === id && item.userId === userId))
    .map((item) =>
      item.userId === userId && item.relatedMistakeId === id
        ? { ...item, relatedMistakeId: null, updatedAt }
        : item
    );

  return {
    ok: true,
    deleted: target,
    state: {
      ...state,
      mistakes: nextMistakes
    }
  };
}

export function updateMistakeRecord(state, userId, mistakeId, input, now = new Date()) {
  if (!userId) {
    return { ok: false, error: '请先登录家长账号。' };
  }

  const id = normalizeFilterText(mistakeId);
  if (!id) {
    return { ok: false, error: '缺少要更新的错题 ID。' };
  }

  const index = state.mistakes.findIndex((item) => item.id === id && item.userId === userId);
  if (index < 0) {
    return { ok: false, error: '要更新的错题不存在。' };
  }

  const current = state.mistakes[index];

  let subject = current.subject;
  if (hasOwn(input, 'subject')) {
    const nextSubject = normalizeSubject(input?.subject);
    if (!nextSubject) {
      return { ok: false, error: '请选择学科（语文/数学/英语）。' };
    }
    subject = nextSubject;
  }

  const originalQuestion = hasOwn(input, 'originalQuestion')
    ? String(input?.originalQuestion ?? '').trim()
    : String(current.originalQuestion ?? '').trim();
  const questionImage = normalizeQuestionImage(hasOwn(input, 'questionImage') ? input.questionImage : current.questionImage);
  if (!originalQuestion && !questionImage) {
    return { ok: false, error: '原题内容不能为空。请填写文字或添加题目图片。' };
  }

  let source = current.source;
  if (hasOwn(input, 'source')) {
    const nextSource = parseSource(input?.source);
    if (!nextSource) {
      return { ok: false, error: '来源不合法。' };
    }
    source = nextSource;
  }

  let status = current.status;
  if (hasOwn(input, 'status')) {
    const nextStatus = parseReviewStatus(input?.status);
    if (!nextStatus) {
      return { ok: false, error: '状态不合法。' };
    }
    status = nextStatus;
  }

  let relatedMistakeId = current.relatedMistakeId;
  if (hasOwn(input, 'relatedMistakeId')) {
    relatedMistakeId = String(input?.relatedMistakeId ?? '').trim() || null;
  }
  if (relatedMistakeId === current.id) {
    return { ok: false, error: '不能关联自己。' };
  }
  if (relatedMistakeId) {
    const related = state.mistakes.find(
      (item) =>
        item.id === relatedMistakeId && item.userId === userId && item.childId === current.childId
    );
    if (!related) {
      return { ok: false, error: '关联历史错题不存在，或不属于当前孩子。' };
    }
  }

  const updatedAt = now.toISOString();
  const nextRecord = {
    ...current,
    recordDate: hasOwn(input, 'recordDate')
      ? normalizeRecordDate(input?.recordDate, now)
      : normalizeRecordDate(current.recordDate, now),
    subject,
    category: hasOwn(input, 'category')
      ? String(input?.category ?? '').trim() || '未分类'
      : String(current.category ?? '').trim() || '未分类',
    originalQuestion,
    questionImage,
    wrongAnswer: hasOwn(input, 'wrongAnswer')
      ? String(input?.wrongAnswer ?? '').trim()
      : String(current.wrongAnswer ?? '').trim(),
    correctAnswer: hasOwn(input, 'correctAnswer')
      ? String(input?.correctAnswer ?? '').trim()
      : String(current.correctAnswer ?? '').trim(),
    analysis: hasOwn(input, 'analysis')
      ? String(input?.analysis ?? '').trim()
      : String(current.analysis ?? '').trim(),
    reviewTip: hasOwn(input, 'reviewTip')
      ? String(input?.reviewTip ?? '').trim()
      : String(current.reviewTip ?? '').trim(),
    source,
    status,
    tags: hasOwn(input, 'tags') ? normalizeTags(input?.tags) : normalizeTags(current.tags),
    relatedMistakeId,
    updatedAt
  };

  const nextMistakes = state.mistakes.slice();
  nextMistakes[index] = nextRecord;

  return {
    ok: true,
    record: nextRecord,
    state: {
      ...state,
      mistakes: nextMistakes
    }
  };
}

export function updateMistakeStatus(state, userId, mistakeId, status, now = new Date()) {
  const nextStatus = parseReviewStatus(status);
  if (!nextStatus) {
    return { ok: false, error: '状态不合法。' };
  }
  return updateMistakeRecord(
    state,
    userId,
    mistakeId,
    {
      status: nextStatus
    },
    now
  );
}

export function listMistakesForUserChild(state, userId, childId) {
  return state.mistakes
    .filter((item) => item.userId === userId && item.childId === childId)
    .slice()
    .sort((a, b) => {
      const dateCompare = b.recordDate.localeCompare(a.recordDate);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export function listMistakesForUser(state, userId) {
  return state.mistakes
    .filter((item) => item.userId === userId)
    .slice()
    .sort((a, b) => {
      const dateCompare = b.recordDate.localeCompare(a.recordDate);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export function findMistakeByIdForUserChild(state, userId, childId, mistakeId) {
  const id = normalizeFilterText(mistakeId);
  if (!id) {
    return null;
  }
  return (
    state.mistakes.find(
      (item) => item.id === id && item.userId === userId && item.childId === childId
    ) ?? null
  );
}

export function findMistakeByIdForUser(state, userId, mistakeId) {
  const id = normalizeFilterText(mistakeId);
  if (!id) {
    return null;
  }
  return state.mistakes.find((item) => item.id === id && item.userId === userId) ?? null;
}

export function filterMistakesForUser(state, userId, filters = {}) {
  const startDate = normalizeFilterText(filters.startDate);
  const endDate = normalizeFilterText(filters.endDate);
  const dateStart = startDate && endDate ? (startDate <= endDate ? startDate : endDate) : startDate;
  const dateEnd = startDate && endDate ? (startDate <= endDate ? endDate : startDate) : endDate;
  const childId = normalizeFilterText(filters.childId);
  const subject = normalizeFilterText(filters.subject);
  const category = normalizeFilterText(filters.category).toLowerCase();
  const status = normalizeFilterText(filters.status);
  const tag = normalizeFilterText(filters.tag).toLowerCase();

  return listMistakesForUser(state, userId).filter((item) => {
    if (childId && childId !== 'all' && item.childId !== childId) {
      return false;
    }
    if (dateStart && item.recordDate < dateStart) {
      return false;
    }
    if (dateEnd && item.recordDate > dateEnd) {
      return false;
    }
    if (subject && subject !== 'all' && item.subject !== subject) {
      return false;
    }
    if (category && !String(item.category ?? '').toLowerCase().includes(category)) {
      return false;
    }
    if (status && status !== 'all' && item.status !== status) {
      return false;
    }
    if (
      tag &&
      !item.tags.some((itemTag) => String(itemTag ?? '').toLowerCase().includes(tag))
    ) {
      return false;
    }
    return true;
  });
}

export function filterMistakesForUserChild(state, userId, childId, filters = {}) {
  return filterMistakesForUser(state, userId, {
    ...filters,
    childId
  });
}

export function detectPotentialDuplicateMistakes(
  state,
  userId,
  childId,
  input,
  options = {}
) {
  const subject = normalizeSubject(input?.subject);
  const originalQuestion = String(input?.originalQuestion ?? '').trim();
  if (!subject || !originalQuestion) {
    return [];
  }

  const category = String(input?.category ?? '').trim();
  const wrongAnswer = String(input?.wrongAnswer ?? '').trim();
  const threshold =
    typeof options.threshold === 'number' && options.threshold > 0 && options.threshold <= 1
      ? options.threshold
      : 0.58;
  const maxCount =
    Number.isInteger(options.maxCount) && options.maxCount > 0 ? options.maxCount : 5;

  const candidates = listMistakesForUserChild(state, userId, childId);
  return candidates
    .map((record) => {
      const questionScore = jaccardSimilarity(record.originalQuestion, originalQuestion);
      const wrongScore = wrongAnswer
        ? jaccardSimilarity(record.wrongAnswer ?? '', wrongAnswer)
        : 0;
      const subjectScore = record.subject === subject ? 0.22 : 0;
      const categoryScore = category && record.category === category ? 0.14 : 0;
      const exactBonus =
        normalizedTextForCompare(record.originalQuestion) ===
        normalizedTextForCompare(originalQuestion)
          ? 0.2
          : 0;
      const score = Math.min(
        1,
        questionScore * 0.49 + wrongScore * 0.15 + subjectScore + categoryScore + exactBonus
      );
      return {
        id: record.id,
        score,
        record
      };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score || b.record.recordDate.localeCompare(a.record.recordDate))
    .slice(0, maxCount);
}

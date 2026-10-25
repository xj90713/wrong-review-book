function parseRecordDate(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date) {
  const day = date.getDay(); // Sunday 0
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const next = new Date(date);
  next.setDate(next.getDate() + mondayOffset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekKey(date) {
  return formatDate(getWeekStart(date));
}

function calcLongestConsecutiveStreak(sortedWeekKeys) {
  if (sortedWeekKeys.length === 0) {
    return { length: 0, start: null, end: null };
  }

  let bestLength = 1;
  let bestStart = sortedWeekKeys[0];
  let bestEnd = sortedWeekKeys[0];

  let currentLength = 1;
  let currentStart = sortedWeekKeys[0];

  for (let index = 1; index < sortedWeekKeys.length; index += 1) {
    const prev = new Date(`${sortedWeekKeys[index - 1]}T00:00:00`);
    const next = new Date(`${sortedWeekKeys[index]}T00:00:00`);
    const diffDays = Math.round((next - prev) / (24 * 3600 * 1000));

    if (diffDays === 7) {
      currentLength += 1;
    } else {
      currentLength = 1;
      currentStart = sortedWeekKeys[index];
    }

    if (currentLength > bestLength) {
      bestLength = currentLength;
      bestStart = currentStart;
      bestEnd = sortedWeekKeys[index];
    }
  }

  return { length: bestLength, start: bestStart, end: bestEnd };
}

function normalizeDays(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return 0;
  }
  return num;
}

function normalizeMistakes(mistakes) {
  return mistakes
    .map((item) => {
      const parsedDate = parseRecordDate(item.recordDate);
      if (!parsedDate) return null;
      return {
        ...item,
        __parsedDate: parsedDate
      };
    })
    .filter(Boolean);
}

function summarizeDateRange(mistakes) {
  if (mistakes.length === 0) return null;
  const sorted = mistakes
    .map((item) => formatDate(item.__parsedDate))
    .sort((a, b) => a.localeCompare(b));
  return {
    startDate: sorted[0],
    endDate: sorted[sorted.length - 1]
  };
}

function summarizeHighFrequency(normalizedMistakes, minFrequency, topN) {
  const map = new Map();

  normalizedMistakes.forEach((item) => {
    const key = `${item.subject}__${item.category}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        subject: item.subject,
        category: item.category,
        count: 0,
        firstDate: item.recordDate,
        lastDate: item.recordDate
      });
    }
    const current = map.get(key);
    current.count += 1;
    if (item.recordDate < current.firstDate) current.firstDate = item.recordDate;
    if (item.recordDate > current.lastDate) current.lastDate = item.recordDate;
  });

  return [...map.values()]
    .filter((item) => item.count >= minFrequency)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, topN);
}

function summarizeConsecutiveWeeks(normalizedMistakes, minWeeks) {
  const weekMap = new Map();
  normalizedMistakes.forEach((item) => {
    const key = `${item.subject}__${item.category}`;
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        subject: item.subject,
        category: item.category,
        weekKeys: new Set(),
        firstDate: item.recordDate,
        lastDate: item.recordDate,
        count: 0
      });
    }
    const current = weekMap.get(key);
    current.weekKeys.add(getWeekKey(item.__parsedDate));
    current.count += 1;
    if (item.recordDate < current.firstDate) current.firstDate = item.recordDate;
    if (item.recordDate > current.lastDate) current.lastDate = item.recordDate;
  });

  const items = [];
  for (const value of weekMap.values()) {
    const sortedWeeks = [...value.weekKeys].sort((a, b) => a.localeCompare(b));
    const streak = calcLongestConsecutiveStreak(sortedWeeks);
    if (streak.length >= minWeeks) {
      items.push({
        subject: value.subject,
        category: value.category,
        count: value.count,
        weeks: streak.length,
        streakStartWeek: streak.start,
        streakEndWeek: streak.end,
        firstDate: value.firstDate,
        lastDate: value.lastDate
      });
    }
  }

  return items.sort((a, b) => b.weeks - a.weeks || b.count - a.count);
}

const PATTERN_RULES = [
  { id: 'polyphone', label: '多音字易错', pattern: /多音字/ },
  { id: 'math-unit', label: '数学单位问题', pattern: /(单位|kg|cm|米|千克|m\b)/i },
  { id: 'eng-past', label: '英语过去式拼写', pattern: /(过去式|时态|past|ed\b)/i }
];

function summarizePatternHints(normalizedMistakes, minFrequency) {
  const hints = PATTERN_RULES.map((rule) => ({
    ...rule,
    count: 0,
    firstDate: null,
    lastDate: null
  }));

  normalizedMistakes.forEach((item) => {
    const text = [
      item.subject,
      item.category,
      item.originalQuestion,
      item.analysis,
      item.reviewTip,
      ...(Array.isArray(item.tags) ? item.tags : [])
    ]
      .join(' ')
      .trim();
    hints.forEach((hint) => {
      if (hint.pattern.test(text)) {
        hint.count += 1;
        if (!hint.firstDate || item.recordDate < hint.firstDate) hint.firstDate = item.recordDate;
        if (!hint.lastDate || item.recordDate > hint.lastDate) hint.lastDate = item.recordDate;
      }
    });
  });

  return hints
    .filter((item) => item.count >= minFrequency)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .map(({ id, label, count, firstDate, lastDate }) => ({
      id,
      label,
      count,
      firstDate,
      lastDate
    }));
}

export function filterMistakesByRecentDays(mistakes, days, now = new Date()) {
  const normalizedDays = normalizeDays(days);
  const normalized = normalizeMistakes(mistakes);
  if (normalizedDays <= 0) {
    return normalized;
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (normalizedDays - 1));
  start.setHours(0, 0, 0, 0);

  return normalized.filter((item) => item.__parsedDate >= start && item.__parsedDate <= end);
}

export function summarizeWeakPoints(mistakes, options = {}) {
  const normalized = normalizeMistakes(mistakes);
  const minSample = Number.isInteger(options.minSample) ? options.minSample : 6;
  const minFrequency = Number.isInteger(options.minFrequency) ? options.minFrequency : 2;
  const topN = Number.isInteger(options.topN) ? options.topN : 6;
  const minConsecutiveWeeks = Number.isInteger(options.minConsecutiveWeeks)
    ? options.minConsecutiveWeeks
    : 3;

  const dateRange = summarizeDateRange(normalized);
  if (normalized.length < minSample) {
    return {
      sufficient: false,
      sampleCount: normalized.length,
      minSample,
      dateRange,
      highFrequency: [],
      consecutiveWeeks: [],
      patterns: []
    };
  }

  const highFrequency = summarizeHighFrequency(normalized, minFrequency, topN);
  const consecutiveWeeks = summarizeConsecutiveWeeks(normalized, minConsecutiveWeeks);
  const patterns = summarizePatternHints(normalized, minFrequency);

  return {
    sufficient: true,
    sampleCount: normalized.length,
    minSample,
    dateRange,
    highFrequency,
    consecutiveWeeks,
    patterns
  };
}

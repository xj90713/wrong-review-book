const CYCLE_OPTIONS = ['day', 'week', 'month'];
const TEMPLATE_OPTIONS = ['compact', 'detailed'];
const FORMAT_OPTIONS = ['txt', 'markdown', 'pdf'];

function parseTime(value) {
  const [hourText, minuteText] = String(value ?? '').split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const valid =
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour < 24 &&
    minute >= 0 &&
    minute < 60;
  return valid ? { hour, minute } : { hour: 20, minute: 0 };
}

function buildDate(baseDate, hour, minute) {
  const next = new Date(baseDate);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function createDefaultAutoExport() {
  return {
    enabled: false,
    cycle: 'week',
    time: '20:00',
    weekday: 5,
    dayOfMonth: 28,
    targetChildId: 'current',
    template: 'compact',
    excludeMastered: false,
    prioritizeNeedReview: true,
    format: 'pdf',
    lastGeneratedAt: null
  };
}

export function normalizeAutoExportConfig(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const cycle = CYCLE_OPTIONS.includes(raw.cycle) ? raw.cycle : 'week';
  let dayOfMonth = Number(raw.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    dayOfMonth = 28;
  }
  let weekday = Number(raw.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    weekday = 5;
  }
  return {
    enabled: Boolean(raw.enabled),
    cycle,
    time: /^\d{2}:\d{2}$/.test(String(raw.time ?? '')) ? raw.time : '20:00',
    weekday,
    dayOfMonth,
    targetChildId: String(raw.targetChildId ?? 'current').trim() || 'current',
    template: TEMPLATE_OPTIONS.includes(raw.template) ? raw.template : 'compact',
    excludeMastered: Boolean(raw.excludeMastered),
    prioritizeNeedReview: raw.prioritizeNeedReview === false ? false : true,
    format: FORMAT_OPTIONS.includes(raw.format) ? raw.format : 'pdf',
    lastGeneratedAt: toIsoOrNull(raw.lastGeneratedAt)
  };
}

export function getCurrentDueTime(config, now = new Date()) {
  const value = normalizeAutoExportConfig(config);
  if (!value.enabled) {
    return null;
  }
  const { hour, minute } = parseTime(value.time);
  const current = new Date(now);

  if (value.cycle === 'day') {
    const due = buildDate(current, hour, minute);
    if (due > current) {
      due.setDate(due.getDate() - 1);
    }
    return due;
  }

  if (value.cycle === 'week') {
    const due = buildDate(current, hour, minute);
    const delta = (current.getDay() - value.weekday + 7) % 7;
    due.setDate(due.getDate() - delta);
    if (due > current) {
      due.setDate(due.getDate() - 7);
    }
    return due;
  }

  const due = buildDate(current, hour, minute);
  due.setDate(value.dayOfMonth);
  if (due > current) {
    due.setMonth(due.getMonth() - 1);
    due.setDate(value.dayOfMonth);
  }
  return due;
}

export function getNextAutoExportTime(config, now = new Date()) {
  const value = normalizeAutoExportConfig(config);
  if (!value.enabled) {
    return null;
  }
  const { hour, minute } = parseTime(value.time);
  const current = new Date(now);

  if (value.cycle === 'day') {
    const next = buildDate(current, hour, minute);
    if (next <= current) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (value.cycle === 'week') {
    const next = buildDate(current, hour, minute);
    const delta = (value.weekday - current.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
    if (next <= current) {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  const next = buildDate(current, hour, minute);
  next.setDate(value.dayOfMonth);
  if (next <= current) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(value.dayOfMonth);
  }
  return next;
}

export function evaluateAutoExport(config, now = new Date()) {
  const value = normalizeAutoExportConfig(config);
  if (!value.enabled) {
    return { shouldGenerate: false, dueAt: null, nextAt: null };
  }
  const dueAt = getCurrentDueTime(value, now);
  const nextAt = getNextAutoExportTime(value, now);
  const lastGeneratedAt = value.lastGeneratedAt ? new Date(value.lastGeneratedAt) : null;
  const shouldGenerate = dueAt && now >= dueAt && (!lastGeneratedAt || lastGeneratedAt < dueAt);

  return {
    shouldGenerate,
    dueAt,
    nextAt
  };
}

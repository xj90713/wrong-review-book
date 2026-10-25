const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6];

export function createDefaultReminder() {
  return {
    enabled: false,
    cycle: 'weekly',
    weekday: 5,
    dayOfMonth: 28,
    time: '20:00',
    lastNotifiedAt: null
  };
}

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

export function normalizeReminder(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const cycle = raw.cycle === 'monthly' ? 'monthly' : 'weekly';
  const weekday = WEEKDAY_VALUES.includes(raw.weekday) ? raw.weekday : 5;

  let dayOfMonth = Number(raw.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    dayOfMonth = 28;
  }

  return {
    enabled: Boolean(raw.enabled),
    cycle,
    weekday,
    dayOfMonth,
    time: /^\d{2}:\d{2}$/.test(String(raw.time ?? '')) ? raw.time : '20:00',
    lastNotifiedAt: toIsoOrNull(raw.lastNotifiedAt)
  };
}

export function getNextReminderTime(reminder, now = new Date()) {
  const config = normalizeReminder(reminder);
  if (!config.enabled) {
    return null;
  }

  const { hour, minute } = parseTime(config.time);
  const current = new Date(now);

  if (config.cycle === 'weekly') {
    const candidate = buildDate(current, hour, minute);
    const delta = (config.weekday - current.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + delta);

    if (candidate <= current) {
      candidate.setDate(candidate.getDate() + 7);
    }

    return candidate;
  }

  const candidate = buildDate(current, hour, minute);
  candidate.setDate(config.dayOfMonth);
  if (candidate <= current) {
    candidate.setMonth(candidate.getMonth() + 1);
    candidate.setDate(config.dayOfMonth);
  }

  return candidate;
}

export function getCurrentDueTime(reminder, now = new Date()) {
  const config = normalizeReminder(reminder);
  if (!config.enabled) {
    return null;
  }

  const { hour, minute } = parseTime(config.time);
  const current = new Date(now);

  if (config.cycle === 'weekly') {
    const due = buildDate(current, hour, minute);
    const delta = (current.getDay() - config.weekday + 7) % 7;
    due.setDate(due.getDate() - delta);
    if (due > current) {
      due.setDate(due.getDate() - 7);
    }
    return due;
  }

  const due = buildDate(current, hour, minute);
  due.setDate(config.dayOfMonth);
  if (due > current) {
    due.setMonth(due.getMonth() - 1);
    due.setDate(config.dayOfMonth);
  }
  return due;
}

export function evaluateReminder(reminder, now = new Date()) {
  const config = normalizeReminder(reminder);
  if (!config.enabled) {
    return {
      shouldNotify: false,
      dueAt: null,
      nextAt: null
    };
  }

  const dueAt = getCurrentDueTime(config, now);
  const nextAt = getNextReminderTime(config, now);
  const lastNotifiedAt = config.lastNotifiedAt ? new Date(config.lastNotifiedAt) : null;
  const shouldNotify = dueAt && now >= dueAt && (!lastNotifiedAt || lastNotifiedAt < dueAt);

  return {
    shouldNotify,
    dueAt,
    nextAt
  };
}

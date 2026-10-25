function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cloneDate(date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

export function getExportCycleOptions() {
  return ['day', 'week', 'month', 'custom'];
}

export function normalizeExportCycle(value) {
  const text = String(value ?? '').trim();
  return getExportCycleOptions().includes(text) ? text : 'week';
}

export function getDateRangeByCycle(cycle, now = new Date()) {
  const normalizedCycle = normalizeExportCycle(cycle);
  const base = cloneDate(now);

  if (normalizedCycle === 'day') {
    const date = formatDate(base);
    return { startDate: date, endDate: date };
  }

  if (normalizedCycle === 'week') {
    const day = base.getDay(); // Sunday is 0.
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = cloneDate(base);
    start.setDate(start.getDate() + mondayOffset);
    const end = cloneDate(start);
    end.setDate(start.getDate() + 6);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }

  if (normalizedCycle === 'month') {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }

  const start = cloneDate(base);
  start.setDate(start.getDate() - 6);
  return { startDate: formatDate(start), endDate: formatDate(base) };
}

function hasCompleteRange(startDate, endDate) {
  return Boolean(String(startDate ?? '').trim() && String(endDate ?? '').trim());
}

export function shouldDisableExportDateInputs() {
  return false;
}

export function resolveExportRangeForCycleChange(cycle, startDate, endDate, now = new Date()) {
  const normalizedCycle = normalizeExportCycle(cycle);
  if (normalizedCycle === 'custom' && hasCompleteRange(startDate, endDate)) {
    return {
      startDate: String(startDate).trim(),
      endDate: String(endDate).trim()
    };
  }
  return getDateRangeByCycle(normalizedCycle, now);
}

export function resolveExportRangeForSubmit(cycle, startDate, endDate, now = new Date()) {
  if (hasCompleteRange(startDate, endDate)) {
    return {
      startDate: String(startDate).trim(),
      endDate: String(endDate).trim()
    };
  }
  return getDateRangeByCycle(cycle, now);
}

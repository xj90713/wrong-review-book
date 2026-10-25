function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value, fallbackDate) {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return fallbackDate;
}

function ensureTemplate(value) {
  return value === 'detailed' ? 'detailed' : 'compact';
}

function normalizeBooleanOption(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

function getReviewStatusPriority(status) {
  const text = String(status ?? '').trim();
  if (text === '需再次复习') return 0;
  if (text === '未复习') return 1;
  if (text === '已复习') return 2;
  if (text === '已掌握') return 3;
  return 4;
}

function escapePdfTextLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function toUtf16BeHex(text) {
  let output = 'FEFF';
  for (const char of String(text ?? '')) {
    const codePoint = char.codePointAt(0);
    if (typeof codePoint !== 'number') {
      continue;
    }
    if (codePoint <= 0xffff) {
      output += codePoint.toString(16).padStart(4, '0').toUpperCase();
    } else {
      const adjusted = codePoint - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      output += high.toString(16).padStart(4, '0').toUpperCase();
      output += low.toString(16).padStart(4, '0').toUpperCase();
    }
  }
  return output;
}

function wrapLine(text, limit = 30) {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return [''];
  }
  const chars = Array.from(normalized);
  const chunks = [];
  for (let index = 0; index < chars.length; index += limit) {
    chunks.push(chars.slice(index, index + limit).join(''));
  }
  return chunks;
}

function splitPages(lines, pageLineLimit = 35) {
  const pages = [];
  for (let index = 0; index < lines.length; index += pageLineLimit) {
    pages.push(lines.slice(index, index + pageLineLimit));
  }
  return pages.length > 0 ? pages : [['无导出内容']];
}

function buildPdfContentStream(lines) {
  const commands = ['BT', '/F1 11 Tf', '50 790 Td'];
  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('0 -20 Td');
    }
    commands.push(`<${toUtf16BeHex(escapePdfTextLine(line))}> Tj`);
  });
  commands.push('ET');
  return commands.join('\n');
}

function buildPdfFromPages(pages) {
  const normalizedPages = pages
    .map((page) => (Array.isArray(page) && page.length > 0 ? page : ['无导出内容']))
    .filter((page) => page.length > 0);
  const outputPages = normalizedPages.length > 0 ? normalizedPages : [['无导出内容']];
  const objects = new Map();
  const pageObjectIds = [];

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(3, '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>');
  objects.set(4, '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor 5 0 R /DW 1000 >>');
  objects.set(5, '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 /Ascent 880 /Descent -120 /CapHeight 700 /ItalicAngle 0 /StemV 80 /MissingWidth 500 >>');

  outputPages.forEach((pageLines, index) => {
    const pageObjectId = 6 + index * 2;
    const contentObjectId = 7 + index * 2;
    pageObjectIds.push(pageObjectId);

    const stream = buildPdfContentStream(pageLines);
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.set(
      contentObjectId,
      `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`
    );
  });

  objects.set(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`);

  const maxObjectId = Math.max(...objects.keys());
  const offsets = new Array(maxObjectId + 1).fill(0);
  let documentText = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';

  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    const body = objects.get(objectId);
    if (!body) {
      continue;
    }
    offsets[objectId] = new TextEncoder().encode(documentText).length;
    documentText += `${objectId} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = new TextEncoder().encode(documentText).length;
  documentText += `xref\n0 ${maxObjectId + 1}\n`;
  documentText += '0000000000 65535 f \n';

  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    const offset = offsets[objectId];
    if (!offset) {
      documentText += '0000000000 00000 f \n';
      continue;
    }
    documentText += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  documentText += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(documentText);
}

function summarizeBySubject(mistakes) {
  const map = new Map();
  mistakes.forEach((item) => {
    map.set(item.subject, (map.get(item.subject) || 0) + 1);
  });
  return map;
}

function groupBySubject(mistakes) {
  const map = new Map();
  mistakes.forEach((item) => {
    if (!map.has(item.subject)) {
      map.set(item.subject, []);
    }
    map.get(item.subject).push(item);
  });
  return map;
}

export function buildExportPayload({
  state,
  userId,
  childId,
  startDate,
  endDate,
  template = 'compact',
  excludeMastered = false,
  prioritizeNeedReview = true,
  now = new Date()
}) {
  const child = state.children.find((item) => item.id === childId && item.userId === userId);
  if (!child) {
    return { ok: false, error: '导出失败：未找到孩子档案。' };
  }

  const nowDate = formatDate(now);
  const rangeStart = normalizeDateInput(startDate, nowDate);
  const rangeEnd = normalizeDateInput(endDate, nowDate);
  const from = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const to = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  const shouldExcludeMastered = normalizeBooleanOption(excludeMastered, false);
  const shouldPrioritizeNeedReview = normalizeBooleanOption(prioritizeNeedReview, true);

  const mistakes = state.mistakes
    .filter((item) => item.userId === userId && item.childId === child.id)
    .filter((item) => item.recordDate >= from && item.recordDate <= to)
    .filter((item) => !shouldExcludeMastered || item.status !== '已掌握')
    .slice()
    .sort((a, b) => {
      if (shouldPrioritizeNeedReview) {
        const priorityDiff = getReviewStatusPriority(a.status) - getReviewStatusPriority(b.status);
        if (priorityDiff !== 0) return priorityDiff;
      }
      const dateCompare = a.recordDate.localeCompare(b.recordDate);
      if (dateCompare !== 0) return dateCompare;
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
    });

  const grouped = groupBySubject(mistakes);
  const summary = summarizeBySubject(mistakes);
  const outputTemplate = ensureTemplate(template);

  return {
    ok: true,
    payload: {
      child,
      from,
      to,
      template: outputTemplate,
      options: {
        excludeMastered: shouldExcludeMastered,
        prioritizeNeedReview: shouldPrioritizeNeedReview
      },
      exportDate: nowDate,
      mistakes,
      grouped,
      summary
    }
  };
}

export function buildExportFileName({ childName, from, to, format }) {
  const safeChildName = String(childName ?? 'child').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
  const safeRange = `${from || 'unknown'}_${to || 'unknown'}`.replaceAll('-', '');
  const suffix = format === 'pdf' ? 'pdf' : format === 'txt' ? 'txt' : 'md';
  return `错题本_${safeChildName}_${safeRange}.${suffix}`;
}

export function resolveExportFormat(formValue, submitterValue) {
  const candidates = [submitterValue, formValue];
  for (const candidate of candidates) {
    const format = String(candidate ?? '').trim().toLowerCase();
    if (format === 'pdf' || format === 'txt' || format === 'markdown') {
      return format;
    }
  }
  return 'markdown';
}

export function generateMarkdownDocument(payload) {
  const lines = [];
  lines.push(`# 错题本复习材料`);
  lines.push('');
  lines.push(`- 孩子：${payload.child.name}（${payload.child.grade}，${payload.child.stage}）`);
  lines.push(`- 导出范围：${payload.from} 至 ${payload.to}`);
  lines.push(`- 导出日期：${payload.exportDate}`);
  lines.push(
    `- 导出策略：${payload.options?.excludeMastered ? '排除已掌握' : '包含已掌握'}；${payload.options?.prioritizeNeedReview ? '需再次复习优先' : '按日期排序'}`
  );
  lines.push(`- 错题总数：${payload.mistakes.length}`);
  lines.push('');
  lines.push(`## 学科统计`);
  if (payload.summary.size === 0) {
    lines.push('- 无');
  } else {
    for (const [subject, count] of payload.summary.entries()) {
      lines.push(`- ${subject}：${count} 题`);
    }
  }
  lines.push('');

  for (const [subject, items] of payload.grouped.entries()) {
    lines.push(`## ${subject}`);
    lines.push('');
    items.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.category}（${item.recordDate}）`);
      lines.push(`- 原题内容：${item.originalQuestion || '（空）'}`);
      lines.push(`- 错误答案/表现：${item.wrongAnswer || '（空）'}`);
      lines.push(`- 正确答案：${item.correctAnswer || '（空）'}`);
      if (payload.template === 'detailed') {
        lines.push(`- 解析：${item.analysis || '（空）'}`);
        lines.push(`- 复习建议：${item.reviewTip || '（空）'}`);
        lines.push(`- 标签：${item.tags?.length ? item.tags.join('、') : '（空）'}`);
      }
      lines.push(`- 来源：${item.source}`);
      lines.push(`- 状态：${item.status}`);
      lines.push('');
    });
  }

  if (payload.mistakes.length === 0) {
    lines.push('## 暂无错题');
    lines.push('');
    lines.push('该时间段内没有错题记录。');
  }

  lines.push('');
  lines.push('---');
  lines.push('打印留白区：');
  lines.push('');
  lines.push('1. ________________________________________________');
  lines.push('2. ________________________________________________');
  lines.push('3. ________________________________________________');

  return lines.join('\n');
}

export function generatePdfDocument(payload) {
  return buildPdfFromPages(buildPdfReviewPages(payload));
}

function appendPdfHeader(lines, payload, title) {
  lines.push(title);
  lines.push(`孩子：${payload.child.name}  年级：${payload.child.grade}  阶段：${payload.child.stage}`);
  lines.push(`导出范围：${payload.from} 至 ${payload.to}`);
  lines.push(
    `导出策略：${payload.options?.excludeMastered ? '排除已掌握' : '包含已掌握'}  ${payload.options?.prioritizeNeedReview ? '需再次复习优先' : '按日期排序'}`
  );
  lines.push(`导出日期：${payload.exportDate}   错题总数：${payload.mistakes.length}`);
  lines.push('');
}

function appendPdfSummary(lines, payload) {
  lines.push('学科统计：');
  if (payload.summary.size === 0) {
    lines.push('暂无错题');
  } else {
    for (const [subject, count] of payload.summary.entries()) {
      lines.push(`${subject}: ${count}题`);
    }
  }
  lines.push('');
}

function appendWrappedPdfLine(lines, prefix, value) {
  wrapLine(`${prefix}${value || '（空）'}`).forEach((line) => lines.push(line));
}

function buildQuestionRetryLines(payload) {
  const lines = [];
  appendPdfHeader(lines, payload, '错题本题目重做');
  lines.push('使用方式：请孩子独立重做，本部分不显示答案。');
  lines.push('');
  appendPdfSummary(lines, payload);
  for (const [subject, items] of payload.grouped.entries()) {
    lines.push(`【${subject}】`);
    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.category} (${item.recordDate})`);
      appendWrappedPdfLine(lines, '原题：', item.originalQuestion);
      lines.push('作答：________________________________________');
      lines.push('过程：________________________________________');
      lines.push('      ________________________________________');
      lines.push('');
    });
  }

  if (payload.mistakes.length === 0) {
    lines.push('该时间段内没有错题记录。');
  }

  return lines;
}

function buildAnswerLines(payload) {
  const lines = [];
  appendPdfHeader(lines, payload, '错题本参考答案');
  lines.push('参考答案');
  lines.push('');
  appendPdfSummary(lines, payload);
  for (const [subject, items] of payload.grouped.entries()) {
    lines.push(`【${subject}】`);
    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.category} (${item.recordDate})`);
      appendWrappedPdfLine(lines, '原题：', item.originalQuestion);
      appendWrappedPdfLine(lines, '错答：', item.wrongAnswer);
      appendWrappedPdfLine(lines, '正答：', item.correctAnswer);
      if (payload.template === 'detailed') {
        appendWrappedPdfLine(lines, '解析：', item.analysis);
        appendWrappedPdfLine(lines, '建议：', item.reviewTip);
        lines.push(`标签：${item.tags?.length ? item.tags.join('、') : '（空）'}`);
      }
      lines.push(`来源：${item.source}  状态：${item.status}`);
      lines.push('');
    });
  }

  if (payload.mistakes.length === 0) {
    lines.push('该时间段内没有错题记录。');
  }

  return lines;
}

export function buildPdfReviewPages(payload) {
  const questionPages = splitPages(buildQuestionRetryLines(payload));
  const answerPages = splitPages(buildAnswerLines(payload));
  return [...questionPages, ...answerPages];
}

export function generateTextDocument(payload) {
  const lines = [];
  lines.push('错题本复习材料');
  lines.push(`孩子：${payload.child.name}（${payload.child.grade}，${payload.child.stage}）`);
  lines.push(`导出范围：${payload.from} 至 ${payload.to}`);
  lines.push(`导出日期：${payload.exportDate}`);
  lines.push(
    `导出策略：${payload.options?.excludeMastered ? '排除已掌握' : '包含已掌握'}；${payload.options?.prioritizeNeedReview ? '需再次复习优先' : '按日期排序'}`
  );
  lines.push(`错题总数：${payload.mistakes.length}`);
  lines.push('');
  lines.push('学科统计：');
  if (payload.summary.size === 0) {
    lines.push('- 无');
  } else {
    for (const [subject, count] of payload.summary.entries()) {
      lines.push(`- ${subject}：${count} 题`);
    }
  }
  lines.push('');

  for (const [subject, items] of payload.grouped.entries()) {
    lines.push(`[${subject}]`);
    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.category}（${item.recordDate}）`);
      lines.push(`原题内容：${item.originalQuestion || '（空）'}`);
      lines.push(`错误答案/表现：${item.wrongAnswer || '（空）'}`);
      lines.push(`正确答案：${item.correctAnswer || '（空）'}`);
      if (payload.template === 'detailed') {
        lines.push(`解析：${item.analysis || '（空）'}`);
        lines.push(`复习建议：${item.reviewTip || '（空）'}`);
        lines.push(`标签：${item.tags?.length ? item.tags.join('、') : '（空）'}`);
      }
      lines.push(`来源：${item.source}`);
      lines.push(`状态：${item.status}`);
      lines.push('');
    });
  }

  if (payload.mistakes.length === 0) {
    lines.push('该时间段内没有错题记录。');
  }

  lines.push('');
  lines.push('打印留白区：');
  lines.push('1. ________________________________________________');
  lines.push('2. ________________________________________________');
  lines.push('3. ________________________________________________');
  return lines.join('\n');
}

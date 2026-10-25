import test from 'node:test';
import assert from 'node:assert/strict';

import { inferRecordDateFromImageMetadata } from '../web/src/date-inference.js';

test('inferRecordDateFromImageMetadata returns formatted date when lastModified exists', () => {
  const result = inferRecordDateFromImageMetadata({
    lastModified: new Date('2026-04-10T12:00:00.000Z').getTime()
  });
  assert.equal(result, '2026-04-10');
});

test('inferRecordDateFromImageMetadata returns null for invalid input', () => {
  assert.equal(inferRecordDateFromImageMetadata({}), null);
  assert.equal(inferRecordDateFromImageMetadata({ lastModified: -1 }), null);
  assert.equal(inferRecordDateFromImageMetadata(null), null);
});

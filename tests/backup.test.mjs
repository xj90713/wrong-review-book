import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKUP_VERSION,
  buildBackupFileName,
  createBackupBundle,
  parseBackupBundleText,
  serializeBackupBundle
} from '../web/src/backup.js';
import { createEmptyState } from '../web/src/storage.js';

test('buildBackupFileName returns timestamped json file name', () => {
  const fileName = buildBackupFileName(new Date('2026-04-18T10:11:12.000Z'));
  assert.match(fileName, /^错题本备份_\d{8}_\d{6}\.json$/);
});

test('createBackupBundle normalizes state and includes metadata', () => {
  const bundle = createBackupBundle(
    {
      users: [{ id: 'u1' }],
      invalid: true
    },
    new Date('2026-04-18T10:00:00.000Z')
  );

  assert.equal(bundle.backupVersion, BACKUP_VERSION);
  assert.equal(bundle.exportedAt, '2026-04-18T10:00:00.000Z');
  assert.equal(bundle.app, 'review-notebook');
  assert.deepEqual(bundle.state.users, [{ id: 'u1' }]);
  assert.deepEqual(bundle.state.children, []);
});

test('serialize + parse backup bundle works', () => {
  const bundle = createBackupBundle(
    {
      ...createEmptyState(),
      users: [{ id: 'u1' }],
      children: [{ id: 'c1' }]
    },
    new Date('2026-04-18T10:00:00.000Z')
  );

  const text = serializeBackupBundle(bundle);
  const parsed = parseBackupBundleText(text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.meta.backupVersion, BACKUP_VERSION);
  assert.equal(parsed.meta.exportedAt, '2026-04-18T10:00:00.000Z');
  assert.deepEqual(parsed.state.users, [{ id: 'u1' }]);
  assert.deepEqual(parsed.state.children, [{ id: 'c1' }]);
});

test('parseBackupBundleText supports legacy direct-state json', () => {
  const parsed = parseBackupBundleText(
    JSON.stringify({
      ...createEmptyState(),
      users: [{ id: 'u1' }],
      mistakes: [{ id: 'm1' }]
    })
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.meta.backupVersion, 'legacy-state-json');
  assert.equal(parsed.meta.exportedAt, null);
  assert.deepEqual(parsed.state.users, [{ id: 'u1' }]);
  assert.deepEqual(parsed.state.mistakes, [{ id: 'm1' }]);
});

test('parseBackupBundleText rejects empty/invalid input', () => {
  assert.equal(parseBackupBundleText('').ok, false);
  assert.equal(parseBackupBundleText('{').ok, false);
  assert.equal(parseBackupBundleText(JSON.stringify({ hello: 'world' })).ok, false);
});

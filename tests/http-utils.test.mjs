import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { getApiErrorStatus, resolveStaticPath } from '../server/http-utils.mjs';

const webRoot = path.resolve('/tmp/mistake-book-test/web');

test('resolveStaticPath resolves index and nested static file', () => {
  assert.equal(resolveStaticPath(webRoot, '/'), path.resolve(webRoot, 'index.html'));
  assert.equal(
    resolveStaticPath(webRoot, '/src/main.js?cache=1'),
    path.resolve(webRoot, 'src/main.js')
  );
});

test('resolveStaticPath blocks traversal with raw and encoded segments', () => {
  assert.equal(resolveStaticPath(webRoot, '/../web-secret.txt'), null);
  assert.equal(resolveStaticPath(webRoot, '/%2e%2e/web-secret.txt'), null);
  assert.equal(resolveStaticPath(webRoot, '/%2E%2E/%2E%2E/package.json'), null);
});

test('getApiErrorStatus maps payload_too_large to 413', () => {
  assert.equal(getApiErrorStatus(new Error('payload_too_large')), 413);
  assert.equal(getApiErrorStatus(new Error('other_error')), 500);
  assert.equal(getApiErrorStatus(null), 500);
});

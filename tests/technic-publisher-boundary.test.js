import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publisherSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'technic', 'changelog-publisher.js'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'background', 'service-worker.js'), 'utf8');

test('Patch 002 Technic content script does not fill or submit Technic forms', () => {
  assert.equal(/requestSubmit\s*\(/.test(publisherSource), false);
  assert.equal(/\.submit\s*\(/.test(publisherSource), false);
  assert.equal(/querySelector\s*\(\s*['"](?:input\[name="version"\]|textarea\[name="changelog"|form)/.test(publisherSource), false);
  assert.match(publisherSource, /form filling and submission are not implemented/i);
});

test('Patch 002 background script disables completion reporting until user-confirmed submission exists', () => {
  assert.match(serviceWorkerSource, /Completion reporting is disabled/);
  assert.equal(/\/internal\/technic-extension-jobs\/complete/.test(serviceWorkerSource), false);
});

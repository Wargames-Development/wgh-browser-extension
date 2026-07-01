import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'technic-manage-versions-minimal.html'), 'utf8');

test('Technic fixture contains the expected changelog form selectors', () => {
  assert.match(fixture, /class="edit-versions-form"/);
  assert.match(fixture, /name="version"/);
  assert.match(fixture, /name="changelog"/);
  assert.match(fixture, />Update Version</);
});

test('Chromium and Firefox manifests keep host permissions narrow', () => {
  const root = path.join(__dirname, '..');
  for (const target of ['chromium', 'firefox']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifests', `manifest.${target}.json`), 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.host_permissions.includes('https://www.technicpack.net/modpack/edit/*/versions'));
    assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  }
});

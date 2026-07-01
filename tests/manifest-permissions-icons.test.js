import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const targets = ['chromium', 'firefox'];
const iconSizes = [16, 32, 48, 128, 256];
const iconEntries = Object.fromEntries(iconSizes.map((size) => [String(size), `icons/icon-${size}.png`]));
const expectedWargamesMatches = [
  'https://solder.wargames.localhost/*',
  'https://*.wargames.localhost/*',
  'https://*.wargames.host/*',
  'https://*.wargames.uk/*'
];
const expectedTechnicMatches = [
  'https://www.technicpack.net/modpack/edit/*/versions',
  'https://www.technicpack.net/dashboard/modpack/*/versions'
];
const expectedHostPermissions = [...expectedWargamesMatches, ...expectedTechnicMatches];

function readManifest(target, baseDir = 'manifests') {
  const file = baseDir === 'manifests'
    ? path.join(root, 'manifests', `manifest.${target}.json`)
    : path.join(root, 'dist', target, 'manifest.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getPngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

test('Patch 005 manifests use corrected Wargames host permissions and no wargames.hosting domain', () => {
  for (const target of targets) {
    const manifest = readManifest(target);
    assert.deepEqual(manifest.host_permissions, expectedHostPermissions);
    assert.equal(JSON.stringify(manifest).includes('wargames.hosting'), false);
    assert.ok(manifest.host_permissions.includes('https://*.wargames.host/*'));
    assert.ok(manifest.host_permissions.includes('https://*.wargames.uk/*'));
    assert.ok(manifest.host_permissions.includes('https://*.wargames.localhost/*'));
    assert.ok(manifest.host_permissions.includes('https://solder.wargames.localhost/*'));
  }
});

test('Patch 005 content scripts keep Wargames and Technic scopes narrow', () => {
  for (const target of targets) {
    const manifest = readManifest(target);
    assert.deepEqual(manifest.content_scripts[0].matches, expectedWargamesMatches);
    assert.deepEqual(manifest.content_scripts[1].matches, expectedTechnicMatches);
    assert.equal(manifest.host_permissions.includes('https://www.technicpack.net/*'), false);
    assert.equal(manifest.host_permissions.includes('https://www.technicpack.net/modpack/*'), false);
    assert.equal(manifest.content_scripts.flatMap((script) => script.matches).includes('https://www.technicpack.net/*'), false);
  }
});

test('Patch 005 removes tabs permission and avoids broad host permissions', () => {
  const broadHosts = new Set(['<all_urls>', '*://*/*', 'https://*/*', 'http://*/*']);
  for (const target of targets) {
    const manifest = readManifest(target);
    assert.equal(Boolean(manifest.permissions?.includes('tabs')), false);
    assert.equal(JSON.stringify(manifest.permissions || []).includes('tabs'), false);
    for (const pattern of manifest.host_permissions) {
      assert.equal(broadHosts.has(pattern), false, `${target} includes broad host permission ${pattern}`);
      assert.equal(pattern.startsWith('http://'), false, `${target} includes non-HTTPS host permission ${pattern}`);
    }
  }
});

test('Patch 005 Firefox extension ID uses the corrected Wargames host domain', () => {
  const manifest = readManifest('firefox');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'wgh-browser-extension@wargames.host');
});

test('Patch 005 icon source and generated icon files exist with expected PNG dimensions', () => {
  assert.ok(fs.existsSync(path.join(root, 'icons', 'wargames-rounded-source.png')));
  for (const size of iconSizes) {
    const file = path.join(root, 'icons', `icon-${size}.png`);
    assert.ok(fs.existsSync(file), `missing ${file}`);
    assert.deepEqual(getPngSize(file), { width: size, height: size });
  }
});

test('Patch 005 manifests expose extension and action icon entries', () => {
  for (const target of targets) {
    const manifest = readManifest(target);
    assert.deepEqual(manifest.icons, iconEntries);
    assert.equal(manifest.action.default_title, 'WGH Browser Extension');
    assert.deepEqual(manifest.action.default_icon, iconEntries);
  }
});

test('Patch 005 build copies icon files and corrected manifests into both browser builds', () => {
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: root, stdio: 'pipe' });
  for (const target of targets) {
    const builtManifest = readManifest(target, 'dist');
    assert.deepEqual(builtManifest.icons, iconEntries);
    assert.deepEqual(builtManifest.action.default_icon, iconEntries);
    assert.equal(JSON.stringify(builtManifest).includes('wargames.hosting'), false);
    assert.equal(Boolean(builtManifest.permissions?.includes('tabs')), false);
    for (const size of iconSizes) {
      const file = path.join(root, 'dist', target, 'icons', `icon-${size}.png`);
      assert.ok(fs.existsSync(file), `missing built ${target} icon-${size}.png`);
      assert.deepEqual(getPngSize(file), { width: size, height: size });
    }
  }
});

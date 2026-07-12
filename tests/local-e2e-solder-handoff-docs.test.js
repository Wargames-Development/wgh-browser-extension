import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const e2eDoc = fs.readFileSync(path.join(root, 'docs', 'local-e2e-solder-handoff-testing.md'), 'utf8');
const localTestingDoc = fs.readFileSync(path.join(root, 'docs', 'local-extension-testing.md'), 'utf8');
const solderContractDoc = fs.readFileSync(path.join(root, 'docs', 'solder-contract.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('Patch 004 documents the local Solder to extension to Technic changelog test path', () => {
  assert.match(e2eDoc, /technic_changelog_post/);
  assert.match(e2eDoc, /wgh:technic-extension-job/);
  assert.match(e2eDoc, /wgh:browser-extension-ready/);
  assert.match(e2eDoc, /POST \/internal\/technic-extension-jobs\/claim/);
  assert.match(e2eDoc, /Submit Technic form/);
  assert.match(e2eDoc, /Cancel \/ use manual copy/);
  assert.match(e2eDoc, /manual copy\/export/i);
});

test('Patch 004 local E2E notes cover supported local browser loading targets', () => {
  for (const browserName of ['Chrome', 'Microsoft Edge', 'Opera GX', 'Firefox']) {
    assert.match(e2eDoc, new RegExp(browserName.replace(' ', '\\s+')));
  }
  assert.match(e2eDoc, /dist\/chromium\//);
  assert.match(e2eDoc, /dist\/firefox\//);
});

test('Patch 004 local E2E notes preserve safety and truthfulness boundaries', () => {
  for (const phrase of [
    'Technic usernames',
    'Technic passwords',
    'Technic cookies',
    'Technic session tokens',
    'Technic 2FA',
    'Wargames internal API tokens',
    'bypass Technic login',
    'official Technic Platform API posting support',
    'server-side browser automation',
    'cannot currently guarantee final Technic server-side acceptance'
  ]) {
    assert.match(e2eDoc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('Patch 004 links the E2E notes from existing docs', () => {
  assert.match(localTestingDoc, /local-e2e-solder-handoff-testing\.md/);
  assert.match(solderContractDoc, /Patch 004 local end-to-end test notes/);
  assert.match(readme, /local-e2e-solder-handoff-testing\.md/);
});


test('README reflects Patch 003/004 MVP status without stale Patch 002 preview wording', () => {
  assert.match(readme, /Status:\s+active MVP workflow/);
  assert.match(readme, /fills the version\/build and changelog fields/i);
  assert.match(readme, /visible confirmation step/i);
  assert.match(readme, /local-e2e-solder-handoff-testing\.md/);
  assert.doesNotMatch(readme, /Technic form filling and form submission are intentionally not implemented in Patch 002/);
  assert.doesNotMatch(readme, /shows a safe manual-copy preview only/);
});

test('Patch 010 documents the safe late-load extension detection probe contract', () => {
  assert.match(e2eDoc, /wgh:browser-extension-probe/);
  assert.match(e2eDoc, /wgh:browser-extension-ready/);
  assert.match(e2eDoc, /does not claim or start a job/i);
  assert.match(e2eDoc, /does not guarantee a browser-store installation or a particular extension version/i);
});

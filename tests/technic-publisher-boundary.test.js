import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publisherSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'technic', 'changelog-publisher.js'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'background', 'service-worker.js'), 'utf8');
const solderContract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'solder-contract.md'), 'utf8');

test('Patch 003 Technic content script allows only user-confirmed normal form submission', () => {
  assert.match(publisherSource, /Submit Technic form/);
  assert.match(publisherSource, /userConfirmed:\s*true/);
  assert.match(publisherSource, /submissionAttempted:\s*true/);
  assert.match(publisherSource, /requestSubmit\s*\(/);
  assert.equal(/\.submit\s*\(/.test(publisherSource), false);
  assert.equal(/silentSubmissionEnabled:\s*true/.test(publisherSource), false);
});

test('Patch 003 does not store or read Technic credentials, cookies, sessions, 2FA data, or internal API tokens', () => {
  const combined = `${publisherSource}\n${serviceWorkerSource}`;
  assert.equal(/chrome\.storage|browser\.storage|localStorage|sessionStorage|indexedDB/i.test(combined), false);
  assert.equal(/document\.cookie/i.test(combined), false);
  assert.equal(/technic_password\s*=|password\s*=|totp_secret\s*=|two_factor_code\s*=/i.test(combined), false);
  assert.equal(/internal_api_token\s*=/.test(combined), false);
});

test('Patch 003 completion reporting is tied to the confirmation id and explicit user confirmation fields', () => {
  assert.match(serviceWorkerSource, /confirmationId/);
  assert.match(serviceWorkerSource, /userConfirmed !== true/);
  assert.match(serviceWorkerSource, /submissionAttempted !== true/);
  assert.match(serviceWorkerSource, /\/internal\/technic-extension-jobs\/complete/);
});

test('Patch 003 documentation keeps the manual fallback and no-official-Technic-API boundary', () => {
  assert.match(solderContract, /manual copy\/export visible as the fallback/i);
  assert.match(solderContract, /visible user confirmation/i);
  assert.match(solderContract, /does not implement silent submission/i);
  assert.match(solderContract, /official Technic Platform API posting support/i);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { validateLaunchPayload, validateClaimResponse } from '../src/shared/job-contract.js';
import { redactSensitiveText, redactSensitiveValue, sanitizeFailureReason } from '../src/shared/redaction.js';

const now = Date.parse('2026-07-01T12:00:00Z');
const future = '2026-07-01T12:15:00Z';
const token = 'wtej_abcdefghijklmnopqrstuvwxyz1234567890';

function validLaunch(overrides = {}) {
  return {
    schema_version: 1,
    solder_base_url: 'https://solder.wargames.host/',
    job_uuid: 'technic-extension-job-20260701120000-abcdef123456',
    job_token: token,
    job_type: 'technic_changelog_post',
    expires_at: future,
    ...overrides
  };
}

function validClaim(overrides = {}) {
  return {
    service: 'wargames-solder',
    result: {
      ok: true,
      status: 'claimed',
      job: {
        job_uuid: 'technic-extension-job-20260701120000-abcdef123456',
        job_type: 'technic_changelog_post',
        status: 'claimed',
        expires_at: future,
        technic_platform_slug: 'example-pack',
        version_number: '1.2.3',
        internal_api_token_exposed: false,
        technic_credentials_stored: false,
        technic_session_tokens_stored: false,
        technic_cookies_stored: false
      },
      payload: {
        schema_version: 1,
        job: {
          job_uuid: 'technic-extension-job-20260701120000-abcdef123456',
          job_type: 'technic_changelog_post',
          status: 'created',
          expires_at: future,
          token_hash_exposed: false,
          internal_api_token_exposed: false
        },
        target: {
          technic_platform_slug: 'example-pack',
          technic_platform_edit_versions_url: 'https://www.technicpack.net/dashboard/modpack/example-pack/versions',
          version_number: '1.2.3'
        },
        extension_payload: {
          changelog: {
            copy_text: 'Approved changelog text'
          }
        },
        safety: {
          technic_platform_api_posting_supported: false,
          backend_technic_posting_enabled: false,
          server_side_browser_automation_enabled: false,
          login_bypass_enabled: false,
          credentials_included: false,
          session_tokens_included: false,
          cookies_included: false,
          user_initiated_flow_required: true,
          user_confirmation_required_before_submit: true
        }
      },
      ...overrides
    }
  };
}

test('validates Wargames launch payloads from the Solder handoff contract', () => {
  const result = validateLaunchPayload(validLaunch(), now);
  assert.equal(result.ok, true);
  assert.equal(result.value.apiBaseUrl, 'https://solder.wargames.host');
  assert.equal(result.value.jobType, 'technic_changelog_post');
  assert.equal(result.value.jobToken, token);
});

test('rejects malformed, expired, and unsupported launch payloads before fetch', () => {
  assert.equal(validateLaunchPayload(null, now).ok, false);
  assert.equal(validateLaunchPayload(validLaunch({ schema_version: 2 }), now).code, 'invalid_schema_version');
  assert.equal(validateLaunchPayload(validLaunch({ expires_at: '2026-07-01T11:59:00Z' }), now).code, 'job_expired');
  assert.equal(validateLaunchPayload(validLaunch({ job_type: 'technic_update_publish_future' }), now).code, 'reserved_job_type');
  assert.equal(validateLaunchPayload(validLaunch({ solder_base_url: 'http://solder.wargames.host' }), now).code, 'invalid_launch_fields');
});

test('validates claimed Solder job payloads and derives safe Technic targets', () => {
  const result = validateClaimResponse(validClaim(), now);
  assert.equal(result.ok, true);
  assert.equal(result.value.jobType, 'technic_changelog_post');
  assert.equal(result.value.technicUrl, 'https://www.technicpack.net/dashboard/modpack/example-pack/versions');
  assert.equal(result.value.versionNumber, '1.2.3');
  assert.equal(result.value.changelogText, 'Approved changelog text');
});

test('rejects unsafe or incomplete claimed payloads', () => {
  assert.equal(validateClaimResponse(validClaim({
    job: { job_type: 'technic_update_publish_future', expires_at: future },
    payload: { job: { job_type: 'technic_update_publish_future', expires_at: future } }
  }), now).code, 'reserved_job_type');

  assert.equal(validateClaimResponse(validClaim({
    job: {
      job_type: 'technic_changelog_post',
      expires_at: future,
      technic_platform_slug: 'example-pack',
      version_number: '1.2.3',
      job_token: token
    }
  }), now).code, 'unsafe_payload');

  assert.equal(validateClaimResponse(validClaim({
    job: {
      job_type: 'technic_changelog_post',
      expires_at: '2026-07-01T11:59:00Z',
      technic_platform_slug: 'example-pack',
      version_number: '1.2.3'
    }
  }), now).code, 'job_expired');

  assert.equal(validateClaimResponse(validClaim({
    job: {
      job_uuid: 'technic-extension-job-20260701120000-abcdef123456',
      job_type: 'technic_changelog_post',
      status: 'claimed',
      expires_at: future,
      technic_platform_slug: '',
      version_number: '1.2.3'
    },
    payload: {
      job: { job_type: 'technic_changelog_post', expires_at: future },
      target: { technic_platform_slug: '', technic_platform_edit_versions_url: 'https://evil.example/versions', version_number: '1.2.3' },
      extension_payload: { changelog: { copy_text: 'Approved changelog text' } },
      safety: { credentials_included: false, session_tokens_included: false, cookies_included: false }
    }
  }), now).code, 'invalid_technic_target');
});

test('redacts short-lived job tokens in strings and structured values', () => {
  assert.equal(redactSensitiveText(`failed for ${token}`), 'failed for [redacted]');
  assert.deepEqual(redactSensitiveValue({ job_token: token, nested: { message: `token ${token}` } }), {
    job_token: '[redacted]',
    nested: { message: 'token [redacted]' }
  });
  assert.equal(sanitizeFailureReason(`submit failed ${token}`), 'submit failed [redacted]');
});

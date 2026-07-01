import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'background', 'service-worker.js'), 'utf8');
const token = 'wtej_abcdefghijklmnopqrstuvwxyz1234567890';
const future = '2099-07-01T12:15:00Z';

function validClaimResponse(overrides = {}) {
  return {
    service: 'wargames-solder',
    result: {
      ok: true,
      status: 'claimed',
      job: {
        job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
        job_type: 'technic_changelog_post',
        status: 'claimed',
        expires_at: future,
        technic_platform_slug: 'example-pack',
        version_number: '1.2.3',
        internal_api_token_exposed: false,
        token_hash_exposed: false,
        technic_credentials_stored: false,
        technic_session_tokens_stored: false,
        technic_cookies_stored: false
      },
      payload: {
        schema_version: 1,
        job: {
          job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
          job_type: 'technic_changelog_post',
          status: 'created',
          expires_at: future,
          token_hash_exposed: false,
          internal_api_token_exposed: false
        },
        target: {
          technic_platform_slug: 'example-pack',
          technic_platform_edit_versions_url: 'https://www.technicpack.net/modpack/edit/example-pack/versions',
          version_number: '1.2.3'
        },
        extension_payload: {
          changelog: {
            copy_text: 'Approved changelog text'
          }
        },
        safety: {
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

function createHarness(fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(validClaimResponse()) })) {
  const state = {
    fetchCalls: [],
    createdTabs: [],
    sentMessages: [],
    onMessage: null,
    onUpdated: null,
    onRemoved: null
  };

  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener(listener) {
          state.onMessage = listener;
        }
      }
    },
    tabs: {
      create(options, callback) {
        state.createdTabs.push(options);
        callback({ id: 42 });
      },
      sendMessage(tabId, message, callback) {
        state.sentMessages.push({ tabId, message });
        callback?.({ ok: true });
      },
      onUpdated: {
        addListener(listener) {
          state.onUpdated = listener;
        }
      },
      onRemoved: {
        addListener(listener) {
          state.onRemoved = listener;
        }
      }
    }
  };

  const context = vm.createContext({
    chrome,
    fetch: async (url, options) => {
      state.fetchCalls.push({ url, options, body: JSON.parse(options.body) });
      return fetchImpl(url, options, state);
    },
    URL,
    Date,
    Promise,
    String,
    Number,
    Boolean,
    Object,
    Array,
    RegExp,
    Set,
    Map,
    JSON,
    Math,
    Uint8Array,
    encodeURIComponent,
    globalThis: null
  });
  context.globalThis = context;
  vm.runInContext(serviceWorkerSource, context, { filename: 'service-worker.js' });
  return state;
}

function startMessage(overrides = {}) {
  return {
    type: 'WGH_START_TECHNIC_JOB',
    apiBaseUrl: 'https://solder.wargames.host',
    jobUuid: 'technic-extension-job-20990701120000-abcdef123456',
    jobToken: token,
    jobType: 'technic_changelog_post',
    expiresAt: future,
    ...overrides
  };
}

function sendRuntimeMessage(state, message, sender = {}) {
  return new Promise((resolve) => {
    const returned = state.onMessage(message, sender, resolve);
    if (returned !== true) {
      resolve({ returned });
    }
  });
}

test('claims a valid Solder job, opens Technic after validation, and sends only safe preview data to the tab', async () => {
  const state = createHarness();
  const response = await sendRuntimeMessage(state, startMessage());

  assert.equal(response.ok, true);
  assert.equal(state.fetchCalls.length, 1);
  assert.equal(state.fetchCalls[0].url, 'https://solder.wargames.host/internal/technic-extension-jobs/claim');
  assert.deepEqual(state.fetchCalls[0].body, {
    job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
    job_token: token
  });
  assert.equal(JSON.stringify(state.createdTabs), JSON.stringify([{ url: 'https://www.technicpack.net/modpack/edit/example-pack/versions', active: true }]));

  state.onUpdated(42, { status: 'complete' });
  assert.equal(state.sentMessages.length, 1);
  assert.equal(state.sentMessages[0].message.type, 'WGH_TECHNIC_JOB_PAYLOAD');
  assert.equal(state.sentMessages[0].message.formFillingImplemented, true);
  assert.equal(state.sentMessages[0].message.silentSubmissionEnabled, false);
  assert.equal(state.sentMessages[0].message.userConfirmationRequired, true);
  assert.match(state.sentMessages[0].message.confirmationId, /^wgh-confirm-/);
  assert.equal(state.sentMessages[0].message.preview.versionNumber, '1.2.3');
  assert.equal(state.sentMessages[0].message.preview.changelogText, 'Approved changelog text');
  assert.equal(JSON.stringify(state.sentMessages[0].message).includes(token), false);
  assert.equal(JSON.stringify(state.sentMessages[0].message).includes('owner_external_id'), false);
});

test('rejects bad launch payloads before contacting Solder or opening Technic', async () => {
  const state = createHarness();
  const response = await sendRuntimeMessage(state, startMessage({
    apiBaseUrl: 'http://solder.wargames.host',
    jobType: 'technic_changelog_post'
  }));

  assert.equal(response.ok, false);
  assert.equal(state.fetchCalls.length, 0);
  assert.equal(state.createdTabs.length, 0);
});

test('rejects unsafe claim responses without opening a Technic tab and without leaking tokens in errors', async () => {
  const state = createHarness(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(validClaimResponse({
      job: {
        job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
        job_type: 'technic_changelog_post',
        status: 'claimed',
        expires_at: future,
        technic_platform_slug: 'example-pack',
        version_number: '1.2.3',
        job_token: token
      }
    }))
  }));

  const response = await sendRuntimeMessage(state, startMessage());
  assert.equal(response.ok, false);
  assert.match(response.message, /unsafe credential/);
  assert.equal(response.message.includes(token), false);
  assert.equal(state.createdTabs.length, 0);
});

test('rejects reserved future update-publisher jobs without opening a Technic tab', async () => {
  const state = createHarness(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(validClaimResponse({
      job: {
        job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
        job_type: 'technic_update_publish_future',
        status: 'claimed',
        expires_at: future,
        technic_platform_slug: 'example-pack',
        version_number: '1.2.3'
      },
      payload: {
        job: { job_type: 'technic_update_publish_future', expires_at: future },
        target: { technic_platform_slug: 'example-pack', version_number: '1.2.3' },
        extension_payload: { changelog: { copy_text: 'Approved changelog text' } },
        safety: { credentials_included: false, session_tokens_included: false, cookies_included: false }
      }
    }))
  }));

  const response = await sendRuntimeMessage(state, startMessage());
  assert.equal(response.ok, false);
  assert.match(response.message, /reserved|only supports/i);
  assert.equal(state.createdTabs.length, 0);
});

test('reports completion only after explicit confirmation and redacts failure reasons sent back to Solder', async () => {
  const state = createHarness(async (url) => {
    if (url.endsWith('/fail')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ result: { ok: true } }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(validClaimResponse()) };
  });

  await sendRuntimeMessage(state, startMessage());

  state.onUpdated(42, { status: 'complete' });
  const confirmationId = state.sentMessages.at(-1).message.confirmationId;

  const unconfirmed = await sendRuntimeMessage(state, { type: 'WGH_TECHNIC_JOB_COMPLETED' }, { tab: { id: 42 } });
  assert.equal(unconfirmed.ok, false);
  assert.match(unconfirmed.message, /explicit user-confirmed/i);
  assert.equal(state.fetchCalls.some((call) => call.url.endsWith('/complete')), false);

  const completion = await sendRuntimeMessage(state, {
    type: 'WGH_TECHNIC_JOB_COMPLETED',
    confirmationId,
    userConfirmed: true,
    submissionAttempted: true
  }, { tab: { id: 42 } });
  assert.equal(completion.ok, true);
  assert.equal(state.fetchCalls.at(-1).url, 'https://solder.wargames.host/internal/technic-extension-jobs/complete');
  assert.deepEqual(state.fetchCalls.at(-1).body, {
    job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
    job_token: token
  });

  await sendRuntimeMessage(state, startMessage());
  state.onUpdated(42, { status: 'complete' });
  const secondConfirmationId = state.sentMessages.at(-1).message.confirmationId;
  const fail = await sendRuntimeMessage(state, {
    type: 'WGH_TECHNIC_JOB_FAILED',
    confirmationId: secondConfirmationId,
    reason: `submit failed ${token}`
  }, { tab: { id: 42 } });
  assert.equal(fail.ok, true);
  assert.equal(state.fetchCalls.at(-1).url, 'https://solder.wargames.host/internal/technic-extension-jobs/fail');
  assert.equal(state.fetchCalls.at(-1).body.failure_reason, 'submit failed [redacted]');
});

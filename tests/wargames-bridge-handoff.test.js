import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'bridge', 'wargames-bridge.js'), 'utf8');
const token = 'wtej_abcdefghijklmnopqrstuvwxyz1234567890';

function createElement(tagName, state) {
  return {
    tagName,
    id: '',
    textContent: '',
    style: {},
    attributes: {},
    children: [],
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    append(...items) {
      this.children.push(...items);
    },
    appendChild(item) {
      this.children.push(item);
    },
    remove() {
      state.appended = state.appended.filter((item) => item !== this);
    }
  };
}

function createHarness(sendMessageImpl = async () => ({ ok: true })) {
  const state = {
    listeners: new Map(),
    dispatched: [],
    sentMessages: [],
    appended: []
  };

  const window = {
    addEventListener(name, listener) {
      if (!state.listeners.has(name)) {
        state.listeners.set(name, []);
      }
      state.listeners.get(name).push(listener);
    },
    dispatchEvent(event) {
      state.dispatched.push(event);
      for (const listener of state.listeners.get(event.type) || []) {
        listener(event);
      }
      return true;
    }
  };

  const document = {
    documentElement: {
      appendChild(item) {
        state.appended.push(item);
      }
    },
    createElement(tagName) {
      return createElement(tagName, state);
    },
    getElementById(id) {
      return state.appended.find((item) => item.id === id) || null;
    }
  };

  const chrome = {
    runtime: {
      sendMessage: async (message) => {
        state.sentMessages.push(message);
        return sendMessageImpl(message, state);
      }
    }
  };

  function CustomEvent(type, init = {}) {
    return { type, detail: init.detail };
  }

  const context = vm.createContext({
    window,
    document,
    chrome,
    CustomEvent,
    URL,
    Date,
    Promise,
    String,
    Number,
    RegExp,
    Set,
    Array,
    Object,
    setTimeout: () => 0,
    globalThis: null
  });
  context.globalThis = context;
  vm.runInContext(bridgeSource, context, { filename: 'wargames-bridge.js' });
  return { state, window, CustomEvent };
}

function validDetail(overrides = {}) {
  return {
    schema_version: 1,
    solder_base_url: 'https://solder.wargames.host/',
    job_uuid: 'technic-extension-job-20990701120000-abcdef123456',
    job_token: token,
    job_type: 'technic_changelog_post',
    expires_at: '2099-07-01T12:15:00Z',
    ...overrides
  };
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('announces readiness with Patch 003 safety boundaries', () => {
  const { state } = createHarness();
  const ready = state.dispatched.find((event) => event.type === 'wgh:browser-extension-ready');
  assert.ok(ready);
  assert.equal(JSON.stringify(ready.detail.supports), JSON.stringify(['technic_changelog_post']));
  assert.equal(ready.detail.patch_scope, 'technic_form_fill_confirmation_safety');
  assert.equal(ready.detail.form_filling_implemented, true);
  assert.equal(ready.detail.user_confirmation_required, true);
  assert.equal(ready.detail.silent_submission_enabled, false);
});

test('forwards valid user-initiated Wargames handoff events to the background script', async () => {
  const { state, window, CustomEvent } = createHarness();
  window.dispatchEvent(new CustomEvent('wgh:technic-extension-job', { detail: validDetail() }));
  await flushAsync();

  assert.equal(state.sentMessages.length, 1);
  assert.equal(JSON.stringify(state.sentMessages[0]), JSON.stringify({
    type: 'WGH_START_TECHNIC_JOB',
    apiBaseUrl: 'https://solder.wargames.host',
    jobUuid: 'technic-extension-job-20990701120000-abcdef123456',
    jobToken: token,
    jobType: 'technic_changelog_post',
    expiresAt: '2099-07-01T12:15:00Z'
  }));
});

test('rejects malformed, expired, and reserved handoff events without sending tokens to the background', async () => {
  const { state, window, CustomEvent } = createHarness();

  window.dispatchEvent(new CustomEvent('wgh:technic-extension-job', { detail: validDetail({ job_type: 'technic_update_publish_future' }) }));
  window.dispatchEvent(new CustomEvent('wgh:technic-extension-job', { detail: validDetail({ expires_at: '2020-01-01T00:00:00Z' }) }));
  window.dispatchEvent(new CustomEvent('wgh:technic-extension-job', { detail: validDetail({ solder_base_url: 'http://solder.wargames.host' }) }));
  await flushAsync();

  assert.equal(state.sentMessages.length, 0);
  assert.ok(state.appended.some((item) => /expired|reserved|missing|valid/i.test(item.textContent)));
});

test('redacts raw job tokens from user-facing bridge errors', async () => {
  const { state, window, CustomEvent } = createHarness(async () => ({ ok: false, message: `backend echoed ${token}` }));
  window.dispatchEvent(new CustomEvent('wgh:technic-extension-job', { detail: validDetail() }));
  await flushAsync();

  const notices = state.appended.map((item) => item.textContent).join('\n');
  assert.equal(notices.includes(token), false);
  assert.match(notices, /\[redacted\]/);
});

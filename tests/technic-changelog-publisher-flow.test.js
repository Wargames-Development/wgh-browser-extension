import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publisherSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'technic', 'changelog-publisher.js'), 'utf8');
const future = '2099-07-01T12:15:00Z';
const token = 'wtej_abcdefghijklmnopqrstuvwxyz1234567890';

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.defaultPrevented = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class FakeElement {
  constructor(tagName, attrs = {}, state = null) {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.listeners = new Map();
    this.state = state;
    this.textContent = '';
    this.innerText = '';
    this.value = attrs.value || '';
    this.disabled = Boolean(attrs.disabled);
    this.readOnly = Boolean(attrs.readOnly);
    this.rows = 0;
    for (const [key, value] of Object.entries(attrs)) {
      if (!['value', 'disabled', 'readOnly'].includes(key)) {
        this.setAttribute(key, value);
      }
    }
  }

  get id() {
    return this.getAttribute('id');
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get type() {
    return this.getAttribute('type');
  }

  set type(value) {
    this.setAttribute('type', value);
  }

  get name() {
    return this.getAttribute('name');
  }

  set name(value) {
    this.setAttribute('name', value);
  }

  get className() {
    return this.getAttribute('class');
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  setAttribute(name, value) {
    this.attributes[String(name)] = String(value);
  }

  getAttribute(name) {
    return this.attributes[String(name)] ?? '';
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, String(name));
  }

  append(...items) {
    for (const item of items) {
      this.appendChild(item);
    }
  }

  appendChild(item) {
    if (item && typeof item === 'object') {
      item.parentNode = this;
    }
    this.children.push(item);
    return item;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    event.target = this;
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new FakeEvent('click', { bubbles: true }));
  }

  reportValidity() {
    return true;
  }

  requestSubmit(submitter) {
    this.state.submissions.push({ form: this, submitter });
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
    const matches = [];
    const visit = (node) => {
      for (const child of node.children || []) {
        if (!child || typeof child !== 'object') {
          continue;
        }
        if (selectors.some((part) => matchesSelector(child, part))) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

function matchesSelector(element, selector) {
  const tag = element.tagName.toLowerCase();
  if (selector === '*') {
    return true;
  }
  if (/^[a-z]+$/.test(selector)) {
    return tag === selector;
  }
  if (selector === '[data-wgh-status]') {
    return element.hasAttribute('data-wgh-status');
  }
  if (selector === 'button:not([type])') {
    return tag === 'button' && !element.hasAttribute('type');
  }

  const attrMatch = selector.match(/^([a-z]+)?\[([^=\]*~|]+)([*^$]?=)?"?([^"\]]*)"?\]$/i);
  if (attrMatch) {
    const [, selectorTag, attrName, operator, expected] = attrMatch;
    if (selectorTag && tag !== selectorTag.toLowerCase()) {
      return false;
    }
    const actual = element.getAttribute(attrName);
    if (!operator) {
      return element.hasAttribute(attrName);
    }
    if (operator === '=') {
      return actual === expected;
    }
    if (operator === '*=') {
      return actual.includes(expected);
    }
    return false;
  }

  return false;
}

function createDocument(state) {
  const documentElement = new FakeElement('html', {}, state);
  const body = new FakeElement('body', {}, state);
  documentElement.appendChild(body);

  const document = {
    body,
    documentElement,
    createElement(tagName) {
      return new FakeElement(tagName, {}, state);
    },
    getElementById(id) {
      return findElement(documentElement, (item) => item.id === id) || null;
    },
    querySelector(selector) {
      return documentElement.querySelector(selector);
    },
    querySelectorAll(selector) {
      return documentElement.querySelectorAll(selector);
    }
  };
  return document;
}

function findElement(root, predicate) {
  if (predicate(root)) {
    return root;
  }
  for (const child of root.children || []) {
    if (!child || typeof child !== 'object') {
      continue;
    }
    const found = findElement(child, predicate);
    if (found) {
      return found;
    }
  }
  return null;
}

function findButtonByText(root, text) {
  return findElement(root, (item) => item.tagName === 'BUTTON' && item.textContent === text);
}

function createTechnicForm(document, state, options = {}) {
  const form = new FakeElement('form', { class: 'edit-versions-form', action: '/modpack/edit/example-pack/versions' }, state);
  if (options.version !== false) {
    form.appendChild(new FakeElement('input', { name: 'version', type: 'text', value: options.initialVersion || '' }, state));
  }
  if (options.changelog !== false) {
    form.appendChild(new FakeElement('textarea', { name: 'changelog', value: options.initialChangelog || '' }, state));
  }
  form.appendChild(new FakeElement('button', { type: 'submit' }, state));
  document.body.appendChild(form);
  return form;
}

function validPayload(overrides = {}) {
  return {
    type: 'WGH_TECHNIC_JOB_PAYLOAD',
    patchScope: 'technic_form_fill_confirmation_safety',
    formFillingImplemented: true,
    silentSubmissionEnabled: false,
    completionReportingEnabled: true,
    userConfirmationRequired: true,
    confirmationId: 'wgh-confirm-test',
    preview: {
      jobType: 'technic_changelog_post',
      technicUrl: 'https://www.technicpack.net/modpack/edit/example-pack/versions',
      versionNumber: '1.2.3',
      changelogText: 'Approved changelog text',
      expiresAt: future
    },
    ...overrides
  };
}

function createHarness({ href = 'https://www.technicpack.net/modpack/edit/example-pack/versions', bodyText = '', formOptions = {} } = {}, sendMessageImpl = async () => ({ ok: true })) {
  const state = {
    listener: null,
    runtimeMessages: [],
    submissions: []
  };
  const document = createDocument(state);
  document.body.textContent = bodyText;
  document.body.innerText = bodyText;
  let form = null;
  if (formOptions !== false) {
    form = createTechnicForm(document, state, formOptions);
  }

  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) {
          state.listener = listener;
        }
      },
      sendMessage: async (message) => {
        state.runtimeMessages.push(message);
        return sendMessageImpl(message, state);
      }
    }
  };

  const context = vm.createContext({
    chrome,
    document,
    window: { location: { href } },
    Event: FakeEvent,
    URL,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
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
    console,
    globalThis: null
  });
  context.globalThis = context;
  vm.runInContext(publisherSource, context, { filename: 'changelog-publisher.js' });
  return { state, document, form };
}

function sendContentMessage(state, message) {
  return new Promise((resolve) => {
    const returned = state.listener(message, {}, resolve);
    if (returned !== true) {
      resolve({ returned });
    }
  });
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('fills Technic version and changelog fields but waits for explicit confirmation before submitting', async () => {
  const { state, document, form } = createHarness();
  const response = await sendContentMessage(state, validPayload());

  assert.equal(response.ok, true);
  assert.equal(form.querySelector('input[name="version"]').value, '1.2.3');
  assert.equal(form.querySelector('textarea[name="changelog"]').value, 'Approved changelog text');
  assert.equal(state.submissions.length, 0);

  const submit = findButtonByText(document.documentElement, 'Submit Technic form');
  assert.ok(submit);
  submit.click();
  await flushAsync();

  assert.equal(state.runtimeMessages.length, 1);
  assert.equal(JSON.stringify(state.runtimeMessages[0]), JSON.stringify({
    type: 'WGH_TECHNIC_JOB_COMPLETED',
    confirmationId: 'wgh-confirm-test',
    userConfirmed: true,
    submissionAttempted: true
  }));
  assert.equal(state.submissions.length, 1);
});

test('does not mistake normal owner/contributor page text for permission denial when a form is editable', async () => {
  const { state, form } = createHarness({ bodyText: 'Owner tools Contributor access Manage versions' });
  const response = await sendContentMessage(state, validPayload());

  assert.equal(response.ok, true);
  assert.equal(response.code, 'technic_form_filled_confirmation_required');
  assert.equal(form.querySelector('input[name="version"]').value, '1.2.3');
  assert.equal(form.querySelector('textarea[name="changelog"]').value, 'Approved changelog text');
  assert.equal(state.submissions.length, 0);
});

test('waits briefly for Technic forms that render after page scripts finish', async () => {
  const harness = createHarness({ bodyText: 'Technic manage versions', formOptions: false });
  setTimeout(() => {
    harness.form = createTechnicForm(harness.document, harness.state);
  }, 20);

  const response = await sendContentMessage(harness.state, validPayload());

  assert.equal(response.ok, true);
  assert.equal(response.code, 'technic_form_filled_confirmation_required');
  assert.equal(harness.form.querySelector('input[name="version"]').value, '1.2.3');
  assert.equal(harness.form.querySelector('textarea[name="changelog"]').value, 'Approved changelog text');
  assert.equal(harness.state.submissions.length, 0);
});

test('cancel restores original field values and does not submit the Technic form', async () => {
  const { state, document, form } = createHarness({ formOptions: { initialVersion: 'old-version', initialChangelog: 'old notes' } });
  const response = await sendContentMessage(state, validPayload());
  assert.equal(response.ok, true);

  const cancel = findButtonByText(document.documentElement, 'Cancel / use manual copy');
  assert.ok(cancel);
  cancel.click();
  await flushAsync();

  assert.equal(form.querySelector('input[name="version"]').value, 'old-version');
  assert.equal(form.querySelector('textarea[name="changelog"]').value, 'old notes');
  assert.equal(state.submissions.length, 0);
  assert.equal(state.runtimeMessages.length, 1);
  assert.equal(state.runtimeMessages[0].type, 'WGH_TECHNIC_JOB_FAILED');
  assert.match(state.runtimeMessages[0].reason, /user_cancelled/);
});

test('rejects unsupported Technic URLs without changing fields', async () => {
  const { state, form } = createHarness({ href: 'https://www.technicpack.net/modpack/example-pack' });
  const response = await sendContentMessage(state, validPayload());

  assert.equal(response.ok, false);
  assert.equal(response.code, 'unsupported_technic_url');
  assert.equal(form.querySelector('input[name="version"]').value, '');
  assert.equal(form.querySelector('textarea[name="changelog"]').value, '');
  assert.equal(state.submissions.length, 0);
});

test('detects login, permission, missing form, and missing field failure states safely', async () => {
  const login = createHarness({ formOptions: false, bodyText: 'Log in with your password to manage this pack' });
  login.document.body.appendChild(new FakeElement('input', { type: 'password' }, login.state));
  assert.equal((await sendContentMessage(login.state, validPayload())).code, 'technic_not_logged_in');

  const denied = createHarness({ formOptions: false, bodyText: 'You do not have permission to edit this modpack' });
  assert.equal((await sendContentMessage(denied.state, validPayload())).code, 'technic_permission_denied');

  const missingForm = createHarness({ formOptions: false, bodyText: 'Technic manage versions' });
  assert.equal((await sendContentMessage(missingForm.state, validPayload())).code, 'technic_form_not_found');

  const missingVersion = createHarness({ formOptions: { version: false } });
  assert.equal((await sendContentMessage(missingVersion.state, validPayload())).code, 'technic_version_field_missing');

  const missingChangelog = createHarness({ formOptions: { changelog: false } });
  assert.equal((await sendContentMessage(missingChangelog.state, validPayload())).code, 'technic_changelog_field_missing');
});

test('rejects malformed, expired, unsupported, and unsafe job payloads before filling fields', async () => {
  const malformed = createHarness();
  assert.equal((await sendContentMessage(malformed.state, { type: 'WGH_TECHNIC_JOB_PAYLOAD' })).code, 'unsupported_job_payload');
  assert.equal(malformed.form.querySelector('input[name="version"]').value, '');

  const expired = createHarness();
  assert.equal((await sendContentMessage(expired.state, validPayload({ preview: { ...validPayload().preview, expiresAt: '2020-01-01T00:00:00Z' } }))).code, 'job_expired');
  assert.equal(expired.form.querySelector('input[name="version"]').value, '');

  const reserved = createHarness();
  assert.equal((await sendContentMessage(reserved.state, validPayload({ preview: { ...validPayload().preview, jobType: 'technic_update_publish_future' } }))).code, 'reserved_job_type');
  assert.equal(reserved.form.querySelector('input[name="version"]').value, '');

  const unsafe = createHarness();
  assert.equal((await sendContentMessage(unsafe.state, validPayload({ preview: { ...validPayload().preview, job_token: token } }))).code, 'unsafe_payload');
  assert.equal(unsafe.form.querySelector('input[name="version"]').value, '');
});

(() => {
  'use strict';

  const extensionApi = globalThis.browser || globalThis.chrome;
  const MESSAGE_TECHNIC_JOB_PAYLOAD = 'WGH_TECHNIC_JOB_PAYLOAD';
  const MESSAGE_TECHNIC_JOB_COMPLETED = 'WGH_TECHNIC_JOB_COMPLETED';
  const MESSAGE_TECHNIC_JOB_FAILED = 'WGH_TECHNIC_JOB_FAILED';
  const ACTIVE_JOB_TYPE = 'technic_changelog_post';
  const MAX_VERSION_LENGTH = 128;
  const MAX_CHANGELOG_LENGTH = 64000;
  const SUPPORTED_PATCH_SCOPE = 'technic_form_fill_confirmation_safety';

  const TOKEN_PATTERNS = [
    /wtej_[A-Za-z0-9_-]{8,}/g,
    /("?job_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi,
    /("?internal_api_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi
  ];

  const SENSITIVE_KEY_PATTERNS = [
    /^job_token$/i,
    /^internal_api_token$/i,
    /^technic_password$/i,
    /^password$/i,
    /^technic_cookie$/i,
    /^technic_cookies$/i,
    /^cookie$/i,
    /^cookies$/i,
    /^technic_session_token$/i,
    /^technic_session_tokens$/i,
    /^session_token$/i,
    /^session_tokens$/i,
    /^two_factor_code$/i,
    /^totp_secret$/i
  ];

  function redactSensitiveText(value) {
    let text = String(value ?? '');
    for (const pattern of TOKEN_PATTERNS) {
      text = text.replace(pattern, (match, prefix = '') => {
        if (prefix && /[:=]/.test(prefix)) {
          return `${prefix}"[redacted]"`;
        }
        return '[redacted]';
      });
    }
    return text;
  }

  function isSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key || '')));
  }

  function containsUnsafeSecret(value, path = []) {
    if (typeof value === 'string') {
      return TOKEN_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(value);
      });
    }
    if (!value || typeof value !== 'object') {
      return false;
    }
    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveKey(key) && item !== false && item !== null && item !== '') {
        return true;
      }
      if (containsUnsafeSecret(item, [...path, key])) {
        return true;
      }
    }
    return false;
  }

  function isFutureIsoDate(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      return false;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > Date.now();
  }

  function validateTechnicVersionsUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      return '';
    }
    try {
      const url = new URL(value.trim());
      if (url.protocol !== 'https:' || url.hostname !== 'www.technicpack.net') {
        return '';
      }
      const path = url.pathname.replace(/\/+$/, '');
      if (/^\/modpack\/edit\/[A-Za-z0-9-]+\/versions$/.test(path)
        || /^\/dashboard\/modpack\/[A-Za-z0-9-]+\/versions$/.test(path)) {
        return url.toString();
      }
    } catch (_) {
      return '';
    }
    return '';
  }

  function extractTechnicSlug(value) {
    const supportedUrl = validateTechnicVersionsUrl(value);
    if (!supportedUrl) {
      return '';
    }
    try {
      const pathParts = new URL(supportedUrl).pathname.split('/').filter(Boolean);
      const versionsIndex = pathParts.lastIndexOf('versions');
      return versionsIndex > 0 ? pathParts[versionsIndex - 1] : '';
    } catch (_) {
      return '';
    }
  }

  function normalizePreview(message) {
    if (!message || typeof message !== 'object') {
      return { ok: false, code: 'missing_job_payload', message: 'The Wargames/Solder job payload was missing. Use manual copy/export instead.' };
    }
    if (containsUnsafeSecret(message)) {
      return { ok: false, code: 'unsafe_payload', message: 'The Wargames/Solder job payload contained unsafe credential, cookie, session, or token material. No Technic form was changed.' };
    }
    if (message.patchScope && message.patchScope !== SUPPORTED_PATCH_SCOPE) {
      return { ok: false, code: 'unsupported_job_payload', message: 'This WGH extension build does not support that Technic job payload shape. Use manual copy/export instead.' };
    }
    if (message.silentSubmissionEnabled === true) {
      return { ok: false, code: 'unsafe_payload', message: 'The job payload requested silent submission, which is not allowed. No Technic form was changed.' };
    }
    if (message.formFillingImplemented !== true) {
      return { ok: false, code: 'unsupported_job_payload', message: 'The job payload was not marked for the user-confirmed Technic form workflow. Use manual copy/export instead.' };
    }

    const preview = message.preview || {};
    const jobType = String(preview.jobType || '').trim();
    const technicUrl = validateTechnicVersionsUrl(String(preview.technicUrl || '').trim());
    const versionNumber = String(preview.versionNumber || '').trim();
    const changelogText = String(preview.changelogText || '').trim();
    const expiresAt = String(preview.expiresAt || message.expiresAt || '').trim();
    const confirmationId = String(message.confirmationId || '').trim();

    if (jobType !== ACTIVE_JOB_TYPE) {
      return { ok: false, code: jobType === 'technic_update_publish_future' ? 'reserved_job_type' : 'unsupported_job_type', message: 'This extension version only supports Technic changelog posting. No Technic form was changed.' };
    }
    if (!technicUrl || !versionNumber || !changelogText || !confirmationId) {
      return { ok: false, code: 'malformed_job_payload', message: 'The Wargames/Solder job payload was incomplete. Use manual copy/export instead.' };
    }
    if (!isFutureIsoDate(expiresAt)) {
      return { ok: false, code: 'job_expired', message: 'The Wargames/Solder job payload is expired. No Technic form was changed; use manual copy/export instead.' };
    }
    if (versionNumber.length > MAX_VERSION_LENGTH || changelogText.length > MAX_CHANGELOG_LENGTH) {
      return { ok: false, code: 'malformed_job_payload', message: 'The Wargames/Solder job payload was too large for the safe MVP form fill. Use manual copy/export instead.' };
    }

    return {
      ok: true,
      value: {
        jobType,
        technicUrl,
        versionNumber,
        changelogText,
        expiresAt,
        confirmationId
      }
    };
  }

  function safeQueryAll(root, selector) {
    try {
      return Array.from(root?.querySelectorAll?.(selector) || []);
    } catch (_) {
      return [];
    }
  }

  function safeQuery(root, selector) {
    try {
      return root?.querySelector?.(selector) || null;
    } catch (_) {
      return null;
    }
  }

  function getAttribute(element, name) {
    return String(element?.getAttribute?.(name) ?? element?.[name] ?? '');
  }

  function isFieldUsable(field) {
    if (!field) {
      return false;
    }
    const type = String(field.type || getAttribute(field, 'type')).toLowerCase();
    return !field.disabled && !field.readOnly && type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'password';
  }

  function fieldMetadata(field) {
    return [
      getAttribute(field, 'name'),
      getAttribute(field, 'id'),
      getAttribute(field, 'aria-label'),
      getAttribute(field, 'placeholder'),
      getAttribute(field, 'class') || getAttribute(field, 'className')
    ].join(' ').toLowerCase();
  }

  function getControls(form) {
    return safeQueryAll(form, 'input, textarea, select').filter(isFieldUsable);
  }

  function findVersionField(form) {
    const exactSelectors = [
      'input[name="version"]',
      'input[name="version_number"]',
      'input[name="build"]',
      'input[name="build_number"]',
      'select[name="version"]',
      'textarea[name="version"]'
    ];
    for (const selector of exactSelectors) {
      const match = safeQuery(form, selector);
      if (isFieldUsable(match)) {
        return match;
      }
    }
    return getControls(form).find((field) => {
      const tag = String(field.tagName || '').toLowerCase();
      const metadata = fieldMetadata(field);
      return tag !== 'textarea'
        && /(version|version_number|build|build_number)/.test(metadata)
        && !/(csrf|token|hash|slug|url|changelog|description|notes|search)/.test(metadata);
    }) || null;
  }

  function findChangelogField(form) {
    const exactSelectors = [
      'textarea[name="changelog"]',
      'textarea[name="changelog_text"]',
      'textarea[name="change_log"]',
      'textarea[name="description"]'
    ];
    for (const selector of exactSelectors) {
      const match = safeQuery(form, selector);
      if (isFieldUsable(match)) {
        return match;
      }
    }
    const controls = getControls(form);
    return controls.find((field) => {
      const tag = String(field.tagName || '').toLowerCase();
      const metadata = fieldMetadata(field);
      return tag === 'textarea' && /(changelog|change_log|change-log|changes|release|notes|description)/.test(metadata);
    }) || controls.find((field) => String(field.tagName || '').toLowerCase() === 'textarea') || null;
  }

  function findSubmitButton(form) {
    return safeQuery(form, 'button[type="submit"], input[type="submit"]')
      || safeQuery(form, 'button:not([type])')
      || null;
  }

  function bodyText() {
    return String(document?.body?.innerText || document?.body?.textContent || document?.documentElement?.innerText || document?.documentElement?.textContent || '').toLowerCase();
  }

  function detectAccessState() {
    const text = bodyText();
    const loginForm = safeQuery(document, 'form[action*="login"], form[action*="signin"], input[type="password"], input[name="username"], input[name="login"]');
    if (loginForm && /(log in|login|sign in|signin|password)/i.test(text)) {
      return { ok: false, code: 'technic_not_logged_in', message: 'Technic appears to be asking you to log in. Log in to Technic normally, then retry the Wargames extension job or use manual copy/export.' };
    }
    if (/(do not have permission|don't have permission|not authorized|not authorised|permission denied|access denied|403|owner|contributor)/i.test(text)) {
      return { ok: false, code: 'technic_permission_denied', message: 'Technic did not show an editable versions form. This usually means the current Technic account is not a pack owner or contributor. Use manual copy/export or switch to an account with pack access.' };
    }
    return { ok: true };
  }

  function detectForm() {
    const forms = safeQueryAll(document, 'form');
    if (forms.length === 0) {
      const access = detectAccessState();
      if (!access.ok) {
        return access;
      }
      return { ok: false, code: 'technic_form_not_found', message: 'The Technic changelog form was not found. Technic may have changed the page layout; use manual copy/export instead.' };
    }

    let best = null;
    for (const form of forms) {
      const versionField = findVersionField(form);
      const changelogField = findChangelogField(form);
      const score = (versionField ? 1 : 0) + (changelogField ? 1 : 0);
      if (!best || score > best.score) {
        best = { form, versionField, changelogField, score };
      }
    }

    if (!best || best.score === 0) {
      const access = detectAccessState();
      if (!access.ok) {
        return access;
      }
      return { ok: false, code: 'technic_form_not_found', message: 'The expected Technic versions form was not found. Use manual copy/export instead.' };
    }
    if (!best.versionField) {
      return { ok: false, code: 'technic_version_field_missing', message: 'The Technic version/build field was not found. No Technic form was submitted; use manual copy/export instead.' };
    }
    if (!best.changelogField) {
      return { ok: false, code: 'technic_changelog_field_missing', message: 'The Technic changelog field was not found. No Technic form was submitted; use manual copy/export instead.' };
    }

    return {
      ok: true,
      value: {
        form: best.form,
        versionField: best.versionField,
        changelogField: best.changelogField,
        submitButton: findSubmitButton(best.form)
      }
    };
  }

  function setFieldValue(field, value) {
    const prototype = Object.getPrototypeOf(field);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(field, value);
    } else {
      field.value = value;
    }
    field.dispatchEvent?.(new Event('input', { bubbles: true }));
    field.dispatchEvent?.(new Event('change', { bubbles: true }));
  }

  function removeOverlay() {
    const overlay = document.getElementById('wgh-technic-publisher-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  function createButton(label, style, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = style;
    button.addEventListener('click', onClick);
    return button;
  }

  function appendReadonlyPreview(parent, label, value, multiline = false) {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'display:block;margin:10px 0 0;color:#d9e5ff;font-weight:700';
    wrapper.textContent = label;

    const field = multiline ? document.createElement('textarea') : document.createElement('input');
    field.readOnly = true;
    field.value = value;
    field.style.cssText = [
      'box-sizing:border-box',
      'display:block',
      'width:100%',
      'margin-top:5px',
      'border:1px solid #334968',
      'border-radius:8px',
      'background:#0b1220',
      'color:#f5f8ff',
      'padding:8px',
      'font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace'
    ].join(';');
    if (multiline) {
      field.rows = 6;
    }
    wrapper.appendChild(field);
    parent.appendChild(wrapper);
  }

  function setStatus(wrapper, message, level = 'info') {
    const status = wrapper.querySelector?.('[data-wgh-status]');
    if (!status) {
      return;
    }
    status.textContent = redactSensitiveText(message);
    status.style.color = level === 'error' ? '#ffc0c0' : '#b9d3ff';
  }

  function createOverlayShell(titleText, bodyTextValue, preview, statusText) {
    removeOverlay();

    const wrapper = document.createElement('div');
    wrapper.id = 'wgh-technic-publisher-overlay';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-live', 'polite');
    wrapper.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:2147483647',
      'width:min(520px,calc(100vw - 36px))',
      'max-height:calc(100vh - 36px)',
      'overflow:auto',
      'background:#101827',
      'color:#fff',
      'border:1px solid #2e4265',
      'border-radius:14px',
      'box-shadow:0 18px 52px rgba(0,0,0,.38)',
      'font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'padding:16px'
    ].join(';');

    const title = document.createElement('strong');
    title.textContent = titleText;
    title.style.display = 'block';
    title.style.marginBottom = '8px';

    const body = document.createElement('p');
    body.textContent = redactSensitiveText(bodyTextValue);
    body.style.margin = '0 0 10px';

    const fallback = document.createElement('p');
    fallback.textContent = 'Manual copy/export remains the safe fallback. The extension never stores Technic credentials, cookies, session tokens, 2FA data, or Wargames internal API tokens.';
    fallback.style.cssText = 'margin:0 0 10px;color:#b9c8dd';

    const status = document.createElement('p');
    status.setAttribute('data-wgh-status', 'true');
    status.textContent = redactSensitiveText(statusText || 'Review the values before continuing.');
    status.style.cssText = 'margin:8px 0 0;color:#b9d3ff';

    wrapper.append(title, body, fallback);
    if (preview?.versionNumber) {
      appendReadonlyPreview(wrapper, 'Manual fallback version/build number', redactSensitiveText(preview.versionNumber));
    }
    if (preview?.changelogText) {
      appendReadonlyPreview(wrapper, 'Manual fallback changelog text', redactSensitiveText(preview.changelogText), true);
    }
    wrapper.appendChild(status);
    document.documentElement.appendChild(wrapper);
    return wrapper;
  }

  async function sendRuntimeMessage(message) {
    if (!extensionApi?.runtime?.sendMessage) {
      return { ok: false, message: 'WGH Browser Extension runtime is not available.' };
    }
    try {
      const response = extensionApi.runtime.sendMessage(message);
      if (response && typeof response.then === 'function') {
        return await response;
      }
      return response || { ok: true };
    } catch (error) {
      return { ok: false, message: redactSensitiveText(error?.message || String(error)) };
    }
  }

  function showFailure(preview, code, message, confirmationId = '') {
    const wrapper = createOverlayShell(
      'WGH Technic changelog job could not continue',
      message,
      preview,
      'No Technic form was submitted.'
    );

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
    actions.appendChild(createButton(
      'Close',
      'cursor:pointer;border:1px solid #536683;border-radius:9px;padding:9px 11px;background:#17243a;color:#fff',
      removeOverlay
    ));
    if (confirmationId) {
      actions.appendChild(createButton(
        'Report failure',
        'cursor:pointer;border:1px solid #6b3d3d;border-radius:9px;padding:9px 11px;background:#2c1515;color:#fff',
        async () => {
          const response = await sendRuntimeMessage({
            type: MESSAGE_TECHNIC_JOB_FAILED,
            confirmationId,
            reason: `${code}: ${message}`
          });
          if (!response?.ok) {
            setStatus(wrapper, response?.message || 'Could not report the failure to Wargames. Manual copy/export is still available.', 'error');
            return;
          }
          setStatus(wrapper, 'Failure reported to Wargames. Manual copy/export remains available.');
        }
      ));
    }
    wrapper.appendChild(actions);
  }

  function submitNormalTechnicForm(form, submitButton) {
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
      return { ok: false, message: 'Technic form validation blocked submission. Review the highlighted fields on the Technic page.' };
    }
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit(submitButton || undefined);
      return { ok: true };
    }
    if (submitButton && typeof submitButton.click === 'function') {
      submitButton.click();
      return { ok: true };
    }
    return { ok: false, message: 'The Technic form could not be submitted safely because no normal submit control was available.' };
  }

  function showConfirmation(preview, formData, originalValues) {
    const wrapper = createOverlayShell(
      'Review before submitting to Technic',
      'The version/build and changelog fields have been filled on the normal Technic manage versions form. Review the page, then choose whether to submit the Technic form.',
      preview,
      'Nothing has been submitted. Submission requires pressing the confirmation button below.'
    );

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';

    const submit = createButton(
      'Submit Technic form',
      'cursor:pointer;border:1px solid #5fb879;border-radius:9px;padding:9px 11px;background:#12301d;color:#fff;font-weight:700',
      async () => {
        submit.disabled = true;
        cancel.disabled = true;
        setStatus(wrapper, 'Confirming with Wargames before submitting the normal Technic form...');

        const completion = await sendRuntimeMessage({
          type: MESSAGE_TECHNIC_JOB_COMPLETED,
          confirmationId: preview.confirmationId,
          userConfirmed: true,
          submissionAttempted: true
        });
        if (!completion?.ok) {
          submit.disabled = false;
          cancel.disabled = false;
          setStatus(wrapper, completion?.message || 'Could not confirm the Wargames job completion. The Technic form was not submitted.', 'error');
          return;
        }

        const submitted = submitNormalTechnicForm(formData.form, formData.submitButton);
        if (!submitted.ok) {
          await sendRuntimeMessage({
            type: MESSAGE_TECHNIC_JOB_FAILED,
            confirmationId: preview.confirmationId,
            reason: `submission_failed: ${submitted.message}`
          });
          submit.disabled = false;
          cancel.disabled = false;
          setStatus(wrapper, submitted.message, 'error');
          return;
        }
        setStatus(wrapper, 'The normal Technic form submission was started after your confirmation.');
      }
    );

    const cancel = createButton(
      'Cancel / use manual copy',
      'cursor:pointer;border:1px solid #536683;border-radius:9px;padding:9px 11px;background:#17243a;color:#fff',
      async () => {
        setFieldValue(formData.versionField, originalValues.version);
        setFieldValue(formData.changelogField, originalValues.changelog);
        await sendRuntimeMessage({
          type: MESSAGE_TECHNIC_JOB_FAILED,
          confirmationId: preview.confirmationId,
          reason: 'user_cancelled: user cancelled before Technic form submission'
        });
        setStatus(wrapper, 'Cancelled. Original Technic field values were restored and no Technic form was submitted. Manual copy/export remains available.');
      }
    );

    actions.append(submit, cancel, createButton(
      'Close',
      'cursor:pointer;border:1px solid #536683;border-radius:9px;padding:9px 11px;background:#101827;color:#fff',
      removeOverlay
    ));
    wrapper.appendChild(actions);
  }

  function handlePayload(message) {
    const normalized = normalizePreview(message);
    const preview = normalized.ok ? normalized.value : null;
    if (!normalized.ok) {
      showFailure(null, normalized.code, normalized.message);
      return normalized;
    }

    const currentUrl = validateTechnicVersionsUrl(String(window.location?.href || ''));
    if (!currentUrl) {
      const result = {
        ok: false,
        code: 'unsupported_technic_url',
        message: 'This page is not a supported Technic manage versions URL. No Technic form was changed; use manual copy/export instead.'
      };
      showFailure(preview, result.code, result.message, preview.confirmationId);
      return result;
    }

    const expectedSlug = extractTechnicSlug(preview.technicUrl);
    const currentSlug = extractTechnicSlug(currentUrl);
    if (expectedSlug && currentSlug && expectedSlug !== currentSlug) {
      const result = {
        ok: false,
        code: 'technic_target_mismatch',
        message: 'The current Technic manage versions page does not match the Wargames/Solder target pack. No Technic form was changed; use manual copy/export instead.'
      };
      showFailure(preview, result.code, result.message, preview.confirmationId);
      return result;
    }

    const access = detectAccessState();
    if (!access.ok) {
      showFailure(preview, access.code, access.message, preview.confirmationId);
      return access;
    }

    const formResult = detectForm();
    if (!formResult.ok) {
      showFailure(preview, formResult.code, formResult.message, preview.confirmationId);
      return formResult;
    }

    const formData = formResult.value;
    const originalValues = {
      version: String(formData.versionField.value || ''),
      changelog: String(formData.changelogField.value || '')
    };
    setFieldValue(formData.versionField, preview.versionNumber);
    setFieldValue(formData.changelogField, preview.changelogText);
    showConfirmation(preview, formData, originalValues);

    return {
      ok: true,
      code: 'technic_form_filled_confirmation_required',
      formFillingImplemented: true,
      silentSubmissionEnabled: false,
      userConfirmationRequired: true
    };
  }

  if (!extensionApi?.runtime?.onMessage?.addListener) {
    showFailure(null, 'extension_runtime_unavailable', 'WGH Browser Extension runtime is not available. Use manual copy/export instead.');
    return;
  }

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TECHNIC_JOB_PAYLOAD) {
      return false;
    }

    try {
      const result = handlePayload(message);
      sendResponse({
        ok: Boolean(result.ok),
        code: result.code,
        message: result.message || '',
        formFillingImplemented: result.formFillingImplemented === true,
        silentSubmissionEnabled: false,
        userConfirmationRequired: true
      });
    } catch (error) {
      const safeMessage = redactSensitiveText(error?.message || String(error));
      showFailure(null, 'technic_extension_error', safeMessage);
      sendResponse({ ok: false, code: 'technic_extension_error', message: safeMessage, silentSubmissionEnabled: false });
    }

    return true;
  });
})();

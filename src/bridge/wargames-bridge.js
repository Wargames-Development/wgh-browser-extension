(() => {
  'use strict';

  const EVENT_NAME = 'wgh:technic-extension-job';
  const READY_EVENT_NAME = 'wgh:browser-extension-ready';
  const PROBE_EVENT_NAME = 'wgh:browser-extension-probe';
  const MESSAGE_START_TECHNIC_JOB = 'WGH_START_TECHNIC_JOB';
  const ACTIVE_JOB_TYPE = 'technic_changelog_post';
  const UPDATE_JOB_TYPE = 'technic_update_publish';
  const ACTIVE_JOB_TYPES = [ACTIVE_JOB_TYPE, UPDATE_JOB_TYPE];
  const RESERVED_JOB_TYPES = new Set(['technic_update_publish_future']);
  const extensionApi = globalThis.browser || globalThis.chrome;

  function redactSensitiveText(value) {
    return String(value ?? '')
      .replace(/wtej_[A-Za-z0-9_-]{8,}/g, '[redacted]')
      .replace(/("?job_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1"[redacted]"')
      .replace(/("?internal_api_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1"[redacted]"');
  }

  function firstString(source, names) {
    for (const name of names) {
      const value = source?.[name];
      if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
    return '';
  }

  function normalizeApiBaseUrl(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!/^https:\/\//i.test(trimmed)) {
      return '';
    }
    try {
      const url = new URL(trimmed);
      return url.protocol === 'https:' ? url.toString().replace(/\/+$/, '') : '';
    } catch (_) {
      return '';
    }
  }

  function isProbablyJobUuid(value) {
    return typeof value === 'string' && /^technic-extension-job-[A-Za-z0-9-]+$/.test(value.trim());
  }

  function isProbablyJobToken(value) {
    return typeof value === 'string' && /^wtej_[A-Za-z0-9_-]{20,}$/.test(value.trim());
  }

  function isFutureIsoDate(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      return false;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > Date.now();
  }

  function validateLaunchPayload(detail) {
    if (!detail || typeof detail !== 'object') {
      return { ok: false, message: 'The extension launch payload was missing.' };
    }

    const schemaVersion = detail.schema_version ?? detail.schemaVersion;
    if (Number(schemaVersion) !== 1) {
      return { ok: false, message: 'The extension launch payload schema version is unsupported.' };
    }

    const jobType = firstString(detail, ['job_type', 'jobType']);
    if (!ACTIVE_JOB_TYPES.includes(jobType)) {
      return {
        ok: false,
        message: RESERVED_JOB_TYPES.has(jobType)
          ? 'That Wargames extension job type is reserved but not implemented yet.'
          : 'This extension version only supports Technic changelog and update publishing.'
      };
    }

    const apiBaseUrl = normalizeApiBaseUrl(firstString(detail, [
      'solder_base_url',
      'solderBaseUrl',
      'api_base_url',
      'apiBaseUrl',
      'apiBase'
    ]));
    const jobUuid = firstString(detail, ['job_uuid', 'jobUuid']);
    const jobToken = firstString(detail, ['job_token', 'jobToken']);
    const expiresAt = firstString(detail, ['expires_at', 'expiresAt']);

    if (!apiBaseUrl || !isProbablyJobUuid(jobUuid) || !isProbablyJobToken(jobToken)) {
      return { ok: false, message: 'The Technic extension job handoff was missing a valid Wargames URL, job UUID, or short-lived job token.' };
    }

    if (!isFutureIsoDate(expiresAt)) {
      return { ok: false, message: 'The Technic extension job handoff is expired or missing a valid expiry time.' };
    }

    return {
      ok: true,
      value: {
        type: MESSAGE_START_TECHNIC_JOB,
        apiBaseUrl,
        jobUuid,
        jobToken,
        jobType,
        expiresAt
      }
    };
  }

  function showPageNotice(message, level = 'info') {
    const existing = document.getElementById('wgh-extension-bridge-notice');
    if (existing) {
      existing.remove();
    }

    const notice = document.createElement('div');
    notice.id = 'wgh-extension-bridge-notice';
    notice.textContent = redactSensitiveText(message);
    notice.setAttribute('role', 'status');
    notice.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'max-width:420px',
      'padding:12px 14px',
      'border-radius:10px',
      'font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'box-shadow:0 12px 34px rgba(0,0,0,.28)',
      level === 'error' ? 'background:#4a1212;color:#fff;border:1px solid #c85f5f' : 'background:#101827;color:#fff;border:1px solid #2a3a56'
    ].join(';');
    document.documentElement.appendChild(notice);
    setTimeout(() => notice.remove(), 8000);
  }

  async function startJob(detail) {
    if (!extensionApi?.runtime?.sendMessage) {
      showPageNotice('WGH Browser Extension runtime is not available.', 'error');
      return;
    }

    const validation = validateLaunchPayload(detail);
    if (!validation.ok) {
      showPageNotice(validation.message, 'error');
      return;
    }

    try {
      const response = await extensionApi.runtime.sendMessage(validation.value);
      if (!response?.ok) {
        showPageNotice(response?.message || 'Could not start the Technic handoff.', 'error');
        return;
      }
      showPageNotice('The Wargames Technic job was validated. The extension will open the normal Technic manage page and require visible confirmation before submission.');
    } catch (error) {
      showPageNotice(`Could not contact the WGH extension: ${redactSensitiveText(error?.message || String(error))}`, 'error');
    }
  }

  function announceReadiness() {
    window.dispatchEvent(new CustomEvent(READY_EVENT_NAME, {
      detail: {
        extension: 'WGH Browser Extension',
        supports: ACTIVE_JOB_TYPES.slice(),
        reserved: Array.from(RESERVED_JOB_TYPES),
        targets: {
          technic_changelog_post: { ready: true },
          technic_update_publish: { ready: true }
        },
        update_target_ready: true,
        patch_scope: 'technic_form_fill_confirmation_safety',
        form_filling_implemented: true,
        update_publisher_implemented: true,
        user_confirmation_required: true,
        silent_submission_enabled: false
      }
    }));
  }

  window.addEventListener(EVENT_NAME, (event) => {
    // This event should be dispatched by a user action in the Wargames UI.
    // Invalid, expired, reserved, or malformed payloads are rejected without
    // calling Wargames endpoints or touching Technic pages.
    startJob(event.detail || {});
  });

  window.addEventListener(PROBE_EVENT_NAME, () => {
    // A probe only repeats static capability metadata. It must never claim a
    // job, send a runtime message, open a tab, or touch a Technic page.
    announceReadiness();
  });

  announceReadiness();
})();

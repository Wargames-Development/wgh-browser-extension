(() => {
  'use strict';

  const extensionApi = globalThis.browser || globalThis.chrome;
  const MESSAGE_START_TECHNIC_JOB = 'WGH_START_TECHNIC_JOB';
  const MESSAGE_TECHNIC_JOB_PAYLOAD = 'WGH_TECHNIC_JOB_PAYLOAD';
  const MESSAGE_TECHNIC_JOB_COMPLETED = 'WGH_TECHNIC_JOB_COMPLETED';
  const MESSAGE_TECHNIC_JOB_FAILED = 'WGH_TECHNIC_JOB_FAILED';
  const ACTIVE_JOB_TYPE = 'technic_changelog_post';
  const UPDATE_JOB_TYPE = 'technic_update_publish';
  const ACTIVE_JOB_TYPES = new Set([ACTIVE_JOB_TYPE, UPDATE_JOB_TYPE]);
  const RESERVED_JOB_TYPES = new Set(['technic_update_publish_future']);
  const MAX_UPDATE_TEXT_LENGTH = 255;
  const MAX_PENDING_JOB_MS = 60 * 60 * 1000;

  const pendingTabs = new Map();

  function redactSensitiveText(value) {
    return String(value ?? '')
      .replace(/wtej_[A-Za-z0-9_-]{8,}/g, '[redacted]')
      .replace(/("?job_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1"[redacted]"')
      .replace(/("?internal_api_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1"[redacted]"');
  }

  function isSensitiveKey(key) {
    return [
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
    ].some((pattern) => pattern.test(String(key || '')));
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

  function getDeep(source, paths) {
    for (const path of paths) {
      const parts = path.split('.');
      let current = source;
      for (const part of parts) {
        current = current?.[part];
      }
      if (current !== undefined && current !== null && current !== '') {
        return current;
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
      const editMatch = path.match(/^\/modpack\/edit\/([A-Za-z0-9-]+)\/versions$/);
      if (editMatch) {
        return `https://www.technicpack.net/modpack/edit/${encodeURIComponent(editMatch[1])}/versions`;
      }
      const dashboardMatch = path.match(/^\/dashboard\/modpack\/([A-Za-z0-9-]+)\/versions$/);
      if (dashboardMatch) {
        return `https://www.technicpack.net/modpack/edit/${encodeURIComponent(dashboardMatch[1])}/versions`;
      }
    } catch (_) {
      return '';
    }
    return '';
  }

  function deriveTechnicVersionsUrlFromSlug(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const slug = value.trim();
    if (!/^[a-z0-9][a-z0-9-]{1,128}$/i.test(slug)) {
      return '';
    }
    return `https://www.technicpack.net/modpack/edit/${encodeURIComponent(slug)}/versions`;
  }

  function validateStartMessage(message) {
    if (!message || typeof message !== 'object') {
      return { ok: false, message: 'The extension launch message was missing.' };
    }
    if (!ACTIVE_JOB_TYPES.has(message.jobType)) {
      return {
        ok: false,
        message: RESERVED_JOB_TYPES.has(message.jobType)
          ? 'That Wargames extension job type is reserved but not implemented yet.'
          : 'This extension version only supports Technic changelog and update publishing.'
      };
    }
    const apiBaseUrl = normalizeApiBaseUrl(message.apiBaseUrl);
    const jobUuid = String(message.jobUuid || '').trim();
    const jobToken = String(message.jobToken || '').trim();
    const expiresAt = String(message.expiresAt || '').trim();
    if (!apiBaseUrl || !isProbablyJobUuid(jobUuid) || !isProbablyJobToken(jobToken)) {
      return { ok: false, message: 'The extension launch message was missing a valid Wargames URL, job UUID, or short-lived job token.' };
    }
    if (!isFutureIsoDate(expiresAt)) {
      return { ok: false, message: 'The extension launch message is expired or missing a valid expiry time.' };
    }
    return { ok: true, value: { apiBaseUrl, jobUuid, jobToken, expiresAt, jobType: message.jobType } };
  }

  function buildEndpoint(apiBaseUrl, path) {
    return `${String(apiBaseUrl).replace(/\/+$/, '')}${path}`;
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }

    if (!response.ok) {
      const message = json?.result?.message || json?.message || `HTTP ${response.status}`;
      throw new Error(redactSensitiveText(message));
    }
    return json;
  }

  function unwrapSolderResult(responseJson) {
    if (responseJson?.result && typeof responseJson.result === 'object') {
      return responseJson.result;
    }
    return responseJson;
  }

  function scanForUnsafeSecrets(value) {
    if (!value || typeof value !== 'object') {
      return [];
    }
    const hits = [];
    const visit = (item, path) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      for (const [key, child] of Object.entries(item)) {
        const nextPath = path ? `${path}.${key}` : key;
        if (isSensitiveKey(key) && child !== false && child !== null && child !== '') {
          hits.push(nextPath);
          continue;
        }
        if (child && typeof child === 'object') {
          visit(child, nextPath);
        }
      }
    };
    visit(value, '');
    return hits;
  }

  function extractClaimPayload(responseJson) {
    const result = unwrapSolderResult(responseJson) || {};
    const job = result.job || {};
    const payload = result.payload || job.payload || {};
    const target = payload.target || job.target || {};
    return { result, job, payload, target };
  }

  function extractClaimPreview(responseJson) {
    const { job, payload, target } = extractClaimPayload(responseJson);
    const explicitUrl = validateTechnicVersionsUrl(
      target.technic_platform_edit_versions_url
        || payload.technic_platform_edit_versions_url
        || job.technic_platform_edit_versions_url
        || target.target_url
        || payload.target_url
        || job.target_url
        || getDeep(payload, ['extension_payload.target.technic_platform_edit_versions_url', 'extension_payload.target.target_url'])
        || ''
    );
    const slugUrl = deriveTechnicVersionsUrlFromSlug(
      target.technic_platform_slug
        || payload.technic_platform_slug
        || job.technic_platform_slug
        || payload.pack?.slug
        || getDeep(payload, ['extension_payload.target.technic_platform_slug', 'extension_payload.pack.slug'])
        || ''
    );
    const jobType = String(job.job_type || payload.job?.job_type || getDeep(payload, ['extension_payload.job_type']) || '').trim();
    const versionNumber = String(getDeep(payload, [
      'target.version_number',
      'extension_payload.target.version_number',
      'extension_payload.version_number',
      'extension_payload.build.name',
      'build.name'
    ]) || job.version_number || '').trim();
    const changelogText = String(getDeep(payload, [
      'extension_payload.changelog.final_changelog',
      'extension_payload.changelog.copy_text',
      'extension_payload.changelog.body',
      'extension_payload.copy_text',
      'manual_copy_export.copy_text',
      'job.changelog_text',
      'changelog_text'
    ]) || '').trim();
    const updateText = String(getDeep(payload, [
      'extension_payload.update.copy_text',
      'manual_copy_export.copy_text'
    ]) || '').trim();
    const updateTitle = String(getDeep(payload, [
      'extension_payload.update.title',
      'manual_copy_export.title'
    ]) || '').trim();
    const updateLength = Number(getDeep(payload, [
      'extension_payload.update.length',
      'manual_copy_export.copy_text_length'
    ]) || updateText.length || 0);
    const updateCharacterLimit = Number(getDeep(payload, [
      'extension_payload.update.character_limit',
      'manual_copy_export.character_limit'
    ]) || MAX_UPDATE_TEXT_LENGTH);
    return {
      jobType,
      technicUrl: explicitUrl || slugUrl,
      versionNumber,
      changelogText,
      updateText,
      updateTitle,
      updateLength: Number.isFinite(updateLength) ? updateLength : updateText.length,
      updateCharacterLimit: Number.isFinite(updateCharacterLimit) ? updateCharacterLimit : MAX_UPDATE_TEXT_LENGTH
    };
  }

  function validateClaimResponse(responseJson) {
    const { result, job, payload } = extractClaimPayload(responseJson);
    if (!result || typeof result !== 'object' || result.ok !== true) {
      return { ok: false, message: result?.message || 'The Solder extension job could not be claimed.' };
    }

    const jobType = job.job_type || payload.job?.job_type || '';
    if (!ACTIVE_JOB_TYPES.has(jobType)) {
      return {
        ok: false,
        message: RESERVED_JOB_TYPES.has(jobType)
          ? 'That Wargames extension job type is reserved but not implemented yet.'
          : 'This extension version only supports Technic changelog and update publishing.'
      };
    }

    const expiresAt = job.expires_at || payload.job?.expires_at || '';
    if (!isFutureIsoDate(expiresAt)) {
      return { ok: false, message: 'The claimed Solder extension job is expired or missing a valid expiry time.' };
    }

    const safety = payload.safety || {};
    const unsafeSafety = Boolean(
      safety.credentials_included
        || safety.session_tokens_included
        || safety.cookies_included
        || safety.technic_credentials_stored
        || safety.technic_session_tokens_stored
        || safety.technic_cookies_stored
        || safety.internal_api_token_exposed
        || payload.job?.internal_api_token_exposed
        || job.internal_api_token_exposed
        || payload.job?.token_hash_exposed
        || job.token_hash_exposed
    );
    if (scanForUnsafeSecrets({ job, payload }).length > 0 || unsafeSafety) {
      return { ok: false, message: 'The claimed Solder extension job payload contained unsafe credential, cookie, session, or token material.' };
    }

    const preview = extractClaimPreview(responseJson);
    if (!preview.technicUrl) {
      return { ok: false, message: 'The claimed Solder extension job did not include a supported Technic manage versions URL or slug.' };
    }
    if (jobType === ACTIVE_JOB_TYPE && (!preview.versionNumber || !preview.changelogText)) {
      return { ok: false, message: 'The claimed Solder extension job did not include a version number and changelog text.' };
    }
    if (jobType === UPDATE_JOB_TYPE) {
      if (!preview.updateText) {
        return { ok: false, message: 'The claimed Solder extension job did not include Technic update copy text.' };
      }
      if (preview.updateText.length > MAX_UPDATE_TEXT_LENGTH || preview.updateLength > MAX_UPDATE_TEXT_LENGTH || preview.updateCharacterLimit > MAX_UPDATE_TEXT_LENGTH) {
        return { ok: false, message: 'The claimed Solder extension job included Technic update copy text or limit metadata over 255 characters.' };
      }
    }

    return {
      ok: true,
      value: {
        result,
        job,
        payload,
        preview: {
          jobUuid: job.job_uuid || payload.job?.job_uuid || '',
          jobType,
          technicUrl: preview.technicUrl,
          versionNumber: preview.versionNumber,
          changelogText: preview.changelogText,
          updateText: preview.updateText,
          updateTitle: preview.updateTitle,
          updateLength: preview.updateLength,
          updateCharacterLimit: preview.updateCharacterLimit,
          expiresAt
        }
      }
    };
  }

  function publicError(error) {
    return redactSensitiveText(error?.message || String(error || 'The Wargames extension job could not be processed safely.'));
  }

  function cleanupExpiredPendingTabs() {
    const now = Date.now();
    for (const [tabId, data] of pendingTabs.entries()) {
      if (!data?.createdAt || now - data.createdAt > MAX_PENDING_JOB_MS) {
        pendingTabs.delete(tabId);
      }
    }
  }


  function createConfirmationId() {
    try {
      if (globalThis.crypto?.getRandomValues && typeof Uint8Array === 'function') {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return `wgh-confirm-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
      }
    } catch (_) {
      // Fall through to a non-secret compatibility identifier.
    }
    return `wgh-confirm-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }

  async function claimAndOpenTechnicJob(message) {
    cleanupExpiredPendingTabs();
    const start = validateStartMessage(message);
    if (!start.ok) {
      throw new Error(start.message);
    }

    const { apiBaseUrl, jobUuid, jobToken } = start.value;
    const claim = await postJson(buildEndpoint(apiBaseUrl, '/internal/technic-extension-jobs/claim'), {
      job_uuid: jobUuid,
      job_token: jobToken
    });

    const claimValidation = validateClaimResponse(claim);
    if (!claimValidation.ok) {
      throw new Error(claimValidation.message);
    }

    const tab = await new Promise((resolve, reject) => {
      extensionApi.tabs.create({ url: claimValidation.value.preview.technicUrl, active: true }, (createdTab) => {
        const runtimeError = extensionApi.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(createdTab);
      });
    });

    pendingTabs.set(tab.id, {
      apiBaseUrl,
      jobUuid,
      jobToken,
      confirmationId: createConfirmationId(),
      preview: claimValidation.value.preview,
      createdAt: Date.now()
    });

    return { ok: true, tabId: tab.id };
  }

  async function reportComplete(data) {
    return postJson(buildEndpoint(data.apiBaseUrl, '/internal/technic-extension-jobs/complete'), {
      job_uuid: data.jobUuid,
      job_token: data.jobToken
    });
  }

  async function reportFail(data, reason) {
    const safeReason = redactSensitiveText(reason || 'extension_validation_failed').slice(0, 512);
    return postJson(buildEndpoint(data.apiBaseUrl, '/internal/technic-extension-jobs/fail'), {
      job_uuid: data.jobUuid,
      job_token: data.jobToken,
      failure_reason: safeReason || 'extension_validation_failed'
    });
  }

  extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.type === MESSAGE_START_TECHNIC_JOB) {
      claimAndOpenTechnicJob(message)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ ok: false, message: publicError(error) }));
      return true;
    }

    if (message.type === MESSAGE_TECHNIC_JOB_COMPLETED) {
      const tabId = sender?.tab?.id;
      const data = pendingTabs.get(tabId);
      if (!data) {
        sendResponse({ ok: false, message: 'No pending WGH Technic job was found for this tab.' });
        return true;
      }
      if (message.confirmationId !== data.confirmationId || message.userConfirmed !== true || message.submissionAttempted !== true) {
        sendResponse({ ok: false, message: 'Technic completion reporting requires the explicit user-confirmed form submission step.' });
        return true;
      }
      reportComplete(data)
        .then(() => {
          pendingTabs.delete(tabId);
          sendResponse({ ok: true });
        })
        .catch((error) => sendResponse({ ok: false, message: publicError(error) }));
      return true;
    }

    if (message.type === MESSAGE_TECHNIC_JOB_FAILED) {
      const tabId = sender?.tab?.id;
      const data = pendingTabs.get(tabId);
      if (!data) {
        sendResponse({ ok: false, message: 'No pending WGH Technic job was found for this tab.' });
        return true;
      }
      if (message.confirmationId && message.confirmationId !== data.confirmationId) {
        sendResponse({ ok: false, message: 'Technic failure reporting did not match the active WGH confirmation step.' });
        return true;
      }
      reportFail(data, message.reason)
        .then(() => {
          pendingTabs.delete(tabId);
          sendResponse({ ok: true });
        })
        .catch((error) => sendResponse({ ok: false, message: publicError(error) }));
      return true;
    }

    return false;
  });

  extensionApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
    cleanupExpiredPendingTabs();
    if (changeInfo.status !== 'complete' || !pendingTabs.has(tabId)) {
      return;
    }

    const data = pendingTabs.get(tabId);
    extensionApi.tabs.sendMessage(tabId, {
      type: MESSAGE_TECHNIC_JOB_PAYLOAD,
      preview: data.preview,
      confirmationId: data.confirmationId,
      patchScope: 'technic_form_fill_confirmation_safety',
      formFillingImplemented: true,
      silentSubmissionEnabled: false,
      completionReportingEnabled: true,
      userConfirmationRequired: true
    }, () => {
      // The content script may not be ready on every navigation. Silence transient errors;
      // the user can retry from Wargames if the page never receives the payload.
      void extensionApi.runtime.lastError;
    });
  });

  if (extensionApi.tabs.onRemoved?.addListener) {
    extensionApi.tabs.onRemoved.addListener((tabId) => {
      pendingTabs.delete(tabId);
    });
  }
})();

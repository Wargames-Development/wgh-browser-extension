(() => {
  'use strict';

  const EVENT_NAME = 'wgh:technic-extension-job';
  const MESSAGE_START_TECHNIC_JOB = 'WGH_START_TECHNIC_JOB';

  const extensionApi = globalThis.browser || globalThis.chrome;

  function normalizeApiBaseUrl(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim().replace(/\/+$/, '');
    return /^https:\/\//i.test(trimmed) ? trimmed : '';
  }

  function isProbablyJobUuid(value) {
    return typeof value === 'string' && /^technic-extension-job-[A-Za-z0-9-]+$/.test(value.trim());
  }

  function isProbablyJobToken(value) {
    return typeof value === 'string' && /^wtej_[A-Za-z0-9_-]{20,}$/.test(value.trim());
  }

  function showPageNotice(message, level = 'info') {
    const existing = document.getElementById('wgh-extension-bridge-notice');
    if (existing) {
      existing.remove();
    }

    const notice = document.createElement('div');
    notice.id = 'wgh-extension-bridge-notice';
    notice.textContent = message;
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

    const apiBaseUrl = normalizeApiBaseUrl(detail?.apiBaseUrl || detail?.api_base_url || detail?.apiBase || '');
    const jobUuid = String(detail?.jobUuid || detail?.job_uuid || '').trim();
    const jobToken = String(detail?.jobToken || detail?.job_token || '').trim();

    if (!apiBaseUrl || !isProbablyJobUuid(jobUuid) || !isProbablyJobToken(jobToken)) {
      showPageNotice('The Technic extension job handoff was missing a valid API base URL, job UUID, or job token.', 'error');
      return;
    }

    try {
      const response = await extensionApi.runtime.sendMessage({
        type: MESSAGE_START_TECHNIC_JOB,
        apiBaseUrl,
        jobUuid,
        jobToken
      });

      if (!response?.ok) {
        showPageNotice(response?.message || 'Could not start the Technic changelog handoff.', 'error');
        return;
      }

      showPageNotice('Opened the Technic changelog handoff in your browser. Confirm on the Technic page before submitting.');
    } catch (error) {
      showPageNotice(`Could not contact the WGH extension: ${error?.message || String(error)}`, 'error');
    }
  }

  window.addEventListener(EVENT_NAME, (event) => {
    // This event should only be dispatched by a user action in the Wargames UI.
    startJob(event.detail || {});
  });

  window.dispatchEvent(new CustomEvent('wgh:browser-extension-ready', {
    detail: {
      extension: 'WGH Browser Extension',
      supports: ['technic_changelog_post'],
      future_reserved: ['technic_update_publish_future']
    }
  }));
})();

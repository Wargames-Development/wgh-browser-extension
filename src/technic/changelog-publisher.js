(() => {
  'use strict';

  const extensionApi = globalThis.browser || globalThis.chrome;
  const MESSAGE_TECHNIC_JOB_PAYLOAD = 'WGH_TECHNIC_JOB_PAYLOAD';
  const MESSAGE_TECHNIC_JOB_FAILED = 'WGH_TECHNIC_JOB_FAILED';
  const ACTIVE_JOB_TYPE = 'technic_changelog_post';

  function redactSensitiveText(value) {
    return String(value ?? '')
      .replace(/wtej_[A-Za-z0-9_-]{8,}/g, '[redacted]')
      .replace(/("?job_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1"[redacted]"')
      .replace(/("?internal_api_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi, '$1"[redacted]"');
  }

  function normalizePreview(message) {
    const preview = message?.preview || {};
    const jobType = String(preview.jobType || '').trim();
    const technicUrl = String(preview.technicUrl || '').trim();
    const versionNumber = String(preview.versionNumber || '').trim();
    const changelogText = String(preview.changelogText || '').trim();

    if (jobType !== ACTIVE_JOB_TYPE || !technicUrl || !versionNumber || !changelogText) {
      return null;
    }

    return {
      jobType,
      technicUrl,
      versionNumber,
      changelogText
    };
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

  function createOverlay(preview) {
    removeOverlay();

    const wrapper = document.createElement('div');
    wrapper.id = 'wgh-technic-publisher-overlay';
    wrapper.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:2147483647',
      'width:min(480px,calc(100vw - 36px))',
      'background:#101827',
      'color:#fff',
      'border:1px solid #2e4265',
      'border-radius:14px',
      'box-shadow:0 18px 52px rgba(0,0,0,.38)',
      'font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'padding:16px'
    ].join(';');

    const title = document.createElement('strong');
    title.textContent = 'WGH Technic changelog job validated';
    title.style.display = 'block';
    title.style.marginBottom = '8px';

    const body = document.createElement('p');
    body.textContent = 'Patch 002 validates the Wargames/Solder job handoff only. It does not fill Technic fields or submit the Technic form. Use the values below for manual copy/export until the later user-confirmed form workflow is implemented.';
    body.style.margin = '0 0 10px';

    appendReadonlyPreview(wrapper, 'Version/build number', preview.versionNumber);
    appendReadonlyPreview(wrapper, 'Changelog text', preview.changelogText, true);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';

    const close = createButton(
      'Close',
      'cursor:pointer;border:1px solid #536683;border-radius:9px;padding:9px 11px;background:#17243a;color:#fff',
      removeOverlay
    );

    const report = createButton(
      'Report as not completed',
      'cursor:pointer;border:1px solid #6b3d3d;border-radius:9px;padding:9px 11px;background:#2c1515;color:#fff',
      async () => {
        try {
          await extensionApi.runtime.sendMessage({
            type: MESSAGE_TECHNIC_JOB_FAILED,
            reason: 'submit_not_confirmed: Patch 002 validates extension jobs only; Technic form filling and submission are not implemented.'
          });
        } catch (_) {
          // Ignore secondary reporting failures.
        }
        removeOverlay();
      }
    );

    actions.append(close, report);
    wrapper.append(title, body, actions);
    document.documentElement.appendChild(wrapper);
  }

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TECHNIC_JOB_PAYLOAD) {
      return false;
    }

    const preview = normalizePreview(message);
    if (!preview) {
      sendResponse({ ok: false, message: 'The Technic changelog preview payload was missing or unsupported.' });
      return true;
    }

    try {
      createOverlay({
        ...preview,
        versionNumber: redactSensitiveText(preview.versionNumber),
        changelogText: redactSensitiveText(preview.changelogText)
      });
      sendResponse({ ok: true, formFillingImplemented: false, silentSubmissionEnabled: false });
    } catch (error) {
      sendResponse({ ok: false, message: redactSensitiveText(error?.message || String(error)) });
    }

    return true;
  });
})();

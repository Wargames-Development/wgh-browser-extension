(() => {
  'use strict';

  const extensionApi = globalThis.browser || globalThis.chrome;
  const MESSAGE_TECHNIC_JOB_PAYLOAD = 'WGH_TECHNIC_JOB_PAYLOAD';
  const MESSAGE_TECHNIC_JOB_COMPLETED = 'WGH_TECHNIC_JOB_COMPLETED';
  const MESSAGE_TECHNIC_JOB_FAILED = 'WGH_TECHNIC_JOB_FAILED';

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

  function extractPayload(claim) {
    const payload = claim?.payload || claim?.job?.payload || claim?.job || claim || {};
    const versionNumber = getDeep(payload, [
      'target.version_number',
      'extension_payload.version_number',
      'extension_payload.build.name',
      'build.name'
    ]);
    const changelogText = getDeep(payload, [
      'extension_payload.changelog.final_changelog',
      'extension_payload.changelog.copy_text',
      'extension_payload.copy_text',
      'manual_copy_export.copy_text',
      'changelog_text'
    ]);

    return {
      jobType: getDeep(payload, ['job.job_type', 'job_type']) || 'technic_changelog_post',
      versionNumber: String(versionNumber || '').trim(),
      changelogText: String(changelogText || '').trim(),
      safety: payload.safety || {}
    };
  }

  function findTechnicForm() {
    const form = document.querySelector('form.edit-versions-form')
      || document.querySelector('form[action*="version"]')
      || document.querySelector('form');

    if (!form) {
      return null;
    }

    const versionInput = form.querySelector('input[name="version"]');
    const changelogInput = form.querySelector('textarea[name="changelog"]');

    if (!versionInput || !changelogInput) {
      return null;
    }

    return { form, versionInput, changelogInput };
  }

  function setFieldValue(field, value) {
    field.focus();
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function createOverlay({ versionNumber, onSubmit, onManual, onFail }) {
    const existing = document.getElementById('wgh-technic-publisher-overlay');
    if (existing) {
      existing.remove();
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'wgh-technic-publisher-overlay';
    wrapper.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:2147483647',
      'width:min(420px,calc(100vw - 36px))',
      'background:#101827',
      'color:#fff',
      'border:1px solid #2e4265',
      'border-radius:14px',
      'box-shadow:0 18px 52px rgba(0,0,0,.38)',
      'font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'padding:16px'
    ].join(';');

    const title = document.createElement('strong');
    title.textContent = 'WGH Technic changelog ready';
    title.style.display = 'block';
    title.style.marginBottom = '8px';

    const body = document.createElement('p');
    body.textContent = `The version and changelog fields have been filled for ${versionNumber || 'this build'}. Review the Technic page before submitting.`;
    body.style.margin = '0 0 12px';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Submit Technic form';
    submit.style.cssText = 'cursor:pointer;border:0;border-radius:9px;padding:9px 11px;background:#6dd86d;color:#08120a;font-weight:700';
    submit.addEventListener('click', onSubmit);

    const manual = document.createElement('button');
    manual.type = 'button';
    manual.textContent = 'Leave for manual review';
    manual.style.cssText = 'cursor:pointer;border:1px solid #536683;border-radius:9px;padding:9px 11px;background:#17243a;color:#fff';
    manual.addEventListener('click', onManual);

    const fail = document.createElement('button');
    fail.type = 'button';
    fail.textContent = 'Report issue';
    fail.style.cssText = 'cursor:pointer;border:1px solid #6b3d3d;border-radius:9px;padding:9px 11px;background:#2c1515;color:#fff';
    fail.addEventListener('click', onFail);

    actions.append(submit, manual, fail);
    wrapper.append(title, body, actions);
    document.documentElement.appendChild(wrapper);
  }

  async function sendRuntimeMessage(message) {
    return extensionApi.runtime.sendMessage(message);
  }

  async function applyChangelogJob(claim) {
    const payload = extractPayload(claim);

    if (payload.jobType !== 'technic_changelog_post') {
      throw new Error('This extension version only supports Technic changelog posting.');
    }

    if (!payload.versionNumber || !payload.changelogText) {
      throw new Error('The extension payload is missing a version number or changelog text.');
    }

    const fields = findTechnicForm();
    if (!fields) {
      throw new Error('Could not find the Technic manage versions form. Make sure you are logged in and have owner/contributor access.');
    }

    setFieldValue(fields.versionInput, payload.versionNumber);
    setFieldValue(fields.changelogInput, payload.changelogText);

    createOverlay({
      versionNumber: payload.versionNumber,
      onSubmit: async () => {
        await sendRuntimeMessage({ type: MESSAGE_TECHNIC_JOB_COMPLETED });
        if (typeof fields.form.requestSubmit === 'function') {
          fields.form.requestSubmit();
        } else {
          fields.form.submit();
        }
      },
      onManual: () => {
        const overlay = document.getElementById('wgh-technic-publisher-overlay');
        if (overlay) {
          overlay.remove();
        }
      },
      onFail: async () => {
        await sendRuntimeMessage({
          type: MESSAGE_TECHNIC_JOB_FAILED,
          reason: 'User reported that the Technic changelog handoff could not be completed.'
        });
        const overlay = document.getElementById('wgh-technic-publisher-overlay');
        if (overlay) {
          overlay.remove();
        }
      }
    });
  }

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TECHNIC_JOB_PAYLOAD) {
      return false;
    }

    applyChangelogJob(message.claim)
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        const reason = error?.message || String(error);
        try {
          await sendRuntimeMessage({ type: MESSAGE_TECHNIC_JOB_FAILED, reason });
        } catch (_) {
          // Ignore secondary reporting failures.
        }
        sendResponse({ ok: false, message: reason });
      });

    return true;
  });
})();

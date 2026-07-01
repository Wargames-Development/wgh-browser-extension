(() => {
  'use strict';

  const extensionApi = globalThis.browser || globalThis.chrome;
  const MESSAGE_START_TECHNIC_JOB = 'WGH_START_TECHNIC_JOB';
  const MESSAGE_TECHNIC_JOB_PAYLOAD = 'WGH_TECHNIC_JOB_PAYLOAD';
  const MESSAGE_TECHNIC_JOB_COMPLETED = 'WGH_TECHNIC_JOB_COMPLETED';
  const MESSAGE_TECHNIC_JOB_FAILED = 'WGH_TECHNIC_JOB_FAILED';

  const pendingTabs = new Map();

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
      throw new Error(json?.message || `HTTP ${response.status}`);
    }
    return json;
  }

  function deriveTechnicUrl(claimedJob) {
    const payload = claimedJob?.payload || claimedJob?.job?.payload || claimedJob?.job || {};
    const target = payload?.target || claimedJob?.job?.target || {};
    const explicitUrl = target?.technic_platform_edit_versions_url || payload?.technic_platform_edit_versions_url || '';

    if (typeof explicitUrl === 'string' && /^https:\/\/www\.technicpack\.net\//i.test(explicitUrl)) {
      return explicitUrl;
    }

    const slug = target?.technic_platform_slug || payload?.target?.technic_platform_slug || payload?.pack?.slug || '';
    if (typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{1,128}$/i.test(slug)) {
      return `https://www.technicpack.net/modpack/edit/${encodeURIComponent(slug)}/versions`;
    }

    return '';
  }

  async function claimAndOpenTechnicJob(message) {
    const { apiBaseUrl, jobUuid, jobToken } = message;
    const claim = await postJson(buildEndpoint(apiBaseUrl, '/internal/technic-extension-jobs/claim'), {
      job_uuid: jobUuid,
      job_token: jobToken
    });

    const claimedPayload = claim?.payload || claim?.job?.payload || null;
    const jobType = claimedPayload?.job?.job_type || claim?.job?.job_type || '';
    if (jobType && jobType !== 'technic_changelog_post') {
      throw new Error('This extension version only supports Technic changelog posting.');
    }

    const technicUrl = deriveTechnicUrl(claim);
    if (!technicUrl) {
      throw new Error('The Solder extension job did not include a valid Technic manage versions URL or slug.');
    }

    const tab = await new Promise((resolve, reject) => {
      extensionApi.tabs.create({ url: technicUrl, active: true }, (createdTab) => {
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
      claim,
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
    return postJson(buildEndpoint(data.apiBaseUrl, '/internal/technic-extension-jobs/fail'), {
      job_uuid: data.jobUuid,
      job_token: data.jobToken,
      failure_reason: reason || 'Extension reported failure.'
    });
  }

  extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.type === MESSAGE_START_TECHNIC_JOB) {
      claimAndOpenTechnicJob(message)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ ok: false, message: error?.message || String(error) }));
      return true;
    }

    if (message.type === MESSAGE_TECHNIC_JOB_COMPLETED) {
      const tabId = sender?.tab?.id;
      const data = pendingTabs.get(tabId);
      if (!data) {
        sendResponse({ ok: false, message: 'No pending WGH Technic job was found for this tab.' });
        return true;
      }
      reportComplete(data)
        .then(() => {
          pendingTabs.delete(tabId);
          sendResponse({ ok: true });
        })
        .catch((error) => sendResponse({ ok: false, message: error?.message || String(error) }));
      return true;
    }

    if (message.type === MESSAGE_TECHNIC_JOB_FAILED) {
      const tabId = sender?.tab?.id;
      const data = pendingTabs.get(tabId);
      if (!data) {
        sendResponse({ ok: false, message: 'No pending WGH Technic job was found for this tab.' });
        return true;
      }
      reportFail(data, message.reason)
        .then(() => {
          pendingTabs.delete(tabId);
          sendResponse({ ok: true });
        })
        .catch((error) => sendResponse({ ok: false, message: error?.message || String(error) }));
      return true;
    }

    return false;
  });

  extensionApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete' || !pendingTabs.has(tabId)) {
      return;
    }

    const data = pendingTabs.get(tabId);
    extensionApi.tabs.sendMessage(tabId, {
      type: MESSAGE_TECHNIC_JOB_PAYLOAD,
      claim: data.claim
    }, () => {
      // The content script may not be ready on every navigation. Silence transient errors;
      // the user can retry from Wargames if the page never receives the payload.
      void extensionApi.runtime.lastError;
    });
  });
})();

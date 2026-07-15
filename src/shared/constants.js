// Shared constants for documentation, tests, and future bundled builds.
// Current manifest content scripts are classic scripts, so runtime files duplicate
// only the tiny constants they need instead of importing modules.

export const JOB_TYPES = Object.freeze({
  TECHNIC_CHANGELOG_POST: 'technic_changelog_post',
  TECHNIC_UPDATE_PUBLISH: 'technic_update_publish',
  TECHNIC_UPDATE_PUBLISH_FUTURE: 'technic_update_publish_future'
});

export const WARGAMES_JOB_EVENT = 'wgh:technic-extension-job';
export const WARGAMES_EXTENSION_READY_EVENT = 'wgh:browser-extension-ready';
export const WARGAMES_EXTENSION_PROBE_EVENT = 'wgh:browser-extension-probe';

export const MESSAGE_TYPES = Object.freeze({
  START_TECHNIC_JOB: 'WGH_START_TECHNIC_JOB',
  TECHNIC_JOB_PAYLOAD: 'WGH_TECHNIC_JOB_PAYLOAD',
  TECHNIC_JOB_COMPLETED: 'WGH_TECHNIC_JOB_COMPLETED',
  TECHNIC_JOB_FAILED: 'WGH_TECHNIC_JOB_FAILED'
});

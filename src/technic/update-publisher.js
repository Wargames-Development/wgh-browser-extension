(() => {
  'use strict';

  // The active Technic update publisher flow is implemented by the shared
  // Technic form content script. This companion module keeps the runtime
  // contract explicit for source review and browser build inspection.

  window.WGH_TECHNIC_UPDATE_PUBLISHER = Object.freeze({
    implemented: true,
    activeJobType: 'technic_update_publish',
    reservedJobType: 'technic_update_publish_future',
    authoritativePayloadPath: 'extension_payload.update.copy_text',
    characterLimit: 255,
    userConfirmationRequired: true,
    silentSubmissionEnabled: false
  });
})();

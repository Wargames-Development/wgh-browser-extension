# Wargames Solder Contract

This extension expects the Wargames Solder backend to provide the Patch 066-style extension job handoff surface.

## Job creation

Job creation is done by the Wargames backend/panel using the internal API token. The extension must never receive or use that internal token.

Expected internal creation endpoint:

```text
POST /internal/technic-extension-jobs/create
```

The Wargames page receives the resulting `job_uuid` and one-time `job_token`, then dispatches them to the extension as a user-initiated event.

## Extension endpoints

The extension uses token-authenticated endpoints only:

```text
POST /internal/technic-extension-jobs/claim
POST /internal/technic-extension-jobs/complete
POST /internal/technic-extension-jobs/fail
```

Required request body:

```json
{
  "job_uuid": "technic-extension-job-...",
  "job_token": "wtej_..."
}
```

The claim response should include the target Technic URL or enough slug metadata to derive it. For `technic_changelog_post` jobs it must include the version number and changelog text. For `technic_update_publish` jobs it must include `extension_payload.update.copy_text` as the authoritative Technic-safe plain-text update/status body. The extension validates those values, opens the supported Technic target page, fills only the detected fields for the claimed workflow, and requires a visible user confirmation before the normal Technic form can be submitted.

## Payload requirements

The job payload must not include:

- Wargames internal API tokens;
- Technic credentials;
- Technic cookies;
- Technic session tokens;
- 2FA material.

The payload should include safety fields that confirm these boundaries.


## Patch 002 extension boundary

Patch 002 implemented the extension-side job handoff foundation:

- Wargames page event validation;
- short-lived job claim calls;
- claimed payload validation;
- unsupported/reserved job rejection;
- token redaction in user-facing errors;
- safe no-op behaviour for missing, malformed, expired, unsupported, or unsafe payloads.

## Patch 003 Technic form boundary

Patch 003 adds the page-side MVP for the active `technic_changelog_post` workflow:

- validates the current page is a supported Technic manage versions URL;
- detects the normal Technic versions/changelog form;
- fills only the version/build and changelog fields from the validated job payload;
- shows a visible confirmation dialog before any normal Technic form submission;
- lets the user cancel safely and restores the original field values;
- reports completion only after the explicit confirmation step;
- keeps manual copy/export visible as the fallback;
- shows safe failure states for missing login, missing permissions, unsupported URLs, missing forms/fields, expired/malformed/unsupported jobs, and unsafe payloads.

Patch 003 still does not implement silent submission, Technic credential/session/cookie storage, Wargames internal API token storage, server-side browser automation, login/2FA/CAPTCHA bypass, or any claim of official Technic Platform API posting support.

## Patch 004 local end-to-end test notes

Patch 004 adds documentation and validation coverage for the local Wargames Solder to browser extension to Technic changelog handoff test flow.

See [`local-e2e-solder-handoff-testing.md`](local-e2e-solder-handoff-testing.md) for:

- local browser build/load steps for Chrome, Edge, Opera GX, and Firefox;
- local Wargames Solder stack preparation;
- creating or locating `technic_changelog_post` extension jobs;
- triggering the `wgh:technic-extension-job` page handoff event;
- checking filled Technic version/changelog fields;
- testing cancellation and safe failure states;
- redaction rules for job tokens, Technic session data, 2FA data, and Wargames internal API tokens;
- the limitation that completion means user-confirmed submission started, not guaranteed final Technic server-side acceptance after navigation;
- manual copy/export fallback steps.

Patch 004 does not change runtime behaviour, expand browser permissions, implement the future update publisher, store credentials/sessions/tokens, add server-side browser automation, or claim official Technic Platform API posting support.



## Active Technic update publisher contract

The extension now supports the active Solder update publisher job type:

```text
technic_update_publish
```

The legacy placeholder remains reserved and must be rejected:

```text
technic_update_publish_future
```

Browser-local readiness probes should advertise both active job types:

```json
{
  "supports": ["technic_changelog_post", "technic_update_publish"],
  "targets": {
    "technic_changelog_post": { "ready": true },
    "technic_update_publish": { "ready": true }
  },
  "update_target_ready": true
}
```

For `technic_update_publish` claims, the extension expects Solder to provide:

```text
job.job_type = technic_update_publish
extension_payload.update.copy_text
extension_payload.update.length
extension_payload.update.character_limit = 255
manual_copy_export.copy_text
safety.user_confirmation_required_before_submit = true
```

`extension_payload.update.copy_text` is authoritative. Solder has already stripped Discord-only Markdown, preserved intentional readable text where possible, and shortened the final update/status body to Technic's 255-character limit. The extension validates it defensively, rejects empty or over-limit values, and does not rebuild it from the Discord draft.

The update publisher flow opens or focuses the supported Technic modpack updates page, verifies the page and expected update/status field, fills only that field, shows a visible confirmation preview, submits only after user confirmation, calls `complete` only after the confirmed submit attempt, and calls `fail` with a safe reason on cancel or blockers. The confirmation UI focuses on the single update/status body because Technic's updates page does not have separate version, changelog, or update-title fields. Manual copy/export remains available in a collapsed details section, and the extension still does not implement silent submission or official Technic Platform API posting support.

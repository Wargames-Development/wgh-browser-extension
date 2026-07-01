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

The claim response should include the target Technic edit URL or enough slug metadata to derive it, plus the version number and changelog text. Patch 003 validates those values, opens the supported Technic manage versions page, fills the detected version/changelog fields, and requires a visible user confirmation before the normal Technic form can be submitted.

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

Patch 003 still does not implement silent submission, Technic credential/session/cookie storage, Wargames internal API token storage, server-side browser automation, future update publishing, login/2FA/CAPTCHA bypass, or any claim of official Technic Platform API posting support.

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


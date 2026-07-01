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

The claim response should include the target Technic edit URL or enough slug metadata to derive it, plus the version number and changelog text. Patch 002 validates those values and shows a manual-copy preview; it does not fill or submit the Technic form.

## Payload requirements

The job payload must not include:

- Wargames internal API tokens;
- Technic credentials;
- Technic cookies;
- Technic session tokens;
- 2FA material.

The payload should include safety fields that confirm these boundaries.


## Patch 002 extension boundary

Patch 002 implements only the extension-side job handoff foundation:

- Wargames page event validation;
- short-lived job claim calls;
- claimed payload validation;
- unsupported/reserved job rejection;
- token redaction in user-facing errors;
- safe no-op behaviour for missing, malformed, expired, unsupported, or unsafe payloads.

Patch 002 intentionally does not implement Technic form filling, silent submission, credential/session storage, future update publishing, login bypass, 2FA/CAPTCHA bypass, or official Technic Platform API posting.

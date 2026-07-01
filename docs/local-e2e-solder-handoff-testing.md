# Local End-to-End Solder Handoff Test Notes

This guide documents the local end-to-end test path for the current Wargames Solder to browser extension to Technic changelog workflow.

Patch 004 is documentation and validation support only. It does not add new Technic form automation, browser permissions, credential storage, server-side browser automation, future update publishing, or official Technic Platform API posting support.

## Scope of the local E2E check

The active workflow is:

```text
technic_changelog_post
```

The reserved workflow remains unavailable:

```text
technic_update_publish_future
```

The intended local flow is:

1. Wargames Solder has an approved changelog draft/export for a pack build.
2. Wargames Solder creates a short-lived `technic_changelog_post` extension job.
3. A Wargames page dispatches the `wgh:technic-extension-job` browser event from a user action.
4. The extension validates the launch payload and claims the job with the short-lived per-job token.
5. The extension opens the normal Technic manage versions page for the target pack.
6. The Technic page content script validates the page, fills the version/build and changelog fields, and shows a visible confirmation dialog.
7. The user either cancels and uses manual copy/export, or explicitly starts the normal Technic form submission.

Completion reporting means the extension reached the user-confirmed submission-start step. It does **not** prove final Technic server-side acceptance after page navigation.

## Safety rules for screenshots, logs, and issue comments

Never paste or upload live secrets in screenshots, terminal output, fixtures, issue comments, pull requests, or chat logs.

Redact or avoid showing:

- raw `job_token` values;
- Wargames internal API tokens;
- Technic usernames;
- Technic passwords;
- Technic cookies;
- Technic session tokens;
- Technic 2FA codes, recovery codes, or TOTP data;
- browser profile data and authenticated session details.

The extension must not bypass Technic login, 2FA, CAPTCHA, permissions, or anti-abuse checks. Log in to Technic normally in the browser when a manual test requires an authenticated owner/contributor session.

## Build and load the extension locally

From the browser extension repository root:

```bash
npm ci
npm test
npm run build
```

Generated local build outputs are:

```text
dist/chromium/
dist/firefox/
```

`dist/` is generated output and must not be committed.

### Chrome

1. Run `npm run build:chromium` or `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select `dist/chromium/`.
6. Confirm the extension loads without unexpected permission prompts.

### Microsoft Edge

1. Run `npm run build:chromium` or `npm run build`.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select `dist/chromium/`.
6. Confirm the extension loads without unexpected permission prompts.

### Opera GX

1. Run `npm run build:chromium` or `npm run build`.
2. Open `opera://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select `dist/chromium/`.
6. Confirm the extension loads without unexpected permission prompts.

Opera GX uses the Chromium package unless a browser-specific issue is found.

### Firefox

1. Run `npm run build:firefox` or `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Select `dist/firefox/manifest.json`.
5. Confirm the extension loads without unexpected permission prompts.

Firefox temporary add-ons are removed when Firefox restarts.

## Prepare the local Wargames Solder stack

Use the latest local `WargamesSolder` repository, not this browser extension repository.

Preferred Wargames local Traefik flow:

```bash
cd /Users/rhysh/Documents/GitHub/WargamesSolder
cp .env.example .env.local

docker network create wargames-local-public 2>/dev/null || true
docker network create wargames-local-internal 2>/dev/null || true

docker compose --env-file .env.local -f compose.yaml -f compose.traefik.yml up --build
```

Expected browser-facing Solder URL:

```text
https://solder.wargames.localhost:8443
```

Optional direct debug flow when Traefik is not being used:

```bash
docker compose --env-file .env.local -f compose.yaml -f compose.direct.yml up --build
```

Expected direct debug URL:

```text
http://localhost:8092
```

The extension launch payload currently requires an HTTPS `solder_base_url`, so prefer the Traefik HTTPS URL for a true browser-extension handoff test. The direct HTTP URL is useful for Solder debugging, but it is not a valid extension handoff base URL under the current validation rules.

Use local-only example tokens only in local `.env.local`. Do not commit `.env.local`, real internal tokens, or terminal output that reveals them.

## Confirm Solder exposes the extension job contract

Use an internal token only from your local environment. Avoid pasting the real value into shared logs.

```bash
cd /Users/rhysh/Documents/GitHub/WargamesSolder
BASE="https://solder.wargames.localhost:8443"
TOKEN="$(grep '^WARGAMES_INTERNAL_API_TOKEN=' .env.local | cut -d= -f2-)"

curl -k -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE}/internal/technic-extension-jobs/types"
```

Expected contract traits:

- `technic_changelog_post` is active;
- `technic_update_publish_future` is reserved or not implemented;
- manual copy/export remains available;
- Technic Platform API posting is not claimed;
- backend Technic posting and server-side browser automation are disabled.

## Generate or locate a Solder extension job

A real `technic_changelog_post` job requires an approved Solder changelog export. Usually that means the local Solder test data must already have a server scan, draft build, and approved changelog draft.

### Locate an existing job

```bash
BASE="https://solder.wargames.localhost:8443"
TOKEN="$(grep '^WARGAMES_INTERNAL_API_TOKEN=' /Users/rhysh/Documents/GitHub/WargamesSolder/.env.local | cut -d= -f2-)"

curl -k -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE}/internal/technic-extension-jobs?job_type=technic_changelog_post&limit=5"
```

This list should not expose token hashes or raw job tokens. A job can only be launched through the extension if you still have the raw `job_token` returned at creation time and the job has not expired, completed, failed, or been cancelled.

### Create a new job from an approved changelog export

Adjust the filters to match the approved changelog/export in your local Solder database. Do not use a live pack unless you intend to test against that pack manually.

```bash
BASE="https://solder.wargames.localhost:8443"
TOKEN="$(grep '^WARGAMES_INTERNAL_API_TOKEN=' /Users/rhysh/Documents/GitHub/WargamesSolder/.env.local | cut -d= -f2-)"

curl -k -sS \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "technic_changelog_post",
    "filters": {
      "status": "approved",
      "changelog_uuid": "replace-with-local-approved-changelog-uuid"
    },
    "technic_platform_slug": "replace-with-test-technic-pack-slug",
    "technic_platform_edit_versions_url": "https://www.technicpack.net/dashboard/modpack/replace-with-test-technic-pack-slug/versions",
    "expires_in_seconds": 900
  }' \
  "${BASE}/internal/technic-extension-jobs/create"
```

The create response returns the raw `job_token` once. Treat it as sensitive. Do not paste the raw token into screenshots or issue comments.

If creation returns `missing_changelog_export`, prepare an approved changelog draft/export in Solder first, then rerun creation with matching filters.

## Trigger the Wargames page handoff event

The page-side bridge listens for:

```text
wgh:technic-extension-job
```

The extension announces readiness with:

```text
wgh:browser-extension-ready
```

In the real Wargames page, dispatch the launch event only from a user action such as a button click. For local developer-mode testing, you can dispatch the event from the Wargames/Solder page console after replacing all placeholder values with the local job creation output:

```js
window.dispatchEvent(new CustomEvent('wgh:technic-extension-job', {
  detail: {
    schema_version: 1,
    solder_base_url: 'https://solder.wargames.localhost:8443',
    job_uuid: 'technic-extension-job-replace-me',
    job_token: 'wtej_replace_me_do_not_share',
    job_type: 'technic_changelog_post',
    expires_at: '2099-07-01T12:15:00Z',
    technic_platform_slug: 'replace-with-test-pack-slug',
    technic_platform_edit_versions_url: 'https://www.technicpack.net/dashboard/modpack/replace-with-test-pack-slug/versions'
  }
}));
```

Do not commit this snippet with live values. Do not paste a live `job_token` into shared logs.

## Expected extension behaviour after handoff

After the handoff event, the extension should:

1. Validate the schema version, HTTPS Solder base URL, job UUID, short-lived job token, active job type, and expiry.
2. Reject malformed, expired, reserved, or unsafe launch payloads before calling Solder.
3. Claim the job through `POST /internal/technic-extension-jobs/claim` with only `job_uuid` and `job_token`.
4. Reject claimed payloads that include credential, cookie, session, 2FA, internal-token, unsupported-job, expired-job, or malformed-target data.
5. Open the supported Technic manage versions page.
6. Send the validated version/build number and changelog text to the Technic content script.
7. Fill only the version/build and changelog fields.
8. Show the visible confirmation overlay before any normal Technic form submission can start.

The extension should not silently submit, should not store Technic credentials or cookies, and should not claim official Technic Platform API posting support.

## What to check on the Technic page

On the opened Technic page, check:

- the URL is a supported manage versions URL for the target pack;
- the current Technic account is logged in normally;
- the current Technic account has owner/contributor permission for the pack;
- the version/build field contains the expected Solder build/version value;
- the changelog field contains the expected approved changelog copy;
- a WGH confirmation overlay is visible;
- the overlay still shows manual copy/export fallback text;
- no form submission occurs until the user presses **Submit Technic form**.

Use a disposable test pack where possible. If testing against a real pack, confirm every field carefully before pressing the confirmation button.

## Confirm the form was filled correctly

Compare the Technic fields against the Solder job claim payload or manual copy/export view:

- `versionNumber` should match the approved build/version value.
- `changelogText` should match the approved changelog text.
- No other Technic form fields should be changed by the extension.
- Existing field values should be restored if the user cancels before submission.

A safe local check is to cancel after confirming the filled values, then verify the page reports cancellation and no Technic form submission happened.

## Test cancellation

1. Start with a valid local job and open the Technic page through the extension flow.
2. Confirm the extension filled the version/build and changelog fields.
3. Press **Cancel / use manual copy**.
4. Confirm the original Technic field values were restored.
5. Confirm no Technic form submission started.
6. Confirm the Wargames/Solder job moves to a failed/cancelled-style terminal outcome through the extension fail endpoint.
7. Use manual copy/export if you still want to post the changelog manually.

## Test failure states

Use local-only jobs and disposable data. For each failure, confirm the extension shows a safe message and does not submit the Technic form.

Suggested cases:

- expired `expires_at` in the launch payload;
- malformed `job_uuid`;
- malformed or missing `job_token`;
- reserved `technic_update_publish_future` job type;
- HTTP Solder base URL instead of HTTPS;
- unsupported Technic URL or target slug mismatch;
- current Technic browser profile is not logged in;
- logged-in Technic account lacks owner/contributor permission;
- Technic page layout does not expose the expected version/build or changelog field;
- Solder claim response is missing version or changelog data;
- Solder claim response contains unsafe credential, cookie, session, 2FA, or internal-token fields.

Expected outcome: manual copy/export remains available, sensitive values are redacted, and no silent submission occurs.

## Known completion limitation

The extension can report that the user-confirmed normal Technic form submission was started. It cannot currently guarantee final Technic server-side acceptance after the page navigates or after Technic performs its own validation.

A successful local E2E note should therefore say something like:

```text
Extension reached user-confirmed submission-start state. Final Technic server-side acceptance was checked manually on the Technic page after navigation.
```

Do not describe this as guaranteed Technic publishing, official Technic API posting, or backend Technic posting.

## Manual copy/export fallback

Manual fallback must remain available at every stage:

1. Open the approved changelog/manual export in Wargames Solder.
2. Copy the version/build number.
3. Copy the changelog text.
4. Open the Technic manage versions page manually.
5. Log in to Technic normally if required.
6. Paste the values into the normal Technic form.
7. Submit manually after review.

Use manual fallback whenever the extension is not installed, browser loading fails, the job expires, Technic requires login/2FA/CAPTCHA, the current Technic account lacks permission, the page layout changes, or the target pack is uncertain.

## Local test record template

Use this template in private/local notes. Redact secrets before sharing.

```text
Browser:
Extension build: dist/chromium or dist/firefox
Solder URL:
Job type: technic_changelog_post
Job UUID: technic-extension-job-...
Job token: [redacted]
Technic pack slug:
Version/build expected:
Changelog expected SHA-256 or short non-sensitive summary:
Result: filled / cancelled / failed / user-confirmed submission started
Final Technic server-side result checked manually: yes / no / not tested
Screenshots/logs checked for secrets before sharing: yes / no
```

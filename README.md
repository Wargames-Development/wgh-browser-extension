<!-- Wargames Development Group – WGH Browser Extension -->

[![Discord](https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/social/discord-plural_vector.svg)](https://discord.wargames.uk)

# Wargames Hosting Browser Extension

**Wargames Hosting Browser Extension** is a browser extension project for approved Wargames Hosting browser-assisted workflows.

The active workflows are the **Technic Changelog Publisher** and **Technic Update Publisher**, which help a Wargames Solder user take reviewed release text, open the normal Technic Platform versions or updates page in their own browser session, fill only the expected fields, and submit only after a visible user confirmation.

Repository: https://github.com/Wargames-Development/wgh-browser-extension

---

## Project Status

This project is in early MVP development.

Current scope:

* Build the shared browser extension foundation
* Support Chrome, Edge, and Opera GX through a Chromium/WebExtension package
* Support Firefox through a Firefox/WebExtension package
* Receive and validate `technic_changelog_post` and `technic_update_publish` launch events from Wargames pages
* Claim short-lived extension jobs from Wargames Solder using the per-job token
* Validate claimed job payloads before opening any Technic page
* Fill the normal Technic manage versions form after validation
* Show a visible confirmation step before normal form submission
* Let the user cancel safely and use manual copy/export
* Redact short-lived job tokens in user-facing errors
* Document the local Solder to extension to Technic changelog test path
* Keep manifest host access scoped to corrected Wargames domains, Technic manage versions pages, and Technic modpack updates pages
* Ship Wargames extension icon assets in Chromium and Firefox builds
* Avoid the extra `tabs` permission so local Chromium-family testing does not show an unrelated browsing-history permission warning
* Advertise active browser-local capability for `technic_update_publish` while keeping the legacy `_future` placeholder reserved

Not implemented yet:

* Full browser-store publishing workflow
* Automated GitHub release packaging
* Silent or server-side Technic update publishing
* Server-side Technic automation
* Any official Technic Platform API posting flow

---

## What This Extension Does

The supported workflows assist with Technic Platform changelog posting and user-confirmed update/status posting.

The current `technic_changelog_post` flow is:

1. A user reviews or approves a changelog draft in Wargames Solder.
2. Wargames Solder creates a short-lived extension job.
3. A Wargames page dispatches a user-initiated extension event.
4. The extension validates the event payload, job type, expiry, UUID, and short-lived token format.
5. The extension claims the job from Wargames Solder with the per-job token.
6. The extension validates the claimed payload and rejects missing, malformed, expired, unsupported, or unsafe payloads.
7. The extension opens the supported Technic manage versions page only after validation.
8. The Technic content script validates the page and normal changelog form.
9. The extension fills the version/build and changelog fields.
10. The extension shows a visible confirmation dialog.
11. The user can cancel and restore the original field values, or explicitly start the normal Technic form submission.

The current `technic_update_publish` flow uses the same short-lived job claim and confirmation model, but fills only the Technic update/status message field. Solder provides `extension_payload.update.copy_text` as the authoritative plain-text update body, already stripped of Discord-only Markdown and capped at Technic's 255-character update/status limit. The extension validates that value defensively and rejects empty or over-limit update bodies instead of rebuilding or reformatting the Discord draft. Its confirmation dialog focuses on the single update/status body and keeps extra manual copy/export details collapsed so update jobs do not show changelog-style version/build, changelog, or update-title fields as normal visible sections.

Completion reporting means the extension reached the user-confirmed submission-start step. It does **not** prove final Technic server-side acceptance after page navigation.

---

## What This Extension Does Not Do

This extension does **not**:

* Store Technic usernames
* Store Technic passwords
* Store Technic cookies
* Store Technic session tokens
* Store Technic 2FA material
* Store Wargames internal API tokens
* Bypass Technic login
* Bypass 2FA
* Bypass CAPTCHA
* Bypass permissions
* Bypass anti-abuse systems
* Run server-side browser automation for user Technic accounts
* Claim official Technic Platform API posting support
* Submit Technic update/status messages silently or server-side

Wargames Solder handles launcher build delivery through Solder-compatible systems. Technic Platform changelog and update/status entry remain manual by default, with this extension acting only as an optional user-confirmed convenience workflow.

---

## Why This Is a Browser Extension

Technic Platform changelog posting is not treated as a direct Wargames Solder backend API feature.

A browser extension allows the workflow to stay user-controlled:

* The user logs into Technic themselves
* The user remains in control of their own browser session
* Wargames does not collect third-party login details
* The extension can fill the normal Technic form without handling passwords or cookies
* The user can review the fields before submitting
* The user can cancel and use manual copy/export instead

Manual copy/export must always remain available as a fallback.

---

## Browser Support

The project is intended to use one shared WebExtension-style codebase with browser-specific packaging.

Planned browser targets:

| Browser         | Target           | Local build output |
| --------------- | ---------------- | ------------------ |
| Google Chrome   | Chromium package | `dist/chromium/`   |
| Microsoft Edge  | Chromium package | `dist/chromium/`   |
| Opera GX        | Chromium package | `dist/chromium/`   |
| Mozilla Firefox | Firefox package  | `dist/firefox/`    |

Chrome, Edge, and Opera GX all use the Chromium build. Firefox uses the Firefox build. Opera GX is treated as a Chromium-family target unless testing shows a browser-specific issue.

Manifest host access is intentionally limited to local Wargames development domains, the Wargames-owned `*.wargames.host` and `*.wargames.uk` domains, the Technic manage versions route for changelogs, and the Technic modpack updates route for update/status posts. No retired Wargames production domain should appear in source files, manifests, or built extension packages. The extension also ships Wargames icon assets in each browser build and does not request the `tabs` permission.

See [`docs/browser-support.md`](docs/browser-support.md), [`docs/local-extension-testing.md`](docs/local-extension-testing.md), and [`docs/local-e2e-solder-handoff-testing.md`](docs/local-e2e-solder-handoff-testing.md) for local loading and end-to-end Solder handoff test notes.

---

## Supported Workflows

### `technic_changelog_post`

Status: active MVP workflow

Current purpose:

* Receive a Wargames page launch event
* Validate the short-lived extension job handoff payload
* Claim the job from Wargames Solder
* Validate job type, expiry, Technic target, version number, changelog text, and safety boundaries
* Open the relevant Technic Platform edit/version page only after validation
* Fill only the expected version/build and changelog fields
* Require visible user confirmation before normal Technic form submission
* Allow cancellation and restore original field values
* Show safe failure states for unsupported URLs, missing forms, missing fields, login/permission problems, expired jobs, malformed jobs, and unsafe payloads
* Keep manual copy/export as the fallback path

### `technic_update_publish`

Status: active MVP workflow

Current purpose:

* Receive a Wargames page launch event for the Release-tab Technic update publisher
* Validate the short-lived extension job handoff payload
* Claim the job from Wargames Solder
* Treat `extension_payload.update.copy_text` as the authoritative Technic-safe update/status text
* Defensively reject empty update text or update text longer than 255 characters
* Open the relevant Technic Platform modpack updates page only after validation
* Fill only the expected update/status message field
* Require visible user confirmation before normal Technic form submission
* Allow cancellation and restore the original update/status field value
* Keep manual copy/export as the fallback path

### `technic_update_publish_future`

Status: reserved legacy placeholder

This workflow identifier remains reserved and must still be rejected. New Solder update publisher jobs use `technic_update_publish`.

---

## Wargames Solder Contract

This extension is designed to work with the Wargames Solder extension job handoff system.

The Solder side owns:

* Changelog and update announcement draft generation
* Changelog and update announcement review/editing
* Technic-safe plain-text rendering for update/status copy
* Extension job creation
* Short-lived job tokens
* Job status tracking
* Manual copy/export fallback
* Audit/event records where applicable

The extension side owns:

* Browser permissions
* Browser packaging
* Wargames bridge event handling
* Extension-side job fetching
* Job payload validation
* Safe Technic page/form detection
* User confirmation UI
* User-confirmed normal Technic form submission
* Safe failure states
* Completion reporting only after the user-confirmed submission-start step

The extension must never receive the Wargames internal API token.

It should only receive a short-lived per-job token created specifically for the browser-assisted workflow.

---

## Manual Fallback

The extension is optional.

Users should always be able to complete the workflow manually by:

1. Copying the version number, changelog text, or update/status text from Wargames Solder
2. Opening the relevant Technic page themselves
3. Pasting the values manually
4. Submitting the Technic form themselves

This fallback is required because:

* The extension may not be installed
* Browser support may vary
* Technic may change its page layout
* A user may not have Technic owner/contributor permissions
* A browser store review may delay extension availability

---

## Security & Privacy Model

This project is intended to be source-reviewable.

The extension should be safe to inspect and should keep a strict boundary between Wargames systems and third-party sessions.

Security principles:

* Keep permissions narrow
* Avoid broad host access
* Do not collect third-party credentials
* Do not collect third-party cookies
* Do not collect session tokens
* Do not store short-lived job tokens longer than needed
* Redact sensitive tokens from logs
* Require visible user confirmation before form submission
* Fail safely if the Technic page layout is not recognised
* Fail safely if the user is not logged in or lacks permission
* Keep manual copy/export available

If a workflow would require credentials, cookies, session tokens, login bypass, CAPTCHA bypass, or hidden submission, it should not be implemented.

See [`SECURITY.md`](SECURITY.md) and [`PRIVACY.md`](PRIVACY.md) for more detail.

---

## Repository Layout

Current structure:

```text
src/
  background/
    service-worker.js

  bridge/
    wargames-bridge.js

  shared/
    constants.js
    job-contract.js
    messaging.js
    redaction.js
    validation.js

  technic/
    changelog-publisher.js
    update-publisher.js

manifests/
  manifest.chromium.json
  manifest.firefox.json

icons/
  wargames-rounded-source.png
  icon-16.png
  icon-32.png
  icon-48.png
  icon-128.png
  icon-256.png

docs/
  architecture.md
  browser-support.md
  local-e2e-solder-handoff-testing.md
  local-extension-testing.md
  repository-hygiene.md
  solder-contract.md

fixtures/
  technic-manage-versions-minimal.html

tests/
  job-contract-validation.test.js
  local-e2e-solder-handoff-docs.test.js
  manifest-permissions-icons.test.js
  service-worker-job-flow.test.js
  technic-changelog-publisher-flow.test.js
  technic-form-selectors.test.js
  technic-publisher-boundary.test.js
  wargames-bridge-handoff.test.js

scripts/
  build.js
```

The exact structure may change as the project develops, but the core separation should remain:

* shared workflow logic
* browser-specific packaging
* Technic page integration
* Wargames/Solder job contract handling
* reserved workflow boundaries

---

## Development

### Requirements

Recommended development tools:

* Node.js LTS
* npm
* Git
* Chrome, Edge, Opera GX, and/or Firefox for testing

### Setup

Clone the repository:

```bash
git clone https://github.com/Wargames-Development/wgh-browser-extension.git
cd wgh-browser-extension
```

Install dependencies from the lockfile:

```bash
npm ci
```

Build the extension packages:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Generated browser packages are written to `dist/`.

Local browser loading instructions are documented in [`docs/local-extension-testing.md`](docs/local-extension-testing.md). Repository hygiene and patch packaging rules are documented in [`docs/repository-hygiene.md`](docs/repository-hygiene.md). The local Wargames Solder handoff test flow is documented in [`docs/local-e2e-solder-handoff-testing.md`](docs/local-e2e-solder-handoff-testing.md).

---

## Testing Approach

Testing should not require a real Technic account for automated checks.

Preferred test coverage:

* Job payload validation
* Token redaction
* Safety checks
* Manual fallback behaviour
* Technic page fixture parsing
* Version field detection
* Changelog field detection
* User confirmation behaviour
* Cancellation and original field restoration
* Unsupported page/layout failure handling
* Reserved future workflow rejection
* Local E2E test documentation coverage
* Manifest domain, permission, and icon coverage
* Chromium and Firefox build icon-copy coverage

Real browser testing should be done manually against test accounts/pages where appropriate.

---

## Release Packaging

Automated release packaging is not implemented yet.

Future release work should use a controlled, manual GitHub Actions workflow that builds Chromium and Firefox packages from a tagged source state, creates checksums, and attaches the generated packages to a GitHub Release or prerelease.

Release work should be handled in a separate patch/issue from the local E2E handoff notes so release permissions, versioning, and packaging rules can be reviewed independently.

---

## Issues and Feature Requests

GitHub Issues may be used for:

* Bug reports
* Browser compatibility problems
* Documentation issues
* Feature requests
* Workflow suggestions

Please do **not** post sensitive security issues, private tokens, screenshots containing session data, or exploit details in public issues.

Security issues should be reported privately through the security contact listed in [`SECURITY.md`](SECURITY.md).

---

## Contributing

Contributions are welcome, especially around:

* Browser compatibility
* Extension security
* WebExtension packaging
* User confirmation UX
* Test coverage
* Documentation improvements

Please keep changes focused and well-documented.

Do not add behaviour that:

* Collects Technic credentials
* Collects cookies/session tokens
* Bypasses login or 2FA
* Submits forms without visible user confirmation
* Expands browser permissions unnecessarily
* Claims official Technic API posting support

If you would like to contribute in a more official capacity, please contact us through our Discord server.

---

## Need to Get in Touch?

Our primary community hub is our Discord server:

https://discord.wargames.uk

For non-support enquiries:

* **[dev@wargames.uk](mailto:dev@wargames.uk)** — development / project enquiries
* **[abuse@wargames.uk](mailto:abuse@wargames.uk)** — security or abuse reports

Please use Discord for general questions, feedback, and discussion.

---

## Credits

This project is developed and maintained by the **Wargames Development Group (WDG)**.

Primary development:

* **Glac** — Lead developer  
  https://github.com/RhysHopkins04

Project support:

* **Barrack**  
  https://github.com/BateNacon

Contributors:

[![Contributors](https://contrib.rocks/image?repo=Wargames-Development/wgh-browser-extension)](https://github.com/Wargames-Development/wgh-browser-extension/graphs/contributors)

---

## License

This project is licensed under the **MIT License**.

See [`LICENSE`](LICENSE) for the full license text.

---

## Links

* GitHub Repository: https://github.com/Wargames-Development/wgh-browser-extension
* Discord: https://discord.wargames.uk

---

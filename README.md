<!-- Wargames Development Group – WGH Browser Extension -->

[![Discord](https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/social/discord-plural_vector.svg)](https://discord.wargames.uk)

# Wargames Hosting Browser Extension

**Wargames Hosting Browser Extension** is a browser extension project for approved Wargames Hosting browser-assisted workflows.

The first supported workflow is the **Technic Changelog Publisher**, which helps Wargames Solder users submit an approved changelog draft through the normal Technic Platform edit/version page using their own browser session.

Repository: https://github.com/Wargames-Development/wgh-browser-extension

---

## Project Status

This project is in early development.

Initial scope:

* Build the shared browser extension foundation
* Support Chrome, Edge, and Opera GX through a Chromium/WebExtension package
* Support Firefox through a Firefox/WebExtension package
* Implement the first workflow: `technic_changelog_post`
* Reserve a clean boundary for future workflows, such as a possible update publisher

Not implemented yet:

* Full Technic update publishing
* Server-side Technic automation
* Any official Technic Platform API posting flow

---

## What This Extension Does

The first supported workflow assists with Technic Platform changelog posting.

The expected flow is:

1. A user reviews or approves a changelog draft in Wargames Solder.
2. Wargames Solder creates a short-lived extension job.
3. The user launches the browser extension flow.
4. The extension opens the user’s normal Technic Platform edit/version page.
5. The user must already be logged into Technic in their own browser.
6. The extension fills the version number and changelog fields.
7. The extension shows a visible confirmation step.
8. The user confirms before anything is submitted.
9. The normal Technic form is submitted through the user’s own browser session.

This is an assisted browser workflow, not a backend Technic publishing API.

---

## What This Extension Does Not Do

This extension does **not**:

* Store Technic usernames
* Store Technic passwords
* Store Technic cookies
* Store Technic session tokens
* Store Technic 2FA material
* Bypass Technic login
* Bypass 2FA
* Bypass CAPTCHA
* Bypass permissions
* Bypass anti-abuse systems
* Run server-side browser automation for user Technic accounts
* Claim official Technic Platform API posting support

Wargames Solder handles launcher build delivery through Solder-compatible systems. Technic Platform changelog entry remains manual by default, with this extension acting only as an optional user-confirmed convenience workflow.

---

## Why This Is a Browser Extension

Technic Platform changelog posting is not treated as a direct Wargames Solder backend API feature.

A browser extension allows the workflow to stay user-controlled:

* The user logs into Technic themselves
* The user remains in control of their own browser session
* Wargames does not collect third-party login details
* The extension can fill the normal Technic form without handling passwords or cookies
* The user can review the fields before submitting

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

See [`docs/browser-support.md`](docs/browser-support.md) and [`docs/local-extension-testing.md`](docs/local-extension-testing.md) for local loading instructions.

---

## Supported Workflows

### `technic_changelog_post`

Status: initial active workflow

Purpose:

* Take an approved Wargames Solder changelog draft
* Open the relevant Technic Platform edit/version page
* Fill the build/version number
* Fill the changelog text
* Ask the user to confirm
* Submit the normal Technic form only after confirmation

### `technic_update_publish_future`

Status: reserved only

This workflow is intentionally not implemented yet.

The repository keeps a placeholder module boundary for a future update-publisher workflow, but it must not be exposed as a usable feature until the backend and safety model are ready.

---

## Wargames Solder Contract

This extension is designed to work with the Wargames Solder extension job handoff system.

The Solder side owns:

* Changelog draft generation
* Changelog review/editing
* Extension job creation
* Short-lived job tokens
* Job status tracking
* Manual copy/export fallback
* Audit/event records where applicable

The extension side owns:

* Browser permissions
* Browser packaging
* Page detection
* User confirmation UI
* Technic form filling
* Reporting job completion or failure

The extension must never receive the Wargames internal API token.

It should only receive a short-lived per-job token created specifically for the browser-assisted workflow.

---

## Manual Fallback

The extension is optional.

Users should always be able to complete the workflow manually by:

1. Copying the version number from Wargames Solder
2. Copying the changelog text from Wargames Solder
3. Opening the Technic edit/version page themselves
4. Pasting the values manually
5. Submitting the Technic form themselves

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
    messaging.js
    validation.js

  technic/
    changelog-publisher.js
    update-publisher.future.js

manifests/
  manifest.chromium.json
  manifest.firefox.json

docs/
  architecture.md
  browser-support.md
  solder-contract.md

fixtures/
  technic-manage-versions-minimal.html

tests/
  technic-form-selectors.test.js

scripts/
  build.js
```

The exact structure may change as the project develops, but the core separation should remain:

* shared workflow logic
* browser-specific packaging
* Technic page integration
* Wargames/Solder job contract handling
* future workflow boundaries

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

Install dependencies:

```bash
npm install
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

Local browser loading instructions are documented in [`docs/local-extension-testing.md`](docs/local-extension-testing.md). Repository hygiene and patch packaging rules are documented in [`docs/repository-hygiene.md`](docs/repository-hygiene.md).

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
* Unsupported page/layout failure handling
* Reserved future workflow rejection

Real browser testing should be done manually against test accounts/pages where appropriate.

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

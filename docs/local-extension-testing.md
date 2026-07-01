# Local Extension Testing Guide

This guide covers local development and manual loading for the Wargames Hosting Browser Extension.

The repository uses one shared source tree with browser-specific build outputs:

- Chrome, Microsoft Edge, and Opera GX use the Chromium build.
- Firefox uses the Firefox build.

Manual copy/export from Wargames Solder remains the fallback path while extension-assisted workflows are being developed or reviewed. For the full local Wargames Solder to browser extension to Technic changelog test flow, see [Local End-to-End Solder Handoff Test Notes](local-e2e-solder-handoff-testing.md).

## Safety rules while testing

Do not use real private data in screenshots, logs, fixtures, pull requests, or issue comments.

The extension must not store or collect:

- Technic usernames;
- Technic passwords;
- Technic cookies;
- Technic session tokens;
- Technic 2FA data;
- Wargames internal API tokens.

The extension must not bypass Technic login, 2FA, CAPTCHA, permissions, or anti-abuse systems. Any Technic form submission must stay visible and user-confirmed. Do not describe the workflow as official Technic Platform API posting support.

## Requirements

Use a current Node.js LTS release and npm.

From the repository root:

```bash
npm install
npm test
npm run build
```

`npm run build` writes reviewable local build outputs to:

```text
dist/chromium/
dist/firefox/
```

`dist/` is generated output and must not be committed.

## Build commands

Build both browser packages:

```bash
npm run build
```

Build only the Chromium package:

```bash
npm run build:chromium
```

Build only the Firefox package:

```bash
npm run build:firefox
```

## Chrome local load

1. Run `npm run build:chromium`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `dist/chromium/`.
6. Confirm the extension loads without unexpected permission prompts.

## Microsoft Edge local load

1. Run `npm run build:chromium`.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `dist/chromium/`.
6. Confirm the extension loads without unexpected permission prompts.

## Opera GX local load

1. Run `npm run build:chromium`.
2. Open `opera://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `dist/chromium/`.
6. Confirm the extension loads without unexpected permission prompts.

Opera GX is treated as a Chromium-family target. Record a browser-specific issue if Opera GX behaves differently from Chrome or Edge.

## Firefox local load

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on**.
4. Select `dist/firefox/manifest.json`.
5. Confirm the extension loads without unexpected permission prompts.

Firefox temporary add-ons are removed when Firefox restarts, so repeat these steps for each new browser session.

## What to check manually

For Patch 001 and other documentation/process-only patches, manual browser loading is enough to confirm packaging still works. Do not trigger live Wargames job handoff or Technic form automation unless the patch explicitly targets that workflow.

For later workflow patches, record these checks without sharing secrets:

- browser and version tested;
- build target used: Chromium or Firefox;
- whether the extension loaded cleanly;
- whether permissions matched the expected manifest;
- whether the workflow fell back safely when a page, payload, or permission was missing;
- whether the user saw a visible confirmation before any Technic form submission.

## Local test account guidance

Use test accounts and non-sensitive test modpacks where possible. Do not paste real Technic account details, cookies, session tokens, 2FA data, or Wargames internal tokens into fixtures, issue comments, screenshots, or logs.

If a real Technic owner/contributor session is needed for a later manual test, log in directly through the browser and keep credentials/session data outside this repository.

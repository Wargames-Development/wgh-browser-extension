# Browser Support

## Targets

The extension is maintained as one shared source tree with browser-specific manifests and build outputs.

Chromium package:

- Chrome;
- Microsoft Edge;
- Opera GX.

Firefox package:

- Firefox.

Chrome, Edge, and Opera GX use `dist/chromium/` after running `npm run build:chromium` or `npm run build`. Firefox uses `dist/firefox/` after running `npm run build:firefox` or `npm run build`.

Opera GX is treated as a Chromium-family target unless testing shows a browser-specific issue.

## Local loading

Use [`local-extension-testing.md`](local-extension-testing.md) for browser-specific local loading steps.

## Store/publication notes

The code should remain clean enough to publish openly for audit. If the repository remains private, the packaged extension should still avoid hidden/private behavior and keep permissions narrow.

Local package artifacts are generated files and should not be committed to the repository.

## Permission policy

Host permissions should be limited to:

- `https://solder.wargames.localhost/*`;
- `https://*.wargames.localhost/*`;
- `https://*.wargames.host/*`;
- `https://*.wargames.uk/*`;
- `https://www.technicpack.net/modpack/edit/*/versions`.

Avoid broad `<all_urls>`, `https://*/*`, `http://*/*`, or `*://*/*` permissions. Retired Wargames production host patterns should not be reintroduced. The extension should not request the `tabs` permission unless a future patch proves it is required and documents why.

A documentation/process-only patch must not change browser permissions, host permissions, or content-script match patterns.

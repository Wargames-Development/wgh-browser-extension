# Browser Support

## Targets

The extension should be maintained as one shared source tree with browser-specific manifests.

Chromium package:

- Chrome
- Microsoft Edge
- Opera GX

Firefox package:

- Firefox

## Store/publication notes

The code should remain clean enough to publish openly for audit. If the repository remains private, the packaged extension should still avoid hidden/private behavior and keep permissions narrow.

## Permission policy

Host permissions should be limited to:

- Wargames/Solder domains used for job handoff;
- Technic manage versions pages needed for the changelog workflow.

Avoid broad `<all_urls>` permissions.

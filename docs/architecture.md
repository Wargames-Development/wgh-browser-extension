# Architecture

## Purpose

The extension exists to bridge user-initiated workflows between Wargames Solder and third-party web pages that do not expose a suitable public API.

The first workflow is Technic Platform changelog posting.

## High-level flow

```text
Wargames Solder panel
  -> creates short-lived extension job
  -> page dispatches job UUID/token event
  -> WGH extension bridge receives event
  -> background coordinator claims job from Solder
  -> background opens Technic manage versions page
  -> Technic content script fills normal form
  -> user confirms before submit
  -> extension reports result to Solder
```

## Modules

```text
src/background/service-worker.js
  Coordinates jobs, claims payloads, opens tabs, reports complete/fail.

src/bridge/wargames-bridge.js
  Runs on Wargames pages and receives user-initiated job handoff events.

src/technic/changelog-publisher.js
  Runs on Technic manage versions pages and fills the version/changelog form.

src/technic/update-publisher.future.js
  Reserved placeholder for future update-publisher work.
```

## Job types

Active:

- `technic_changelog_post`

Reserved:

- `technic_update_publish_future`

The extension must reject reserved job types until they are explicitly implemented.

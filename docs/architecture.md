# Architecture

## Purpose

The extension exists to bridge user-initiated workflows between Wargames Solder and third-party web pages that do not expose a suitable public API.

The first workflow is Technic Platform changelog posting.

## High-level flow

```text
Wargames Solder panel
  -> creates short-lived extension job
  -> page dispatches user-initiated job UUID/token event
  -> WGH extension bridge validates event shape, job type, and expiry
  -> background coordinator claims job from Solder with the per-job token
  -> background validates the claimed payload and safety boundaries
  -> background opens Technic manage versions page only after validation
  -> Technic content script validates the normal manage versions form
  -> extension fills the version/build and changelog fields
  -> user reviews a visible confirmation dialog
  -> normal Technic form submission starts only after explicit user confirmation
```

## Modules

```text
src/background/service-worker.js
  Coordinates jobs, claims payloads, validates safety boundaries, opens tabs, and reports safe failure states.

src/bridge/wargames-bridge.js
  Runs on Wargames pages and receives user-initiated job handoff events.

src/technic/changelog-publisher.js
  Runs on Technic manage versions pages, fills the expected version/build and changelog fields after payload validation, and requires visible user confirmation before normal form submission.

src/technic/update-publisher.future.js
  Reserved placeholder for future update-publisher work.
```

## Job types

Active:

- `technic_changelog_post`

Reserved:

- `technic_update_publish_future`

The extension must reject reserved job types until they are explicitly implemented.

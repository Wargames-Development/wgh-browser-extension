# Architecture

## Purpose

The extension exists to bridge user-initiated workflows between Wargames Solder and third-party web pages that do not expose a suitable public API.

The active workflows are Technic Platform changelog posting and user-confirmed Technic update/status posting.

## High-level flow

```text
Wargames Solder panel
  -> creates short-lived extension job
  -> page dispatches user-initiated job UUID/token event
  -> WGH extension bridge validates event shape, job type, and expiry
  -> background coordinator claims job from Solder with the per-job token
  -> background validates the claimed payload and safety boundaries
  -> background opens the relevant Technic versions or updates page only after validation
  -> Technic content script validates the normal versions or updates form
  -> extension fills only the expected changelog or update/status fields
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
  Runs on scoped Technic versions and updates pages, fills the expected version/build and changelog fields for `technic_changelog_post`, fills only the update/status message field for `technic_update_publish`, and requires visible user confirmation before normal form submission. The update confirmation UI keeps the main review focused on the update/status body and collapses manual fallback details.

src/technic/update-publisher.js
  Metadata boundary documenting the active `technic_update_publish` contract and the reserved legacy `technic_update_publish_future` identifier.
```

## Job types

Active:

- `technic_changelog_post`
- `technic_update_publish`

Reserved:

- `technic_update_publish_future`

The extension must advertise the two active job types and must continue rejecting the reserved legacy update placeholder.

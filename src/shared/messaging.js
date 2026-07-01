// Shared messaging helpers for future bundled builds.

export function getExtensionApi() {
  return globalThis.browser || globalThis.chrome;
}

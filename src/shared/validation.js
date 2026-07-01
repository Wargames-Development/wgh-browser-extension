// Shared validation helpers for future bundled builds.

export function normalizeApiBaseUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

export function isProbablyExtensionJob(value) {
  return typeof value === 'string' && /^technic-extension-job-[A-Za-z0-9-]+$/.test(value.trim());
}

export function isProbablyExtensionToken(value) {
  return typeof value === 'string' && /^wtej_[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

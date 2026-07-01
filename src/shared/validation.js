// Shared validation helpers for future bundled builds and Node-based tests.

export const ACTIVE_JOB_TYPE = 'technic_changelog_post';
export const RESERVED_JOB_TYPES = Object.freeze(['technic_update_publish_future']);

export function normalizeApiBaseUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(trimmed)) {
    return '';
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString().replace(/\/+$/, '') : '';
  } catch (_) {
    return '';
  }
}

export function isProbablyExtensionJob(value) {
  return typeof value === 'string' && /^technic-extension-job-[A-Za-z0-9-]+$/.test(value.trim());
}

export function isProbablyExtensionToken(value) {
  return typeof value === 'string' && /^wtej_[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

export function isSupportedJobType(value) {
  return value === ACTIVE_JOB_TYPE;
}

export function isReservedJobType(value) {
  return RESERVED_JOB_TYPES.includes(value);
}

export function isFutureIsoDate(value, nowMs = Date.now()) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > nowMs;
}

export function validateTechnicVersionsUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'www.technicpack.net') {
      return '';
    }
    const path = url.pathname.replace(/\/+$/, '');
    if (/^\/modpack\/edit\/[A-Za-z0-9-]+\/versions$/.test(path)
      || /^\/dashboard\/modpack\/[A-Za-z0-9-]+\/versions$/.test(path)) {
      return url.toString();
    }
  } catch (_) {
    return '';
  }
  return '';
}

export function deriveTechnicVersionsUrlFromSlug(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const slug = value.trim();
  if (!/^[a-z0-9][a-z0-9-]{1,128}$/i.test(slug)) {
    return '';
  }
  return `https://www.technicpack.net/modpack/edit/${encodeURIComponent(slug)}/versions`;
}

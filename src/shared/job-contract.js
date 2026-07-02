import {
  ACTIVE_JOB_TYPE,
  deriveTechnicVersionsUrlFromSlug,
  isFutureIsoDate,
  isProbablyExtensionJob,
  isProbablyExtensionToken,
  isReservedJobType,
  isSupportedJobType,
  normalizeApiBaseUrl,
  validateTechnicVersionsUrl
} from './validation.js';
import { isSensitiveKey } from './redaction.js';

function firstString(source, names) {
  for (const name of names) {
    const value = source?.[name];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

function getDeep(source, paths) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = source;
    for (const part of parts) {
      current = current?.[part];
    }
    if (current !== undefined && current !== null && current !== '') {
      return current;
    }
  }
  return '';
}

export function validateLaunchPayload(detail, nowMs = Date.now()) {
  if (!detail || typeof detail !== 'object') {
    return { ok: false, code: 'missing_payload', message: 'The extension launch payload was missing.' };
  }

  const schemaVersion = detail.schema_version ?? detail.schemaVersion;
  if (Number(schemaVersion) !== 1) {
    return { ok: false, code: 'invalid_schema_version', message: 'The extension launch payload schema version is unsupported.' };
  }

  const jobType = firstString(detail, ['job_type', 'jobType']);
  if (!isSupportedJobType(jobType)) {
    return {
      ok: false,
      code: isReservedJobType(jobType) ? 'reserved_job_type' : 'unsupported_job_type',
      message: 'This extension version only supports Technic changelog posting.'
    };
  }

  const apiBaseUrl = normalizeApiBaseUrl(firstString(detail, [
    'solder_base_url',
    'solderBaseUrl',
    'api_base_url',
    'apiBaseUrl',
    'apiBase'
  ]));
  const jobUuid = firstString(detail, ['job_uuid', 'jobUuid']);
  const jobToken = firstString(detail, ['job_token', 'jobToken']);
  const expiresAt = firstString(detail, ['expires_at', 'expiresAt']);

  if (!apiBaseUrl || !isProbablyExtensionJob(jobUuid) || !isProbablyExtensionToken(jobToken)) {
    return { ok: false, code: 'invalid_launch_fields', message: 'The extension launch payload did not contain a valid URL, job UUID, and short-lived job token.' };
  }

  if (!isFutureIsoDate(expiresAt, nowMs)) {
    return { ok: false, code: 'job_expired', message: 'The extension launch payload is expired or missing a valid expiry time.' };
  }

  const technicUrl = validateTechnicVersionsUrl(firstString(detail, ['technic_platform_edit_versions_url', 'technicPlatformEditVersionsUrl']));
  const technicSlug = firstString(detail, ['technic_platform_slug', 'technicPlatformSlug']);
  const returnUrl = firstString(detail, ['return_url', 'returnUrl']);

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      apiBaseUrl,
      jobUuid,
      jobToken,
      jobType,
      expiresAt,
      technicUrl,
      technicSlug,
      returnUrl
    }
  };
}

export function unwrapSolderResult(responseJson) {
  if (responseJson?.result && typeof responseJson.result === 'object') {
    return responseJson.result;
  }
  return responseJson;
}

export function scanForUnsafeSecrets(value, path = []) {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const hits = [];
  for (const [key, item] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (isSensitiveKey(key) && item !== false && item !== null && item !== '') {
      hits.push(nextPath.join('.'));
      continue;
    }
    if (item && typeof item === 'object') {
      hits.push(...scanForUnsafeSecrets(item, nextPath));
    }
  }
  return hits;
}

export function extractClaimPayload(result) {
  const unwrapped = unwrapSolderResult(result) || {};
  const job = unwrapped.job || {};
  const payload = unwrapped.payload || job.payload || {};
  const target = payload.target || job.target || {};
  return { result: unwrapped, job, payload, target };
}

export function extractClaimPreview(result) {
  const { job, payload, target } = extractClaimPayload(result);
  const explicitUrl = validateTechnicVersionsUrl(
    target.technic_platform_edit_versions_url
      || payload.technic_platform_edit_versions_url
      || job.technic_platform_edit_versions_url
      || ''
  );
  const slugUrl = deriveTechnicVersionsUrlFromSlug(
    target.technic_platform_slug
      || payload.technic_platform_slug
      || job.technic_platform_slug
      || payload.pack?.slug
      || ''
  );
  const versionNumber = String(getDeep(payload, [
    'target.version_number',
    'extension_payload.version_number',
    'extension_payload.build.name',
    'build.name'
  ]) || job.version_number || '').trim();
  const changelogText = String(getDeep(payload, [
    'extension_payload.changelog.final_changelog',
    'extension_payload.changelog.copy_text',
    'extension_payload.changelog.body',
    'extension_payload.copy_text',
    'manual_copy_export.copy_text',
    'job.changelog_text',
    'changelog_text'
  ]) || '').trim();

  return {
    technicUrl: explicitUrl || slugUrl,
    versionNumber,
    changelogText
  };
}

export function validateClaimResponse(responseJson, nowMs = Date.now()) {
  const { result, job, payload } = extractClaimPayload(responseJson);
  if (!result || typeof result !== 'object' || result.ok !== true) {
    return { ok: false, code: result?.status || 'claim_failed', message: result?.message || 'The Solder extension job could not be claimed.' };
  }

  const jobType = job.job_type || payload.job?.job_type || '';
  if (!isSupportedJobType(jobType)) {
    return {
      ok: false,
      code: isReservedJobType(jobType) ? 'reserved_job_type' : 'unsupported_job_type',
      message: 'This extension version only supports Technic changelog posting.'
    };
  }

  const expiresAt = job.expires_at || payload.job?.expires_at || '';
  if (!isFutureIsoDate(expiresAt, nowMs)) {
    return { ok: false, code: 'job_expired', message: 'The claimed Solder extension job is expired or missing a valid expiry time.' };
  }

  const unsafePaths = scanForUnsafeSecrets({ job, payload });
  const safety = payload.safety || {};
  const unsafeSafety = Boolean(
    safety.credentials_included
      || safety.session_tokens_included
      || safety.cookies_included
      || safety.technic_credentials_stored
      || safety.technic_session_tokens_stored
      || safety.technic_cookies_stored
      || safety.internal_api_token_exposed
      || payload.job?.internal_api_token_exposed
      || job.internal_api_token_exposed
      || payload.job?.token_hash_exposed
      || job.token_hash_exposed
  );
  if (unsafePaths.length > 0 || unsafeSafety) {
    return { ok: false, code: 'unsafe_payload', message: 'The claimed Solder extension job payload contained unsafe credential, cookie, session, or token material.' };
  }

  const preview = extractClaimPreview(responseJson);
  if (!preview.technicUrl) {
    return { ok: false, code: 'invalid_technic_target', message: 'The claimed Solder extension job did not include a supported Technic manage versions URL or slug.' };
  }
  if (!preview.versionNumber || !preview.changelogText) {
    return { ok: false, code: 'invalid_changelog_payload', message: 'The claimed Solder extension job did not include a version number and changelog text.' };
  }

  return {
    ok: true,
    value: {
      result,
      job,
      payload,
      ...preview,
      jobType: ACTIVE_JOB_TYPE
    }
  };
}

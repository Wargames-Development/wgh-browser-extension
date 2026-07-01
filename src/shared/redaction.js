const TOKEN_PATTERNS = [
  /wtej_[A-Za-z0-9_-]{8,}/g,
  /("?job_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi,
  /("?internal_api_token"?\s*[:=]\s*)"?[^"\s,}]+"?/gi
];

const SENSITIVE_KEY_PATTERNS = [
  /^job_token$/i,
  /^internal_api_token$/i,
  /^technic_password$/i,
  /^password$/i,
  /^technic_cookie$/i,
  /^technic_cookies$/i,
  /^cookie$/i,
  /^cookies$/i,
  /^technic_session_token$/i,
  /^technic_session_tokens$/i,
  /^session_token$/i,
  /^session_tokens$/i,
  /^two_factor_code$/i,
  /^totp_secret$/i
];

export function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key || '')));
}

export function redactSensitiveText(value) {
  let text = typeof value === 'string' ? value : String(value ?? '');
  for (const pattern of TOKEN_PATTERNS) {
    text = text.replace(pattern, (match, prefix = '') => {
      if (prefix && /[:=]/.test(prefix)) {
        return `${prefix}"[redacted]"`;
      }
      return '[redacted]';
    });
  }
  return text;
}

export function redactSensitiveValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[redacted]' : redactSensitiveValue(item)
    ]));
  }
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }
  return value;
}

export function safeErrorMessage(error, fallback = 'The Wargames extension job could not be processed safely.') {
  const raw = error?.message || error?.status || error || fallback;
  const redacted = redactSensitiveText(raw);
  return redacted || fallback;
}

export function sanitizeFailureReason(reason, fallback = 'extension_validation_failed') {
  const text = redactSensitiveText(reason || fallback).trim();
  return text.slice(0, 512) || fallback;
}

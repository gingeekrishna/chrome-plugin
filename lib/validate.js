/**
 * Parses and validates the backend URL entered in the settings panel.
 * Returns { url } on success or { error } on failure.
 */
export function parseBackendUrl(rawUrl, defaultBackend) {
  const url = rawUrl.trim().replace(/\/$/, '') || defaultBackend;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'Backend URL is not a valid URL (e.g. http://localhost:8000).' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { error: 'Backend URL must start with http:// or https://.' };
  }
  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!isLocalhost) {
    return { error: 'Non-localhost URLs require updating host_permissions in the extension manifest.' };
  }
  return { url };
}

/** Returns true if `id` is a valid UUID v4 string. */
export function isValidUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

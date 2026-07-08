import { parseBackendUrl, isValidUuid } from '../lib/validate.js';

const DEFAULT = 'http://localhost:8000';

// ── parseBackendUrl ───────────────────────────────────────────────────────────
describe('parseBackendUrl', () => {
  test('accepts http://localhost', () => {
    expect(parseBackendUrl('http://localhost:8000', DEFAULT)).toEqual({ url: 'http://localhost:8000' });
  });

  test('accepts http://127.0.0.1', () => {
    expect(parseBackendUrl('http://127.0.0.1:8000', DEFAULT)).toEqual({ url: 'http://127.0.0.1:8000' });
  });

  test('accepts https://localhost', () => {
    expect(parseBackendUrl('https://localhost:8000', DEFAULT)).toEqual({ url: 'https://localhost:8000' });
  });

  test('strips trailing slash', () => {
    expect(parseBackendUrl('http://localhost:8000/', DEFAULT)).toEqual({ url: 'http://localhost:8000' });
  });

  test('falls back to defaultBackend when input is empty', () => {
    expect(parseBackendUrl('', DEFAULT)).toEqual({ url: DEFAULT });
  });

  test('falls back to defaultBackend when input is whitespace', () => {
    expect(parseBackendUrl('   ', DEFAULT)).toEqual({ url: DEFAULT });
  });

  test('rejects an invalid URL', () => {
    const result = parseBackendUrl('not-a-url', DEFAULT);
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/valid URL/i);
  });

  test('rejects ftp:// protocol', () => {
    const result = parseBackendUrl('ftp://localhost:8000', DEFAULT);
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/http/i);
  });

  test('rejects non-localhost host', () => {
    const result = parseBackendUrl('http://example.com', DEFAULT);
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/host_permissions/i);
  });

  test('rejects a public IP', () => {
    const result = parseBackendUrl('http://192.168.1.1:8000', DEFAULT);
    expect(result).toHaveProperty('error');
  });
});

// ── isValidUuid ───────────────────────────────────────────────────────────────
describe('isValidUuid', () => {
  test('accepts a valid UUID v4', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  test('accepts uppercase UUID', () => {
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  test('rejects a UUID that is too short', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
  });

  test('rejects a UUID with wrong separators', () => {
    expect(isValidUuid('550e8400_e29b_41d4_a716_446655440000')).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(isValidUuid('')).toBe(false);
  });

  test('rejects a plain string', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
  });
});

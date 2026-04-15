import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveToken, loadToken, clearToken } from './token';

describe('token management', () => {
  beforeEach(() => clearToken());
  afterEach(() => clearToken());

  it('returns null when no token saved', () => {
    expect(loadToken()).toBeNull();
  });

  it('saves and loads token', () => {
    saveToken('ghp_test123', 'gridtech-is', 'merkjalisti-data');
    const result = loadToken();
    expect(result).toEqual({
      token: 'ghp_test123',
      owner: 'gridtech-is',
      repo: 'merkjalisti-data',
    });
  });

  it('clearToken removes all keys', () => {
    saveToken('ghp_test123', 'gridtech-is', 'merkjalisti-data');
    clearToken();
    expect(loadToken()).toBeNull();
  });

  it('returns null if only token saved (missing owner)', () => {
    localStorage.setItem('merkjalisti-gh-token', 'ghp_test');
    expect(loadToken()).toBeNull();
  });
});

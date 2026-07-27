import { describe, expect, test, vi } from 'vitest';
import { createAuthClient } from './authClient.js';

function jsonResponse(body, { ok = true } = {}) {
  return { ok, json: vi.fn().mockResolvedValue(body) };
}

describe('auth client', () => {
  test('checks session status, logs in, and logs out', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ authenticated: false, passwordConfigured: true }))
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }))
      .mockResolvedValueOnce(jsonResponse({ authenticated: false }));
    const client = createAuthClient({ fetcher });

    await expect(client.getStatus()).resolves.toEqual({ authenticated: false, passwordConfigured: true });
    await expect(client.login('shared-password')).resolves.toEqual({ authenticated: true });
    await expect(client.logout()).resolves.toEqual({ authenticated: false });

    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'shared-password' }),
    });
  });

  test('surfaces a failed login message', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      error: { detail: 'Incorrect password.' },
    }, { ok: false }));
    const client = createAuthClient({ fetcher });

    await expect(client.login('wrong')).rejects.toThrow('Incorrect password.');
  });
});

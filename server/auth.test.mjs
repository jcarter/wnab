// @vitest-environment node

import { describe, expect, test } from 'vitest';
import { AUTH_COOKIE_NAME, AuthError, createAuth } from './auth.mjs';

function createExchange({ cookie = '', address = '127.0.0.1', secure = false } = {}) {
  const headers = {};
  return {
    request: {
      headers: { cookie },
      socket: { remoteAddress: address, encrypted: secure },
    },
    response: {
      setHeader(name, value) {
        headers[name] = value;
      },
    },
    headers,
  };
}

describe('shared password authentication', () => {
  test('creates and verifies an HttpOnly signed session cookie', () => {
    const auth = createAuth({
      password: 'shared-password',
      sessionSecret: 'independent-session-secret',
      now: () => 1_000,
    });
    const login = createExchange();

    auth.login(login.request, login.response, 'shared-password');

    expect(login.headers['Set-Cookie']).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(login.headers['Set-Cookie']).toContain('HttpOnly');
    expect(login.headers['Set-Cookie']).toContain('SameSite=Strict');
    const cookie = login.headers['Set-Cookie'].split(';')[0];
    expect(auth.isAuthenticated(createExchange({ cookie }).request)).toBe(true);
    expect(auth.isAuthenticated(createExchange({ cookie: `${cookie}tampered` }).request)).toBe(false);
  });

  test('rejects incorrect passwords without locking out later attempts', () => {
    const auth = createAuth({ password: 'correct-password' });
    const exchange = createExchange();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(() => auth.login(exchange.request, exchange.response, 'wrong'))
        .toThrow(new AuthError(401, 'Incorrect password.'));
    }
    expect(() => auth.login(exchange.request, exchange.response, 'correct-password'))
      .not.toThrow();
  });

  test('requires APP_PASSWORD configuration', () => {
    const auth = createAuth({ password: '' });
    const exchange = createExchange();

    expect(auth.configured).toBe(false);
    expect(() => auth.login(exchange.request, exchange.response, 'anything'))
      .toThrow(new AuthError(503, 'Server is missing the APP_PASSWORD environment variable.'));
  });
});

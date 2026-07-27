import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE_NAME = 'wnab_session';
const DEFAULT_SESSION_HOURS = 24 * 7;

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest();
}

function secureEqual(left, right) {
  return timingSafeEqual(hash(left), hash(right));
}

function parseCookies(header = '') {
  const cookies = new Map();
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

function isSecureRequest(request, cookieSecure) {
  if (cookieSecure === 'true') return true;
  if (cookieSecure === 'false') return false;
  return Boolean(request.socket?.encrypted || request.headers['x-forwarded-proto'] === 'https');
}

function cookieAttributes(request, cookieSecure) {
  return [
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    isSecureRequest(request, cookieSecure) ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

export function createAuth({
  password = process.env.APP_PASSWORD?.trim(),
  sessionSecret = process.env.SESSION_SECRET?.trim(),
  sessionHours = Number(process.env.SESSION_TTL_HOURS || DEFAULT_SESSION_HOURS),
  cookieSecure = process.env.COOKIE_SECURE || 'auto',
  now = () => Date.now(),
} = {}) {
  const configured = Boolean(password);
  const signingSecret = sessionSecret || password || '';
  const validSessionHours = Number.isFinite(sessionHours) && sessionHours > 0
    ? sessionHours
    : DEFAULT_SESSION_HOURS;
  const sessionDurationMs = validSessionHours * 60 * 60 * 1000;

  function signature(expiresAt) {
    return createHmac('sha256', signingSecret).update(String(expiresAt)).digest('base64url');
  }

  function createSessionToken() {
    const expiresAt = now() + sessionDurationMs;
    return `${expiresAt}.${signature(expiresAt)}`;
  }

  function verifySessionToken(token) {
    if (!configured || typeof token !== 'string') return false;
    const [expiresAtText, providedSignature, extra] = token.split('.');
    const expiresAt = Number(expiresAtText);
    if (extra || !providedSignature || !Number.isFinite(expiresAt) || expiresAt <= now()) return false;
    return secureEqual(providedSignature, signature(expiresAtText));
  }

  function isAuthenticated(request) {
    const token = parseCookies(request.headers.cookie).get(AUTH_COOKIE_NAME);
    return verifySessionToken(token);
  }

  function login(request, response, providedPassword) {
    if (!configured) {
      throw new AuthError(503, 'Server is missing the APP_PASSWORD environment variable.');
    }
    if (!secureEqual(providedPassword ?? '', password)) {
      throw new AuthError(401, 'Incorrect password.');
    }

    const maxAge = Math.floor(sessionDurationMs / 1000);
    response.setHeader(
      'Set-Cookie',
      `${AUTH_COOKIE_NAME}=${createSessionToken()}; Max-Age=${maxAge}; ${cookieAttributes(request, cookieSecure)}`,
    );
  }

  function logout(request, response) {
    response.setHeader(
      'Set-Cookie',
      `${AUTH_COOKIE_NAME}=; Max-Age=0; ${cookieAttributes(request, cookieSecure)}`,
    );
  }

  return {
    configured,
    isAuthenticated,
    login,
    logout,
  };
}

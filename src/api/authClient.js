const AUTH_API_BASE_URL = '/api/auth';

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.detail || 'Unable to authenticate.');
  }
  return body;
}

export function createAuthClient({ fetcher, baseUrl = AUTH_API_BASE_URL } = {}) {
  const request = (...args) => (fetcher ?? globalThis.fetch)(...args);

  return {
    async getStatus() {
      const response = await request(`${baseUrl}/status`, { method: 'GET' });
      return readJson(response);
    },

    async login(password) {
      const response = await request(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return readJson(response);
    },

    async logout() {
      const response = await request(`${baseUrl}/logout`, { method: 'POST' });
      return readJson(response);
    },
  };
}

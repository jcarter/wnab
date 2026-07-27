export const YNAB_API_BASE_URL = 'https://api.ynab.com/v1';
const AUTH_SCHEME = 'Bearer';


export class YnabApiError extends Error {
  constructor({ status, id, name, detail }) {
    super(detail);
    this.name = name;
    this.status = status;
    this.id = id;
    this.detail = detail;
  }
}

function normalizeToken(token) {
  return String(token ?? '').trim();
}

function toYnabApiError(status, body) {
  const error = body?.error;
  if (
    error &&
    typeof error === 'object' &&
    typeof error.id === 'string' &&
    typeof error.name === 'string' &&
    typeof error.detail === 'string'
  ) {
    return new YnabApiError({
      status,
      id: error.id,
      name: error.name,
      detail: error.detail,
    });
  }

  return new YnabApiError({
    status,
    id: String(status),
    name: 'http_error',
    detail: 'YNAB request failed.',
  });
}

export function createYnabClient({ token, fetcher = globalThis.fetch, baseUrl = YNAB_API_BASE_URL }) {
  const trimmedToken = normalizeToken(token);

  async function getJson(path) {
    if (!trimmedToken) {
      throw new Error('Missing YNAB access token');
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `${AUTH_SCHEME} ${trimmedToken}`,
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw toYnabApiError(response.status, body);
    }

    return body.data;
  }

  return {
    getPlans() {
      return getJson('/plans');
    },

    getPlanMonths(planId) {
      return getJson(`/plans/${encodeURIComponent(planId)}/months`);
    },

    async getMonthDetail(planId, month) {
      const data = await getJson(`/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(month)}`);
      return data.month;
    },
  };
}

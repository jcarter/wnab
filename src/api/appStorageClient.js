import {
  createEmptyMapping,
  normalizeMapping,
  parseStoredMapping,
} from '../domain/mappingStorage.js';

const STORAGE_API_BASE_URL = '/api';

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.detail || 'Unable to access the app data file.');
    error.name = body?.error?.name || 'AppStorageError';
    error.status = response.status;
    throw error;
  }
  return body;
}

export function createAppStorageClient({
  fetcher,
  baseUrl = STORAGE_API_BASE_URL,
} = {}) {
  const request = (...args) => (fetcher ?? globalThis.fetch)(...args);

  return {
    async loadMapping(planIds) {
      const query = new URLSearchParams();
      for (const planId of [...planIds].sort()) {
        query.append('planId', planId);
      }

      const response = await request(`${baseUrl}/mappings?${query}`, {
        method: 'GET',
      });
      const body = await readJson(response);
      if (body.mapping == null) {
        return { mapping: createEmptyMapping(planIds), error: null };
      }
      return parseStoredMapping(body.mapping, planIds);
    },

    async saveMapping(mapping) {
      const normalized = normalizeMapping(mapping);
      const response = await request(`${baseUrl}/mappings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mapping: normalized }),
      });
      await readJson(response);
      return normalized;
    },

    async loadSelectedBudgets() {
      const response = await request(`${baseUrl}/selected-budgets`, {
        method: 'GET',
      });
      const body = await readJson(response);
      return body.selectedBudgets ?? null;
    },

    async saveSelectedBudgets(selectedBudgets) {
      const response = await request(`${baseUrl}/selected-budgets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedBudgets }),
      });
      const body = await readJson(response);
      return body.selectedBudgets;
    },
  };
}

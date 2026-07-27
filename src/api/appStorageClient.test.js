import { describe, expect, test, vi } from 'vitest';
import { GROCERIES_MAPPING } from '../test/fixtures/ynabResponses.js';
import { createAppStorageClient } from './appStorageClient.js';

function jsonResponse(body, { ok = true } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('app storage client', () => {
  test('loads pair-specific mappings from the server', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ mapping: GROCERIES_MAPPING }));
    const client = createAppStorageClient({ fetcher });

    await expect(client.loadMapping(['plan-b', 'plan-a'])).resolves.toEqual({
      mapping: GROCERIES_MAPPING,
      error: null,
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/mappings?planId=plan-a&planId=plan-b',
      { method: 'GET' },
    );
  });

  test('saves normalized mappings to the server', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ mapping: GROCERIES_MAPPING }));
    const client = createAppStorageClient({ fetcher });

    await client.saveMapping({ ...GROCERIES_MAPPING, planIds: ['plan-b', 'plan-a'] });

    expect(fetcher).toHaveBeenCalledWith('/api/mappings', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapping: GROCERIES_MAPPING }),
    }));
  });

  test('loads and saves the shared selected budgets through the server', async () => {
    const selectedBudgets = {
      leftPlanId: 'plan-a',
      rightPlanId: 'plan-b',
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ selectedBudgets }))
      .mockResolvedValueOnce(jsonResponse({ selectedBudgets }));
    const client = createAppStorageClient({ fetcher });

    await expect(client.loadSelectedBudgets()).resolves.toEqual(selectedBudgets);
    await expect(client.saveSelectedBudgets(selectedBudgets)).resolves.toEqual(selectedBudgets);
    expect(fetcher).toHaveBeenLastCalledWith('/api/selected-budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedBudgets }),
    });
  });
});

import { describe, expect, test, vi } from 'vitest';
import { PLANS_RESPONSE, PLAN_A_JUNE_MONTH_RESPONSE, PLAN_A_MONTHS_RESPONSE } from '../test/fixtures/ynabResponses.js';
import { createYnabClient, YNAB_API_BASE_URL, YnabApiError } from './ynabClient.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('createYnabClient', () => {
  test('getPlans sends a read-only request through the server proxy and unwraps data', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(PLANS_RESPONSE));
    const client = createYnabClient({ fetcher });

    await expect(client.getPlans()).resolves.toEqual(PLANS_RESPONSE.data);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`${YNAB_API_BASE_URL}/plans`, {
      method: 'GET',
    });
  });

  test('getPlanMonths URL-encodes the plan id and unwraps months data', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(PLAN_A_MONTHS_RESPONSE));
    const client = createYnabClient({ fetcher, baseUrl: 'https://example.test/api' });

    await expect(client.getPlanMonths('plan a')).resolves.toEqual(PLAN_A_MONTHS_RESPONSE.data);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://example.test/api/plans/plan%20a/months', {
      method: 'GET',
    });
  });

  test('getMonthDetail URL-encodes path parts and unwraps the month detail', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(PLAN_A_JUNE_MONTH_RESPONSE));
    const client = createYnabClient({ fetcher });

    await expect(client.getMonthDetail('plan/a', '2026-06-01')).resolves.toEqual(PLAN_A_JUNE_MONTH_RESPONSE.data.month);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`${YNAB_API_BASE_URL}/plans/plan%2Fa/months/2026-06-01`, {
      method: 'GET',
    });
  });

  test('does not send an authorization header from the browser', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(PLANS_RESPONSE));
    const client = createYnabClient({ fetcher });

    await expect(client.getPlans()).resolves.toEqual(PLANS_RESPONSE.data);
    expect(fetcher).toHaveBeenCalledWith(`${YNAB_API_BASE_URL}/plans`, {
      method: 'GET',
    });
  });

  test('throws a YnabApiError with YNAB envelope details for 401 responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      error: {
        id: '401',
        name: 'unauthorized',
        detail: 'Not authorized.',
      },
    }, { ok: false, status: 401 }));
    const client = createYnabClient({ fetcher });

    await expect(client.getPlans()).rejects.toMatchObject({
      status: 401,
      id: '401',
      name: 'unauthorized',
      detail: 'Not authorized.',
    });
    await client.getPlans().catch((error) => {
      expect(error).toBeInstanceOf(YnabApiError);
    });
  });

  test('throws a fallback YnabApiError for invalid 503 error bodies', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ nope: true }, { ok: false, status: 503 }));
    const client = createYnabClient({ fetcher });

    await expect(client.getPlans()).rejects.toMatchObject({
      status: 503,
      id: '503',
      name: 'http_error',
      detail: 'YNAB request failed.',
    });
  });

  test('throws a fallback YnabApiError when the error envelope shape is invalid', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: { id: 'service_unavailable' } }, { ok: false, status: 503 }));
    const client = createYnabClient({ fetcher });

    await expect(client.getPlans()).rejects.toMatchObject({
      status: 503,
      id: '503',
      name: 'http_error',
      detail: 'YNAB request failed.',
    });
  });
});

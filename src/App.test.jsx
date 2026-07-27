import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import {
  GROCERIES_MAPPING,
  PLAN_A_JUNE_MONTH_RESPONSE,
  PLAN_A_MONTHS_RESPONSE,
  PLAN_B_JUNE_MONTH_RESPONSE,
  PLAN_B_MONTHS_RESPONSE,
  PLANS_RESPONSE,
} from './test/fixtures/ynabResponses.js';
import { serializeMapping } from './domain/mappingStorage.js';

const API_BASE = 'https://api.ynab.com/v1';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function installFetch(routes) {
  globalThis.fetch = vi.fn(async (url) => {
    if (!routes[url]) {
      throw new Error(`Unexpected URL: ${url}`);
    }

    return jsonResponse(routes[url]);
  });
}

function installHappyPathFetch() {
  installFetch({
    [`${API_BASE}/plans`]: PLANS_RESPONSE,
    [`${API_BASE}/plans/plan-a/months`]: PLAN_A_MONTHS_RESPONSE,
    [`${API_BASE}/plans/plan-b/months`]: PLAN_B_MONTHS_RESPONSE,
    [`${API_BASE}/plans/plan-a/months/2026-06-01`]: PLAN_A_JUNE_MONTH_RESPONSE,
    [`${API_BASE}/plans/plan-b/months/2026-06-01`]: PLAN_B_JUNE_MONTH_RESPONSE,
  });
}

function createStorageStub() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function installStorage() {
  const storage = createStorageStub();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
}


async function connectAndLoadMonth(user) {
  render(<App />);

  await user.type(screen.getByLabelText('YNAB Personal Access Token'), 'fake-token');
  await user.click(screen.getByRole('button', { name: 'Connect read-only' }));

  expect(await screen.findByLabelText('Your plan')).toHaveValue('plan-a');
  expect(screen.getByLabelText('Partner plan')).toHaveValue('plan-b');
  expect(await screen.findByLabelText('Month')).toHaveValue('2026-06-01');

  await user.click(screen.getByRole('button', { name: 'Load month' }));
  expect(await screen.findByText('Unmapped source categories')).toBeInTheDocument();
}

beforeEach(() => {
  vi.restoreAllMocks();
  installStorage();
  document.documentElement.removeAttribute('data-theme');
});

describe('Together Budget app', () => {
  test('switches between system, light, and dark themes and saves the choice', async () => {
    const user = userEvent.setup();
    render(<App />);

    const themePicker = screen.getByLabelText('Theme');
    expect(themePicker).toHaveValue('system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');

    await user.selectOptions(themePicker, 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('ynabTogether.theme.v1')).toBe('dark');

    await user.selectOptions(themePicker, 'light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.selectOptions(themePicker, 'system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  test('creates a Groceries mapping and renders combined budget totals from mocked endpoints', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth(user);

    await user.type(screen.getByLabelText('Group name'), 'Living Expenses');
    await user.type(screen.getByLabelText('Unified category name'), 'Groceries');
    await user.click(screen.getByLabelText('Alex Plan › Everyday › Groceries'));
    await user.click(screen.getByLabelText('Blair Plan › Daily Life › Food'));
    await user.click(screen.getByRole('button', { name: 'Add unified category' }));

    const row = screen.getByRole('row', { name: /Groceries/ });
    expect(within(row).getByText('$950.00')).toBeInTheDocument();
    expect(within(row).getByText('$323.45')).toBeInTheDocument();
    expect(within(row).getByText('$626.55')).toBeInTheDocument();
  });

  test('lists unmapped Dining Out separately and excludes it from mapped totals', async () => {
    localStorage.setItem('ynabTogether.categoryMapping.v1.plan-a__plan-b', serializeMapping(GROCERIES_MAPPING));
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth(user);

    const totalsRow = screen.getByRole('row', { name: /Totals/ });
    expect(within(totalsRow).getByText('$950.00')).toBeInTheDocument();
    expect(screen.getAllByText('Dining Out').length).toBeGreaterThan(0);
    expect(screen.getByText(/excluded until mapped/i)).toBeInTheDocument();
  });

  test('renders a friendly access-token error for 401 YNAB envelopes', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({
      error: {
        id: '401',
        name: 'unauthorized',
        detail: 'No access.',
      },
    }, { ok: false, status: 401 }));
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('YNAB Personal Access Token'), 'fake-token');
    await user.click(screen.getByRole('button', { name: 'Connect read-only' }));

    expect(await screen.findByText('YNAB rejected the access token. Check the token and try again.')).toBeInTheDocument();
  });

  test('reloads a saved mapping for the same selected plan pair', async () => {
    localStorage.setItem('ynabTogether.categoryMapping.v1.plan-a__plan-b', serializeMapping(GROCERIES_MAPPING));
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth(user);

    const row = screen.getByRole('row', { name: /Groceries/ });
    expect(within(row).getByText('$950.00')).toBeInTheDocument();
    expect(within(row).getByText('$323.45')).toBeInTheDocument();
    expect(within(row).getByText('$626.55')).toBeInTheDocument();
  });

  test('expands a shared category into per-plan budgeted and spent amounts', async () => {
    localStorage.setItem('ynabTogether.categoryMapping.v1.plan-a__plan-b', serializeMapping(GROCERIES_MAPPING));
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth(user);

    await user.click(screen.getByRole('button', { name: 'Show plan breakdown for Groceries' }));

    const breakdown = screen.getByRole('region', { name: 'Plan breakdown for Groceries' });
    expect(within(breakdown).getByText('Alex Plan')).toBeInTheDocument();
    expect(within(breakdown).getByText('$450.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('$123.45')).toBeInTheDocument();
    expect(within(breakdown).getByText('Blair Plan')).toBeInTheDocument();
    expect(within(breakdown).getByText('$500.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide plan breakdown for Groceries' })).toHaveAttribute('aria-expanded', 'true');
  });
});

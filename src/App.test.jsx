import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import {
  GROCERIES_MAPPING,
  PLAN_A_JUNE_MONTH_RESPONSE,
  PLAN_A_MAY_MONTH_RESPONSE,
  PLAN_A_MONTHS_RESPONSE,
  PLAN_B_JUNE_MONTH_RESPONSE,
  PLAN_B_MAY_MONTH_RESPONSE,
  PLAN_B_MONTHS_RESPONSE,
  PLANS_RESPONSE,
} from './test/fixtures/ynabResponses.js';
const API_BASE = '/api/ynab';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function installFetch(routes, {
  mapping = null,
  selectedBudgets = null,
  authenticated = true,
  password = 'shared-password',
} = {}) {
  let storedMapping = mapping;
  let storedSelectedBudgets = selectedBudgets;
  let signedIn = authenticated;
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/status') {
      return jsonResponse({ authenticated: signedIn, passwordConfigured: true });
    }
    if (url === '/api/auth/login') {
      if (JSON.parse(options.body).password !== password) {
        return jsonResponse({ error: { detail: 'Incorrect password.' } }, { ok: false, status: 401 });
      }
      signedIn = true;
      return jsonResponse({ authenticated: true });
    }
    if (url === '/api/auth/logout') {
      signedIn = false;
      return jsonResponse({ authenticated: false });
    }
    if (url.startsWith('/api/mappings?')) {
      return jsonResponse({ mapping: storedMapping });
    }
    if (url === '/api/mappings' && options.method === 'PUT') {
      storedMapping = JSON.parse(options.body).mapping;
      return jsonResponse({ mapping: storedMapping });
    }
    if (url === '/api/selected-budgets') {
      if (options.method === 'PUT') {
        storedSelectedBudgets = JSON.parse(options.body).selectedBudgets;
      }
      return jsonResponse({ selectedBudgets: storedSelectedBudgets });
    }
    if (!routes[url]) {
      throw new Error(`Unexpected URL: ${url}`);
    }

    return typeof routes[url]?.json === 'function' ? routes[url] : jsonResponse(routes[url]);
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
    clear() {
      values.clear();
    },
  };
}

function installStorage() {
  const storage = createStorageStub();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

function installHappyPathFetch(options) {
  installFetch({
    [`${API_BASE}/plans`]: PLANS_RESPONSE,
    [`${API_BASE}/plans/plan-a/months`]: PLAN_A_MONTHS_RESPONSE,
    [`${API_BASE}/plans/plan-b/months`]: PLAN_B_MONTHS_RESPONSE,
    [`${API_BASE}/plans/plan-a/months/2026-06-01`]: PLAN_A_JUNE_MONTH_RESPONSE,
    [`${API_BASE}/plans/plan-b/months/2026-06-01`]: PLAN_B_JUNE_MONTH_RESPONSE,
    [`${API_BASE}/plans/plan-a/months/2026-05-01`]: PLAN_A_MAY_MONTH_RESPONSE,
    [`${API_BASE}/plans/plan-b/months/2026-05-01`]: PLAN_B_MAY_MONTH_RESPONSE,
  }, options);
}


async function connectAndLoadMonth() {
  render(<App />);

  expect(await screen.findByLabelText('Your plan')).toHaveValue('plan-a');
  expect(screen.getByLabelText('Partner plan')).toHaveValue('plan-b');
  expect(await screen.findByRole('button', { name: 'Choose month, June 2026' })).toBeInTheDocument();
  expect(await screen.findByText('Unmapped source categories')).toBeInTheDocument();
}

beforeEach(() => {
  vi.restoreAllMocks();
  installStorage();
  document.documentElement.removeAttribute('data-theme');
});

describe('Together Budget app', () => {
  test('switches between system, light, and dark themes and saves the choice in this browser', async () => {
    installHappyPathFetch();
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

  test('requires the shared password before loading budget data', async () => {
    installHappyPathFetch({ authenticated: false });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Enter shared password' })).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalledWith(`${API_BASE}/plans`, expect.anything());

    await user.type(screen.getByLabelText('Application password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Application password'), 'shared-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByLabelText('Your plan')).toHaveValue('plan-a');
  });

  test('restores the chosen month from localStorage for the shared selected budgets', async () => {
    localStorage.setItem('ynabTogether.selectedMonth.v1.plan-a__plan-b', '2026-05-01');
    installHappyPathFetch({
      selectedBudgets: {
        leftPlanId: 'plan-a',
        rightPlanId: 'plan-b',
      },
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Choose month, May 2026' })).toBeInTheDocument();
    expect(await screen.findByText('Unmapped source categories')).toBeInTheDocument();
  });

  test('shares the selected budgets but keeps their chosen month local', async () => {
    installHappyPathFetch();

    await connectAndLoadMonth();

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/selected-budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedBudgets: {
          leftPlanId: 'plan-a',
          rightPlanId: 'plan-b',
        },
      }),
    });
    expect(localStorage.getItem('ynabTogether.selectedMonth.v1.plan-a__plan-b'))
      .toBe('2026-06-01');
  });

  test('creates a Groceries mapping and renders combined budget totals from mocked endpoints', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await user.click(screen.getByRole('button', { name: 'Map categories' }));

    await user.type(screen.getByLabelText('Group name'), 'Living Expenses');
    await user.type(screen.getByLabelText('Unified category name'), 'Groceries');
    await user.click(screen.getByLabelText('Alex Plan › Everyday › Groceries'));
    await user.click(screen.getByLabelText('Blair Plan › Daily Life › Food'));
    await user.click(screen.getByRole('button', { name: 'Add unified category' }));
    await user.click(screen.getByRole('button', { name: 'Budget' }));

    const row = screen.getByRole('row', { name: /Groceries/ });
    expect(within(row).getByText('$950.00')).toBeInTheDocument();
    expect(within(row).getByText('-$323.45')).toBeInTheDocument();
    expect(within(row).getByText('$626.55')).toBeInTheDocument();
  });

  test('lists unmapped Dining Out separately and excludes it from mapped totals', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });

    await connectAndLoadMonth();

    const totalsRow = screen.getByRole('row', { name: /Totals/ });
    expect(within(totalsRow).getByText('$950.00')).toBeInTheDocument();
    expect(screen.getAllByText('Dining Out').length).toBeGreaterThan(0);
    expect(screen.getByText(/excluded until mapped/i)).toBeInTheDocument();
  });

  test('renders a friendly access-token error for 401 YNAB envelopes', async () => {
    installFetch({
      [`${API_BASE}/plans`]: jsonResponse({
      error: {
        id: '401',
        name: 'unauthorized',
        detail: 'No access.',
      },
      }, { ok: false, status: 401 }),
    });
    render(<App />);

    expect(await screen.findByText(
      'YNAB rejected the server access token. Check YNAB_ACCESS_TOKEN and try again.',
    )).toBeInTheDocument();
  });

  test('reloads a saved mapping for the same selected plan pair', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });

    await connectAndLoadMonth();

    const row = screen.getByRole('row', { name: /Groceries/ });
    expect(within(row).getByText('$950.00')).toBeInTheDocument();
    expect(within(row).getByText('-$323.45')).toBeInTheDocument();
    expect(within(row).getByText('$626.55')).toBeInTheDocument();
  });

  test('expands a shared category into per-plan assigned, activity, and available amounts', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();

    await user.click(screen.getByRole('button', { name: 'Show plan breakdown for Groceries' }));

    const breakdown = screen.getByRole('region', { name: 'Plan breakdown for Groceries' });
    expect(within(breakdown).getByText('Alex Plan')).toBeInTheDocument();
    expect(within(breakdown).getByText('$450.00')).toHaveAttribute('data-label', 'Assigned');
    expect(within(breakdown).getByText('-$123.45')).toHaveAttribute('data-label', 'Activity');
    expect(within(breakdown).getByText('Blair Plan')).toBeInTheDocument();
    expect(within(breakdown).getByText('$500.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('-$200.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('$326.55').parentElement).toHaveAttribute('data-label', 'Available');
    expect(within(breakdown).getByText('$300.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide plan breakdown for Groceries' })).toHaveAttribute('aria-expanded', 'true');
  });

  test('filters shared categories without changing the combined summary', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();

    await user.click(screen.getByRole('button', { name: 'Underfunded' }));
    expect(screen.getByText('No categories match this filter')).toBeInTheDocument();
    expect(screen.getByText('Combined Available')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByRole('row', { name: /Groceries/ })).toBeInTheDocument();
  });

  test('chooses a month from the header and loads it automatically', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth();

    expect(screen.queryByLabelText('Month')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load month' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choose month, June 2026' }));
    expect(screen.getByRole('dialog', { name: 'Choose budget month' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'May 2026' }));

    expect(await screen.findByRole('button', { name: 'Choose month, May 2026' })).toBeInTheDocument();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API_BASE}/plans/plan-a/months/2026-05-01`,
        expect.objectContaining({ method: 'GET' }),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API_BASE}/plans/plan-b/months/2026-05-01`,
        expect.objectContaining({ method: 'GET' }),
      );
    });
    expect(localStorage.getItem('ynabTogether.selectedMonth.v1.plan-a__plan-b'))
      .toBe('2026-05-01');
  });

  test('signs out and returns to the password gate', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Enter shared password' })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  test('opens category mapping as a separate view and returns to the budget', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await user.click(screen.getByRole('button', { name: 'Map categories' }));

    expect(screen.getByRole('heading', { name: 'Map categories' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Category' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Your plan')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Budget' }));
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your plan')).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  expect(await screen.findByRole('button', { name: 'Choose month, June 2026' })).toBeInTheDocument();
  expect(await screen.findByText('Unmapped source categories')).toBeInTheDocument();
}

async function openSettings(user) {
  await user.click(screen.getByRole('button', { name: 'More options' }));
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
}

async function openMapping(user) {
  await openSettings(user);
  await user.click(screen.getByRole('button', { name: 'Map categories' }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  installStorage();
  document.documentElement.removeAttribute('data-theme');
});

describe('WNAB app', () => {
  test('renders the WNAB brand name', async () => {
    installHappyPathFetch();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'WNAB' })).toBeInTheDocument();
  });

  test('switches between system, light, and dark themes and saves the choice in this browser', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: 'Choose month, June 2026' });
    await user.click(screen.getByRole('button', { name: 'More options' }));
    const themePicker = screen.getByLabelText('Theme');
    expect(themePicker).toHaveValue('system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');

    await user.selectOptions(themePicker, 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('wnab.theme.v1')).toBe('dark');

    await user.selectOptions(themePicker, 'light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.selectOptions(themePicker, 'system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  test('keeps progress bars hidden by default and persists the local display preference', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();
    expect(screen.queryByRole('progressbar', { name: /^Groceries:/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More options' }));
    const toggle = screen.getByRole('checkbox', { name: 'Show progress bars' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    expect(localStorage.getItem('wnab.showProgressBars.v1')).toBe('true');
    expect(screen.getByRole('progressbar', { name: /^Groceries:/ })).toBeInTheDocument();
  });

  test('restores saved progress-bar visibility from this browser only', async () => {
    localStorage.setItem('wnab.showProgressBars.v1', 'true');
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });

    await connectAndLoadMonth();
    expect(screen.getByRole('progressbar', { name: /^Groceries:/ })).toBeInTheDocument();
  });

  test('opens and closes the options menu with escape and outside interaction', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: 'Choose month, June 2026' });
    const trigger = screen.getByRole('button', { name: 'More options' });
    await user.click(trigger);
    expect(screen.getByRole('region', { name: 'More options' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'More options' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region', { name: 'More options' })).not.toBeInTheDocument();
  });

  test('renders one green combined-budget bar with spent and available portions', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('checkbox', { name: 'Show progress bars' }));

    const progress = screen.getByRole('progressbar', {
      name: 'Groceries: Spent $323.45 of $950.00. $323.45 spent and $626.55 available.',
    });
    expect(progress).toHaveAttribute('aria-valuemax', '950000');
    expect(progress).toHaveAttribute('aria-valuenow', '323450');
    const segments = progress.querySelectorAll('.category-progress-segment');
    expect(segments).toHaveLength(2);
    expect(Number.parseFloat(segments[0].style.width)).toBeCloseTo((323450 / 950000) * 100, 3);
    expect(Number.parseFloat(segments[1].style.width)).toBeCloseTo((626550 / 950000) * 100, 3);
    expect(segments[0]).toHaveClass('category-progress-segment-spent');
    expect(segments[1]).toHaveClass('category-progress-segment-available');
    expect(screen.getByText('Spent $323.45 of $950.00')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Progress bar legend' })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: 'Choose month, June 2026' })).toBeInTheDocument();
  });

  test('restores the chosen month from localStorage for the shared selected budgets', async () => {
    localStorage.setItem('wnab.selectedMonth.v1.plan-a__plan-b', '2026-05-01');
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
    expect(localStorage.getItem('wnab.selectedMonth.v1.plan-a__plan-b'))
      .toBe('2026-06-01');
  });

  test('keeps plan selection and category mapping in Settings and removes refresh from the budget', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth();
    expect(screen.queryByLabelText('Your plan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Map categories' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh connection' })).not.toBeInTheDocument();

    await openSettings(user);
    expect(screen.getByLabelText('Your plan')).toHaveValue('plan-a');
    expect(screen.getByLabelText('Partner plan')).toHaveValue('plan-b');
    expect(screen.getByRole('button', { name: 'Map categories' })).toBeInTheDocument();
  });

  test('creates a Groceries mapping and renders combined budget totals from mocked endpoints', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await openMapping(user);

    await user.type(screen.getByLabelText('Group name'), 'Living Expenses');
    await user.type(screen.getByLabelText('Unified category name'), 'Groceries');
    await user.click(screen.getByLabelText('Alex Plan › Everyday › Groceries'));
    await user.click(screen.getByLabelText('Blair Plan › Daily Life › Food'));
    await user.click(screen.getByRole('button', { name: 'Add unified category' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Budget' }));

    const row = screen.getByRole('row', { name: /Groceries/ });
    expect(within(row).getByText('$950.00')).toBeInTheDocument();
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

  test('keeps the main summary combined and excludes activity and per-plan totals', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });

    await connectAndLoadMonth();

    expect(screen.getByText('Combined Available')).toBeInTheDocument();
    expect(screen.queryByText('Assigned by plan')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Activity' })).not.toBeInTheDocument();
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
    expect(within(row).getByText('$626.55')).toBeInTheDocument();
  });

  test('expands a shared category into per-plan assigned and available amounts', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();

    await user.click(screen.getByRole('button', { name: 'Show plan breakdown for Groceries' }));

    const breakdown = screen.getByRole('region', { name: 'Plan breakdown for Groceries' });
    expect(within(breakdown).getByText('Alex Plan')).toBeInTheDocument();
    expect(within(breakdown).getByText('$450.00')).toHaveAttribute('data-label', 'Assigned');
    expect(within(breakdown).getByText('Blair Plan')).toBeInTheDocument();
    expect(within(breakdown).getByText('$500.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('$326.55').parentElement).toHaveAttribute('data-label', 'Available');
    expect(within(breakdown).getByText('$300.00')).toBeInTheDocument();
    expect(within(breakdown).queryByText('-$123.45')).not.toBeInTheDocument();
    expect(within(breakdown).queryByText('-$200.00')).not.toBeInTheDocument();
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
    expect(localStorage.getItem('wnab.selectedMonth.v1.plan-a__plan-b'))
      .toBe('2026-05-01');
  });

  test('signs out and returns to the password gate', async () => {
    installHappyPathFetch();
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Enter shared password' })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  test('opens category mapping as a separate view and returns to the budget', async () => {
    installHappyPathFetch({ mapping: GROCERIES_MAPPING });
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await openMapping(user);

    expect(screen.getByRole('heading', { name: 'Map categories' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Category' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Your plan')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your plan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Budget' }));
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your plan')).not.toBeInTheDocument();
  });

  test('reorders top-level mapped categories with the keyboard and persists the order', async () => {
    const mapping = {
      ...GROCERIES_MAPPING,
      unifiedCategories: [
        ...GROCERIES_MAPPING.unifiedCategories,
        {
          id: 'unified-dining-out',
          groupName: 'Living Expenses',
          name: 'Dining Out',
          sourceIds: ['plan-a:cat-a-dining', 'plan-b:cat-b-dining'],
        },
      ],
    };
    installHappyPathFetch({ mapping });
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await openMapping(user);
    const groceriesHandle = screen.getByRole('button', {
      name: 'Reorder Living Expenses / Groceries. Drag or use arrow keys.',
    });
    groceriesHandle.focus();
    await user.keyboard('{ArrowDown}');

    const reorderHandles = screen.getAllByRole('button', { name: /^Reorder / });
    expect(reorderHandles[0]).toHaveAccessibleName(
      'Reorder Living Expenses / Dining Out. Drag or use arrow keys.',
    );
    expect(reorderHandles[1]).toHaveAccessibleName(
      'Reorder Living Expenses / Groceries. Drag or use arrow keys.',
    );
    expect(await screen.findByText('Living Expenses / Groceries moved to position 2 of 2.'))
      .toBeInTheDocument();

    await waitFor(() => {
      const saveCall = globalThis.fetch.mock.calls.findLast(
        ([url, options]) => url === '/api/mappings' && options?.method === 'PUT',
      );
      expect(JSON.parse(saveCall[1].body).mapping.unifiedCategories.map((category) => category.id))
        .toEqual(['unified-dining-out', 'unified-groceries']);
    });
  });

  test('drags a top-level mapped category to a new position', async () => {
    const mapping = {
      ...GROCERIES_MAPPING,
      unifiedCategories: [
        ...GROCERIES_MAPPING.unifiedCategories,
        {
          id: 'unified-dining-out',
          groupName: 'Living Expenses',
          name: 'Dining Out',
          sourceIds: ['plan-a:cat-a-dining', 'plan-b:cat-b-dining'],
        },
      ],
    };
    installHappyPathFetch({ mapping });
    const user = userEvent.setup();

    await connectAndLoadMonth();
    await openMapping(user);
    const groceriesHandle = screen.getByRole('button', {
      name: 'Reorder Living Expenses / Groceries. Drag or use arrow keys.',
    });
    const diningCard = screen.getByRole('button', {
      name: 'Reorder Living Expenses / Dining Out. Drag or use arrow keys.',
    }).closest('article');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => diningCard),
    });
    vi.spyOn(diningCard, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      height: 100,
    });

    fireEvent.pointerDown(groceriesHandle, {
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.pointerMove(groceriesHandle, { pointerId: 1, clientX: 20, clientY: 180 });
    fireEvent.pointerUp(groceriesHandle, { pointerId: 1 });

    const reorderHandles = screen.getAllByRole('button', { name: /^Reorder / });
    expect(reorderHandles[0]).toHaveAccessibleName(
      'Reorder Living Expenses / Dining Out. Drag or use arrow keys.',
    );
    expect(reorderHandles[1]).toHaveAccessibleName(
      'Reorder Living Expenses / Groceries. Drag or use arrow keys.',
    );
  });
});

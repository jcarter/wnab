import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { UnifiedBudgetTable } from './UnifiedBudgetTable.jsx';
import { USD_FORMAT } from '../test/fixtures/ynabResponses.js';

const OVESPENT_AGGREGATE = {
  rows: [{
    id: 'shared-dining',
    groupName: 'Everyday',
    name: 'Dining',
    budgeted: 100000,
    activity: -160000,
    available: -60000,
    missingSourceIds: [],
    sources: [
      {
        planId: 'plan-a',
        planName: 'Alex Plan',
        categoryName: 'Dining',
        budgeted: 50000,
        activity: -100000,
        available: -50000,
      },
      {
        planId: 'plan-b',
        planName: 'Blair Plan',
        categoryName: 'Meals',
        budgeted: 50000,
        activity: -60000,
        available: -10000,
      },
    ],
  }],
  unmappedSources: [],
  totals: { budgeted: 100000, activity: -160000, available: -60000 },
  planTotals: [
    { planId: 'plan-a', planName: 'Alex Plan', budgeted: 50000, activity: -100000, available: -50000 },
    { planId: 'plan-b', planName: 'Blair Plan', budgeted: 50000, activity: -60000, available: -10000 },
  ],
};

describe('UnifiedBudgetTable progress bars', () => {
  test('uses one combined bar and a clear overspending state', () => {
    render(
      <UnifiedBudgetTable
        aggregate={OVESPENT_AGGREGATE}
        currencyFormat={USD_FORMAT}
        selectedMonth="2026-06-01"
        onOpenMapping={vi.fn()}
        showProgressBars
      />,
    );

    const progress = screen.getByRole('progressbar', {
      name: 'Dining: Overspent by $60.00. $160.00 spent and -$60.00 available.',
    });
    expect(progress).toHaveAttribute('aria-valuemax', '160000');
    expect(progress).toHaveAttribute('aria-valuenow', '160000');
    const segments = progress.querySelectorAll('.category-progress-segment');
    expect(segments).toHaveLength(2);
    expect(Number.parseFloat(segments[0].style.width)).toBeCloseTo(100, 3);
    expect(Number.parseFloat(segments[1].style.width)).toBe(0);
    expect(segments[0]).toHaveClass('category-progress-segment-spent');
    expect(segments[1]).toHaveClass('category-progress-segment-available');
    expect(screen.getByText('Overspent by $60.00')).toBeInTheDocument();
  });

  test('uses the available portion for a funded category with no spending', () => {
    const availableOnlyAggregate = {
      ...OVESPENT_AGGREGATE,
      rows: OVESPENT_AGGREGATE.rows.map((row) => ({
        ...row,
        budgeted: 0,
        activity: 0,
        available: 150000,
        sources: row.sources.map((source, index) => ({
          ...source,
          budgeted: 0,
          activity: 0,
          available: index === 0 ? 100000 : 50000,
        })),
      })),
      totals: { budgeted: 0, activity: 0, available: 150000 },
      planTotals: OVESPENT_AGGREGATE.planTotals.map((plan, index) => ({
        ...plan,
        budgeted: 0,
        activity: 0,
        available: index === 0 ? 100000 : 50000,
      })),
    };
    render(
      <UnifiedBudgetTable
        aggregate={availableOnlyAggregate}
        currencyFormat={USD_FORMAT}
        selectedMonth="2026-06-01"
        onOpenMapping={vi.fn()}
        showProgressBars
      />,
    );

    const progress = screen.getByRole('progressbar', {
      name: 'Dining: Funded. $0.00 spent and $150.00 available.',
    });
    expect(progress).toHaveAttribute('aria-valuemax', '150000');
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    const segments = progress.querySelectorAll('.category-progress-segment');
    expect(segments).toHaveLength(2);
    expect(Number.parseFloat(segments[0].style.width)).toBe(0);
    expect(Number.parseFloat(segments[1].style.width)).toBeCloseTo(100, 3);
    expect(screen.getByText('Funded')).toBeInTheDocument();
  });

  test('uses a fully spent description when nothing remains available', () => {
    const fullySpentAggregate = {
      ...OVESPENT_AGGREGATE,
      rows: OVESPENT_AGGREGATE.rows.map((row) => ({
        ...row,
        budgeted: 160000,
        available: 0,
        sources: row.sources.map((source) => ({ ...source, available: 0 })),
      })),
      totals: { budgeted: 160000, activity: -160000, available: 0 },
    };
    render(
      <UnifiedBudgetTable
        aggregate={fullySpentAggregate}
        currencyFormat={USD_FORMAT}
        selectedMonth="2026-06-01"
        onOpenMapping={vi.fn()}
        showProgressBars
      />,
    );

    expect(screen.getByRole('progressbar', {
      name: 'Dining: Fully Spent. $160.00 spent and $0.00 available.',
    })).toBeInTheDocument();
    expect(screen.getByText('Fully Spent')).toBeInTheDocument();
  });

  test('describes an empty category without an invalid zero-range progressbar', () => {
    const emptyAggregate = {
      ...OVESPENT_AGGREGATE,
      rows: OVESPENT_AGGREGATE.rows.map((row) => ({
        ...row,
        budgeted: 0,
        activity: 0,
        available: 0,
        sources: row.sources.map((source) => ({
          ...source,
          budgeted: 0,
          activity: 0,
          available: 0,
        })),
      })),
      totals: { budgeted: 0, activity: 0, available: 0 },
      planTotals: OVESPENT_AGGREGATE.planTotals.map((plan) => ({
        ...plan,
        budgeted: 0,
        activity: 0,
        available: 0,
      })),
    };
    render(
      <UnifiedBudgetTable
        aggregate={emptyAggregate}
        currencyFormat={USD_FORMAT}
        selectedMonth="2026-06-01"
        onOpenMapping={vi.fn()}
        showProgressBars
      />,
    );

    const emptyProgress = screen.getByRole('img', {
      name: 'Dining: No spending or available amount.',
    });
    expect(emptyProgress).not.toHaveAttribute('aria-valuemax');
    expect(emptyProgress).not.toHaveAttribute('aria-valuenow');
  });
});

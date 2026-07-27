import { describe, expect, test } from 'vitest';
import {
  FAKE_PLANS,
  GROCERIES_EXPECTED_AGGREGATE,
  GROCERIES_MAPPING,
  PLAN_A_JUNE_MONTH,
  PLAN_A_MONTHS_RESPONSE,
  PLAN_B_JUNE_MONTH,
  PLAN_B_MONTHS_RESPONSE,
  USD_FORMAT,
} from '../test/fixtures/ynabResponses.js';
import { formatMilliunits, milliunitsToDecimal } from './formatMoney.js';
import {
  aggregateMappedCategories,
  getPlanCurrency,
  getSelectableMonths,
  getSourceCategories,
  makeSourceCategory,
  validateCompatibleCurrencies,
} from './aggregation.js';

const [alexPlan, blairPlan] = FAKE_PLANS;

function allSourceCategories() {
  return [
    ...getSourceCategories(alexPlan, PLAN_A_JUNE_MONTH),
    ...getSourceCategories(blairPlan, PLAN_B_JUNE_MONTH),
  ];
}

describe('money formatting', () => {
  test('converts milliunits and formats with currency metadata', () => {
    expect(milliunitsToDecimal(123450)).toBe(123.45);
    expect(formatMilliunits(626550, USD_FORMAT)).toBe('$626.55');
    expect(formatMilliunits(1234, null)).toBe('1.23');
  });
});

describe('aggregation domain logic', () => {
  test('intersects non-deleted months sorted newest first', () => {
    expect(getSelectableMonths(PLAN_A_MONTHS_RESPONSE.data.months, PLAN_B_MONTHS_RESPONSE.data.months)).toEqual([
      '2026-06-01',
      '2026-05-01',
    ]);
  });

  test('validates plan currencies without conversion', () => {
    expect(getPlanCurrency(alexPlan)).toBe('USD');
    expect(validateCompatibleCurrencies(alexPlan, blairPlan)).toEqual({ ok: true, currencyFormat: USD_FORMAT });
    expect(validateCompatibleCurrencies(alexPlan, { ...blairPlan, currency_format: { ...USD_FORMAT, iso_code: 'EUR' } })).toEqual({
      ok: false,
      message: 'Selected plans use different currencies and cannot be combined.',
    });
    expect(validateCompatibleCurrencies(alexPlan, { ...blairPlan, currency_format: null })).toEqual({ ok: true, currencyFormat: USD_FORMAT });
  });

  test('builds source categories and excludes deleted and internal categories while preserving hidden categories', () => {
    const sources = getSourceCategories(alexPlan, PLAN_A_JUNE_MONTH);

    expect(sources.map((source) => source.sourceId)).toEqual([
      'plan-a:cat-a-groceries',
      'plan-a:cat-a-rent',
      'plan-a:cat-a-dining',
      'plan-a:cat-a-hidden',
    ]);
    expect(sources.find((source) => source.sourceId === 'plan-a:cat-a-hidden')).toMatchObject({ hidden: true });
    expect(sources.some((source) => source.sourceId === 'plan-a:cat-a-deleted')).toBe(false);
    expect(sources.some((source) => source.sourceId === 'plan-a:cat-a-internal')).toBe(false);
  });

  test('makeSourceCategory creates the exact source shape with signed spent', () => {
    const source = makeSourceCategory(alexPlan, PLAN_A_JUNE_MONTH.categories[0]);

    expect(source).toEqual({
      sourceId: 'plan-a:cat-a-groceries',
      planId: 'plan-a',
      planName: 'Alex Plan',
      categoryId: 'cat-a-groceries',
      categoryName: 'Groceries',
      categoryGroupName: 'Everyday',
      hidden: false,
      budgeted: 450000,
      activity: -123450,
      spent: 123450,
      available: 326550,
    });
  });

  test('aggregates mapped Groceries and excludes unmapped Dining Out from mapped totals', () => {
    const result = aggregateMappedCategories(allSourceCategories(), GROCERIES_MAPPING);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: 'unified-groceries',
      groupName: 'Living Expenses',
      name: 'Groceries',
      sourceIds: ['plan-a:cat-a-groceries', 'plan-b:cat-b-food'],
      missingSourceIds: [],
      ...GROCERIES_EXPECTED_AGGREGATE,
    });
    expect(result.totals).toEqual(GROCERIES_EXPECTED_AGGREGATE);
    expect(result.planTotals).toEqual([
      {
        planId: 'plan-a',
        planName: 'Alex Plan',
        budgeted: 450000,
        activity: -123450,
        spent: 123450,
        available: 326550,
      },
      {
        planId: 'plan-b',
        planName: 'Blair Plan',
        budgeted: 500000,
        activity: -200000,
        spent: 200000,
        available: 300000,
      },
    ]);
    expect(result.unmappedSources.map((source) => source.sourceId)).toContain('plan-a:cat-a-dining');
    expect(result.unmappedSources.map((source) => source.sourceId)).not.toContain('plan-a:cat-a-deleted');
  });

  test('records missing mapped sources with zero contribution', () => {
    const mapping = {
      ...GROCERIES_MAPPING,
      unifiedCategories: [
        {
          ...GROCERIES_MAPPING.unifiedCategories[0],
          sourceIds: ['plan-a:cat-a-groceries', 'plan-b:missing-category'],
        },
      ],
    };

    const result = aggregateMappedCategories(allSourceCategories(), mapping);

    expect(result.rows[0]).toMatchObject({
      missingSourceIds: ['plan-b:missing-category'],
      budgeted: 450000,
      activity: -123450,
      spent: 123450,
      available: 326550,
    });
  });

  test('uses each source in at most one row and ignores duplicate later assignments', () => {
    const mapping = {
      version: 1,
      planIds: ['plan-a', 'plan-b'],
      unifiedCategories: [
        { id: 'first', groupName: 'One', name: 'First', sourceIds: ['plan-a:cat-a-groceries'] },
        { id: 'second', groupName: 'Two', name: 'Second', sourceIds: ['plan-a:cat-a-groceries', 'plan-b:cat-b-food'] },
      ],
    };

    const result = aggregateMappedCategories(allSourceCategories(), mapping);

    expect(result.rows[0]).toMatchObject({ budgeted: 450000, sourceIds: ['plan-a:cat-a-groceries'] });
    expect(result.rows[1]).toMatchObject({ budgeted: 500000, sourceIds: ['plan-a:cat-a-groceries', 'plan-b:cat-b-food'] });
    expect(result.rows[1].sources.map((source) => source.sourceId)).toEqual(['plan-b:cat-b-food']);
    expect(result.rows[1].missingSourceIds).toEqual([]);
    expect(result.totals.budgeted).toBe(950000);
  });

  test('positive activity becomes negative spent for net inflow categories', () => {
    const refundSource = makeSourceCategory(alexPlan, {
      id: 'cat-a-refund',
      category_group_name: 'Everyday',
      name: 'Refunds',
      budgeted: 0,
      activity: 12500,
      balance: 12500,
      hidden: false,
      internal: false,
      deleted: false,
    });

    expect(refundSource.spent).toBe(-12500);
    expect(aggregateMappedCategories([refundSource], {
      version: 1,
      planIds: ['plan-a'],
      unifiedCategories: [{ id: 'refunds', groupName: 'Everyday', name: 'Refunds', sourceIds: [refundSource.sourceId] }],
    }).totals.spent).toBe(-12500);
  });
});

export const USD_FORMAT = {
  iso_code: 'USD',
  example_format: '$123,456.78',
  decimal_digits: 2,
  decimal_separator: '.',
  symbol_first: true,
  group_separator: ',',
  currency_symbol: '$',
  display_symbol: true,
};

export const FAKE_PLANS = [
  {
    id: 'plan-a',
    name: 'Alex Plan',
    currency_format: USD_FORMAT,
  },
  {
    id: 'plan-b',
    name: 'Blair Plan',
    currency_format: USD_FORMAT,
  },
];

export const PLANS_RESPONSE = {
  data: {
    plans: FAKE_PLANS,
    default_plan: FAKE_PLANS[0],
  },
};

export const SHARED_MONTHS = [
  { month: '2026-06-01', deleted: false },
  { month: '2026-05-01', deleted: false },
];

export const PLAN_A_MONTHS_RESPONSE = {
  data: {
    months: [
      ...SHARED_MONTHS,
      { month: '2026-04-01', deleted: true },
    ],
    server_knowledge: 101,
  },
};

export const PLAN_B_MONTHS_RESPONSE = {
  data: {
    months: [
      ...SHARED_MONTHS,
      { month: '2026-03-01', deleted: false },
    ],
    server_knowledge: 202,
  },
};

export const PLAN_A_JUNE_MONTH = {
  month: '2026-06-01',
  categories: [
    {
      id: 'cat-a-groceries',
      category_group_name: 'Everyday',
      name: 'Groceries',
      budgeted: 450000,
      activity: -123450,
      balance: 326550,
      hidden: false,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-a-rent',
      category_group_name: 'Bills',
      name: 'Rent',
      budgeted: 1200000,
      activity: -1200000,
      balance: 0,
      hidden: false,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-a-dining',
      category_group_name: 'Everyday',
      name: 'Dining Out',
      budgeted: 150000,
      activity: -37500,
      balance: 112500,
      hidden: false,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-a-hidden',
      category_group_name: 'Everyday',
      name: 'Pocket Cash',
      budgeted: 25000,
      activity: -5000,
      balance: 20000,
      hidden: true,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-a-deleted',
      category_group_name: 'Old Group',
      name: 'Old Category',
      budgeted: 999000,
      activity: -111000,
      balance: 888000,
      hidden: false,
      internal: false,
      deleted: true,
    },
    {
      id: 'cat-a-internal',
      category_group_name: 'Internal Master Category',
      name: 'Credit Card Payments',
      budgeted: 777000,
      activity: -222000,
      balance: 555000,
      hidden: false,
      internal: true,
      deleted: false,
    },
  ],
};

export const PLAN_B_JUNE_MONTH = {
  month: '2026-06-01',
  categories: [
    {
      id: 'cat-b-food',
      category_group_name: 'Daily Life',
      name: 'Food',
      budgeted: 500000,
      activity: -200000,
      balance: 300000,
      hidden: false,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-b-rent',
      category_group_name: 'Housing',
      name: 'Apartment',
      budgeted: 1000000,
      activity: -1000000,
      balance: 0,
      hidden: false,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-b-hidden',
      category_group_name: 'Daily Life',
      name: 'Travel Snacks',
      budgeted: 30000,
      activity: -10000,
      balance: 20000,
      hidden: true,
      internal: false,
      deleted: false,
    },
    {
      id: 'cat-b-deleted',
      category_group_name: 'Old Group',
      name: 'Deleted Food',
      budgeted: 666000,
      activity: -333000,
      balance: 333000,
      hidden: false,
      internal: false,
      deleted: true,
    },
    {
      id: 'cat-b-internal',
      category_group_name: 'Internal Master Category',
      name: 'Internal Offset',
      budgeted: 444000,
      activity: -123000,
      balance: 321000,
      hidden: false,
      internal: true,
      deleted: false,
    },
  ],
};

export const PLAN_A_MAY_MONTH = {
  month: '2026-05-01',
  categories: [],
};

export const PLAN_B_MAY_MONTH = {
  month: '2026-05-01',
  categories: [],
};

export const PLAN_A_JUNE_MONTH_RESPONSE = {
  data: {
    month: PLAN_A_JUNE_MONTH,
  },
};

export const PLAN_B_JUNE_MONTH_RESPONSE = {
  data: {
    month: PLAN_B_JUNE_MONTH,
  },
};

export const PLAN_A_MAY_MONTH_RESPONSE = {
  data: {
    month: PLAN_A_MAY_MONTH,
  },
};

export const PLAN_B_MAY_MONTH_RESPONSE = {
  data: {
    month: PLAN_B_MAY_MONTH,
  },
};

export const GROCERIES_MAPPING = {
  version: 1,
  planIds: ['plan-a', 'plan-b'],
  unifiedCategories: [
    {
      id: 'unified-groceries',
      groupName: 'Living Expenses',
      name: 'Groceries',
      sourceIds: ['plan-a:cat-a-groceries', 'plan-b:cat-b-food'],
    },
  ],
};

export const GROCERIES_EXPECTED_AGGREGATE = {
  budgeted: 950000,
  activity: -323450,
  spent: 323450,
  available: 626550,
};

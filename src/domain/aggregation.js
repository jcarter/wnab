export function getSelectableMonths(leftMonths, rightMonths) {
  const rightMonthSet = new Set(
    rightMonths
      .filter((month) => month.deleted !== true)
      .map((month) => month.month),
  );

  return leftMonths
    .filter((month) => month.deleted !== true && rightMonthSet.has(month.month))
    .map((month) => month.month)
    .sort((a, b) => b.localeCompare(a));
}

export function getPlanCurrency(planSummary) {
  return planSummary.currency_format?.iso_code ?? null;
}

export function validateCompatibleCurrencies(leftPlan, rightPlan) {
  const leftCurrency = getPlanCurrency(leftPlan);
  const rightCurrency = getPlanCurrency(rightPlan);

  if (leftCurrency && rightCurrency && leftCurrency !== rightCurrency) {
    return {
      ok: false,
      message: 'Selected plans use different currencies and cannot be combined.',
    };
  }

  return {
    ok: true,
    currencyFormat: leftPlan.currency_format ?? rightPlan.currency_format ?? null,
  };
}

export function makeSourceCategory(plan, category) {
  return {
    sourceId: `${plan.id}:${category.id}`,
    planId: plan.id,
    planName: plan.name,
    categoryId: category.id,
    categoryName: category.name,
    categoryGroupName: category.category_group_name,
    hidden: category.hidden,
    budgeted: category.budgeted,
    activity: category.activity,
    spent: -category.activity,
    available: category.balance,
  };
}

export function getSourceCategories(plan, monthDetail) {
  return monthDetail.categories
    .filter((category) => category.deleted !== true && category.internal !== true)
    .map((category) => makeSourceCategory(plan, category));
}

function emptySums() {
  return {
    budgeted: 0,
    activity: 0,
    spent: 0,
    available: 0,
  };
}

function addSourceToSums(sums, source) {
  sums.budgeted += source.budgeted;
  sums.activity += source.activity;
  sums.spent += source.spent;
  sums.available += source.available;
}

export function aggregateMappedCategories(sourceCategories, mapping) {
  const sourceById = new Map(sourceCategories.map((source) => [source.sourceId, source]));
  const assignedSourceIds = new Set();
  const totals = emptySums();

  const rows = mapping.unifiedCategories.map((unifiedCategory) => {
    const sums = emptySums();
    const sources = [];
    const missingSourceIds = [];

    for (const sourceId of unifiedCategory.sourceIds) {
      const source = sourceById.get(sourceId);

      if (!source) {
        missingSourceIds.push(sourceId);
        continue;
      }

      if (assignedSourceIds.has(sourceId)) {
        continue;
      }

      assignedSourceIds.add(sourceId);
      sources.push(source);
      addSourceToSums(sums, source);
      addSourceToSums(totals, source);
    }

    return {
      id: unifiedCategory.id,
      groupName: unifiedCategory.groupName,
      name: unifiedCategory.name,
      sourceIds: unifiedCategory.sourceIds,
      sources,
      missingSourceIds,
      budgeted: sums.budgeted,
      activity: sums.activity,
      spent: sums.spent,
      available: sums.available,
    };
  });

  const unmappedSources = sourceCategories.filter((source) => !assignedSourceIds.has(source.sourceId));

  return {
    rows,
    unmappedSources,
    totals,
  };
}

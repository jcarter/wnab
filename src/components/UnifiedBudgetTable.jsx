import { Fragment, useState } from 'react';
import { formatMilliunits } from '../domain/formatMoney.js';

function groupedRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.groupName)) groups.set(row.groupName, []);
    groups.get(row.groupName).push(row);
  }
  return [...groups.entries()];
}

function sumRows(rows) {
  return rows.reduce(
    (total, row) => ({
      budgeted: total.budgeted + row.budgeted,
      activity: total.activity + row.activity,
      available: total.available + row.available,
    }),
    { budgeted: 0, activity: 0, available: 0 },
  );
}

function groupSourcesByPlan(sources) {
  const plans = new Map();

  for (const source of sources) {
    if (!plans.has(source.planId)) {
      plans.set(source.planId, {
        planId: source.planId,
        planName: source.planName,
        categoryNames: [],
        budgeted: 0,
        activity: 0,
        available: 0,
      });
    }

    const plan = plans.get(source.planId);
    plan.categoryNames.push(source.categoryName);
    plan.budgeted += source.budgeted;
    plan.activity += source.activity;
    plan.available += source.available;
  }

  return [...plans.values()];
}

function monthName(month) {
  if (!month) return 'Month';
  return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(month));
}

function planShare(amount, total) {
  if (total === 0) return null;
  return (amount / total) * 100;
}

function formatPercentage(percentage) {
  if (percentage === null) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(percentage)}%`;
}

function AvailableAmount({ value, currencyFormat }) {
  return (
    <span className={`available-amount${value < 0 ? ' available-negative' : value > 0 ? ' available-positive' : ''}`}>
      {formatMilliunits(value, currencyFormat)}
    </span>
  );
}

export function UnifiedBudgetTable({ aggregate, currencyFormat, selectedMonth, onOpenMapping }) {
  const [expandedRowIds, setExpandedRowIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const mappedSourceCount = aggregate.rows.reduce((count, row) => count + row.sources.length, 0);
  const totalSourceCount = mappedSourceCount + aggregate.unmappedSources.length;
  const coverage = totalSourceCount === 0 ? 0 : Math.round((mappedSourceCount / totalSourceCount) * 100);
  const planContributions = aggregate.planTotals.map((plan) => {
    const percentage = planShare(plan.budgeted, aggregate.totals.budgeted);
    return {
      ...plan,
      percentage,
      percentageLabel: formatPercentage(percentage),
    };
  });
  const visibleRows = aggregate.rows.filter((row) => {
    if (activeFilter === 'underfunded') return row.available < 0;
    if (activeFilter === 'available') return row.available > 0;
    return true;
  });

  function toggleBreakdown(rowId) {
    setExpandedRowIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
    );
  }

  return (
    <section className="budget-card" aria-labelledby="budget-heading">
      <div className="budget-filterbar" aria-label="Budget filters">
        <button
          type="button"
          className={`filter-button${activeFilter === 'all' ? ' filter-button-active' : ''}`}
          aria-pressed={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`filter-button${activeFilter === 'underfunded' ? ' filter-button-active' : ''}`}
          aria-pressed={activeFilter === 'underfunded'}
          onClick={() => setActiveFilter('underfunded')}
        >
          Underfunded
        </button>
        <button
          type="button"
          className={`filter-button${activeFilter === 'available' ? ' filter-button-active' : ''}`}
          aria-pressed={activeFilter === 'available'}
          onClick={() => setActiveFilter('available')}
        >
          Money Available
        </button>
      </div>

      <div className="budget-layout">
        <div className="budget-main">
          <div className="budget-toolbar">
            <button type="button" className="mapping-link" onClick={onOpenMapping}>
              <span aria-hidden="true">⌘</span>
              Map categories
            </button>
            <div className="view-switch" aria-label="Budget view">
              <span aria-hidden="true">☷</span>
              <span className="view-switch-active" aria-hidden="true">≡</span>
            </div>
          </div>

          <div className="table-wrap">
            {visibleRows.length > 0 ? (
              <table className="budget-table">
                <thead>
                  <tr>
                    <th scope="col" id="budget-heading">Category</th>
                    <th scope="col" className="money">Assigned</th>
                    <th scope="col" className="money">Activity</th>
                    <th scope="col" className="money">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows(visibleRows).map(([groupName, rows]) => {
                    const groupTotals = sumRows(rows);
                    return (
                      <Fragment key={groupName}>
                        <tr className="group-row">
                          <th scope="rowgroup"><span className="row-chevron" aria-hidden="true">⌄</span>{groupName}</th>
                          <td className="money">{formatMilliunits(groupTotals.budgeted, currencyFormat)}</td>
                          <td className="money">{formatMilliunits(groupTotals.activity, currencyFormat)}</td>
                          <td className="money"><AvailableAmount value={groupTotals.available} currencyFormat={currencyFormat} /></td>
                        </tr>
                        {rows.map((row) => {
                          const planBreakdown = groupSourcesByPlan(row.sources);
                          const isExpanded = expandedRowIds.includes(row.id);
                          const breakdownId = `plan-breakdown-${row.id}`;

                          return (
                            <Fragment key={row.id}>
                              <tr className={`category-row${isExpanded ? ' category-row-expanded' : ''}`}>
                                <th scope="row" data-label="Category">
                                  <button
                                    type="button"
                                    className="category-toggle"
                                    aria-expanded={isExpanded}
                                    aria-controls={breakdownId}
                                    aria-label={`${isExpanded ? 'Hide' : 'Show'} plan breakdown for ${row.name}`}
                                    onClick={() => toggleBreakdown(row.id)}
                                  >
                                    <span className="row-chevron" aria-hidden="true">{isExpanded ? '⌄' : '›'}</span>
                                    <span>{row.name}</span>
                                    <small>{planBreakdown.length} {planBreakdown.length === 1 ? 'plan' : 'plans'}</small>
                                  </button>
                                </th>
                                <td className="money" data-label="Assigned">{formatMilliunits(row.budgeted, currencyFormat)}</td>
                                <td className="money" data-label="Activity">{formatMilliunits(row.activity, currencyFormat)}</td>
                                <td className="money" data-label="Available"><AvailableAmount value={row.available} currencyFormat={currencyFormat} /></td>
                              </tr>
                              {isExpanded ? (
                                <tr className="breakdown-row">
                                  <td colSpan="4">
                                    <section id={breakdownId} className="plan-breakdown" aria-label={`Plan breakdown for ${row.name}`}>
                                      {planBreakdown.map((plan, index) => (
                                        <div key={plan.planId} className="plan-breakdown-line">
                                          <span className={`plan-initial plan-initial-${index % 2}`} aria-hidden="true">
                                            {plan.planName.slice(0, 1).toUpperCase()}
                                          </span>
                                          <span className="plan-source">
                                            <strong>{plan.planName}</strong>
                                            <small>{plan.categoryNames.join(' + ')}</small>
                                          </span>
                                          <span className="money breakdown-assigned" data-label="Assigned">{formatMilliunits(plan.budgeted, currencyFormat)}</span>
                                          <span className="money breakdown-activity" data-label="Activity">{formatMilliunits(plan.activity, currencyFormat)}</span>
                                          <span className="money breakdown-available" data-label="Available"><AvailableAmount value={plan.available} currencyFormat={currencyFormat} /></span>
                                        </div>
                                      ))}
                                      {row.missingSourceIds.map((sourceId) => (
                                        <span key={sourceId} className="missing-source">Missing source / {sourceId}</span>
                                      ))}
                                    </section>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" data-label="Category">Totals</th>
                    <td className="money" data-label="Assigned">{formatMilliunits(aggregate.totals.budgeted, currencyFormat)}</td>
                    <td className="money" data-label="Activity">{formatMilliunits(aggregate.totals.activity, currencyFormat)}</td>
                    <td className="money" data-label="Available"><AvailableAmount value={aggregate.totals.available} currencyFormat={currencyFormat} /></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div className="budget-empty-state">
                <h3>{aggregate.rows.length === 0 ? 'No shared categories yet' : 'No categories match this filter'}</h3>
                <p>
                  {aggregate.rows.length === 0
                    ? 'Map matching categories below to start building your combined view.'
                    : 'Choose another filter to see your shared categories.'}
                </p>
                {aggregate.rows.length === 0 ? <button type="button" className="text-button" onClick={onOpenMapping}>Create a mapping</button> : null}
              </div>
            )}
          </div>
        </div>

        <aside className="summary-rail" aria-label={`${monthName(selectedMonth)} summary`}>
          <section className="summary-panel">
            <h2>{monthName(selectedMonth)}’s Summary <span aria-hidden="true">⌄</span></h2>
            <dl>
              <div><dt>Assigned</dt><dd>{formatMilliunits(aggregate.totals.budgeted, currencyFormat)}</dd></div>
              <div><dt>Activity</dt><dd>{formatMilliunits(aggregate.totals.activity, currencyFormat)}</dd></div>
              <div className="summary-total"><dt>Combined Available</dt><dd>{formatMilliunits(aggregate.totals.available, currencyFormat)}</dd></div>
            </dl>
            <section className="summary-contributions" aria-labelledby="plan-contributions-heading">
              <div className="summary-contributions-heading">
                <h3 id="plan-contributions-heading">Assigned by plan</h3>
                <span>Mapped total</span>
              </div>
              <ul>
                {planContributions.map((plan) => (
                  <li key={plan.planId}>
                    <div className="plan-contribution-line">
                      <strong>{plan.planName}</strong>
                      <span>
                        <span className="money">{formatMilliunits(plan.budgeted, currencyFormat)}</span>
                        <small>{plan.percentageLabel}</small>
                      </span>
                    </div>
                    <progress
                      aria-label={`${plan.planName} contributes ${plan.percentageLabel} of assigned total`}
                      max="100"
                      value={plan.percentage === null ? 0 : Math.min(100, Math.max(0, plan.percentage))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <section className="summary-panel coverage-panel">
            <div>
              <strong>{coverage}% mapped</strong>
              <span>{mappedSourceCount} of {totalSourceCount} source categories</span>
            </div>
            <button type="button" className="review-mapping-button" onClick={onOpenMapping}>Review mapping <span aria-hidden="true">›</span></button>
          </section>

          <section className="summary-panel unmapped-section" aria-labelledby="unmapped-heading">
            <div className="table-section-header">
              <div>
                <h3 id="unmapped-heading">Unmapped source categories</h3>
                <p>Excluded until mapped.</p>
              </div>
              <span>{aggregate.unmappedSources.length}</span>
            </div>
            {aggregate.unmappedSources.length > 0 ? (
              <ul className="unmapped-list">
                {aggregate.unmappedSources.map((source) => (
                  <li key={source.sourceId}>
                    <div className="unmapped-category-name">
                      <strong>{source.categoryName}</strong>
                      <span>{source.planName} / {source.categoryGroupName}</span>
                    </div>
                    <span className="money">{formatMilliunits(source.available, currencyFormat)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="all-mapped">Every source category is mapped.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

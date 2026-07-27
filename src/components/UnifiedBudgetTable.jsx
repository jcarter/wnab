import { Fragment, useState } from 'react';
import { formatMilliunits } from '../domain/formatMoney.js';

function groupedRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.groupName)) {
      groups.set(row.groupName, []);
    }
    groups.get(row.groupName).push(row);
  }
  return [...groups.entries()];
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
        spent: 0,
      });
    }

    const plan = plans.get(source.planId);
    plan.categoryNames.push(source.categoryName);
    plan.budgeted += source.budgeted;
    plan.spent += source.spent;
  }

  return [...plans.values()];
}

export function UnifiedBudgetTable({ aggregate, currencyFormat }) {
  const [expandedRowIds, setExpandedRowIds] = useState([]);
  const mappedSourceCount = aggregate.rows.reduce((count, row) => count + row.sources.length, 0);
  const totalSourceCount = mappedSourceCount + aggregate.unmappedSources.length;
  const coverage = totalSourceCount === 0 ? 0 : Math.round((mappedSourceCount / totalSourceCount) * 100);

  function toggleBreakdown(rowId) {
    setExpandedRowIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
    );
  }

  return (
    <section className="budget-card" aria-labelledby="budget-heading">
      <div className="budget-hero">
        <div>
          <h2 id="budget-heading">Combined budget</h2>
          <p>Only mapped categories are included in these totals.</p>
        </div>
        <a className="button button-secondary" href="#mapping-heading">Manage mappings</a>
      </div>

      <div className="metric-grid" aria-label="Combined budget summary">
        <article className="metric-card metric-card-primary">
          <span>Available</span>
          <strong className={aggregate.totals.available < 0 ? 'negative' : ''}>
            {formatMilliunits(aggregate.totals.available, currencyFormat)}
          </strong>
          <small>left across mapped categories</small>
        </article>
        <article className="metric-card">
          <span>Budgeted</span>
          <strong>{formatMilliunits(aggregate.totals.budgeted, currencyFormat)}</strong>
          <small>combined plan total</small>
        </article>
        <article className="metric-card">
          <span>Spent</span>
          <strong>{formatMilliunits(aggregate.totals.spent, currencyFormat)}</strong>
          <small>activity this month</small>
        </article>
        <article className="metric-card coverage-card">
          <span>Category coverage</span>
          <strong>{coverage}%</strong>
          <small>{mappedSourceCount} of {totalSourceCount} sources mapped</small>
        </article>
      </div>

      <div className="table-section">
        <div className="table-section-header">
          <h3>Shared categories</h3>
          <span>{aggregate.rows.length} {aggregate.rows.length === 1 ? 'category' : 'categories'}</span>
        </div>
        {aggregate.rows.length > 0 ? (
          <div className="table-wrap">
            <table className="budget-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="money">Budgeted</th>
                  <th scope="col" className="money">Spent</th>
                  <th scope="col" className="money">Available</th>
                  <th scope="col">From</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows(aggregate.rows).map(([groupName, rows]) => (
                  <Fragment key={groupName}>
                    <tr className="group-row">
                      <th scope="rowgroup" colSpan="5">{groupName}</th>
                    </tr>
                    {rows.map((row) => {
                      const planBreakdown = groupSourcesByPlan(row.sources);
                      const isExpanded = expandedRowIds.includes(row.id);
                      const breakdownId = `plan-breakdown-${row.id}`;

                      return (
                        <Fragment key={row.id}>
                          <tr className={`category-row${isExpanded ? ' category-row-expanded' : ''}`}>
                            <th scope="row" data-label="Category">{row.name}</th>
                            <td className="money" data-label="Budgeted">{formatMilliunits(row.budgeted, currencyFormat)}</td>
                            <td className="money" data-label="Spent">{formatMilliunits(row.spent, currencyFormat)}</td>
                            <td className={`money ${row.available < 0 ? 'negative' : 'positive'}`} data-label="Available">
                              {formatMilliunits(row.available, currencyFormat)}
                            </td>
                            <td data-label="From">
                              {planBreakdown.length > 0 ? (
                                <button
                                  type="button"
                                  className="breakdown-toggle"
                                  aria-expanded={isExpanded}
                                  aria-controls={breakdownId}
                                  aria-label={`${isExpanded ? 'Hide' : 'Show'} plan breakdown for ${row.name}`}
                                  onClick={() => toggleBreakdown(row.id)}
                                >
                                  <span className="breakdown-toggle-copy">
                                    <strong>{planBreakdown.length} {planBreakdown.length === 1 ? 'plan' : 'plans'}</strong>
                                    <span>{planBreakdown.map((plan) => plan.planName).join(' + ')}</span>
                                  </span>
                                  <span className="breakdown-action" aria-hidden="true">{isExpanded ? 'Hide' : 'View'}</span>
                                </button>
                              ) : null}
                              {row.missingSourceIds.map((sourceId) => (
                                <span key={sourceId} className="missing-source">Missing / {sourceId}</span>
                              ))}
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="breakdown-row">
                              <td colSpan="5">
                                <section id={breakdownId} className="plan-breakdown" aria-label={`Plan breakdown for ${row.name}`}>
                                  <div className="plan-breakdown-heading">
                                    <strong>Plan breakdown</strong>
                                    <span>The combined totals above stay unchanged.</span>
                                  </div>
                                  <div className="plan-breakdown-grid">
                                    {planBreakdown.map((plan) => (
                                      <article key={plan.planId} className="plan-breakdown-card">
                                        <div className="plan-breakdown-name">
                                          <div>
                                            <strong>{plan.planName}</strong>
                                            <span>{plan.categoryNames.join(' + ')}</span>
                                          </div>
                                        </div>
                                        <dl>
                                          <div>
                                            <dt>Budgeted</dt>
                                            <dd>{formatMilliunits(plan.budgeted, currencyFormat)}</dd>
                                          </div>
                                          <div>
                                            <dt>Spent</dt>
                                            <dd>{formatMilliunits(plan.spent, currencyFormat)}</dd>
                                          </div>
                                        </dl>
                                      </article>
                                    ))}
                                  </div>
                                </section>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" data-label="Category">Totals</th>
                  <td className="money" data-label="Budgeted">{formatMilliunits(aggregate.totals.budgeted, currencyFormat)}</td>
                  <td className="money" data-label="Spent">{formatMilliunits(aggregate.totals.spent, currencyFormat)}</td>
                  <td className={`money ${aggregate.totals.available < 0 ? 'negative' : 'positive'}`} data-label="Available">
                    {formatMilliunits(aggregate.totals.available, currencyFormat)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="budget-empty-state">
            <span aria-hidden="true">↔</span>
            <div><h3>No shared categories yet</h3><p>Map matching categories below to start building your combined view.</p></div>
            <a href="#mapping-heading">Create a mapping</a>
          </div>
        )}
      </div>

      <section className="unmapped-section" aria-labelledby="unmapped-heading">
        <div className="table-section-header">
          <div>
            <h3 id="unmapped-heading">Unmapped source categories</h3>
            <p>These source categories are excluded until mapped.</p>
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
                {source.hidden ? <span className="badge badge-hidden">Hidden</span> : <span className="badge badge-unmapped">Unmapped</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="all-mapped"><span aria-hidden="true">✓</span> Every source category is mapped.</div>
        )}
      </section>
    </section>
  );
}

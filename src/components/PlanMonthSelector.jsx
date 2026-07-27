import { getSelectableMonths } from '../domain/aggregation.js';

function formatMonth(month) {
  if (!month) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month));
}

export function PlanMonthSelector({
  plans,
  leftPlanId,
  rightPlanId,
  leftMonths,
  rightMonths,
  selectedMonth,
  onLeftPlanChange,
  onRightPlanChange,
  onMonthChange,
  onLoadMonth,
  loading,
}) {
  const selectableMonths = getSelectableMonths(leftMonths, rightMonths);
  const canLoad = leftPlanId && rightPlanId && leftPlanId !== rightPlanId && selectedMonth && !loading;

  return (
    <section className="selection-card" aria-label="Plan and month selection">
      <div className="selection-heading">
        <div>
          <h3>Plans and month</h3>
          <p>Pick two plans and a month they have in common.</p>
        </div>
      </div>
      <div className="control-grid">
        <label>
          <span className="field-label">First plan</span>
          <select aria-label="Your plan" value={leftPlanId} onChange={(event) => onLeftPlanChange(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id} disabled={plan.id === rightPlanId}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <span className="pair-symbol" aria-hidden="true">+</span>
        <label>
          <span className="field-label">Second plan</span>
          <select aria-label="Partner plan" value={rightPlanId} onChange={(event) => onRightPlanChange(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id} disabled={plan.id === leftPlanId}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Budget month</span>
          <select aria-label="Month" value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)}>
            {selectableMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="Load month" className="button button-primary load-button" disabled={!canLoad} onClick={onLoadMonth}>
          {loading ? 'Loading…' : 'Load shared view'}
        </button>
      </div>
    </section>
  );
}

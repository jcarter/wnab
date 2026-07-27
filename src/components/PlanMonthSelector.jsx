export function PlanMonthSelector({
  plans,
  leftPlanId,
  rightPlanId,
  onLeftPlanChange,
  onRightPlanChange,
  loading,
}) {
  return (
    <section className="selection-card" aria-label="Plan selection">
      <div className="selection-heading">
        <span className="selection-icon" aria-hidden="true">⌁</span>
        <div><h3>Shared plans</h3><p>Choose the two plans to review side by side.</p></div>
      </div>
      <div className="control-grid">
        <label>
          <span className="field-label">First plan</span>
          <select aria-label="Your plan" value={leftPlanId} disabled={loading} onChange={(event) => onLeftPlanChange(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id} disabled={plan.id === rightPlanId}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Second plan</span>
          <select aria-label="Partner plan" value={rightPlanId} disabled={loading} onChange={(event) => onRightPlanChange(event.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id} disabled={plan.id === leftPlanId}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

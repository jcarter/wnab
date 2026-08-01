import { PlanMonthSelector } from './PlanMonthSelector.jsx';

export function SettingsView({
  plans,
  leftPlanId,
  rightPlanId,
  onLeftPlanChange,
  onRightPlanChange,
  onOpenMapping,
  onBack,
  loading,
}) {
  return (
    <section className="settings-view" aria-labelledby="settings-heading">
      <div className="settings-heading-row">
        <button type="button" className="back-to-budget" onClick={onBack}>
          <span aria-hidden="true">‹</span> Budget
        </button>
        <div className="section-heading">
          <h2 id="settings-heading">Settings</h2>
          <p>Choose the budgets and shared category structure used in this view.</p>
        </div>
      </div>

      <div className="settings-content">
        <PlanMonthSelector
          plans={plans}
          leftPlanId={leftPlanId}
          rightPlanId={rightPlanId}
          onLeftPlanChange={onLeftPlanChange}
          onRightPlanChange={onRightPlanChange}
          loading={loading}
        />

        <section className="settings-card" aria-labelledby="category-mapping-heading">
          <div>
            <span className="settings-label">Shared structure</span>
            <h3 id="category-mapping-heading">Category mapping</h3>
            <p>Match categories that mean the same thing across both plans.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={onOpenMapping}>
            Map categories <span aria-hidden="true">›</span>
          </button>
        </section>
      </div>
    </section>
  );
}

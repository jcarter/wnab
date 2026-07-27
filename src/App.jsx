import { useEffect, useMemo, useState } from 'react';
import { TokenGate } from './components/TokenGate.jsx';
import { PlanMonthSelector } from './components/PlanMonthSelector.jsx';
import { MappingEditor } from './components/MappingEditor.jsx';
import { UnifiedBudgetTable } from './components/UnifiedBudgetTable.jsx';
import { StatusMessage } from './components/StatusMessage.jsx';
import { createYnabClient, YnabApiError } from './api/ynabClient.js';
import {
  aggregateMappedCategories,
  getSelectableMonths,
  getSourceCategories,
  validateCompatibleCurrencies,
} from './domain/aggregation.js';
import { loadMapping, saveMapping } from './domain/mappingStorage.js';

const THEME_STORAGE_KEY = 'ynabTogether.theme.v1';
const VALID_THEMES = new Set(['system', 'light', 'dark']);

function getStoredTheme() {
  try {
    const storedTheme = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.has(storedTheme) ? storedTheme : 'system';
  } catch {
    return 'system';
  }
}

function friendlyErrorMessage(error) {
  if (error instanceof YnabApiError || typeof error?.status === 'number') {
    if (error.status === 401 || error.status === 403) {
      return 'YNAB rejected the access token. Check the token and try again.';
    }
    if (error.status === 429) {
      return 'YNAB rate limit reached. Wait and try again.';
    }
    if (error.status === 503) {
      return 'YNAB is temporarily unavailable. Try again later.';
    }
    return error.detail || 'Unable to load YNAB data.';
  }

  return 'YNAB is temporarily unavailable. Try again later.';
}

function findPlan(plans, planId) {
  return plans.find((plan) => plan.id === planId) ?? null;
}

function formatMonth(month) {
  if (!month) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(month));
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">T</span>;
}

export default function App() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [accessToken, setAccessToken] = useState('');
  const [client, setClient] = useState(null);
  const [plans, setPlans] = useState([]);
  const [leftPlanId, setLeftPlanId] = useState('');
  const [rightPlanId, setRightPlanId] = useState('');
  const [leftMonths, setLeftMonths] = useState([]);
  const [rightMonths, setRightMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [sourceCategories, setSourceCategories] = useState([]);
  const [currencyFormat, setCurrencyFormat] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadingStep, setLoadingStep] = useState(null);
  const [retryStep, setRetryStep] = useState(null);

  const leftPlan = findPlan(plans, leftPlanId);
  const rightPlan = findPlan(plans, rightPlanId);
  const selectedPlanIds = useMemo(() => [leftPlanId, rightPlanId].filter(Boolean), [leftPlanId, rightPlanId]);
  const aggregate = useMemo(
    () => (mapping ? aggregateMappedCategories(sourceCategories, mapping) : null),
    [mapping, sourceCategories],
  );
  const isConnected = plans.length >= 2;
  const hasBudgetData = Boolean(mapping && aggregate);

  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }

    try {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme still applies for this tab when storage is unavailable.
    }
  }, [theme]);

  function setError(error, step) {
    setStatus({ type: 'error', message: friendlyErrorMessage(error) });
    setRetryStep(step);
  }

  async function loadMonthsForPair(apiClient, nextLeftPlanId, nextRightPlanId) {
    if (!apiClient || !nextLeftPlanId || !nextRightPlanId || nextLeftPlanId === nextRightPlanId) return;

    setLoadingStep('months');
    setRetryStep(null);
    setStatus(null);
    setMapping(null);
    setSourceCategories([]);

    try {
      const [leftData, rightData] = await Promise.all([
        apiClient.getPlanMonths(nextLeftPlanId),
        apiClient.getPlanMonths(nextRightPlanId),
      ]);
      const sharedMonths = getSelectableMonths(leftData.months, rightData.months);
      setLeftMonths(leftData.months);
      setRightMonths(rightData.months);
      setSelectedMonth(sharedMonths[0] ?? '');
      if (sharedMonths.length === 0) {
        setStatus({ type: 'error', message: 'Selected plans have no shared months.' });
      }
    } catch (error) {
      setError(error, 'months');
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleConnect(token) {
    const apiClient = createYnabClient({ token });
    setLoadingStep('plans');
    setRetryStep(null);
    setStatus(null);
    setAccessToken(token);
    setClient(apiClient);

    try {
      const planData = await apiClient.getPlans();
      if (planData.plans.length < 2) {
        setPlans(planData.plans);
        setStatus({ type: 'error', message: 'At least two YNAB plans are required.' });
        return;
      }

      const nextLeftPlanId = planData.plans[0].id;
      const nextRightPlanId = planData.plans[1].id;
      setPlans(planData.plans);
      setLeftPlanId(nextLeftPlanId);
      setRightPlanId(nextRightPlanId);
      await loadMonthsForPair(apiClient, nextLeftPlanId, nextRightPlanId);
    } catch (error) {
      setError(error, 'plans');
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleLeftPlanChange(planId) {
    setLeftPlanId(planId);
    await loadMonthsForPair(client, planId, rightPlanId);
  }

  async function handleRightPlanChange(planId) {
    setRightPlanId(planId);
    await loadMonthsForPair(client, leftPlanId, planId);
  }

  async function handleLoadMonth() {
    if (!client || !leftPlan || !rightPlan || !selectedMonth) return;

    setLoadingStep('month');
    setRetryStep(null);
    setStatus(null);

    try {
      const [leftMonthDetail, rightMonthDetail] = await Promise.all([
        client.getMonthDetail(leftPlan.id, selectedMonth),
        client.getMonthDetail(rightPlan.id, selectedMonth),
      ]);
      const currency = validateCompatibleCurrencies(leftPlan, rightPlan);
      if (!currency.ok) {
        setMapping(null);
        setSourceCategories([]);
        setStatus({ type: 'error', message: currency.message });
        return;
      }

      const nextSourceCategories = [
        ...getSourceCategories(leftPlan, leftMonthDetail),
        ...getSourceCategories(rightPlan, rightMonthDetail),
      ];
      const { mapping: loadedMapping, error } = loadMapping([leftPlan.id, rightPlan.id]);
      setSourceCategories(nextSourceCategories);
      setCurrencyFormat(currency.currencyFormat);
      setMapping(loadedMapping);
      if (error) {
        setStatus({ type: 'error', message: error });
      }
    } catch (error) {
      setError(error, 'month');
    } finally {
      setLoadingStep(null);
    }
  }

  function handleMappingChange(nextMapping) {
    setMapping(nextMapping);
    saveMapping(nextMapping);
  }

  function handleMappingMessage(message, type = 'success') {
    setStatus({ type, message });
    setRetryStep(null);
  }

  function handleRetry() {
    if (retryStep === 'plans') {
      handleConnect(accessToken);
    } else if (retryStep === 'months') {
      loadMonthsForPair(client, leftPlanId, rightPlanId);
    } else if (retryStep === 'month') {
      handleLoadMonth();
    }
  }

  function handleDisconnect() {
    setAccessToken('');
    setClient(null);
    setPlans([]);
    setLeftPlanId('');
    setRightPlanId('');
    setLeftMonths([]);
    setRightMonths([]);
    setSelectedMonth('');
    setSourceCategories([]);
    setCurrencyFormat(null);
    setMapping(null);
    setStatus(null);
    setLoadingStep(null);
    setRetryStep(null);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <BrandMark />
          <div>
            <h1>Together</h1>
            <p className="brand-subtitle">Shared budget view</p>
          </div>
        </div>
        <div className="header-meta">
          <label className="theme-picker">
            <span className="sr-only">Theme</span>
            <select aria-label="Theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <span className="privacy-badge">Read only</span>
          {selectedMonth ? <span className="month-badge">{formatMonth(selectedMonth)}</span> : null}
        </div>
      </header>

      {!isConnected ? (
        <section className="onboarding-layout">
          <div className="welcome-panel">
            <h2>See both budgets in one place.</h2>
            <p className="welcome-copy">
              Compare two YNAB plans in a private, read-only view. Your budgets stay unchanged.
            </p>
          </div>
          <div className="connect-column">
            <TokenGate onSubmit={handleConnect} loading={loadingStep === 'plans'} />
            <StatusMessage type={status?.type} onRetry={retryStep ? handleRetry : null}>
              {status?.message}
            </StatusMessage>
          </div>
          <ol className="workflow-list" aria-label="How Together works">
            <li><div><strong>Connect securely</strong><p>Your token stays in this tab.</p></div></li>
            <li><div><strong>Choose two plans</strong><p>Pick any month they share.</p></div></li>
            <li><div><strong>Match categories</strong><p>Save a shared structure for next time.</p></div></li>
          </ol>
        </section>
      ) : (
        <div className="workspace">
          <section className="workspace-intro">
            <div>
              <h2>Shared budget</h2>
              <p>Choose two plans and a month to review together.</p>
            </div>
            <div className="connection-actions">
              <span className="connection-state">Connected for this tab</span>
              <button type="button" className="change-connection-button" onClick={handleDisconnect}>Change connection</button>
            </div>
          </section>

          <PlanMonthSelector
            plans={plans}
            leftPlanId={leftPlanId}
            rightPlanId={rightPlanId}
            leftMonths={leftMonths}
            rightMonths={rightMonths}
            selectedMonth={selectedMonth}
            onLeftPlanChange={handleLeftPlanChange}
            onRightPlanChange={handleRightPlanChange}
            onMonthChange={setSelectedMonth}
            onLoadMonth={handleLoadMonth}
            loading={loadingStep === 'month' || loadingStep === 'months'}
          />

          <StatusMessage type={status?.type} onRetry={retryStep ? handleRetry : null}>
            {status?.message}
          </StatusMessage>

          {!hasBudgetData ? (
            <section className="ready-card" aria-live="polite">
              <div>
                <h3>Choose a month to begin</h3>
                <p>Load a shared month to review totals and match categories.</p>
              </div>
            </section>
          ) : (
            <div className="budget-workspace">
              <UnifiedBudgetTable aggregate={aggregate} currencyFormat={currencyFormat} />
              <MappingEditor
                sourceCategories={sourceCategories}
                mapping={mapping}
                planIds={selectedPlanIds}
                onMappingChange={handleMappingChange}
                onMessage={handleMappingMessage}
              />
            </div>
          )}
        </div>
      )}

      <footer className="app-footer">
        <span>Local and read only</span>
        <span>YNAB data is not stored by this app.</span>
      </footer>
    </main>
  );
}

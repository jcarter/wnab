import { useEffect, useMemo, useState } from 'react';
import { TokenGate } from './components/TokenGate.jsx';
import { HeaderMonthPicker } from './components/HeaderMonthPicker.jsx';
import { PlanMonthSelector } from './components/PlanMonthSelector.jsx';
import { MappingEditor } from './components/MappingEditor.jsx';
import { UnifiedBudgetTable } from './components/UnifiedBudgetTable.jsx';
import { StatusMessage } from './components/StatusMessage.jsx';
import { createYnabClient, YnabApiError } from './api/ynabClient.js';
import { formatMilliunits } from './domain/formatMoney.js';
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

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>;
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
  const [activeView, setActiveView] = useState('budget');

  const leftPlan = findPlan(plans, leftPlanId);
  const rightPlan = findPlan(plans, rightPlanId);
  const selectedPlanIds = useMemo(() => [leftPlanId, rightPlanId].filter(Boolean), [leftPlanId, rightPlanId]);
  const selectableMonths = useMemo(
    () => getSelectableMonths(leftMonths, rightMonths),
    [leftMonths, rightMonths],
  );
  const aggregate = useMemo(
    () => (mapping ? aggregateMappedCategories(sourceCategories, mapping) : null),
    [mapping, sourceCategories],
  );
  const isConnected = plans.length >= 2;
  const hasBudgetData = Boolean(mapping && aggregate);
  const combinedAvailable = hasBudgetData
    ? formatMilliunits(aggregate.totals.available, currencyFormat)
    : '—';

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

  async function loadMonthData(apiClient, nextLeftPlan, nextRightPlan, month) {
    if (!apiClient || !nextLeftPlan || !nextRightPlan || !month) return;

    setLoadingStep('month');
    setRetryStep(null);
    setStatus(null);

    try {
      const [leftMonthDetail, rightMonthDetail] = await Promise.all([
        apiClient.getMonthDetail(nextLeftPlan.id, month),
        apiClient.getMonthDetail(nextRightPlan.id, month),
      ]);
      const currency = validateCompatibleCurrencies(nextLeftPlan, nextRightPlan);
      if (!currency.ok) {
        setMapping(null);
        setSourceCategories([]);
        setStatus({ type: 'error', message: currency.message });
        return;
      }

      const nextSourceCategories = [
        ...getSourceCategories(nextLeftPlan, leftMonthDetail),
        ...getSourceCategories(nextRightPlan, rightMonthDetail),
      ];
      const { mapping: loadedMapping, error } = loadMapping([nextLeftPlan.id, nextRightPlan.id]);
      setSourceCategories(nextSourceCategories);
      setCurrencyFormat(currency.currencyFormat);
      setMapping(loadedMapping);
      if (error) setStatus({ type: 'error', message: error });
    } catch (error) {
      setError(error, 'month');
    } finally {
      setLoadingStep(null);
    }
  }

  async function loadMonthsForPair(apiClient, nextLeftPlanId, nextRightPlanId, availablePlans = plans) {
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
        return;
      }

      const nextLeftPlan = findPlan(availablePlans, nextLeftPlanId);
      const nextRightPlan = findPlan(availablePlans, nextRightPlanId);
      await loadMonthData(apiClient, nextLeftPlan, nextRightPlan, sharedMonths[0]);
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
      await loadMonthsForPair(apiClient, nextLeftPlanId, nextRightPlanId, planData.plans);
    } catch (error) {
      setError(error, 'plans');
    } finally {
      setLoadingStep(null);
    }
  }

  async function handleLeftPlanChange(planId) {
    setLeftPlanId(planId);
    setActiveView('budget');
    await loadMonthsForPair(client, planId, rightPlanId);
  }

  async function handleRightPlanChange(planId) {
    setRightPlanId(planId);
    setActiveView('budget');
    await loadMonthsForPair(client, leftPlanId, planId);
  }

  async function handleMonthSelect(month) {
    setSelectedMonth(month);
    setActiveView('budget');
    await loadMonthData(client, leftPlan, rightPlan, month);
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
      loadMonthData(client, leftPlan, rightPlan, selectedMonth);
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
    setActiveView('budget');
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <BrandMark />
          <h1>Together</h1>
          {isConnected ? (
            <HeaderMonthPicker
              availableMonths={selectableMonths}
              selectedMonth={selectedMonth}
              onSelect={handleMonthSelect}
              loading={loadingStep === 'month' || loadingStep === 'months'}
            />
          ) : null}
        </div>
        {isConnected ? (
          <div className="ready-summary" aria-label={`Combined available ${combinedAvailable}`}>
            <strong>{combinedAvailable}</strong>
            <span>Combined available</span>
          </div>
        ) : null}
        <div className="header-meta">
          <label className="theme-picker">
            <span className="sr-only">Theme</span>
            <select aria-label="Theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <span className="privacy-badge">{isConnected ? '2 plans connected' : 'Read only'}</span>
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
          {activeView === 'budget' ? (
            <>
              <PlanMonthSelector
                plans={plans}
                leftPlanId={leftPlanId}
                rightPlanId={rightPlanId}
                onLeftPlanChange={handleLeftPlanChange}
                onRightPlanChange={handleRightPlanChange}
                loading={loadingStep === 'month' || loadingStep === 'months'}
              />

              <div className="connection-actions">
                <span className="connection-state">Connected for this tab</span>
                <button type="button" className="change-connection-button" onClick={handleDisconnect}>Change connection</button>
              </div>

              <StatusMessage type={status?.type} onRetry={retryStep ? handleRetry : null}>
                {status?.message}
              </StatusMessage>

              {!hasBudgetData ? (
                <section className="ready-card" aria-live="polite">
                  <div>
                    <h3>{loadingStep ? 'Loading shared month…' : 'No shared month available'}</h3>
                    <p>{loadingStep ? 'Fetching both plans for this month.' : 'Choose another pair of plans to continue.'}</p>
                  </div>
                </section>
              ) : (
                <UnifiedBudgetTable
                  aggregate={aggregate}
                  currencyFormat={currencyFormat}
                  selectedMonth={selectedMonth}
                  onOpenMapping={() => setActiveView('mapping')}
                />
              )}
            </>
          ) : (
            <>
              <StatusMessage type={status?.type} onRetry={retryStep ? handleRetry : null}>
                {status?.message}
              </StatusMessage>
              <MappingEditor
                sourceCategories={sourceCategories}
                mapping={mapping}
                planIds={selectedPlanIds}
                onMappingChange={handleMappingChange}
                onMessage={handleMappingMessage}
                onBack={() => setActiveView('budget')}
              />
            </>
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

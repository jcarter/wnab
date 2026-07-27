import { useState } from 'react';

export function PasswordGate({ onSubmit, loading, error, configured = true }) {
  const [password, setPassword] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(password);
    setPassword('');
  }

  return (
    <section className="onboarding-layout auth-layout">
      <div className="welcome-panel">
        <h2>Shared budgets, kept private.</h2>
        <p className="welcome-copy">
          Sign in to view the shared budget and category mappings.
        </p>
      </div>
      <div className="connect-column">
        <form className="connect-card" onSubmit={handleSubmit}>
          <div className="connect-card-header">
            <div>
              <h2>Enter shared password</h2>
              <p>Protected access</p>
            </div>
          </div>
          {!configured ? (
            <p className="status status-error" role="alert">
              The server is missing the APP_PASSWORD environment variable.
            </p>
          ) : (
            <>
              <label htmlFor="app-password">Password</label>
              <input
                id="app-password"
                aria-label="Application password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
              {error ? <p className="status status-error" role="alert">{error}</p> : null}
              <button
                type="submit"
                className="button button-primary button-wide"
                disabled={loading || !password}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}

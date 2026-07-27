import { useState } from 'react';

export function TokenGate({ onSubmit, loading }) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(token);
  }

  return (
    <form className="connect-card" onSubmit={handleSubmit}>
      <div className="connect-card-header">
        <div>
          <h2>Connect to YNAB</h2>
          <p>Private by design</p>
        </div>
      </div>

      <p className="connect-copy">Use a Personal Access Token to load your plan names and budget data directly from YNAB.</p>

      <label htmlFor="ynab-token">Personal Access Token</label>
      <div className="token-input-wrap">
        <input
          id="ynab-token"
          aria-label="YNAB Personal Access Token"
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste your token"
          autoComplete="off"
          spellCheck="false"
          required
        />
        <button type="button" className="show-token-button" onClick={() => setShowToken((current) => !current)}>
          {showToken ? 'Hide' : 'Show'}
        </button>
      </div>

      <p className="privacy-note">Kept only in memory and cleared when this tab closes.</p>

      <button type="submit" className="button button-primary button-wide" disabled={loading || !token.trim()}>
        {loading ? 'Connecting…' : 'Connect read-only'}
      </button>
    </form>
  );
}

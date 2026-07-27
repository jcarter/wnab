export function StatusMessage({ type = 'info', children, onRetry }) {
  if (!children) return null;

  return (
    <div className={`status status-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="status-icon" aria-hidden="true">{type === 'error' ? '!' : type === 'success' ? '✓' : 'i'}</span>
      <span className="status-copy">{children}</span>
      {onRetry ? (
        <button type="button" className="text-button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

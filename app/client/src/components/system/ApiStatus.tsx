import { useApiHealth } from '../../shared/api/useApiHealth';

export function ApiStatus() {
  const { state } = useApiHealth();

  return (
    <span className={`connection ${state}`}>
      <span className="connection-dot" />
      {state === 'checking' && 'Connecting to local services…'}
      {state === 'connected' && 'API and SQLite connected'}
      {state === 'error' && 'Could not connect to local services'}
    </span>
  );
}

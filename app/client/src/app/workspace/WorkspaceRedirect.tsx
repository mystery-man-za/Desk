import { Navigate } from 'react-router-dom';
import { useWorkspace } from './WorkspaceContext';

export function WorkspaceRedirect() {
  const { company, loading, error, reload } = useWorkspace();

  if (loading) {
    return <main className="auth-loading">Loading your Books site…</main>;
  }
  if (error) {
    return (
      <main className="auth-loading">
        <div role="alert">
          <h1>Could not load your Books site</h1>
          <p>{error}</p>
          <button className="primary-button" onClick={() => void reload()} type="button">
            Try again
          </button>
        </div>
      </main>
    );
  }
  return <Navigate replace to={company ? '/dashboard' : '/setup'} />;
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { user, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="auth-loading">Checking your Books site…</main>;
  }
  if (error) {
    return (
      <main className="auth-loading">
        <div role="alert">
          <h1>Could not connect to your Books site</h1>
          <p>{error}</p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">
            Try again
          </button>
        </div>
      </main>
    );
  }
  if (!user) {
    return <Navigate replace to="/login" state={{ from: location }} />;
  }
  return <Outlet />;
}

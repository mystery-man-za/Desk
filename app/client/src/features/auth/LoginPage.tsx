import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/api/client';
import { apiRequest } from '../../shared/api/client';
import { useAuth } from '../../app/auth/AuthContext';

type PreviousLocation = {
  pathname?: string;
};

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ required: boolean }>('/api/v1/auth/bootstrap-status', {
      signal: controller.signal,
    })
      .then(({ required }) => setBootstrapRequired(required))
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Could not check whether this site needs initial setup.');
        }
      });
    return () => controller.abort();
  }, []);

  if (!loading && user) return <Navigate replace to="/" />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      const from = (location.state as { from?: PreviousLocation } | null)?.from;
      navigate(from?.pathname ?? '/', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === 'INVALID_CREDENTIALS'
          ? 'The email or password you entered is incorrect.'
          : cause instanceof Error
            ? cause.message
            : 'Could not sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="brand auth-brand" href="/" aria-label="Books home">
          <span className="brand-mark" aria-hidden="true">b.</span>
          <span>books<span className="brand-period">.</span></span>
        </a>
        <div className="eyebrow">YOUR BOOKS SITE</div>
        <h1 id="login-title">Welcome back.</h1>
        <p className="auth-intro">Sign in to continue to your workspace.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email address</span>
            <input
              autoComplete="username"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <button className="primary-button full-width" disabled={submitting} type="submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footnote">
          {bootstrapRequired ? (
            <>New Books site? <a href="/first-run">Create the site owner account</a></>
          ) : (
            'Access is managed by a System Manager on this site.'
          )}
        </p>
      </section>
    </main>
  );
}

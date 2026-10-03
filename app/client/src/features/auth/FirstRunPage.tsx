import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthContext';
import { apiRequest, ApiError } from '../../shared/api/client';

type InitialAdmin = {
  email: string;
  fullname: string;
  password: string;
};

export function FirstRunPage() {
  const { user, loading: authLoading, bootstrap } = useAuth();
  const navigate = useNavigate();
  const [required, setRequired] = useState<boolean | null>(null);
  const [input, setInput] = useState<InitialAdmin>({
    email: '',
    fullname: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ required: boolean }>('/api/v1/auth/bootstrap-status', {
      signal: controller.signal,
    })
      .then(({ required: isRequired }) => setRequired(isRequired))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not check site setup status.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, []);

  if (!authLoading && user) return <Navigate replace to="/" />;
  if (!checking && required === false) return <Navigate replace to="/login" />;

  function update(field: keyof InitialAdmin, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (input.password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await bootstrap(input);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError &&
        cause.code === 'INITIAL_SYSTEM_MANAGER_ALREADY_EXISTS'
          ? 'This site already has an owner account. Sign in with that account.'
          : cause instanceof Error
            ? cause.message
            : 'Could not initialize the site. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || checking) {
    return <main className="auth-loading">Checking first-run setup…</main>;
  }
  if (required === null) {
    return (
      <main className="auth-loading">
        <div role="alert">
          <h1>Could not check site setup</h1>
          <p>{error}</p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="first-run-title">
        <a className="brand auth-brand" href="/" aria-label="Books home">
          <span className="brand-mark" aria-hidden="true">b.</span>
          <span>books<span className="brand-period">.</span></span>
        </a>
        <div className="eyebrow">A NEW BOOKS SITE</div>
        <h1 id="first-run-title">Create the site owner account.</h1>
        <p className="auth-intro">
          This creates your personal sign-in with the System Manager role. It
          can manage site users and Books settings. There are no default
          credentials or separate shared Administrator login.
        </p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Your full name</span>
            <input
              autoComplete="name"
              autoFocus
              maxLength={140}
              onChange={(event) => update('fullname', event.target.value)}
              required
              value={input.fullname}
            />
          </label>
          <label className="field">
            <span>Owner sign-in email</span>
            <input
              autoComplete="email"
              onChange={(event) => update('email', event.target.value)}
              required
              type="email"
              value={input.email}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => update('password', event.target.value)}
              required
              type="password"
              value={input.password}
            />
            <small>Use at least 12 characters. This password is never displayed again.</small>
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <button className="primary-button full-width" disabled={submitting} type="submit">
            {submitting ? 'Creating your site…' : 'Create owner account and continue'}
          </button>
        </form>
        <p className="auth-footnote">
          Next, set up your company once. Then the owner can add separate Books
          Managers and Books Users.
        </p>
      </section>
    </main>
  );
}

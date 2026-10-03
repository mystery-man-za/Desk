import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthContext';
import { ApiError, apiRequest } from '../../shared/api/client';

const roles = ['System Manager', 'Books Manager', 'Books User'] as const;
type UserRole = (typeof roles)[number];
type ManagedUser = {
  id: number;
  email: string;
  fullname: string;
  role: UserRole;
  isActive: boolean;
};
type NewUser = Pick<ManagedUser, 'email' | 'fullname' | 'role'> & {
  password: string;
};

const emptyUser: NewUser = {
  email: '',
  fullname: '',
  password: '',
  role: 'Books User',
};

const roleDescriptions: Record<UserRole, string> = {
  'System Manager': 'Manages site users, access, and company setup.',
  'Books Manager': 'Can create and manage Books records.',
  'Books User': 'Can use Books with read access to records.',
};

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<NewUser>(emptyUser);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ users: ManagedUser[] }>('/api/v1/auth/users', {
      signal: controller.signal,
    })
      .then(({ users: siteUsers }) => setUsers(siteUsers))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setPageError(messageFor(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (currentUser?.role !== 'System Manager') {
    return <Navigate replace to="/" />;
  }

  function updateForm(field: keyof NewUser, value: string) {
    setForm((current) => ({
      ...current,
      [field]: field === 'role' ? (value as UserRole) : value,
    }));
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setPageError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ user: ManagedUser }>(
        '/api/v1/auth/users',
        { method: 'POST', body: JSON.stringify(form) },
      );
      setUsers((current) => [...current, response.user]);
      setForm(emptyUser);
      setNotice(
        'User created. Share the initial password with them through a secure channel; no email is sent.',
      );
    } catch (cause) {
      setFormError(messageFor(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeUser(
    target: ManagedUser,
    changes: { role?: UserRole; isActive?: boolean },
  ) {
    setBusyUserId(target.id);
    setPageError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ user: ManagedUser }>(
        `/api/v1/auth/users/${target.id}`,
        { method: 'PATCH', body: JSON.stringify(changes) },
      );
      setUsers((current) =>
        current.map((existing) =>
          existing.id === target.id ? response.user : existing,
        ),
      );
      setNotice(`${response.user.fullname}'s access was updated.`);
    } catch (cause) {
      setPageError(messageFor(cause));
    } finally {
      setBusyUserId(null);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetUserId === null) return;
    if (newPassword !== confirmPassword) {
      setPageError('The passwords do not match.');
      return;
    }
    const target = users.find((candidate) => candidate.id === resetUserId);
    if (!target) return;

    setBusyUserId(target.id);
    setPageError(null);
    setNotice(null);
    try {
      await apiRequest<void>(`/api/v1/auth/users/${target.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      });
      setResetUserId(null);
      setNewPassword('');
      setConfirmPassword('');
      setNotice(
        `${target.fullname}'s password was reset. Their active sessions were revoked.`,
      );
    } catch (cause) {
      setPageError(messageFor(cause));
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <main className="setup-page users-page">
      <div className="setup-page-heading">
        <div className="eyebrow">SITE ACCESS</div>
        <h1>Manage users.</h1>
        <p>
          This database is one Books site. Add each person who should sign in,
          and assign their site or Books role here.
        </p>
      </div>

      <section className="user-admin-card">
        <header className="user-admin-heading">
          <div>
            <h2>Add a user</h2>
            <p>Accounts are created only when a System Manager adds them.</p>
          </div>
        </header>
        <form className="user-create-form" onSubmit={createUser}>
          <label className="field">
            <span>Full name</span>
            <input
              autoComplete="name"
              maxLength={140}
              onChange={(event) => updateForm('fullname', event.target.value)}
              required
              value={form.fullname}
            />
          </label>
          <label className="field">
            <span>Sign-in email</span>
            <input
              autoComplete="email"
              maxLength={254}
              onChange={(event) => updateForm('email', event.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label className="field">
            <span>Initial password</span>
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => updateForm('password', event.target.value)}
              required
              type="password"
              value={form.password}
            />
            <small>At least 12 characters. Give it to the user securely.</small>
          </label>
          <label className="field">
            <span>Role</span>
            <select
              onChange={(event) => updateForm('role', event.target.value)}
              value={form.role}
            >
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <small>{roleDescriptions[form.role]}</small>
          </label>
          {formError && <div className="form-alert user-form-message" role="alert">{formError}</div>}
          {notice && <div className="user-notice user-form-message" role="status">{notice}</div>}
          <button
            className="primary-button user-create-button"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Creating user…' : 'Create user'}
          </button>
        </form>
      </section>

      <section className="user-admin-card">
        <header className="user-admin-heading">
          <div>
            <h2>People with access</h2>
            <p>{users.length} account{users.length === 1 ? '' : 's'} on this site</p>
          </div>
        </header>
        {pageError && <div className="form-alert user-list-message" role="alert">{pageError}</div>}
        {notice && <div className="user-notice user-list-message" role="status">{notice}</div>}
        {loading ? (
          <div className="empty-state">Loading site users…</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No users are configured for this site.</div>
        ) : (
          <div className="user-list">
            {users.map((siteUser) => (
              <article className="user-row" key={siteUser.id}>
                <div className="user-identity">
                  <strong>{siteUser.fullname}</strong>
                  <span>{siteUser.email}</span>
                  {siteUser.id === currentUser.id && <small>You</small>}
                </div>
                <label className="field user-role-field">
                  <span>Role</span>
                  <select
                    aria-label={`Role for ${siteUser.fullname}`}
                    disabled={busyUserId === siteUser.id}
                    onChange={(event) =>
                      void changeUser(siteUser, {
                        role: event.currentTarget.value as UserRole,
                      })
                    }
                    value={siteUser.role}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <small>{roleDescriptions[siteUser.role]}</small>
                </label>
                <span className={`user-status${siteUser.isActive ? ' active' : ''}`}>
                  {siteUser.isActive ? 'Active' : 'Disabled'}
                </span>
                <div className="user-actions">
                  {siteUser.id !== currentUser.id && (
                    <>
                      <button
                        className="secondary-button"
                        disabled={busyUserId === siteUser.id}
                        onClick={() => {
                          setResetUserId(siteUser.id);
                          setNewPassword('');
                          setConfirmPassword('');
                          setPageError(null);
                        }}
                        type="button"
                      >
                        Reset password
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busyUserId === siteUser.id}
                        onClick={() =>
                          void changeUser(siteUser, { isActive: !siteUser.isActive })
                        }
                        type="button"
                      >
                        {siteUser.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </>
                  )}
                </div>
                {resetUserId === siteUser.id && (
                  <form className="user-reset-form" onSubmit={resetPassword}>
                    <label className="field">
                      <span>New password for {siteUser.fullname}</span>
                      <input
                        autoComplete="new-password"
                        minLength={12}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                        type="password"
                        value={newPassword}
                      />
                    </label>
                    <label className="field">
                      <span>Confirm new password</span>
                      <input
                        autoComplete="new-password"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        type="password"
                        value={confirmPassword}
                      />
                    </label>
                    <div className="user-actions">
                      <button
                        className="primary-button"
                        disabled={busyUserId === siteUser.id}
                        type="submit"
                      >
                        Reset password
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => setResetUserId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function messageFor(cause: unknown): string {
  if (cause instanceof ApiError && cause.code === 'EMAIL_ALREADY_EXISTS') {
    return 'A user with this email already exists.';
  }
  if (cause instanceof ApiError && cause.code === 'LAST_SYSTEM_MANAGER') {
    return 'The site must keep at least one active System Manager.';
  }
  if (cause instanceof Error) return cause.message;
  return 'Could not update site access. Please try again.';
}

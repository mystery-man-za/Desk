import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { ApiError, apiRequest } from '../../shared/api/client';

type SetupOption = {
  id: string;
  name: string;
};

type CompanyForm = {
  name: string;
  fullname: string;
  email: string;
  country: string;
  currency: string;
  timeZone: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  chartId: string;
  bankAccountName: string;
};

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialForm(): CompanyForm {
  const year = new Date().getFullYear();
  return {
    name: '',
    fullname: '',
    email: '',
    country: '',
    currency: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    fiscalYearStart: `${year}-01-01`,
    fiscalYearEnd: dateInputValue(new Date(year, 11, 31)),
    chartId: '',
    bankAccountName: '',
  };
}

export function CompanySetupPage() {
  const { company, loading: workspaceLoading, reload } = useWorkspace();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [charts, setCharts] = useState<SetupOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ charts: SetupOption[] }>('/api/v1/setup/options', {
      signal: controller.signal,
    })
      .then((options) => {
        setCharts(options.charts);
        setForm((current) => ({
          ...current,
          chartId: options.charts[0]?.id ?? '',
        }));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load setup options.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false);
      });
    return () => controller.abort();
  }, []);

  if (workspaceLoading || loadingOptions) {
    return <main className="auth-loading">Preparing your company setup…</main>;
  }
  if (company) return <Navigate replace to="/dashboard" />;

  function updateField(field: keyof CompanyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/companies', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await reload();
      navigate('/accounts', { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.details?.length) {
        setError(cause.details.map(({ message }) => message).join(' '));
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not save your company. Please try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-page">
      <div className="setup-page-heading">
        <div className="eyebrow">LET’S GET YOU SET UP</div>
        <h1>Start with your business.</h1>
        <p>These details shape your books, account structure, and financial year.</p>
      </div>

      <form className="setup-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <div className="form-section-title">
            <span className="step-number">01</span>
            <div><h2>Your business</h2><p>Who are we setting up?</p></div>
          </div>
          <div className="form-grid">
            <label className="field span-two">
              <span>Company name</span>
              <input
                autoComplete="organization"
                maxLength={140}
                onChange={(event) => updateField('name', event.target.value)}
                required
                value={form.name}
              />
            </label>
            <label className="field">
              <span>Company contact name</span>
              <input
                autoComplete="name"
                maxLength={140}
                onChange={(event) => updateField('fullname', event.target.value)}
                required
                value={form.fullname}
              />
            </label>
            <label className="field">
              <span>Contact email</span>
              <input
                autoComplete="email"
                onChange={(event) => updateField('email', event.target.value)}
                required
                type="email"
                value={form.email}
              />
              <small>Used for company documents; this is not a user sign-in.</small>
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title">
            <span className="step-number">02</span>
            <div><h2>Regional settings</h2><p>Set the context for dates and currency.</p></div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Country</span>
              <input
                autoComplete="country-name"
                maxLength={100}
                onChange={(event) => updateField('country', event.target.value)}
                placeholder="e.g. South Africa"
                required
                value={form.country}
              />
            </label>
            <label className="field">
              <span>Base currency</span>
              <input
                autoCapitalize="characters"
                maxLength={3}
                onChange={(event) => updateField('currency', event.target.value.toUpperCase())}
                placeholder="e.g. ZAR"
                required
                value={form.currency}
              />
              <small>Enter the three-letter ISO currency code.</small>
            </label>
            <label className="field span-two">
              <span>Time zone</span>
              <input
                maxLength={100}
                onChange={(event) => updateField('timeZone', event.target.value)}
                placeholder="e.g. Africa/Johannesburg"
                required
                value={form.timeZone}
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title">
            <span className="step-number">03</span>
            <div><h2>Accounting foundation</h2><p>Choose the starting structure for your books.</p></div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Chart of accounts</span>
              <select
                onChange={(event) => updateField('chartId', event.target.value)}
                required
                value={form.chartId}
              >
                {charts.map((chart) => (
                  <option key={chart.id} value={chart.id}>{chart.name}</option>
                ))}
              </select>
              <small>Charts can be reviewed after setup.</small>
            </label>
            <label className="field">
              <span>Bank account name</span>
              <input
                maxLength={140}
                onChange={(event) => updateField('bankAccountName', event.target.value)}
                placeholder="e.g. Business Cheque Account"
                required
                value={form.bankAccountName}
              />
            </label>
            <label className="field">
              <span>Financial year starts</span>
              <input
                onChange={(event) => updateField('fiscalYearStart', event.target.value)}
                required
                type="date"
                value={form.fiscalYearStart}
              />
            </label>
            <label className="field">
              <span>Financial year ends</span>
              <input
                onChange={(event) => updateField('fiscalYearEnd', event.target.value)}
                required
                type="date"
                value={form.fiscalYearEnd}
              />
            </label>
          </div>
        </section>

        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="setup-form-actions">
          <span>You can review the account structure before adding activity.</span>
          <button className="primary-button" disabled={submitting || charts.length === 0} type="submit">
            {submitting ? 'Setting up your books…' : 'Create my Books site'}
          </button>
        </div>
      </form>
    </main>
  );
}

import { Link, Navigate } from 'react-router-dom';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';

export function DashboardPage() {
  const { company, loading } = useWorkspace();
  if (!loading && !company) return <Navigate replace to="/setup" />;

  return (
    <section className="dashboard" id="dashboard">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR BUSINESS, IN GOOD ORDER</div>
          <h1>A clearer view of your business.</h1>
          <p className="welcome-copy">
            {company ? `${company.name} is ready for its first chapter.` : 'Your Books site is ready.'}
          </p>
        </div>
        {company && (
          <Link className="date-chip" to="/accounts">
            <span aria-hidden="true">☷</span> Review accounts
          </Link>
        )}
        {company && (
          <Link className="primary-button" to="/sales">
            Create sales invoice
          </Link>
        )}
      </div>

      <section className="setup-card" aria-labelledby="setup-title">
        <div className="setup-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-sheet">
            <div className="sheet-mark">b.</div>
            <div className="sheet-line line-long" />
            <div className="sheet-line line-short" />
            <div className="sheet-chart"><span /><span /><span /><span /><span /></div>
          </div>
          <div className="art-dot dot-one" />
          <div className="art-dot dot-two" />
        </div>
        <div className="setup-copy">
          <div className="ready-label"><span /> COMPANY SETUP COMPLETE</div>
          <h2 id="setup-title">{company?.name ?? 'Your Books site'}</h2>
          <p>
            Your company workspace has been created. Review the account
            structure and confirm it suits your business before entering transactions.
          </p>
          <div className="setup-note company-meta">
            <span>{company?.country} · {company?.currency}</span>
            <span>{company?.fiscalYearStart} — {company?.fiscalYearEnd}</span>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h2>Your foundation</h2>
          <p>The building blocks behind your workspace.</p>
        </div>
        <Link className="text-link" to="/accounts">Review chart <span aria-hidden="true">→</span></Link>
      </div>

      <div className="foundation-grid">
        <article className="foundation-card">
          <div className="card-icon green-icon" aria-hidden="true">⌂</div>
          <div className="card-overline">BUSINESS</div>
          <h3>Company profile</h3>
          <p>Your business details and accounting preferences.</p>
          <span className="card-status">Company configured</span>
        </article>
        <article className="foundation-card">
          <div className="card-icon lavender-icon" aria-hidden="true">☷</div>
          <div className="card-overline">STRUCTURE</div>
          <h3>Chart of accounts</h3>
          <p>A clear home for every dollar in and out.</p>
          <Link className="card-status card-link" to="/accounts">Review accounts</Link>
        </article>
        <article className="foundation-card">
          <div className="card-icon peach-icon" aria-hidden="true">↗</div>
          <div className="card-overline">ACTIVITY</div>
          <h3>First transactions</h3>
          <p>Start tracking the important things.</p>
          <Link className="card-status card-link" to="/sales">Create an invoice</Link>
        </article>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon, type AppIconName } from '../../components/ui/AppIcon';
import { AppSheet } from '../../components/ui/AppSheet';
import { PageTitle } from '../../components/layout/PageTitle';
import { PageContainer } from '../../components/layout/PageContainer';
import { EmptyState } from '../../components/ui/EmptyState';
import { AppButton } from '../../components/ui/AppButton';

type PlaceholderPageProps = {
  title: 'Expenses' | 'Accounting' | 'Reports';
};

type ReportCard = {
  title: string;
  description: string;
  icon: AppIconName;
  tone: string;
};

const reports: ReportCard[] = [
  { title: 'Profit and Loss', description: 'Income and expenses for a selected period.', icon: 'reports', tone: 'green' },
  { title: 'Balance Sheet', description: 'Assets, liabilities, and equity at a glance.', icon: 'accounts', tone: 'lavender' },
  { title: 'General Ledger', description: 'Account activity and running balances.', icon: 'accounting', tone: 'peach' },
  { title: 'Trial Balance', description: 'A summary of debit and credit balances.', icon: 'filter', tone: 'blue' },
];

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);
  const [expenseQuery, setExpenseQuery] = useState('');
  const [reportPeriod, setReportPeriod] = useState('This year');
  const isExpenses = title === 'Expenses';
  const isAccounting = title === 'Accounting';

  return (
    <PageContainer className={`feature-page ${isExpenses ? 'expenses-page' : ''}`}>
      <PageTitle
        description={isExpenses
          ? 'Keep track of what your business spends.'
          : isAccounting
            ? 'Review your books and keep every entry in balance.'
            : 'Understand how your business is performing.'}
        eyebrow={isExpenses ? 'PURCHASES & PAYMENTS' : isAccounting ? 'BOOKKEEPING' : 'FINANCIAL INSIGHT'}
        title={title}
      >
        {isExpenses && (
          <AppButton className="preview-action" icon={<AppIcon name="plus" size={16} />} onClick={() => setSelectedReport({
            title: 'Record an expense',
            description: 'Expense entry is not available yet. Your expense workflow will be connected here.',
            icon: 'plus',
            tone: 'green',
          })}>
            New expense
          </AppButton>
        )}
      </PageTitle>

      {isExpenses ? (
        <>
          <div className="feature-summary-grid">
            <SummaryCard label="Total expenses" value="—" icon="expenses" />
            <SummaryCard label="Awaiting payment" value="—" icon="accounting" />
            <SummaryCard label="Paid this period" value="—" icon="sales" />
          </div>
          <section className="feature-panel">
            <div className="feature-panel-heading">
              <div>
                <h2>Expense activity</h2>
                <p>Supplier invoices, bills, and expense entries</p>
              </div>
              <label className="feature-search">
                <AppIcon name="search" size={16} />
                <input
                  aria-label="Search expenses"
                  onChange={(event) => setExpenseQuery(event.target.value)}
                  placeholder="Search expenses"
                  type="search"
                  value={expenseQuery}
                />
              </label>
            </div>
            <div aria-label="Expense filters" className="feature-tabs" role="tablist">
              {['All', 'Unpaid', 'Paid'].map((tab) => (
                <button
                  aria-selected={activeTab === tab}
                  className={activeTab === tab ? 'active' : ''}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="feature-table-header expense-table-header">
              <span>SUPPLIER / DESCRIPTION</span><span>DATE</span><span>STATUS</span><span>AMOUNT</span>
            </div>
            <EmptyState
              icon="expenses"
              title={expenseQuery
                ? 'No matching expenses'
                : activeTab === 'All'
                  ? 'No expenses recorded'
                  : `No ${activeTab.toLowerCase()} expenses`}
              detail={expenseQuery
                ? 'Try another search term or clear your search.'
                : 'When you record a supplier invoice or expense, it will appear here.'}
            />
          </section>
          <div className="feature-note">
            <span className="note-icon">i</span>
            Expense entry and supplier bill posting are not connected yet.
          </div>
        </>
      ) : isAccounting ? (
        <>
          <div className="feature-summary-grid accounting-summary-grid">
            <SummaryCard label="Accounts" value="Chart" icon="accounts" />
            <SummaryCard label="Journal entries" value="—" icon="accounting" />
            <SummaryCard label="Ledger status" value="Ready" icon="reports" />
          </div>
          <section className="feature-panel">
            <div className="feature-panel-heading">
              <div>
                <h2>Accounting workspace</h2>
                <p>Navigate between your chart and account activity</p>
              </div>
              <Link className="secondary-button" to="/accounts">Open chart of accounts</Link>
            </div>
            <div aria-label="Accounting views" className="feature-tabs" role="tablist">
              {['Journal entries', 'General ledger'].map((tab) => (
                <button
                  aria-selected={activeTab === tab || (activeTab === 'All' && tab === 'Journal entries')}
                  className={(activeTab === tab || (activeTab === 'All' && tab === 'Journal entries')) ? 'active' : ''}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="feature-table-header ledger-table-header">
              <span>DATE / REFERENCE</span><span>ACCOUNT</span><span>DEBIT</span><span>CREDIT</span>
            </div>
            <EmptyState
              icon="accounting"
              title={activeTab === 'General ledger' ? 'No ledger activity to display' : 'Journal entry list is not connected'}
              detail={activeTab === 'General ledger'
                ? 'Posted invoice activity will appear here when the general ledger view is connected.'
                : 'Posted sales invoices already create balanced journal entries. Their register is still being built.'}
            />
          </section>
          <div className="accounting-shortcuts">
            <Link className="shortcut-card" to="/sales">
              <span className="shortcut-icon green-icon"><AppIcon name="sales" /></span>
              <span><strong>Sales invoices</strong><small>Create and post customer invoices</small></span>
              <AppIcon name="chevron" size={16} />
            </Link>
            <Link className="shortcut-card" to="/accounts">
              <span className="shortcut-icon lavender-icon"><AppIcon name="accounts" /></span>
              <span><strong>Chart of accounts</strong><small>Review your accounting structure</small></span>
              <AppIcon name="chevron" size={16} />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="reports-intro">
            <div>
              <h2>Financial reports</h2>
              <p>Choose a report to explore balances and activity.</p>
            </div>
            <label className="period-select">
              <span>Period</span>
              <select
                aria-label="Report period"
                onChange={(event) => setReportPeriod(event.target.value)}
                value={reportPeriod}
              >
                <option>This month</option><option>This quarter</option><option>This year</option>
              </select>
            </label>
          </div>
          <div className="report-card-grid">
            {reports.map((report) => (
              <button
                className="report-card"
                key={report.title}
                onClick={() => setSelectedReport(report)}
                type="button"
              >
                <span className={`card-icon ${report.tone}-icon`}><AppIcon name={report.icon} /></span>
                <span className="report-card-copy">
                  <strong>{report.title}</strong>
                  <small>{report.description}</small>
                </span>
                <AppIcon name="chevron" size={16} />
              </button>
            ))}
          </div>
          <section className="report-preview-panel">
            <div className="feature-panel-heading">
              <div><h2>Reports at a glance</h2><p>Your financial picture · {reportPeriod.toLowerCase()}</p></div>
              <span className="preview-badge">PREVIEW</span>
            </div>
            <div className="report-chart-empty">
              <div className="chart-grid-lines"><span /><span /><span /><span /></div>
              <div className="chart-columns" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
              <div className="chart-empty-caption">
                <span className="chart-empty-mark"><AppIcon name="reports" size={18} /></span>
                <strong>Report data will appear here</strong>
                <small>Post transactions to start seeing your financial trends.</small>
              </div>
            </div>
          </section>
          <div className="feature-note">
            <span className="note-icon">i</span>
            Live report calculations are not connected yet.
          </div>
          <AppSheet
            description={selectedReport?.description}
            onClose={() => setSelectedReport(null)}
            open={selectedReport !== null}
            title={selectedReport?.title ?? 'Report'}
          >
            <div className="report-sheet-body">
              <span className={`card-icon ${selectedReport?.tone ?? 'green'}-icon`}>
                <AppIcon name={selectedReport?.icon ?? 'reports'} />
              </span>
              <p>Report data will be available here when the accounting report workflow is connected.</p>
              <AppButton onClick={() => setSelectedReport(null)}>Done</AppButton>
            </div>
          </AppSheet>
        </>
      )}

      {isExpenses && (
        <AppSheet
          description={selectedReport?.description}
          onClose={() => setSelectedReport(null)}
          open={selectedReport !== null}
          title={selectedReport?.title ?? 'Expense entry'}
        >
          <div className="report-sheet-body">
            <span className="card-icon green-icon"><AppIcon name="expenses" /></span>
            <p>Supplier bills and expense posting are planned for this workspace.</p>
            <AppButton onClick={() => setSelectedReport(null)}>Got it</AppButton>
          </div>
        </AppSheet>
      )}
    </PageContainer>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: AppIconName;
}) {
  return (
    <div className="feature-summary-card">
      <span className="summary-icon"><AppIcon name={icon} size={17} /></span>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
      <small>Current company</small>
    </div>
  );
}

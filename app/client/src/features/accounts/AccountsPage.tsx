import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { useAuth } from '../../app/auth/AuthContext';
import { apiRequest } from '../../shared/api/client';
import { PageTitle } from '../../components/layout/PageTitle';
import { PageContainer } from '../../components/layout/PageContainer';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

type Account = {
  id: number;
  name: string;
  code: string | null;
  rootType: string;
  accountType: string | null;
  parentId: number | null;
  isGroup: boolean;
};

const rootOrder = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

export function AccountsPage() {
  const { company, loading: workspaceLoading } = useWorkspace();
  const { user } = useAuth();
  const canManageAccounts =
    user?.role === 'System Manager' || user?.role === 'Books Manager';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    apiRequest<{ accounts: Account[] }>(
      `/api/v1/companies/${company.id}/accounts`,
      { signal: controller.signal },
    )
      .then((response) => setAccounts(response.accounts))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load the chart of accounts.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [company]);

  const accountsByParent = useMemo(() => {
    const grouped = new Map<number | null, Account[]>();
    for (const account of accounts) {
      const siblings = grouped.get(account.parentId) ?? [];
      siblings.push(account);
      grouped.set(account.parentId, siblings);
    }
    for (const siblings of grouped.values()) {
      siblings.sort((left, right) => left.name.localeCompare(right.name));
    }
    return grouped;
  }, [accounts]);

  if (!workspaceLoading && !company) return <Navigate replace to="/setup" />;

  if (workspaceLoading || loading) {
    return (
      <section className="dashboard">
        <Spinner label="Loading your chart of accounts…" />
      </section>
    );
  }

  return (
    <PageContainer className="accounts-page">
      <PageTitle
        description={`Review how ${company?.name} is organized before adding transactions.`}
        eyebrow="ACCOUNTING FOUNDATION"
        title="Chart of accounts"
      >
        <Link className="secondary-button" to="/dashboard">Back to dashboard</Link>
      </PageTitle>

      <div className="accounts-summary">
        <div><strong>{accounts.length}</strong><span>accounts</span></div>
        <div><strong>{accounts.filter(({ isGroup }) => isGroup).length}</strong><span>groups</span></div>
        <div><strong>{accounts.filter(({ isGroup }) => !isGroup).length}</strong><span>ledger accounts</span></div>
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}

      <div className="account-tree-card">
        <div className="account-tree-header">
          <span>ACCOUNT</span>
          <span>TYPE</span>
          <span>KIND</span>
        </div>
        {accounts.length === 0 && !error && (
          <EmptyState
            compact
            detail="Add a group or ledger account to build this company’s chart."
            icon="accounts"
            title="No accounts configured"
          />
        )}
        {rootOrder.map((rootType) => {
          const roots = (accountsByParent.get(null) ?? []).filter(
            (account) => account.rootType === rootType,
          );
          if (roots.length === 0) return null;
          return (
            <section className="account-root" key={rootType}>
              <h2>{rootType}</h2>
              {roots.map((account) => (
                <AccountBranch
                  account={account}
                  accountsByParent={accountsByParent}
                  canManage={canManageAccounts}
                  companyId={company!.id}
                  depth={0}
                  onUpdated={(updated) =>
                    setAccounts((current) =>
                      current.map((item) => item.id === updated.id ? updated : item),
                    )
                  }
                  key={account.id}
                />
              ))}
            </section>
          );
        })}
      </div>
      <p className="accounts-note">
        This starter chart is a foundation, not a complete regional chart.
        Account names can be changed; an assigned account type cannot.
      </p>
    </PageContainer>
  );
}

function AccountBranch({
  account,
  accountsByParent,
  canManage,
  companyId,
  depth,
  onUpdated,
}: {
  account: Account;
  accountsByParent: Map<number | null, Account[]>;
  canManage: boolean;
  companyId: number;
  depth: number;
  onUpdated: (account: Account) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [code, setCode] = useState(account.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const children = accountsByParent.get(account.id) ?? [];

  async function saveChanges() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ account: Account }>(
        `/api/v1/companies/${companyId}/accounts/${account.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            code,
          }),
        },
      );
      onUpdated(response.account);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`account-row${account.isGroup ? ' account-group' : ''}`}>
        <div className="account-name-cell" style={{ paddingLeft: `${depth * 24 + 14}px` }}>
          <span className="account-tree-marker" aria-hidden="true">
            {account.isGroup ? '⌄' : '·'}
          </span>
          <span>{account.name}</span>
          {account.code && <small>{account.code}</small>}
        </div>
        <span className="account-type-cell">{account.accountType ?? '—'}</span>
        <span className={`account-kind ${account.isGroup ? 'kind-group' : ''}`}>
          {account.isGroup ? 'Group' : 'Ledger'}
        </span>
      </div>
      {canManage && (
        <div className="account-management-controls" style={{ paddingLeft: `${depth * 24 + 30}px` }}>
          {editing ? (
            <>
              <label className="account-edit-field">
                <span className="visually-hidden">Account name</span>
                <input
                  aria-label={`Account name for ${account.name}`}
                  maxLength={140}
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <label className="account-edit-field">
                <span className="visually-hidden">Account code</span>
                <input
                  aria-label={`Account code for ${account.name}`}
                  maxLength={40}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Account code"
                  value={code}
                />
              </label>
              <button className="text-link" disabled={busy} onClick={() => void saveChanges()} type="button">
                Save
              </button>
              <button className="text-link" onClick={() => setEditing(false)} type="button">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="text-link" onClick={() => setEditing(true)} type="button">
                Edit
              </button>
            </>
          )}
          {error && <span className="account-inline-error" role="alert">{error}</span>}
        </div>
      )}
      {children.map((child) => (
        <AccountBranch
          account={child}
          accountsByParent={accountsByParent}
          canManage={canManage}
          companyId={companyId}
          depth={depth + 1}
          onUpdated={onUpdated}
          key={child.id}
        />
      ))}
    </>
  );
}

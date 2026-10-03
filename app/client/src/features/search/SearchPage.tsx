import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthContext';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { AppIcon } from '../../components/ui/AppIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { apiRequest } from '../../shared/api/client';

type SearchCategory = 'Pages' | 'Customers' | 'Invoices' | 'Accounts';
type FilterCategory = 'All' | SearchCategory;
type SearchItem = {
  id: string;
  label: string;
  detail: string;
  category: SearchCategory;
  to: string;
  searchText: string;
  invoiceId?: number;
};
type Customer = {
  id: number;
  name: string;
  email: string | null;
  role: 'Customer' | 'Supplier' | 'Both';
};
type Account = {
  id: number;
  name: string;
  code: string | null;
  rootType: string;
  accountType: string | null;
};
type Invoice = {
  id: number;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  currency: string;
  currencyPrecision: number;
  subtotalMinor: number;
  status: 'Draft' | 'Submitted' | 'Cancelled';
};

const categories: FilterCategory[] = ['All', 'Pages', 'Customers', 'Invoices', 'Accounts'];
const pages: SearchItem[] = [
  { id: 'dashboard', label: 'Dashboard', detail: 'Your business overview', category: 'Pages', to: '/dashboard', searchText: 'home overview' },
  { id: 'sales', label: 'Sales invoices', detail: 'Customers and sales activity', category: 'Pages', to: '/sales', searchText: 'sales invoices customers' },
  { id: 'expenses', label: 'Purchases', detail: 'Expenses and supplier bills', category: 'Pages', to: '/expenses', searchText: 'purchases expenses suppliers' },
  { id: 'reports', label: 'Reports', detail: 'Financial reports', category: 'Pages', to: '/reports', searchText: 'reports financial' },
  { id: 'accounts', label: 'Chart of accounts', detail: 'Your company accounts', category: 'Pages', to: '/accounts', searchText: 'accounts chart accounting' },
  { id: 'accounting', label: 'Accounting', detail: 'Journal entries and ledgers', category: 'Pages', to: '/accounting', searchText: 'accounting journal ledger' },
];

function formatInvoiceAmount(invoice: Invoice): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: invoice.currency,
  }).format(invoice.subtotalMinor / 10 ** invoice.currencyPrecision);
}

export function SearchPage() {
  const { company, loading: workspaceLoading } = useWorkspace();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FilterCategory>('All');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const base = `/api/v1/companies/${company.id}`;
    Promise.all([
      apiRequest<{ customers: Customer[] }>(`${base}/sales/customers`, { signal: controller.signal }),
      apiRequest<{ accounts: Account[] }>(`${base}/accounts`, { signal: controller.signal }),
      apiRequest<{ invoices: Invoice[] }>(`${base}/sales/invoices`, { signal: controller.signal }),
    ])
      .then(([customerResult, accountResult, invoiceResult]) => {
        setCustomers(customerResult.customers);
        setAccounts(accountResult.accounts);
        setInvoices(invoiceResult.invoices);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load search results.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [company]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const items = useMemo<SearchItem[]>(() => [
    ...pages,
    ...(user?.role === 'System Manager'
      ? [{ id: 'users', label: 'Manage users', detail: 'People and access to this site', category: 'Pages' as const, to: '/settings/users', searchText: 'users people access settings' }]
      : []),
    ...customers.map((customer) => ({
      id: `customer-${customer.id}`,
      label: customer.name,
      detail: [customer.email, customer.role].filter(Boolean).join(' · '),
      category: 'Customers' as const,
      to: '/sales#customers',
      searchText: `${customer.name} ${customer.email ?? ''} ${customer.role}`,
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      label: invoice.invoiceNumber,
      detail: `${invoice.customerName} · ${invoice.invoiceDate} · ${invoice.status} · ${formatInvoiceAmount(invoice)}`,
      category: 'Invoices' as const,
      to: '/sales',
      invoiceId: invoice.id,
      searchText: `${invoice.invoiceNumber} ${invoice.customerName} ${invoice.invoiceDate} ${invoice.status}`,
    })),
    ...accounts.map((account) => ({
      id: `account-${account.id}`,
      label: account.name,
      detail: [account.code, account.accountType, account.rootType].filter(Boolean).join(' · '),
      category: 'Accounts' as const,
      to: '/accounts',
      searchText: `${account.name} ${account.code ?? ''} ${account.accountType ?? ''} ${account.rootType}`,
    })),
  ], [accounts, customers, invoices, user?.role]);

  const matchingItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!normalizedQuery) return item.category === 'Pages';
      return `${item.label} ${item.detail} ${item.searchText}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [category, items, query]);

  if (!workspaceLoading && !company) return <Navigate replace to="/setup" />;
  if (workspaceLoading || loading) {
    return <section className="search-loading"><Spinner label="Loading search…" /></section>;
  }

  return (
    <section className="books-search-page">
      <div className="search-toolbar">
        <label className="search-input">
          <AppIcon name="search" size={18} />
          <input
            aria-label="Search Books"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type to search..."
            ref={inputRef}
            type="search"
            value={query}
          />
        </label>
        <div aria-label="Search categories" className="search-category-list">
          {categories.map((item) => (
            <button
              aria-pressed={category === item}
              className={`search-category${category === item ? ' active' : ''}`}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <p className="search-section-label">
        {query.trim() ? 'Results' : 'Quick access'}
      </p>
      {error && <div className="form-alert search-error" role="alert">{error}</div>}
      {matchingItems.length > 0 ? (
        <nav aria-label="Search results" className="search-result-list">
          {matchingItems.map((item) => (
            <Link
              className="search-result"
              key={item.id}
              state={item.invoiceId ? { invoiceId: item.invoiceId } : undefined}
              to={item.to}
            >
              <span className="search-result-copy">
                <strong>{item.label}</strong>
                {item.detail && <small>{item.detail}</small>}
              </span>
              <span className={`search-result-category category-${item.category.toLowerCase()}`}>
                {item.category}
              </span>
            </Link>
          ))}
        </nav>
      ) : (
        !error && (
          <EmptyState
            compact
            detail={query.trim() ? 'Try a different search term or category.' : 'Choose a category or search for a customer, invoice, or account.'}
            icon="search"
            title={query.trim() ? 'No results' : 'Nothing to show'}
          />
        )
      )}
    </section>
  );
}

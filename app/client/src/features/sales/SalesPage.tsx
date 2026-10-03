import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { ApiError, apiRequest } from '../../shared/api/client';
import { AppSheet } from '../../components/ui/AppSheet';
import { AppIcon } from '../../components/ui/AppIcon';

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
  isGroup: boolean;
};
type Invoice = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  invoiceDate: string;
  receivableAccountId: number | null;
  receivableAccountName: string | null;
  currency: string;
  currencyPrecision: number;
  subtotalMinor: number;
  status: 'Draft' | 'Submitted' | 'Cancelled';
  lines: Array<{
    id: number;
    description: string;
    quantityMilli: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    incomeAccountId: number;
    incomeAccountName: string;
  }>;
  journalEntries: Array<{
    id: number;
    entryDate: string;
    description: string;
    sourceType: 'Sales Invoice' | 'Reversal';
    lines: Array<{
      accountId: number;
      accountName: string;
      debitMinor: number;
      creditMinor: number;
    }>;
  }>;
};
type InvoiceSummary = Pick<
  Invoice,
  | 'id'
  | 'invoiceNumber'
  | 'customerId'
  | 'customerName'
  | 'invoiceDate'
  | 'receivableAccountId'
  | 'receivableAccountName'
  | 'currency'
  | 'currencyPrecision'
  | 'subtotalMinor'
  | 'status'
>;

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDecimal(value: string, scale: number): number {
  const pattern = scale === 0
    ? /^\d+$/
    : new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`);
  if (!pattern.test(value)) return 0;
  const [whole, fraction = ''] = value.split('.');
  const result = Number(whole) * 10 ** scale + Number(fraction.padEnd(scale, '0'));
  return Number.isSafeInteger(result) ? result : 0;
}

function formatMoney(minor: number, currency: string, precision: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 10 ** precision);
}

function getCurrencyPrecision(currency: string): number {
  const precision = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits;
  if (precision === undefined) {
    throw new Error(`Currency "${currency}" has no defined minor-unit precision.`);
  }
  return precision;
}

function calculateLineTotalMinor(quantityMilli: number, unitPriceMinor: number): number {
  if (quantityMilli < 1 || unitPriceMinor < 1) return 0;
  const total = (BigInt(quantityMilli) * BigInt(unitPriceMinor) + 500n) / 1000n;
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : 0;
}

export function SalesPage() {
  const { company, loading: workspaceLoading } = useWorkspace();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    invoice: Invoice;
    action: 'submit' | 'cancel';
  } | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [receivableAccountId, setReceivableAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => dateValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const eligibleCustomers = customers.filter(
    (customer) => customer.role === 'Customer' || customer.role === 'Both',
  );
  const incomeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          !account.isGroup && account.rootType === 'Income',
      ),
    [accounts],
  );
  const receivableAccounts = useMemo(
    () => accounts.filter(
      (account) =>
        !account.isGroup && account.rootType === 'Asset' && account.accountType === 'Receivable',
    ),
    [accounts],
  );
  const currencyPrecision = useMemo(() => {
    if (!company) return 2;
    return getCurrencyPrecision(company.currency);
  }, [company]);
  const invoiceTotal = useMemo(() => {
    const qtyMilli = parseDecimal(quantity, 3);
    const priceMinor = parseDecimal(unitPrice, currencyPrecision);
    return calculateLineTotalMinor(qtyMilli, priceMinor);
  }, [quantity, unitPrice, currencyPrecision]);

  useEffect(() => {
    if (!company) return;
    const controller = new AbortController();
    const base = `/api/v1/companies/${company.id}`;
    Promise.all([
      apiRequest<{ customers: Customer[] }>(`${base}/sales/customers`, {
        signal: controller.signal,
      }),
      apiRequest<{ accounts: Account[] }>(`${base}/accounts`, {
        signal: controller.signal,
      }),
      apiRequest<{ invoices: InvoiceSummary[] }>(`${base}/sales/invoices`, {
        signal: controller.signal,
      }),
    ])
      .then(([customerResult, accountResult, invoiceResult]) => {
        setCustomers(customerResult.customers);
        setAccounts(accountResult.accounts);
        setInvoices(invoiceResult.invoices);
        setCustomerId((current) =>
          current || String(customerResult.customers.find((item) =>
            item.role === 'Customer' || item.role === 'Both',
          )?.id ?? ''),
        );
        setIncomeAccountId((current) =>
          current ||
          String(
            accountResult.accounts.find(
              (item) =>
                !item.isGroup && item.rootType === 'Income',
            )?.id ?? '',
          ),
        );
        setReceivableAccountId((current) =>
          current ||
          String(
            accountResult.accounts.find(
              (item) =>
                !item.isGroup && item.rootType === 'Asset' && item.accountType === 'Receivable',
            )?.id ?? '',
          ),
        );
        const today = dateValue(new Date());
        const defaultDate =
          today < company.fiscalYearStart || today > company.fiscalYearEnd
            ? company.fiscalYearStart
            : today;
        setInvoiceDate((current) =>
          current < company.fiscalYearStart || current > company.fiscalYearEnd
            ? defaultDate
            : current,
        );
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [company]);

  if (!workspaceLoading && !company) return <Navigate replace to="/setup" />;
  if (workspaceLoading || loading) {
    return <section className="dashboard">Loading sales workspace…</section>;
  }

  async function refreshInvoices() {
    if (!company) return;
    const response = await apiRequest<{ invoices: InvoiceSummary[] }>(
      `/api/v1/companies/${company.id}/sales/invoices`,
    );
    setInvoices(response.invoices);
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ customer: Customer }>(
        `/api/v1/companies/${company.id}/sales/customers`,
        {
          method: 'POST',
          body: JSON.stringify({ name: customerName, email: customerEmail }),
        },
      );
      setCustomers((current) => [...current, response.customer]);
      setCustomerId(String(response.customer.id));
      setCustomerName('');
      setCustomerEmail('');
      setNotice('Customer added.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;
    const quantityMilli = parseDecimal(quantity, 3);
    const unitPriceMinor = parseDecimal(unitPrice, currencyPrecision);
    if (
      !quantityMilli ||
      !unitPriceMinor ||
      !incomeAccountId ||
      !customerId ||
      !receivableAccountId
    ) {
      setError('Enter a valid quantity, unit price, customer, and ledger accounts.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ invoice: Invoice }>(
        `/api/v1/companies/${company.id}/sales/invoices`,
        {
          method: 'POST',
          body: JSON.stringify({
            customerId: Number(customerId),
            receivableAccountId: Number(receivableAccountId),
            invoiceDate,
            lines: [{
              description,
              quantityMilli,
              unitPriceMinor,
              incomeAccountId: Number(incomeAccountId),
            }],
          }),
        },
      );
      setInvoices((current) => [response.invoice, ...current]);
      setSelectedInvoice(response.invoice);
      setDescription('');
      setUnitPrice('');
      setNotice(`${response.invoice.invoiceNumber} saved as a draft.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function changeInvoiceStatus(invoice: Invoice, action: 'submit' | 'cancel') {
    if (!company) return;
    setPendingAction({ invoice, action });
  }

  async function confirmInvoiceStatus() {
    if (!company || !pendingAction) return;
    const { invoice, action } = pendingAction;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ invoice: Invoice }>(
        `/api/v1/companies/${company.id}/sales/invoices/${invoice.id}/${action}`,
        { method: 'POST' },
      );
      setSelectedInvoice(response.invoice);
      await refreshInvoices();
      setNotice(
        action === 'submit'
          ? `${invoice.invoiceNumber} posted to the ledger.`
          : `${invoice.invoiceNumber} cancelled with a reversing journal entry.`,
      );
      setPendingAction(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function openInvoice(invoice: InvoiceSummary) {
    if (!company) return;
    setError(null);
    try {
      const response = await apiRequest<{ invoice: Invoice }>(
        `/api/v1/companies/${company.id}/sales/invoices/${invoice.id}`,
      );
      setSelectedInvoice(response.invoice);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <section className="dashboard sales-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">SALES WORKFLOW</div>
          <h1>Sales invoices</h1>
          <p className="welcome-copy">
            Create a draft, review it, then post it to the general ledger.
          </p>
        </div>
        <Link className="secondary-button" to="/accounts">Chart of accounts</Link>
      </div>

      {error && <div className="form-alert sales-message" role="alert">{error}</div>}
      {notice && <div className="user-notice sales-message" role="status">{notice}</div>}

      <div className="sales-workspace">
        <div className="sales-forms">
          <section className="sales-card">
            <header className="user-admin-heading">
              <div><h2>Add a customer</h2><p>Customers are shared across this company site.</p></div>
            </header>
            <form className="sales-form" onSubmit={addCustomer}>
              <label className="field">
                <span>Customer name</span>
                <input
                  maxLength={140}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                  value={customerName}
                />
              </label>
              <label className="field">
                <span>Contact email <small>Optional</small></span>
                <input
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  type="email"
                  value={customerEmail}
                />
              </label>
              <button className="secondary-button" disabled={busy} type="submit">
                Add customer
              </button>
            </form>
          </section>

          <section className="sales-card">
            <header className="user-admin-heading">
              <div><h2>New invoice</h2><p>Currency precision follows the selected company currency; tax is not applied yet.</p></div>
            </header>
            {eligibleCustomers.length === 0 ? (
              <p className="empty-state">Add a customer before creating an invoice.</p>
            ) : incomeAccounts.length === 0 ? (
              <p className="empty-state">Add an income ledger account before creating an invoice.</p>
            ) : receivableAccounts.length === 0 ? (
              <p className="empty-state">Add an Accounts Receivable ledger account before creating an invoice.</p>
            ) : (
              <form className="sales-form" onSubmit={createInvoice}>
                <label className="field">
                  <span>Customer</span>
                  <select onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
                    {eligibleCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Invoice date</span>
                  <input
                    max={company?.fiscalYearEnd}
                    min={company?.fiscalYearStart}
                    onChange={(event) => setInvoiceDate(event.target.value)}
                    required
                    type="date"
                    value={invoiceDate}
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <input
                    maxLength={240}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    value={description}
                  />
                </label>
                <div className="sales-line-grid">
                  <label className="field">
                    <span>Quantity</span>
                    <input
                      inputMode="decimal"
                      onChange={(event) => setQuantity(event.target.value)}
                      pattern="\\d+(\\.\\d{1,3})?"
                      required
                      value={quantity}
                    />
                    <small>Up to 3 decimal places.</small>
                  </label>
                  <label className="field">
                    <span>Unit price ({company?.currency})</span>
                    <input
                      inputMode="decimal"
                      onChange={(event) => setUnitPrice(event.target.value)}
                      pattern={currencyPrecision === 0
                        ? '\\d+'
                        : `\\d+(\\.\\d{1,${currencyPrecision}})?`}
                      required
                      value={unitPrice}
                    />
                    <small>
                      {currencyPrecision === 0
                        ? 'No fractional currency units.'
                        : `Up to ${currencyPrecision} decimal place${currencyPrecision === 1 ? '' : 's'}.`}
                    </small>
                  </label>
                </div>
                <label className="field">
                  <span>Receivable account</span>
                  <select
                    onChange={(event) => setReceivableAccountId(event.target.value)}
                    value={receivableAccountId}
                  >
                    {receivableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code ? `${account.code} · ` : ''}{account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Income account</span>
                  <select
                    onChange={(event) => setIncomeAccountId(event.target.value)}
                    value={incomeAccountId}
                  >
                    {incomeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code ? `${account.code} · ` : ''}{account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sales-total">
                  <span>Invoice total</span>
                  <strong>{formatMoney(invoiceTotal, company?.currency ?? 'USD', currencyPrecision)}</strong>
                </div>
                <button className="primary-button" disabled={busy || invoiceTotal < 1} type="submit">
                  Save draft
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="sales-card sales-invoice-list">
          <header className="user-admin-heading">
            <div><h2>Invoices</h2><p>{invoices.length} invoice{invoices.length === 1 ? '' : 's'}</p></div>
          </header>
          {invoices.length === 0 ? (
            <p className="empty-state">No sales invoices yet.</p>
          ) : (
            <div className="invoice-list">
              {invoices.map((invoice) => (
                <button
                  className={`invoice-list-row${selectedInvoice?.id === invoice.id ? ' selected' : ''}`}
                  key={invoice.id}
                  onClick={() => void openInvoice(invoice)}
                  type="button"
                >
                  <span className="invoice-main">
                    <strong>{invoice.invoiceNumber}</strong>
                    <small>{invoice.customerName} · {invoice.invoiceDate}</small>
                  </span>
                  <strong>{formatMoney(invoice.subtotalMinor, invoice.currency, invoice.currencyPrecision)}</strong>
                  <span className={`invoice-status status-${invoice.status.toLowerCase()}`}>
                    {invoice.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedInvoice && (
            <div className="invoice-detail">
              <div className="invoice-detail-heading">
                <div>
                  <div className="eyebrow">{selectedInvoice.status.toUpperCase()}</div>
                  <h3>{selectedInvoice.invoiceNumber}</h3>
                  <p>
                    {selectedInvoice.customerName} · {selectedInvoice.invoiceDate}
                    {selectedInvoice.receivableAccountName
                      ? ` · ${selectedInvoice.receivableAccountName}`
                      : ' · No receivable account selected'}
                  </p>
                </div>
                <strong>{formatMoney(selectedInvoice.subtotalMinor, selectedInvoice.currency, selectedInvoice.currencyPrecision)}</strong>
              </div>
              <div className="invoice-detail-lines">
                {selectedInvoice.lines.map((line) => (
                  <div className="invoice-detail-line" key={line.id}>
                    <span>{line.description}<small>{line.incomeAccountName}</small></span>
                    <span>{(line.quantityMilli / 1000).toLocaleString()} × {formatMoney(line.unitPriceMinor, selectedInvoice.currency, selectedInvoice.currencyPrecision)}</span>
                    <strong>{formatMoney(line.lineTotalMinor, selectedInvoice.currency, selectedInvoice.currencyPrecision)}</strong>
                  </div>
                ))}
              </div>
              {selectedInvoice.journalEntries.map((entry) => (
                <div className="journal-entry" key={entry.id}>
                  <h4>{entry.sourceType === 'Reversal' ? 'Reversing entry' : 'Posted journal'} · {entry.entryDate}</h4>
                  {entry.lines.map((line, index) => (
                    <div className="journal-line" key={`${entry.id}-${index}`}>
                      <span>{line.accountName}</span>
                      <span>{line.debitMinor ? `Dr ${formatMoney(line.debitMinor, selectedInvoice.currency, selectedInvoice.currencyPrecision)}` : '—'}</span>
                      <span>{line.creditMinor ? `Cr ${formatMoney(line.creditMinor, selectedInvoice.currency, selectedInvoice.currencyPrecision)}` : '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
              {selectedInvoice.status === 'Draft' && (
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void changeInvoiceStatus(selectedInvoice, 'submit')}
                  type="button"
                >
                  Post invoice
                </button>
              )}
              {selectedInvoice.status === 'Submitted' && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void changeInvoiceStatus(selectedInvoice, 'cancel')}
                  type="button"
                >
                  Cancel with reversal
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      <AppSheet
        className="confirmation-sheet"
        description={
          pendingAction?.action === 'cancel'
            ? 'This adds a reversing journal entry dated on the invoice date. The invoice itself remains in your records.'
            : 'The invoice will be posted to your general ledger and can no longer be edited.'
        }
        onClose={() => !busy && setPendingAction(null)}
        open={pendingAction !== null}
        title={pendingAction?.action === 'cancel' ? 'Cancel invoice?' : 'Post invoice?'}
      >
        <div className="confirmation-body">
          <div className="confirmation-document">
            <span className="confirmation-icon"><AppIcon name="sales" /></span>
            <span>
              <strong>{pendingAction?.invoice.invoiceNumber}</strong>
              <small>{pendingAction?.invoice.customerName}</small>
            </span>
            {pendingAction && (
              <b>{formatMoney(
                pendingAction.invoice.subtotalMinor,
                pendingAction.invoice.currency,
                pendingAction.invoice.currencyPrecision,
              )}</b>
            )}
          </div>
          <div className="confirmation-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPendingAction(null)}
              type="button"
            >
              Keep invoice
            </button>
            <button
              className={pendingAction?.action === 'cancel' ? 'danger-button' : 'primary-button'}
              disabled={busy}
              onClick={() => void confirmInvoiceStatus()}
              type="button"
            >
              {busy ? 'Working…' : pendingAction?.action === 'cancel' ? 'Confirm cancellation' : 'Post invoice'}
            </button>
          </div>
        </div>
      </AppSheet>
    </section>
  );
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError && cause.details?.length) {
    return cause.details.map(({ message }) => message).join(' ');
  }
  if (cause instanceof ApiError && cause.code === 'INVOICE_OUTSIDE_FISCAL_YEAR') {
    return 'Choose an invoice date within the company fiscal year.';
  }
  if (cause instanceof Error) return cause.message;
  return 'The sales operation could not be completed.';
}

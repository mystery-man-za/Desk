import type { RootType } from './types.js';

export type StarterAccount = {
  name: string;
  rootType: RootType;
  accountType: string | null;
  parentName: string | null;
  isGroup: boolean;
};

export const STARTER_CHART_ID = 'starter';

export function starterChart(bankAccountName: string): StarterAccount[] {
  return [
    {
      name: 'Assets',
      rootType: 'Asset',
      accountType: null,
      parentName: null,
      isGroup: true,
    },
    {
      name: 'Current Assets',
      rootType: 'Asset',
      accountType: null,
      parentName: 'Assets',
      isGroup: true,
    },
    {
      name: 'Bank Accounts',
      rootType: 'Asset',
      accountType: 'Bank',
      parentName: 'Current Assets',
      isGroup: true,
    },
    {
      name: bankAccountName,
      rootType: 'Asset',
      accountType: 'Bank',
      parentName: 'Bank Accounts',
      isGroup: false,
    },
    {
      name: 'Cash',
      rootType: 'Asset',
      accountType: 'Cash',
      parentName: 'Current Assets',
      isGroup: false,
    },
    {
      name: 'Accounts Receivable',
      rootType: 'Asset',
      accountType: 'Receivable',
      parentName: 'Current Assets',
      isGroup: false,
    },
    {
      name: 'Liabilities',
      rootType: 'Liability',
      accountType: null,
      parentName: null,
      isGroup: true,
    },
    {
      name: 'Current Liabilities',
      rootType: 'Liability',
      accountType: null,
      parentName: 'Liabilities',
      isGroup: true,
    },
    {
      name: 'Accounts Payable',
      rootType: 'Liability',
      accountType: 'Payable',
      parentName: 'Current Liabilities',
      isGroup: false,
    },
    {
      name: 'Equity',
      rootType: 'Equity',
      accountType: 'Equity',
      parentName: null,
      isGroup: true,
    },
    {
      name: 'Retained Earnings',
      rootType: 'Equity',
      accountType: 'Equity',
      parentName: 'Equity',
      isGroup: false,
    },
    {
      name: 'Income',
      rootType: 'Income',
      accountType: null,
      parentName: null,
      isGroup: true,
    },
    {
      name: 'Sales Revenue',
      rootType: 'Income',
      accountType: 'Income Account',
      parentName: 'Income',
      isGroup: false,
    },
    {
      name: 'Expenses',
      rootType: 'Expense',
      accountType: null,
      parentName: null,
      isGroup: true,
    },
    {
      name: 'Operating Expenses',
      rootType: 'Expense',
      accountType: 'Expense Account',
      parentName: 'Expenses',
      isGroup: true,
    },
    {
      name: 'General Expenses',
      rootType: 'Expense',
      accountType: 'Expense Account',
      parentName: 'Operating Expenses',
      isGroup: false,
    },
    {
      name: 'Cost of Goods Sold',
      rootType: 'Expense',
      accountType: 'Cost of Goods Sold',
      parentName: 'Expenses',
      isGroup: false,
    },
  ];
}

export const ROOT_TYPES = [
  'Asset',
  'Liability',
  'Equity',
  'Income',
  'Expense',
] as const;

export type RootType = (typeof ROOT_TYPES)[number];

export const ACCOUNT_TYPES = [
  'Accumulated Depreciation',
  'Bank',
  'Cash',
  'Chargeable',
  'Cost of Goods Sold',
  'Depreciation',
  'Equity',
  'Expense Account',
  'Expenses Included In Valuation',
  'Fixed Asset',
  'Income Account',
  'Payable',
  'Receivable',
  'Round Off',
  'Stock',
  'Stock Adjustment',
  'Stock Received But Not Billed',
  'Tax',
  'Temporary',
] as const;

export type AccountRecord = {
  id: number;
  companyId: number;
  name: string;
  code: string | null;
  rootType: RootType;
  accountType: string | null;
  parentId: number | null;
  isGroup: boolean;
  createdAt: string;
};

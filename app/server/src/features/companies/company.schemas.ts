import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date.');

export const createCompanySchema = z
  .object({
    name: z.string().trim().min(1).max(140),
    fullname: z.string().trim().min(1).max(140),
    email: z.string().trim().email().max(254),
    country: z.string().trim().min(1).max(100),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Use a three-letter currency code.')
      .transform((value) => value.toUpperCase()),
    timeZone: z.string().trim().min(1).max(100),
    fiscalYearStart: dateSchema,
    fiscalYearEnd: dateSchema,
    chartId: z.literal('starter'),
    bankAccountName: z.string().trim().min(1).max(140),
  })
  .refine(
    ({ fiscalYearStart, fiscalYearEnd }) => fiscalYearEnd > fiscalYearStart,
    {
      path: ['fiscalYearEnd'],
      message: 'Fiscal year end must be after the start date.',
    },
  )
  .refine(
    ({ timeZone }) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone });
        return true;
      } catch {
        return false;
      }
    },
    { path: ['timeZone'], message: 'Enter a valid IANA time zone.' },
  );

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

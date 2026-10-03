import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ApiError, apiRequest } from '../../shared/api/client';

export type CompanySummary = {
  id: number;
  name: string;
  setupComplete: boolean;
  createdAt: string;
  country: string;
  currency: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
};

type WorkspaceValue = {
  company: CompanySummary | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider() {
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ companies: CompanySummary[] }>(
        '/api/v1/companies',
      );
      const summary = response.companies[0];
      if (!summary) {
        setCompany(null);
        return;
      }
      const details = await apiRequest<{ company: CompanySummary }>(
        `/api/v1/companies/${summary.id}`,
      );
      setCompany(details.company);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setCompany(null);
        setError('Your session expired. Sign in again.');
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load this Books site.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({ company, loading, error, reload }),
    [company, loading, error, reload],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      <Outlet />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}

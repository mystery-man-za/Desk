import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { apiRequest, ApiError } from '../../shared/api/client';

export type SessionUser = {
  id: number;
  email: string;
  fullname: string;
  role: 'System Manager' | 'Books Manager' | 'Books User';
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  bootstrap: (input: { email: string; fullname: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setError(null);
    try {
      const response = await apiRequest<{ user: SessionUser }>(
        '/api/v1/auth/session',
      );
      setUser(response.user);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setUser(null);
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not check your sign-in session.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<{ user: SessionUser }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    setUser(response.user);
    setError(null);
  }, []);

  const bootstrap = useCallback(
    async (input: { email: string; fullname: string; password: string }) => {
      const response = await apiRequest<{ user: SessionUser }>(
        '/api/v1/auth/bootstrap',
        { method: 'POST', body: JSON.stringify(input) },
      );
      setUser(response.user);
      setError(null);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await apiRequest<void>('/api/v1/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, signIn, bootstrap, signOut }),
    [user, loading, error, signIn, bootstrap, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

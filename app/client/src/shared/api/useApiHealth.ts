import { useEffect, useState } from 'react';
import { getJson } from './client';

type HealthResponse = {
  status: 'ok';
  database: 'sqlite';
};

type ApiState = 'checking' | 'connected' | 'error';

export function useApiHealth() {
  const [state, setState] = useState<ApiState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    getJson<HealthResponse>('/api/health', controller.signal)
      .then((health) => {
        setState(
          health.status === 'ok' && health.database === 'sqlite'
            ? 'connected'
            : 'error',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });

    return () => controller.abort();
  }, []);

  return { state };
}

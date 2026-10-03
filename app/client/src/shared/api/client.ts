type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Array<{ field?: string; message?: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiErrorBody & T;
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      payload.error?.code,
      payload.error?.details,
    );
  }
  return payload;
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { signal });
}

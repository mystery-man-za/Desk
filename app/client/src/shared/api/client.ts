export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

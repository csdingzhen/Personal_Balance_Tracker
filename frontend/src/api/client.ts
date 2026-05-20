const BASE = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include', // always send the httpOnly auth cookie
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (res.status === 401) {
    // Session expired — redirect to login without a full page reload loop
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `API ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get:      <T>(path: string)                        => request<T>(path),
  post:     <T>(path: string, body: unknown)         => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:      <T>(path: string, body: unknown)         => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  del:      <T>(path: string)                        => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData)        => {
    return fetch(`${BASE}${path}`, { method: 'POST', body: form, credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `API ${res.status}`);
        }
        return res.json() as Promise<T>;
      });
  },
};

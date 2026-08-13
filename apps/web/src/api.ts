const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  firstLoginCompleted: boolean;
  workId: string;
  workCode: string;
  workName: string;
  role: string;
  canEmitPt: boolean;
};

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

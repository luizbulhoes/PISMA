import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type SessionUser } from './api';

type AuthState = {
  token: string | null;
  user: SessionUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = 'pisma.session';

function loadStored(): { token: string; user: SessionUser } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(token: string, user: SessionUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [user, setUser] = useState<SessionUser | null>(stored?.user ?? null);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api<{ accessToken: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(result.accessToken);
    setUser(result.user);
    persist(result.accessToken, result.user);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await api('/auth/logout', { method: 'POST', token });
      } catch {
        /* ignore */
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token || !user) return;
    const next = {
      ...user,
      firstLoginCompleted: true,
    };
    setUser(next);
    persist(token, next);
  }, [token, user]);

  const value = useMemo(
    () => ({ token, user, login, logout, refreshUser }),
    [token, user, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}

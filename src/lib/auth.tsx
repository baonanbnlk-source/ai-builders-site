// Auth context + hook. Boots from token in localStorage on mount.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken, type ApiUser } from "./api";
import { refreshUsers, upsertUser } from "./userStore";

type AuthState = {
  user: ApiUser | null;
  loading: boolean;
  error: string | null;
};

type AuthCtx = AuthState & {
  login: (email: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

// Global event name + helper so any write-action entry point can request the
// login dialog without prop-drilling. The dialog is mounted once in Layout.
export const LOGIN_OPEN_EVENT = "login:open";
export function openLoginDialog() {
  window.dispatchEvent(new Event(LOGIN_OPEN_EVENT));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  const fetchMe = useCallback(async () => {
    if (!getToken()) {
      setState({ user: null, loading: false, error: null });
      return;
    }
    try {
      const { user } = await api.me();
      upsertUser(user);
      setState({ user, loading: false, error: null });
    } catch {
      setToken(null);
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    fetchMe();
    refreshUsers();
    const onAuth = () => fetchMe();
    window.addEventListener("auth:update", onAuth);
    return () => window.removeEventListener("auth:update", onAuth);
  }, [fetchMe]);

  const login = useCallback(async (email: string, name?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { token, user } = await api.login(email, name);
      setToken(token);
      upsertUser(user);
      setState({ user, loading: false, error: null });
      refreshUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "登录失败";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    setState({ user: null, loading: false, error: null });
  }, []);

  return (
    <Ctx.Provider value={{ ...state, isLoggedIn: !!state.user, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

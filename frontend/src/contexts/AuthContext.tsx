import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi, LoginRequest } from '../api/authApi';
import { getApiErrorMessage } from '../api/http';
import { User } from '../types/api';
import { sessionEvents, tokenStore } from '../utils/session';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => tokenStore.getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    tokenStore.clearAccessToken();
    setAccessToken(null);
    setUser(null);
  }, []);

  const reloadUser = useCallback(async () => {
    const currentUser = await authApi.me();
    setUser(currentUser);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      let token = tokenStore.getAccessToken();
      if (!token) {
        const refreshed = await authApi.refresh();
        token = refreshed.accessToken;
        tokenStore.setAccessToken(token);
        setAccessToken(token);
      }
      await reloadUser();
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, reloadUser]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onExpired = () => {
      clearSession();
      toast.error('Session expired. Sign in again to continue.');
      navigate('/login', { replace: true });
    };
    window.addEventListener(sessionEvents.expired, onExpired);
    return () => window.removeEventListener(sessionEvents.expired, onExpired);
  }, [clearSession, navigate]);

  const login = useCallback(
    async (payload: LoginRequest) => {
      try {
        const result = await authApi.login(payload);
        tokenStore.setAccessToken(result.accessToken);
        setAccessToken(result.accessToken);
        setUser(result.user);
        toast.success('Signed in');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        throw error;
      }
    },
    [navigate]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A failed logout should not trap the user in a local session.
    } finally {
      clearSession();
      toast.success('Signed out');
      navigate('/login', { replace: true });
    }
  }, [clearSession, navigate]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isLoading,
      login,
      logout,
      reloadUser
    }),
    [accessToken, isLoading, login, logout, reloadUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getBackendProfile,
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signOut
} from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadBackendProfile = useCallback(async () => {
    const backendUser = await getBackendProfile();
    setUser(backendUser);
    setRole(backendUser.role);
    setProfile(backendUser.profile);
    return backendUser;
  }, []);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      setLoading(true);
      setAuthError(null);
      try {
        const currentSession = await getSession();
        if (!isMounted) return;
        setSession(currentSession);
        if (currentSession) {
          await loadBackendProfile();
        } else {
          clearAuthState();
        }
      } catch (error) {
        if (!isMounted) return;
        setAuthError(error);
        clearAuthState();
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    boot();
    const { data } = onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (!nextSession) {
        clearAuthState();
        return;
      }
      try {
        await loadBackendProfile();
      } catch (error) {
        setAuthError(error);
        clearAuthState();
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [clearAuthState, loadBackendProfile]);

  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPassword(email, password);
      setSession(result.session);
      const backendUser = await loadBackendProfile();
      return backendUser;
    } catch (error) {
      setAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadBackendProfile]);

  const logout = useCallback(async () => {
    await signOut();
    clearAuthState();
  }, [clearAuthState]);

  const value = useMemo(() => ({
    session,
    user,
    role,
    profile,
    loading,
    authError,
    isAuthenticated: Boolean(session && role),
    login,
    logout
  }), [authError, loading, login, logout, profile, role, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return value;
}

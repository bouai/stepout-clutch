import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  apiRequest,
  setAuthToken,
  setUnauthorizedHandler,
} from '../api';
import { clearResourceCache } from '../hooks/useCachedResource';

const SESSION_KEY = 'stepout_session_token';

export interface AuthUser {
  id: number;
  email: string;
}

interface RequestLinkResult {
  sent: boolean;
  emailEnabled: boolean;
  devToken: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** False until the stored session has been read and validated. */
  ready: boolean;
  /**
   * Start login for an email. Returns the dev token when the server is running
   * without an email provider, so the app can complete login in one tap.
   */
  requestLink: (email: string) => Promise<RequestLinkResult | null>;
  /** Exchange a magic-link token for a session and sign in. */
  verify: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    setUser(null);
    setAuthToken(null);
    // Never let one account's cached trips flash under the next account.
    clearResourceCache();
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing stored.
    }
  }, []);

  // A 401 anywhere means the session is dead — drop to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Restore a stored session on launch and confirm it still works.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const token = await AsyncStorage.getItem(SESSION_KEY);
        if (token) {
          setAuthToken(token);
          const me = await apiRequest<AuthUser>('/auth/me');
          if (!cancelled) setUser(me);
        }
      } catch {
        // An invalid or unreachable session leaves the user signed out.
        setAuthToken(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestLink(email: string): Promise<RequestLinkResult | null> {
    try {
      return await apiRequest<RequestLinkResult>('/auth/request-link', {
        method: 'POST',
        body: { email },
      });
    } catch {
      return null;
    }
  }

  async function verify(token: string): Promise<boolean> {
    try {
      const session = await apiRequest<{ sessionToken: string; user: AuthUser }>(
        '/auth/verify',
        { method: 'POST', body: { token } }
      );
      setAuthToken(session.sessionToken);
      await AsyncStorage.setItem(SESSION_KEY, session.sessionToken);
      setUser(session.user);
      return true;
    } catch {
      return false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the server call fails, drop the local session below.
    }
    await signOut();
  }

  return (
    <AuthContext.Provider value={{ user, ready, requestLink, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

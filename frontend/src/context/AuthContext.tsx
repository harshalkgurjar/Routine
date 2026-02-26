import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from '../utils/api';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    // Check for session_id in URL hash (web only - OAuth callback)
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          window.history.replaceState(null, '', window.location.pathname);
          processCallback(sessionId);
          return;
        }
      }
    }
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const data = await apiCall('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  function login() {
    if (Platform.OS === 'web') {
      const redirectUrl = window.location.origin;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  }

  async function processCallback(sessionId: string) {
    try {
      const data = await apiCall('/auth/session', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (data.session_token) {
        await AsyncStorage.setItem('session_token', data.session_token);
      }
      setUser({
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        picture: data.picture,
      });
    } catch (e) {
      console.error('Auth callback failed:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await apiCall('/auth/logout', { method: 'POST' });
    } catch {}
    await AsyncStorage.removeItem('session_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

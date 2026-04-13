import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  clearSessionWall,
  ensureSessionWall,
  isSessionWallExpired,
} from '../lib/authSessionWall';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

async function applySessionOrSignOut(session: Session | null): Promise<User | null> {
  const u = session?.user ?? null;
  if (!u) {
    clearSessionWall();
    return null;
  }
  ensureSessionWall(u.id);
  if (isSessionWallExpired(u.id)) {
    clearSessionWall();
    await supabase.auth.signOut();
    return null;
  }
  return u;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const wallCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAuthChange = useCallback(async (event: string, session: Session | null) => {
    if (event === 'SIGNED_OUT') {
      clearSessionWall();
      setUser(null);
      setLoading(false);
      return;
    }
    if (event === 'TOKEN_REFRESHED' && session?.user) {
      ensureSessionWall(session.user.id);
      if (isSessionWallExpired(session.user.id)) {
        clearSessionWall();
        await supabase.auth.signOut();
        return;
      }
      setUser(session.user);
      setLoading(false);
      return;
    }
    const next = await applySessionOrSignOut(session);
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      const next = await applySessionOrSignOut(session);
      setUser(next);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthChange(event, session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  useEffect(() => {
    if (wallCheckRef.current) {
      clearInterval(wallCheckRef.current);
      wallCheckRef.current = null;
    }
    if (!user) return;

    wallCheckRef.current = setInterval(() => {
      if (isSessionWallExpired(user.id)) {
        clearSessionWall();
        void supabase.auth.signOut();
      }
    }, 60_000);

    return () => {
      if (wallCheckRef.current) clearInterval(wallCheckRef.current);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { privateApi, supabase } from './client';
import { notify } from './toast-events';

type AuthMode = 'login' | 'register' | 'recover' | 'reset';
type AuthContextValue = { user: User | null; isAdmin: boolean; loading: boolean; authMode: AuthMode | null; openAuth: (mode?: AuthMode) => void; closeAuth: () => void; signOut: () => Promise<void> };
const Context = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(!!supabase);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let current = true;
    const callback = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    let callbackError = callback.has('error') ? callback.get('error_code') === 'otp_expired'
      ? 'El enlace de confirmación venció o ya se utilizó. Solicita otro desde el inicio de sesión.'
      : 'No se pudo completar el acceso. Inténtalo otra vez desde CreafIA.' : null;
    if (callbackError) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    async function refresh() {
      const redirectError = callbackError;
      callbackError = null;
      const { data } = await supabase!.auth.getUser();
      if (!current) return;
      setUser(data.user);
      if (redirectError) {
        if (data.user) notify(redirectError, 'error');
        else { sessionStorage.setItem('creafia-auth-redirect-error', redirectError); setAuthMode('login'); }
      }
      if (data.user) {
        try { const result = await privateApi<{ isAdmin: boolean }>('me'); if (current) setAdmin(result.isAdmin); }
        catch { if (current) setAdmin(false); }
        if (current && sessionStorage.getItem('creafia-google-login')) {
          sessionStorage.removeItem('creafia-google-login');
          notify('Entraste con Google. Ya puedes guardar tus cotizaciones.', 'success');
        }
      } else setAdmin(false);
      if (current) setLoading(false);
    }
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setAuthMode('reset');
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_OUT') setAdmin(false);
      }
      setTimeout(() => void refresh(), 0);
    });
    return () => { current = false; subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    if (supabase) { const { error } = await supabase.auth.signOut(); if (error) throw error; }
    setUser(null); setAdmin(false);
  }
  return <Context.Provider value={{ user, isAdmin, loading, authMode, openAuth: mode => setAuthMode(mode || 'login'), closeAuth: () => setAuthMode(null), signOut }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}


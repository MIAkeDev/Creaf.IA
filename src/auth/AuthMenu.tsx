import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { AuthDialog } from './AuthDialog';
import './auth.css';

export function AuthMenu() {
  const { user, loading, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const base = import.meta.env.BASE_URL;
  return <><div className="auth-menu">{user ? <a className="auth-avatar-button" aria-label="Ir a mi perfil" href={`${base}profile`}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 2.6-6 7-6s7 2 7 6"/></svg></a> : <button type="button" className="auth-avatar-button" aria-label="Cuenta" aria-expanded={open} onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 2.6-6 7-6s7 2 7 6"/></svg></button>}{open && !user && <div className="auth-dropdown">{loading ? <span className="auth-loading">Comprobando sesión…</span> : <><button type="button" onClick={() => { setOpen(false); openAuth('login'); }}>Iniciar sesión</button><button type="button" onClick={() => { setOpen(false); openAuth('register'); }}>Registrarse</button></>}</div>}</div><AuthDialog/></>;
}


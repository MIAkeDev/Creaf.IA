import { useEffect, useState, type FormEvent } from 'react';
import { AuthMenu } from './AuthMenu';
import { useAuth } from './AuthProvider';
import { supabase } from './client';
import { notify } from './toast-events';
import { QuotesOverview } from './MyQuotes';
import './auth.css';
import '../components/admin/quotes.css';

export default function Profile() {
  const { user, loading, openAuth, signOut, isAdmin } = useAuth();
  const [name, setName] = useState(''); const [whatsapp, setWhatsapp] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (!user || !supabase) return; void supabase.from('profiles').select('display_name,whatsapp').eq('user_id', user.id).maybeSingle().then(({ data }) => { setName(data?.display_name || user.user_metadata?.full_name || ''); setWhatsapp(data?.whatsapp || ''); }); }, [user]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!user || !supabase) return;
    const digits = whatsapp.replace(/\D/g, '');
    if (digits && !/^\d{9,15}$/.test(digits)) { const message = 'Revisa el número de WhatsApp.'; setNotice(message); notify(message, 'error'); return; }
    const { error } = await supabase.from('profiles').upsert({ user_id: user.id, display_name: name.trim().slice(0, 100), whatsapp: digits });
    const metadata = error ? null : await supabase.auth.updateUser({ data: { full_name: name.trim().slice(0, 100) } });
    const failed = !!error || !!metadata?.error;
    const message = failed ? 'No se pudo guardar el nombre en la cuenta.' : 'Perfil guardado.';
    setNotice(message); notify(message, failed ? 'error' : 'success');
  }
  return <main className="account-page"><header><a className="wordmark" href={import.meta.env.BASE_URL}>creaf<span>ia</span><i/></a><AuthMenu/></header><div className="profile-shell"><a className="profile-back" href={import.meta.env.BASE_URL}>← Volver al chat</a>{loading ? <p>Cargando…</p> : !user ? <div className="profile-login"><h1>Inicia sesión para ver tus cotizaciones</h1><p>Aquí encontrarás tus solicitudes y su estado.</p><button type="button" onClick={() => openAuth()}>Iniciar sesión</button></div> : <><div className="profile-heading"><div><h1>Mi perfil</h1><p>Mis cotizaciones y datos de contacto</p></div><button className="profile-signout" type="button" onClick={() => void signOut()}>Cerrar sesión</button></div><section className="profile-info"><div><h2>Datos de contacto</h2><p>{user.email}</p></div><form onSubmit={event => void save(event)}><label>Nombre<input maxLength={100} value={name} onChange={event => setName(event.target.value)}/></label><label>WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)}/></label><button type="submit">Guardar datos</button>{notice && <p role="status">{notice}</p>}</form></section>{isAdmin && <a className="profile-admin-link" href={`${import.meta.env.BASE_URL}admin/providers`}>Abrir panel de administración →</a>}<QuotesOverview/></>}</div></main>;
}


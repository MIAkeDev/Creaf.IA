import SpecularButton from '../SpecularButton';
import { useEffect, useState } from 'react';
import type { Provider } from '../../types/provider';
import { listProviders, saveProvider, deleteProvider } from '../../services/providers';
import { PROVIDER_CATEGORIES, normalize } from '../../../shared/provider-validation.mjs';
import { MonkeyAvatar } from '../MonkeyAvatar';
import { ProviderForm } from './ProviderForm';
import { ProviderList } from './ProviderList';
import './providers.css';
import { QuoteAdmin } from './QuoteAdmin';
import { AuthMenu } from '../../auth/AuthMenu';

export default function ProviderAdmin() {
  const [providers, setProviders] = useState<Provider[]>([]); const [editing, setEditing] = useState<Provider | 'new' | null>(null);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'providers' | 'requests' | 'generated'>('providers');
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function refresh() { setBusy(true); try { setProviders((await listProviders()).providers); setError(''); } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.'); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, []);
  async function toggle(provider: Provider) { setBusy(true); try { await saveProvider({ ...provider, active: !provider.active }, false); await refresh(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); } }
  async function remove(provider: Provider) {
    if (!window.confirm(`¿Eliminar «${provider.businessName}»? También puedes desactivarlo para conservar sus datos.`)) return;
    setBusy(true); try { await deleteProvider(provider.id); setNotice('Proveedor eliminado.'); await refresh(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  const filtered = providers.filter(provider => (!search || normalize(`${provider.businessName} ${provider.category} ${provider.city}`).includes(normalize(search))) && (!category || provider.category === category) && (!status || (status === 'active' ? provider.active : !provider.active)));
  const categories = [...new Set([...PROVIDER_CATEGORIES, ...providers.map(provider => provider.category)])];
  return <div className="provider-admin"><div className="water-world" aria-hidden="true"><div className="water-light"/><div className="water-caustics"/></div><header><a className="wordmark" href={import.meta.env.BASE_URL}>creaf<span>ia</span><i/></a><a className="admin-back" href={import.meta.env.BASE_URL}>Volver al chat ↗</a><AuthMenu/></header>
    <main className="provider-admin-content"><nav className="admin-main-tabs" aria-label="Secciones del panel">{([['providers', 'Proveedores'], ['requests', 'Solicitudes'], ['generated', 'Opciones generadas']] as const).map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setEditing(null); }}>{label}</button>)}</nav>{tab === 'providers' ? editing ? <ProviderForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Proveedor guardado. Ya está disponible para futuras búsquedas.'); void refresh(); }}/>
      : <><section className="admin-hero"><div><p className="admin-kicker">El lado que hace todo posible</p><h1>Gente que crea<br/><span>momentos.</span></h1><p>{providers.length} {providers.length === 1 ? 'proveedor registrado' : 'proveedores registrados'} · {providers.filter(provider => provider.active).length} activos</p></div><div className="admin-hero-monkey"><MonkeyAvatar state="friendly"/></div></section><div className="admin-toolbar"><div><h2>Proveedores</h2><p>Cuida tu catálogo. Las buenas opciones empiezan aquí.</p></div><SpecularButton type="button" onClick={() => { setEditing('new'); setNotice(''); }}>+ Nuevo proveedor</SpecularButton></div>
        <div className="admin-filters"><label>Buscar<input type="search" placeholder="Nombre, categoría o ciudad…" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Categoría<select aria-label="Categoría" value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label>Estado<select aria-label="Estado" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label></div>
        {notice && <p role="status" className="admin-notice">{notice}</p>}{error && <p role="alert" className="admin-error">{error} <SpecularButton type="button" onClick={() => void refresh()}>Reintentar</SpecularButton></p>}
        {busy && !providers.length ? <p className="admin-empty">Abriendo tu catálogo…</p> : filtered.length ? <ProviderList providers={filtered} busy={busy} onEdit={setEditing} onToggle={provider => void toggle(provider)} onDelete={provider => void remove(provider)}/> : <div className="admin-empty">{providers.length ? 'No hay proveedores con esos filtros.' : 'Tu catálogo está listo para recibir su primer proveedor.'}</div>}
      </> : <QuoteAdmin view={tab}/>}</main><p className="admin-local-note">CreafIA · Panel de administración</p></div>;
}

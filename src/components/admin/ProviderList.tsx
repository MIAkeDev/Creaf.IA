import SpecularButton from '../SpecularButton';
import type { Provider } from '../../types/provider';
import { AdminImage } from './AdminImage';
export function ProviderList({ providers, busy, onEdit, onToggle, onDelete }: { providers: Provider[]; busy: boolean; onEdit: (provider: Provider) => void; onToggle: (provider: Provider) => void; onDelete: (provider: Provider) => void }) {
  return <div className="admin-provider-list">{providers.map(provider => <article className={`admin-provider-card ${provider.active ? '' : 'is-inactive'}`} key={provider.id}>
    <div className="admin-provider-cover">{provider.coverImage ? <AdminImage source={provider.coverImage} alt="" loading="lazy"/> : <span>{provider.category.slice(0, 1)}</span>}</div>
    <div className="admin-provider-info"><div className="admin-badges"><span>{provider.category}</span>{provider.verified && <span>Verificado ✓</span>}{!provider.active && <span>Inactivo</span>}</div><h2>{provider.businessName}</h2><p>{provider.city}{provider.yearsExperience !== undefined ? ` · ${provider.yearsExperience} años` : ''}{provider.eventsCompleted !== undefined ? ` · ${provider.eventsCompleted} eventos` : ''}{provider.rating !== undefined ? ` · ${provider.rating} ★` : ''}</p><p>{provider.services.length} {provider.services.length === 1 ? 'servicio registrado' : 'servicios registrados'}</p></div>
    <div className="admin-card-actions"><SpecularButton type="button" disabled={busy} onClick={() => onEdit(provider)}>Editar</SpecularButton><SpecularButton type="button" variant="ghost" size="sm" className="admin-quiet" disabled={busy} onClick={() => onToggle(provider)}>{provider.active ? 'Desactivar' : 'Activar'}</SpecularButton><SpecularButton type="button" variant="danger" size="sm" className="admin-delete" disabled={busy} onClick={() => onDelete(provider)}>Eliminar</SpecularButton></div>
  </article>)}</div>;
}

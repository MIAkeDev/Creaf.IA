import { useState } from 'react';
import type { PublicProviderPreview } from '../../types/proposal';
export const formatMoney = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(value);
export function EvidencePhoto({ source, label, className = '' }: { source?: string; label: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return source && !failed ? <img className={className} src={source} alt={label} loading="lazy" onError={() => setFailed(true)}/> : <div className={`proposal-photo-empty ${className}`}>Evidencia pendiente</div>;
}
export function ProposalProviderPreview({ provider }: { provider: PublicProviderPreview }) {
  return <section className="proposal-provider"><div className="proposal-provider-photo"><EvidencePhoto source={provider.evidenceImage} label={`Evidencia de ${provider.category}`}/></div><div className="proposal-provider-copy"><p className="proposal-category">{provider.category}</p><h3>{provider.serviceName}</h3><div className="proposal-provider-stats">{provider.yearsExperience !== undefined && <span>{provider.yearsExperience} años de experiencia</span>}{provider.eventsCompleted !== undefined && <span>{provider.eventsCompleted} eventos registrados</span>}{provider.rating !== undefined && <span>{provider.rating.toFixed(1)} ★</span>}</div>{provider.shortDescription && <p>{provider.shortDescription}</p>}<ul>{provider.includes.map((item, index) => <li key={index}>✓ {item}</li>)}</ul><p className="proposal-provider-price">{provider.priceKind === 'from' ? 'Desde ' : ''}{formatMoney(provider.price)}</p></div></section>;
}

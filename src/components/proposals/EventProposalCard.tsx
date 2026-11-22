import type { EventProposal } from '../../types/proposal';
import { EvidencePhoto, formatMoney } from './ProposalProviderPreview';
import SpecularButton from '../SpecularButton';
const tags = { saving: 'Ahorra', recommended: 'Recomendada', upgrade: 'Sube de nivel' };
export function EventProposalCard({ proposal, onOpen }: { proposal: EventProposal; onOpen: () => void }) {
  const images = proposal.providers.filter(provider => provider.evidenceImage).slice(0, 4);
  return <article className={`event-proposal-card proposal-${proposal.isAlternative ? 'alternative' : proposal.type}`} aria-label={proposal.title}><div className="proposal-card-head"><span className="proposal-tag">{proposal.isAlternative ? 'Alternativa' : <>{proposal.type === 'recommended' ? '✧ ' : ''}{tags[proposal.type]}</>}</span><h3>{proposal.title}</h3><span className="proposal-price-label">Estimado desde</span><strong className="proposal-total">{formatMoney(proposal.total)}</strong><p className="proposal-budget">Tu presupuesto: {formatMoney(proposal.budget)}</p><p className={`proposal-difference ${proposal.difference > 0 ? 'is-over' : ''}`}>{proposal.difference > 0 ? `+ ${formatMoney(proposal.difference)} sobre tu presupuesto` : proposal.difference < 0 ? `Te quedan ${formatMoney(-proposal.difference)}` : 'Aprovecha tu presupuesto completo'}</p>
    <SpecularButton className="proposal-view-button" size="lg" radius={18} baseColor={proposal.type === 'recommended' && !proposal.isAlternative ? '#355d54' : '#355b61'} textColor="#f5fafa" lineColor="#ddf7f3" intensity={1} idleIntensity={.35} shineSize={10} shineFade={34} thickness={1.2} glow={1} followMouse proximity={250} onClick={onOpen}>Ver propuesta <span className="proposal-view-arrow" aria-hidden="true">↗</span></SpecularButton>
    </div>
    <div className={`proposal-collage collage-${images.length || 1}`}>{images.length ? images.map(provider => <EvidencePhoto key={`${provider.providerId}:${provider.serviceId}`} source={provider.evidenceImage} label={`Evidencia de ${provider.category}`}/>) : <EvidencePhoto label="Evidencia pendiente"/>}</div>
    <div className="proposal-card-body"><ul className="proposal-service-list">{proposal.providers.map(provider => <li key={`${provider.providerId}:${provider.serviceId}`}>✓ {provider.category}</li>)}</ul><p className="proposal-reason">{proposal.reason}</p></div>
  </article>;
}

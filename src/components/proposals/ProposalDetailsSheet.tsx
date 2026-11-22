import SpecularButton from '../SpecularButton';
import { useEffect, useRef } from 'react';
import type { EventProposal } from '../../types/proposal';
import { ProposalProviderPreview, formatMoney } from './ProposalProviderPreview';
export function ProposalDetailsSheet({ proposal, onClose, onRequest }: { proposal: EventProposal; onClose: () => void; onRequest: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="proposal-sheet" aria-labelledby="proposal-sheet-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="proposal-sheet-inner"><div className="proposal-sheet-handle"/><div className="proposal-sheet-top"><div><p className="proposal-category">Tu evento, servicio a servicio</p><h2 id="proposal-sheet-title">{proposal.title}</h2></div><SpecularButton type="button" variant="ghost" radius={99} style={{ fontSize: 26, padding: 0 }} className="proposal-close" aria-label="Cerrar propuesta" onClick={onClose}>×</SpecularButton></div>
    <div className="proposal-sheet-summary"><strong>Desde {formatMoney(proposal.total)}</strong><span>{proposal.difference > 0 ? `+ ${formatMoney(proposal.difference)} sobre tu presupuesto` : proposal.difference < 0 ? `Te quedan ${formatMoney(-proposal.difference)}` : 'Coincide con tu presupuesto'}</span></div><p>{proposal.reason}</p>
    {proposal.providers.map(provider => <ProposalProviderPreview key={`${provider.providerId}:${provider.serviceId}`} provider={provider}/>)}
    <p className="proposal-footnote">Los importes se construyen con los precios iniciales registrados. No confirman disponibilidad, cotización final ni reserva.</p><SpecularButton type="button" className="proposal-done" onClick={onRequest}>🎁 Obtén un beneficio con tu primera cotización</SpecularButton><SpecularButton type="button" variant="ghost" onClick={onClose}>Volver a las opciones</SpecularButton>
  </div></dialog>;
}

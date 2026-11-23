import { useState } from 'react';
import './ProviderWhatsApp.css';

const phone = (import.meta.env.VITE_PROVIDER_WHATSAPP ?? '').replace(/\D/g, '');
const message = encodeURIComponent('Hola, quiero registrar mi producto o servicio en CreafIA. ¿Cómo puedo hacerlo?');

export function ProviderWhatsApp() {
  const [open, setOpen] = useState(false);
  if (!/^\d{9,15}$/.test(phone)) return null;

  return <aside className="provider-whatsapp" aria-label="Contacto para proveedores">
    {open && <div className="provider-whatsapp-card" id="provider-whatsapp-card">
      <button className="provider-whatsapp-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar contacto">×</button>
      <strong>¿Quieres sumar tu producto o servicio?</strong>
      <p>Escríbenos para registrarlo. Podrá aparecer en las cotizaciones cuando sea compatible con lo que busca cada persona.</p>
      <a href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp <span aria-hidden="true">↗</span></a>
    </div>}
    <button className="provider-whatsapp-trigger" type="button" aria-label="¿Ofreces un servicio? Contactar por WhatsApp" aria-expanded={open} aria-controls="provider-whatsapp-card" onClick={() => setOpen(value => !value)}>
      <span className="provider-whatsapp-icon" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}avatar/whatsapp-official.svg`} alt="" />
      </span><span>¿Ofreces un servicio?</span>
    </button>
  </aside>;
}

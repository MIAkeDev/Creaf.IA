import { useState, type ReactNode } from 'react';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import BlurText from './BlurText';
import { PillNav } from './PillNav';
import { AuthMenu } from '../auth/AuthMenu';

// Completa estas rutas al crear las páginas y los perfiles sociales.
const links: { services?: string; about?: string; instagram?: string; tiktok?: string } = {};
const hero = `${import.meta.env.BASE_URL}avatar/creafia-hero-desk.webp`;

function EventIcon({ kind }: { kind: 'birthday' | 'wedding' | 'quince' | 'business' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'birthday') return <svg viewBox="0 0 32 32" aria-hidden="true" {...common}><path d="M5 17h22v11H5zM4 17c0-2 2-3 4-2 2 1 3 1 5 0 2-1 4-1 6 0 2 1 4 1 6 0 2-1 4 0 4 2M10 13V9m6 4V8m6 5V9M9 7c0-1 1-2 1-3 1 1 1 2 1 3m4 0c0-1 1-2 1-3 1 1 1 2 1 3m4 0c0-1 1-2 1-3 1 1 1 2 1 3"/></svg>;
  if (kind === 'wedding') return <svg viewBox="0 0 32 32" aria-hidden="true" {...common}><circle cx="12" cy="18" r="8"/><circle cx="21" cy="18" r="8"/><path d="m6 7 2-3 2 3m10 0 2-3 2 3"/></svg>;
  if (kind === 'quince') return <svg viewBox="0 0 32 32" aria-hidden="true" {...common}><path d="m6 26 14-14 4 4-14 14-4-4ZM15 7V3m8 4 3-3m1 11h4M8 9l-2-2m4 9-4-1"/><path d="m18 16 4 4"/></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true" {...common}><rect x="4" y="7" width="24" height="22" rx="2"/><path d="M4 13h24M10 3v8m12-8v8m-7 13 3-4h-3l3-4"/></svg>;
}

function InstagramIcon() {
  return <svg className="instagram-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="instagram-gradient" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#feda75"/><stop offset=".3" stopColor="#fa7e1e"/><stop offset=".6" stopColor="#d62976"/><stop offset=".85" stopColor="#962fbf"/><stop offset="1" stopColor="#4f5bd5"/></linearGradient></defs><rect x="3" y="3" width="26" height="26" rx="7" fill="none" stroke="url(#instagram-gradient)" strokeWidth="4"/><circle cx="16" cy="16" r="6" fill="none" stroke="url(#instagram-gradient)" strokeWidth="3"/><circle cx="23.5" cy="8.5" r="2" fill="url(#instagram-gradient)"/></svg>;
}

function TikTokIcon() {
  return <svg className="tiktok-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M19 4v16.5a6.5 6.5 0 1 1-5.3-6.4v4.5a2.2 2.2 0 1 0 1.1 1.9V4h4.2c.5 3.1 2.4 5 5.5 5.5V14A11.4 11.4 0 0 1 19 12.4V4Z" fill="#25f4ee" transform="translate(-1 1)"/><path d="M19 4v16.5a6.5 6.5 0 1 1-5.3-6.4v4.5a2.2 2.2 0 1 0 1.1 1.9V4h4.2c.5 3.1 2.4 5 5.5 5.5V14A11.4 11.4 0 0 1 19 12.4V4Z" fill="#fe2c55" transform="translate(1 -1)"/><path d="M19 4v16.5a6.5 6.5 0 1 1-5.3-6.4v4.5a2.2 2.2 0 1 0 1.1 1.9V4h4.2c.5 3.1 2.4 5 5.5 5.5V14A11.4 11.4 0 0 1 19 12.4V4Z" fill="#101b22"/></svg>;
}

function SocialItem({ label, href, icon }: { label: string; href?: string; icon: ReactNode }) {
  const content = <>{icon}<span>{label}</span></>;
  return <a href={href || undefined} target={href ? '_blank' : undefined} rel={href ? 'noopener noreferrer' : undefined} title={href ? undefined : 'Próximamente'}>{content}</a>;
}

type Props = { onStart: () => void; transitioning: boolean };

export function LandingPage({ onStart, transitioning }: Props) {
  const [showHow, setShowHow] = useState(false);
  const [headlineDone, setHeadlineDone] = useState(false);
  return <>
    <header className="landing-header"><a className="wordmark" href={import.meta.env.BASE_URL} aria-label="CreafIA, inicio">creaf<span>ia</span><i/></a><PillNav activeHref={import.meta.env.BASE_URL} items={[{ label: 'Inicio', href: import.meta.env.BASE_URL }, { label: 'Servicios', href: links.services }, { label: 'Nosotros', href: links.about }]}/><AuthMenu/></header>
    <main className={`landing ${transitioning ? 'is-leaving' : ''}`}>
      <div className="landing-glow" aria-hidden="true"/>
      <div className="landing-orb" aria-hidden="true"/>
      <div className="landing-desk" aria-hidden="true"/>
      <div className="landing-plant" aria-hidden="true"><i/><i/><i/><i/></div>
      <section className="landing-copy">
        <div className="landing-rays" aria-hidden="true"><i/><i/><i/></div>
        <h1><BlurText text="¿Se viene una" effect="blur" animateBy="words" direction="top" staggerFrom="start" trigger="view" delay={200} stepDuration={.35} blur={10} distance={50}/><br/><BlurText text="fecha importante?" effect="blur" animateBy="words" direction="top" staggerFrom="start" trigger="view" delay={200} stepDuration={.35} blur={10} distance={50}/><br/><span className="landing-accent"><BlurText text="Cotizalo ;)" effect="blur" animateBy="words" direction="top" staggerFrom="start" trigger="view" delay={200} stepDuration={.35} blur={10} distance={50} loop={false} onAnimationComplete={() => setHeadlineDone(true)}/><svg className={`landing-underline ${headlineDone ? 'is-visible' : ''}`} viewBox="0 0 310 20" aria-hidden="true"><path d="M3 13 C86 1 207 1 307 12" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/></svg></span></h1>
        <p>Te ahorramos el tiempo de buscar y buscar.</p>
        <div className="landing-actions"><button className="landing-start" type="button" disabled={transitioning} onClick={onStart}>Empezar</button><button className="landing-how" type="button" onClick={() => setShowHow(true)}><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M7 4 26 15 7 26V4Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/><path d="m12 11 7 4-7 4" fill="currentColor"/></svg>Ver cómo funciona</button></div>
        <div className="landing-socials"><SocialItem label="Instagram" href={links.instagram} icon={<InstagramIcon/>}/><span className="landing-social-divider" aria-hidden="true"/><SocialItem label="TikTok" href={links.tiktok} icon={<TikTokIcon/>}/></div>
      </section>
      <img className="landing-hero" src={hero} alt="Monito de peluche con auriculares cotizando un evento en su portátil"/>
      <div className="landing-event-card" aria-label="Ideas para cotizar: cumpleaños, boda, quinceañero y evento empresarial"><div className="landing-card-rays" aria-hidden="true"><i/><i/><i/></div>{([{ kind: 'birthday', label: 'Cumpleaños' }, { kind: 'wedding', label: 'Boda' }, { kind: 'quince', label: 'Quinceañero' }, { kind: 'business', label: 'Evento empresarial' }] as const).map((event, index) => <div className="landing-event-row" key={event.kind}><EventIcon kind={event.kind}/><span>{event.label}</span><span className={`landing-event-check ${index === 0 ? 'checked' : ''}`} aria-hidden="true">{index === 0 ? '✓' : ''}</span></div>)}</div>
      <button className="landing-down" type="button" aria-label="Ir a cómo funciona" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 12 9 9 9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      {showHow && <div className="landing-modal-backdrop" role="presentation" onClick={() => setShowHow(false)}><section className="landing-modal" role="dialog" aria-modal="true" aria-labelledby="how-title" onClick={event => event.stopPropagation()}><button type="button" className="landing-modal-close" aria-label="Cerrar" onClick={() => setShowHow(false)}>×</button><h2 id="how-title">Así funciona CreafIA</h2><p>Cuéntanos qué evento imaginas, cuántas personas asistirán y tu presupuesto. Elige los servicios que te interesan y compara propuestas de proveedores registrados.</p><button type="button" className="landing-start" onClick={() => { setShowHow(false); onStart(); }}>Empezar</button></section></div>}
    </main>
    <section className="landing-next" id="como-funciona" aria-labelledby="next-title"><div><span>Así de sencillo</span><h2 id="next-title">Cuéntanos tu idea.<br/>Compara opciones para celebrarla.</h2><p>Dinos qué evento planeas, tu presupuesto y los servicios que necesitas. CreafIA reúne propuestas de proveedores registrados para que elijas con calma.</p><button className="landing-start" type="button" onClick={onStart}>Empezar a cotizar</button></div></section>
  </>;
}

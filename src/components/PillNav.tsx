import { useState } from 'react';

export type PillNavItem = { label: string; href?: string };

type Props = { items: PillNavItem[]; activeHref: string };

export function PillNav({ items, activeHref }: Props) {
  const [open, setOpen] = useState(false);

  return <nav className={`landing-nav ${open ? 'is-open' : ''}`} aria-label="Navegación principal">
    <button className="landing-nav-toggle" type="button" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} onClick={() => setOpen(value => !value)}><span/><span/><span/></button>
    <ul className="landing-nav-list">{items.map(item => <li key={item.label}>
      {item.href ? <a className={`landing-nav-item ${item.href === activeHref ? 'is-active' : ''}`} href={item.href} aria-current={item.href === activeHref ? 'page' : undefined} onClick={() => setOpen(false)}>{item.label}</a>
        : <span className="landing-nav-item is-pending" title="Próximamente">{item.label}</span>}
    </li>)}</ul>
  </nav>;
}

import { useEffect, useId, useState } from 'react';
import type { MonkeyState } from '../types/monkey';
import './MonkeyAvatar.css';
const atlas = `${import.meta.env.BASE_URL}avatar/plush-monkey-atlas.webp`;
const heroImage = `${import.meta.env.BASE_URL}avatar/plush-monkey.webp`;
const positions: Record<MonkeyState, string> = { sleeping: '0% 100%', waking: '50% 0%', annoyed: '50% 0%', thinking: '50% 100%', searching: '0% 0%', friendly: '100% 0%', confused: '50% 100%' };
export const descriptions: Record<MonkeyState, string> = { sleeping: 'El mono está durmiendo', waking: 'El mono se está despertando', annoyed: 'El mono necesita un segundo', thinking: 'Déjame pensar…', searching: 'Estoy buscando…', friendly: 'El mono está listo para ayudarte', confused: 'El mono se ha enredado' };
function Fallback({ state }: { state: MonkeyState }) {
  const id = useId().replace(/:/g, '');
  const sleepy = state === 'sleeping' || state === 'waking';
  return <svg viewBox="0 0 320 320" aria-hidden="true">
    <defs><radialGradient id={`${id}fur`} cx="36%" cy="24%" r="80%"><stop stopColor="#B38360"/><stop offset=".65" stopColor="#805338"/><stop offset="1" stopColor="#593C2D"/></radialGradient><radialGradient id={`${id}face`} cx="40%" cy="25%" r="85%"><stop stopColor="#F6DFC0"/><stop offset="1" stopColor="#D8AC83"/></radialGradient></defs>
    <path d="M219 254c70 28 69-49 43-37-17 8 10 27-10 29" fill="none" stroke="#805338" strokeWidth="17" strokeLinecap="round"/>
    <ellipse cx="160" cy="241" rx="61" ry="65" fill={`url(#${id}fur)`}/><ellipse cx="160" cy="247" rx="36" ry="43" fill={`url(#${id}face)`}/>
    <ellipse cx="111" cy="283" rx="30" ry="17" fill="#805338"/><ellipse cx="208" cy="283" rx="30" ry="17" fill="#805338"/>
    <ellipse cx="102" cy="235" rx="18" ry="36" fill="#946344" transform="rotate(15 102 235)"/><ellipse cx="219" cy="232" rx="17" ry="36" fill="#946344" transform={`rotate(${state === 'friendly' ? '-45' : '-15'} 219 232)`}/>
    <circle cx="69" cy="135" r="36" fill={`url(#${id}fur)`}/><circle cx="69" cy="135" r="23" fill="#D3A17F"/><circle cx="251" cy="135" r="36" fill={`url(#${id}fur)`}/><circle cx="251" cy="135" r="23" fill="#D3A17F"/>
    <ellipse cx="160" cy="130" rx="99" ry="91" fill={`url(#${id}fur)`}/>
    <path d="M138 47q-13-28 9-29-4 17 11 22 1-28 20-25-10 16-2 29" fill="#805338"/>
    <path d="M160 92c-35-39-86-10-79 40-19 66 20 84 79 84s98-18 79-84c7-50-44-79-79-40Z" fill={`url(#${id}face)`}/>
    <g className={sleepy ? '' : 'monkey-eyes'}>
    {sleepy ? <><path d="M109 134q13 12 26 0m50 0q13 12 26 0" fill="none" stroke="#543B30" strokeWidth="5" strokeLinecap="round"/></> : <>{[122,198].map(x => <g key={x}><ellipse cx={x} cy="132" rx="16" ry={state === 'annoyed' ? 12 : 21} fill="#FFF9EF"/><ellipse cx={x + (state === 'thinking' ? 3 : 0)} cy={state === 'thinking' ? 125 : 134} rx="10" ry="14" fill="#553B2D"/><ellipse cx={x+3} cy="129" rx="3.5" ry="4.5" fill="white"/></g>)}{state === 'annoyed' && <path d="m105 110 29 7m52 0 29-7" stroke="#805338" strokeWidth="5" strokeLinecap="round"/>}</>}
    </g>
    <ellipse cx="160" cy="173" rx="41" ry="29" fill="#EAC8A4"/><ellipse cx="160" cy="159" rx="10" ry="6" fill="#80583F"/>
    {state === 'waking' ? <ellipse cx="160" cy="185" rx="11" ry="14" fill="#684634"/> : <path d={state === 'friendly' ? 'M141 180q19 22 38 0' : state === 'confused' ? 'M149 187q12-9 23 0' : 'M148 183q12 7 24 0'} fill="none" stroke="#80583F" strokeWidth="3.5" strokeLinecap="round"/>}
    <ellipse cx="101" cy="164" rx="12" ry="6" fill="#D99580" opacity=".35"/><ellipse cx="219" cy="164" rx="12" ry="6" fill="#D99580" opacity=".35"/>
    {state === 'friendly' && <path d="M239 226v-16q0-9 7-7l3 15h8q8 0 5 9l-4 12h-19Z" fill="#EAC8A4"/>}
  </svg>;
}
function Asset({ state, hero = false, joyful = false }: { state: MonkeyState; hero?: boolean; joyful?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Fallback state={state}/>;
  if (hero) return <span className="monkey-hero"><img src={heroImage} alt="" onError={() => setFailed(true)}/></span>;
  return <span className="monkey-sprite" style={{ backgroundImage: `url("${atlas}")`, backgroundPosition: joyful ? '100% 100%' : positions[state] }}><img className="atlas-probe" src={atlas} alt="" onError={() => setFailed(true)}/></span>;
}
type Props = { state: MonkeyState; onClick?: () => void; interactive?: boolean; ready?: boolean; disabled?: boolean; hero?: boolean; label?: string; className?: string };
export function MonkeyAvatar({ state, onClick, interactive = false, ready = false, disabled = false, hero = false, label, className = '' }: Props) {
  const [layers, setLayers] = useState({ current: state, previous: state });
  useEffect(() => { for (const source of [atlas, heroImage]) { const image = new Image(); image.src = source; } }, []);
  useEffect(() => { setLayers(old => old.current === state ? old : { previous: old.current, current: state }); }, [state]);
  const content = <><span className="monkey-halo"/><span className={`monkey-motion state-${state}`}><span className="avatar-layer previous" key={`old-${layers.previous}-${layers.current}`}><Asset state={layers.previous}/></span><span className="avatar-layer current" key={layers.current}><Asset state={layers.current} hero={hero && state === 'friendly' && !ready} joyful={ready && state === 'friendly'}/></span></span><span className="monkey-shadow"/>{state === 'searching' && <span className="search-ring"/>}</>;
  const classes = `monkey ${ready ? 'ready' : ''} ${className}`;
  return interactive ? <button type="button" className={classes} onClick={disabled ? undefined : onClick} aria-disabled={disabled} aria-label={label ?? (ready ? 'Enviar mensaje' : 'Escribe un mensaje primero')}>{content}</button> : <div className={classes} aria-hidden="true">{content}</div>;
}

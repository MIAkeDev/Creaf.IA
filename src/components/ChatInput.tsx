import { useEffect, useRef } from 'react';
import SpecularButton from './SpecularButton';
export function ChatInput({ value, onChange, onSend, busy }: { value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 136)}px`; } }, [value]);
  useEffect(() => { if (window.matchMedia('(min-width: 768px)').matches) ref.current?.focus(); }, []);
  return <div className="composer"><label className="visually-hidden" htmlFor="message">Tu mensaje</label><div className="composer-control"><textarea ref={ref} id="message" rows={1} value={value} placeholder="Cuéntame qué estás planeando…" onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) onSend(); } }} aria-describedby="input-hint"/><SpecularButton className="composer-send" radius={18} disabled={busy || !value.trim()} onClick={onSend} aria-label="Enviar mensaje">{busy ? '…' : <>Enviar <span aria-hidden="true">↑</span></>}</SpecularButton></div><p id="input-hint"><kbd>↵</kbd> Enter para enviar <span>· Shift + Enter para otra línea</span></p></div>;
}

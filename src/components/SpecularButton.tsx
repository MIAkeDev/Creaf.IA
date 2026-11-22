import { forwardRef, useEffect, useImperativeHandle, useRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import './SpecularButton.css';

type TrackedButton = { element: HTMLButtonElement; proximity: number };
const tracked = new Set<TrackedButton>();
let pointer = { x: -10000, y: -10000 }; let frame = 0;
function updateHighlights() {
  frame = 0;
  const positions = [...tracked].map(item => ({ ...item, rect: item.element.getBoundingClientRect() }));
  for (const { element, proximity, rect } of positions) {
    const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
    const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    const strength = element.matches(':disabled') || rect.bottom < 0 || rect.top > innerHeight ? 0 : Math.max(0, 1 - distance / Math.max(1, proximity));
    element.style.setProperty('--specular-active', String(strength));
    element.style.setProperty('--specular-x', `${pointer.x - rect.left}px`);
    element.style.setProperty('--specular-y', `${pointer.y - rect.top}px`);
  }
}
function scheduleHighlight() { if (!frame) frame = requestAnimationFrame(updateHighlights); }
function movePointer(event: PointerEvent) { if (event.pointerType === 'touch') return; pointer = { x: event.clientX, y: event.clientY }; scheduleHighlight(); }
function clearPointer() { pointer = { x: -10000, y: -10000 }; scheduleHighlight(); }
function trackButton(button: TrackedButton) {
  if (!tracked.size) {
    window.addEventListener('pointermove', movePointer, { passive: true });
    window.addEventListener('blur', clearPointer);
    window.addEventListener('scroll', scheduleHighlight, { passive: true, capture: true });
    window.addEventListener('resize', scheduleHighlight, { passive: true });
  }
  tracked.add(button);
  return () => {
    tracked.delete(button);
    if (!tracked.size) {
      window.removeEventListener('pointermove', movePointer); window.removeEventListener('blur', clearPointer);
      window.removeEventListener('scroll', scheduleHighlight, true); window.removeEventListener('resize', scheduleHighlight);
      cancelAnimationFrame(frame); frame = 0;
    }
  };
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> & {
  size?: 'sm' | 'md' | 'lg'; radius?: number;
  tint?: string; tintOpacity?: number; textColor?: string; lineColor?: string; baseColor?: string;
  intensity?: number; idleIntensity?: number; shineSize?: number; shineFade?: number;
  thickness?: number; glow?: number; followMouse?: boolean; proximity?: number;
  variant?: 'primary' | 'ghost' | 'danger';
};
const themes = {
  primary: { base: '#355b61', text: '#f5fafa', line: '#d4f5f1' },
  ghost: { base: '#ffffff80', text: '#41656b', line: '#b2d0d4' },
  danger: { base: '#faf0eb', text: '#945b51', line: '#e3c7bd' },
};
export const SpecularButton = forwardRef<HTMLButtonElement, Props>(function SpecularButton({
  children, className = '', size = 'md', radius = 18, variant = 'primary',
  tint = '#ffffff', tintOpacity = .04, textColor, lineColor, baseColor,
  intensity = 1, idleIntensity = .35, shineSize = 10, shineFade = 34,
  thickness = 1.2, glow = 1, followMouse = true, proximity = 250, style, type = 'button', ...props
}, forwardedRef) {
  const ref = useRef<HTMLButtonElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!, []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)'); let stop: (() => void) | undefined;
    const update = () => {
      stop?.(); stop = undefined;
      if (followMouse && !preference.matches && ref.current) stop = trackButton({ element: ref.current, proximity });
      else { ref.current?.style.setProperty('--specular-active', '0'); ref.current?.style.setProperty('--specular-x', '50%'); ref.current?.style.setProperty('--specular-y', '0%'); }
    };
    update(); preference.addEventListener('change', update);
    return () => { stop?.(); preference.removeEventListener('change', update); };
  }, [followMouse, proximity]);
  const theme = themes[variant];
  const variables = {
    '--specular-radius': `${radius}px`, '--specular-tint': tint, '--specular-tint-opacity': tintOpacity,
    '--specular-intensity': intensity, '--specular-idle': idleIntensity,
    '--specular-spot': `${Math.max(20, shineSize * 8)}px`, '--specular-fade': `${Math.max(1, Math.min(100, shineFade))}%`,
    '--specular-glow': glow, '--specular-line': lineColor ?? theme.line,
    backgroundColor: baseColor ?? theme.base, color: textColor ?? theme.text,
    borderWidth: thickness, borderStyle: 'solid', borderColor: `color-mix(in srgb, ${lineColor ?? theme.line} 65%, transparent)`,
    borderRadius: radius, ...style,
  } as CSSProperties;
  return <button {...props} ref={ref} type={type} className={`specular-button specular-${size} ${className}`} style={variables}>
    <span className="specular-wash" aria-hidden="true"/><span className="specular-glint" aria-hidden="true"/>
    <span className="specular-content">{children}</span>
  </button>;
});
export default SpecularButton;

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './BlurText.css';

type Props = {
  text: string; effect?: 'drift' | 'blur'; animateBy?: 'words' | 'letters';
  direction?: 'left' | 'right' | 'top' | 'bottom'; staggerFrom?: 'start' | 'end' | 'center';
  trigger?: 'view' | 'mount'; delay?: number; stepDuration?: number; blur?: number; distance?: number;
  onAnimationComplete?: () => void; className?: string; loop?: boolean; loopDelay?: number; focusOnHover?: boolean;
};
export default function BlurText({ text, effect = 'drift', animateBy = 'words', direction = 'left', staggerFrom = 'end', trigger = 'view', delay = 110, stepDuration = .5, blur = 11, distance = 70, onAnimationComplete, className = '', loop = false, loopDelay = 2, focusOnHover = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null); const callback = useRef(onAnimationComplete);
  const [visible, setVisible] = useState(trigger === 'mount'); const [cycle, setCycle] = useState(0); const [reduced, setReduced] = useState(false);
  const parts = animateBy === 'words' ? text.split(/(\s+)/) : Array.from(text);
  const count = parts.filter(part => part.trim()).length;
  useEffect(() => { callback.current = onAnimationComplete; }, [onAnimationComplete]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches); update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (trigger === 'mount' || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { threshold: .15 });
    if (ref.current) observer.observe(ref.current);
    // Some browsers delay observer callbacks for inline text during the first paint.
    const fallback = window.setTimeout(() => {
      const bounds = ref.current?.getBoundingClientRect();
      if (bounds && bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth) {
        setVisible(true);
        observer.disconnect();
      }
    }, 100);
    return () => { observer.disconnect(); window.clearTimeout(fallback); };
  }, [trigger]);
  useEffect(() => {
    if (!visible) return;
    const maxOrder = staggerFrom === 'center' ? Math.max(0, count - 1) / 2 : Math.max(0, count - 1);
    const duration = reduced ? 0 : maxOrder * delay + stepDuration * 1000;
    const complete = setTimeout(() => callback.current?.(), duration);
    const repeat = loop && !reduced ? setTimeout(() => setCycle(value => value + 1), duration + loopDelay * 1000) : undefined;
    return () => { clearTimeout(complete); clearTimeout(repeat); };
  }, [visible, cycle, count, delay, stepDuration, loop, loopDelay, reduced, staggerFrom]);
  let index = 0;
  const horizontal = direction === 'left' || direction === 'right';
  const offset = distance * (direction === 'left' || direction === 'top' ? -1 : 1);
  return <span ref={ref} className={`blur-text ${visible ? 'is-visible' : ''} ${focusOnHover ? 'focus-on-hover' : ''} ${className}`}>
    <span className="visually-hidden">{text}</span>
    <span aria-hidden="true">{parts.map((part, partIndex) => {
      if (!part.trim()) return part;
      const position = index++; const order = staggerFrom === 'end' ? count - 1 - position : staggerFrom === 'center' ? Math.abs(position - (count - 1) / 2) : position;
      const variables = { '--blur-delay': `${order * delay}ms`, '--blur-duration': `${stepDuration}s`, '--blur-amount': `${blur}px`, '--blur-x': `${horizontal ? offset : 0}px`, '--blur-y': `${horizontal ? 0 : offset}px` } as CSSProperties;
      return <span className="blur-text-unit" style={variables} key={`${cycle}-${partIndex}`}>{part}</span>;
    })}</span>
  </span>;
}

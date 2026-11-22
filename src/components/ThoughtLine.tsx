import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import './ThoughtLine.css';

type Props = {
  working: boolean;
  steps: string[];
  label?: string;
  doneLabel?: string;
  glyph?: 'sparkle' | 'circle';
  fontSize?: number;
  breathPeriod?: number;
  breathDepth?: number;
  settleDuration?: number;
  settleBlur?: number;
  collapsible?: boolean;
  collapseOnSettle?: boolean;
  showTimer?: boolean;
  onSettle?: (seconds: number) => void;
  activeStep?: number;
};

export default function ThoughtLine({
  working, steps, label = 'Thinking…', doneLabel = 'Thought for',
  glyph = 'sparkle', fontSize = 16, breathPeriod = 1.6, breathDepth = .45,
  settleDuration = 350, settleBlur = 2, collapsible = false,
  collapseOnSettle = false, showTimer = false, onSettle, activeStep = 0,
}: Props) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'settling' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const started = useRef<number | null>(null);
  const callback = useRef(onSettle);
  const panelId = useId();
  useEffect(() => { callback.current = onSettle; }, [onSettle]);

  useEffect(() => {
    if (working) {
      started.current ??= performance.now();
      setPhase('working');
      setExpanded(true);
      const update = () => setSeconds((performance.now() - started.current!) / 1000);
      update();
      const timer = setInterval(update, 250);
      return () => clearInterval(timer);
    }
    if (started.current === null) return;
    const duration = (performance.now() - started.current) / 1000;
    setSeconds(duration);
    setPhase('settling');
    const timer = setTimeout(() => {
      started.current = null;
      setPhase('done');
      if (collapsible && collapseOnSettle) setExpanded(false);
      callback.current?.(duration);
    }, Math.max(0, settleDuration));
    return () => clearTimeout(timer);
  }, [working, settleDuration, collapsible, collapseOnSettle]);

  if (phase === 'idle') return null;
  const finished = phase === 'done' || phase === 'settling';
  const timerLabel = `${seconds.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
  const style = {
    fontSize,
    '--thought-period': `${Math.max(.1, breathPeriod)}s`,
    '--thought-low-opacity': 1 - Math.min(1, Math.max(0, breathDepth)),
    '--thought-settle': `${Math.max(0, settleDuration)}ms`,
    '--thought-blur': `${Math.max(0, settleBlur)}px`,
  } as CSSProperties;
  const heading = <>
    <span className="thought-glyph" aria-hidden="true">{glyph === 'sparkle' ? '✧' : '◌'}</span>
    <span className="thought-label">{finished ? doneLabel : label}</span>
    {showTimer && <span className="thought-time" aria-hidden={!finished}>{timerLabel}</span>}
    {collapsible && <svg className="thought-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6 3 3 3-3"/></svg>}
  </>;
  return <div className={`thought-line thought-${phase}`} style={style}>
    {collapsible ? <button className="thought-heading" type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>{heading}</button> : <div className="thought-heading">{heading}</div>}
    <div className={`thought-details ${expanded || !collapsible ? 'expanded' : ''}`} id={panelId} inert={collapsible && !expanded}>
      <div><ol className="thought-steps">
        {steps.map((step, index) => <li key={`${index}-${step}`} className={finished || index < activeStep ? 'complete' : index === activeStep ? 'active' : 'pending'} aria-current={!finished && index === activeStep ? 'step' : undefined}><span className="thought-step-dot" aria-hidden="true"/>{step}</li>)}
      </ol></div>
    </div>
  </div>;
}

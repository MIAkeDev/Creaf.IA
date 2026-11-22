import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, MonkeyState } from '../types/monkey';
import { TIMINGS } from '../config/timings';
import { AIServiceError, sendMessageToAI } from '../services/ai';
import { applyEventUpdates, getMissingFields, getEventStatus } from '../../shared/event-state.mjs';
import { createConversationState, conversationQuestion, nextExpectedField } from '../../shared/conversation-state.mjs';
import { ambiguityQuestions } from '../../shared/event-ambiguities.mjs';
import { findProposals } from '../services/providers';
import { categoryKey } from '../../shared/provider-validation.mjs';

function restoredChat(): { messages: Message[]; conversationState: ReturnType<typeof createConversationState> } | null {
  if (!sessionStorage.getItem('creafia_pending_quote')) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem('creafia_chat_draft') || 'null');
    if (!value || !Array.isArray(value.messages)) return null;
    return { messages: value.messages, conversationState: value.conversationState };
  } catch { return null; }
}
const restored = restoredChat();

export function useMonkeyState() {
  const [state, setState] = useState<MonkeyState>(restored ? 'friendly' : 'sleeping');
  const [phase, setPhase] = useState<'splash' | 'transitioning' | 'chat'>(restored ? 'chat' : 'splash');
  const [messages, setMessages] = useState<Message[]>(restored?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [conversationState, setConversationState] = useState(restored?.conversationState ?? createConversationState());
  const { event: eventState, ambiguities: eventAmbiguities } = conversationState;
  const [servicePickerRequested, setServicePickerRequested] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [allowAlternatives, setAllowAlternatives] = useState(false);
  const [proposalRevision, setProposalRevision] = useState(0);
  const lastProposalSearch = useRef('');
  const locked = useRef(false);
  const nextMessageId = useRef(Math.max(0, ...(restored?.messages.map(message => message.id) ?? [])));
  const beforeReaction = useRef<MonkeyState | null>(null);
  const controller = useRef<AbortController | null>(null);
  const reaction = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const delay = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
  useEffect(() => () => { controller.current?.abort(); clearTimeout(reaction.current); clearTimeout(idle.current); }, []);
  useEffect(() => {
    if (messages.length) sessionStorage.setItem('creafia_chat_draft', JSON.stringify({ messages, conversationState }));
  }, [messages, conversationState]);
  const activity = useCallback(() => {
    clearTimeout(idle.current);
    if (!locked.current) idle.current = setTimeout(() => {
      setState(current => current === 'friendly' ? 'waking' : current);
      reaction.current = setTimeout(() => setState('sleeping'), 600);
    }, TIMINGS.idle);
  }, []);
  useEffect(() => { if (phase === 'chat' && !isBusy) activity(); return () => clearTimeout(idle.current); }, [phase, isBusy, activity]);
  async function wakeUp() {
    if (locked.current || phase !== 'splash') return;
    locked.current = true;
    const ac = new AbortController(); controller.current = ac;
    setPhase('transitioning'); setState('waking');
    try { await delay(TIMINGS.wake, ac.signal); setState('annoyed'); await delay(TIMINGS.annoyed, ac.signal); setPhase('chat'); setState('friendly'); }
    catch { /* Unmount cancels the sequence. */ }
    finally { locked.current = false; }
  }
  async function sendMessage(text: string) {
    if (!text.trim() || locked.current || phase !== 'chat') return;
    locked.current = true; clearTimeout(reaction.current); clearTimeout(idle.current); beforeReaction.current = null;
    const ac = new AbortController(); controller.current = ac;
    setBusy(true); setDraft('');
    const userMessage = { type: 'text' as const, id: ++nextMessageId.current, role: 'user' as const, text: text.trim() };
    setMessages(list => [...list, userMessage]);
    try {
      setState('thinking'); await delay(TIMINGS.thinking, ac.signal);
      setState('searching');
      const lastAssistant = messages.filter(message => message.role === 'assistant').at(-1);
      const response = await sendMessageToAI(text.trim(), conversationState, ac.signal, !!lastAssistant, lastAssistant?.type === 'text' ? lastAssistant.text : '');
      setConversationState(response.conversationState);
      setAllowAlternatives(false);
      setServicePickerRequested(response.showServiceSelector === true);
      const responseMessage = { type: 'text' as const, id: ++nextMessageId.current, role: 'assistant' as const, text: response.reply };
      setMessages(list => [...list, responseMessage]);
      setState(response.degraded ? 'confused' : 'friendly');
      if (response.degraded) {
        await delay(TIMINGS.error, ac.signal);
        setState('friendly');
      }
    } catch (error) {
      if (ac.signal.aborted) return;
      if (error instanceof AIServiceError) {
        if (error.conversationState) setConversationState(error.conversationState);
        else if (error.eventState) setConversationState(current => ({ ...current, event: error.eventState! }));
      }
      setState('confused');
      const errorMessage = { type: 'text' as const, id: ++nextMessageId.current, role: 'assistant' as const, text: error instanceof Error ? error.message : 'Uy, me enredé. ¿Lo intentamos de nuevo?' };
      setMessages(list => [...list, errorMessage]);
      await delay(TIMINGS.error, ac.signal).catch(() => {});
      if (!ac.signal.aborted) setState('friendly');
    } finally { locked.current = false; if (!ac.signal.aborted) setBusy(false); }
  }
  function reactToEmptyTap() {
    if (locked.current) return;
    clearTimeout(reaction.current); clearTimeout(idle.current);
    beforeReaction.current ??= state;
    setState('annoyed');
    reaction.current = setTimeout(() => { setState(beforeReaction.current ?? 'friendly'); beforeReaction.current = null; activity(); }, TIMINGS.empty);
  }
  function confirmServices(services: string[]) {
    if (locked.current || phase !== 'chat' || !services.length) return;
    const updated = applyEventUpdates(eventState, { selectedServices: services });
    const updatedConversation = { ...conversationState, event: updated, expectedField: nextExpectedField(updated, conversationState.eventDateParts, eventAmbiguities) };
    clearTimeout(reaction.current);
    setConversationState(updatedConversation);
    setAllowAlternatives(false);
    setServicePickerRequested(true);
    setState('friendly');
    const userMessage = { type: 'text' as const, id: ++nextMessageId.current, role: 'user' as const, text: `Quiero incluir: ${updated.selectedServices.join(', ')}.` };
    const assistantMessage = { type: 'text' as const, id: ++nextMessageId.current, role: 'assistant' as const, text: eventAmbiguities.length
      ? `Perfecto, guardé tu selección. ${ambiguityQuestions(eventAmbiguities)}`
      : getEventStatus(updated) === 'ready'
      ? 'Excelente, guardé tu selección. Puedes desmarcar servicios y guardar los cambios cuando quieras; ya tengo los datos necesarios de tu evento.'
      : `Perfecto, guardé tu selección. ${conversationQuestion(updatedConversation)}` };
    setMessages(list => [...list, userMessage, assistantMessage]);
    activity();
  }
  useEffect(() => {
    if (phase !== 'chat' || isBusy || locked.current || getEventStatus(conversationState.event) !== 'ready' || conversationState.ambiguities.length || Object.keys(conversationState.eventDateParts).length) return;
    const signature = JSON.stringify([conversationState.event, allowAlternatives, proposalRevision]);
    if (signature === lastProposalSearch.current) return;
    lastProposalSearch.current = signature;
    locked.current = true; clearTimeout(reaction.current); clearTimeout(idle.current);
    const ac = new AbortController(); controller.current = ac;
    setBusy(true); setProposalLoading(true); setProposalError(''); setState('thinking');
    void (async () => {
      try {
        await delay(TIMINGS.thinking, ac.signal); setState('searching');
        const data = await findProposals(conversationState, allowAlternatives, ac.signal);
        if (ac.signal.aborted) return;
        setMessages(list => [...list, { type: 'event_proposals', id: ++nextMessageId.current, role: 'assistant', data, event: conversationState.event }]);
        setState('friendly');
      } catch (error) {
        if (!ac.signal.aborted) { setProposalError(error instanceof Error ? error.message : 'No pude comparar las opciones. Inténtalo de nuevo.'); setState('confused'); }
      } finally { locked.current = false; if (!ac.signal.aborted) { setBusy(false); setProposalLoading(false); } }
    })();
  }, [conversationState, phase, isBusy, allowAlternatives, proposalRevision]);
  function adjustBudget(budget: number) {
    if (locked.current) return;
    const event = applyEventUpdates(eventState, { budget });
    setConversationState(current => ({ ...current, event, expectedField: nextExpectedField(event, current.eventDateParts, current.ambiguities) }));
    setAllowAlternatives(false);
    setMessages(list => [...list, { type: 'text', id: ++nextMessageId.current, role: 'user', text: `Probemos con S/ ${budget.toLocaleString('es-PE')} de presupuesto.` }]);
  }
  function removeProposalService(service: string) {
    if (locked.current) return;
    const event = applyEventUpdates(eventState, { selectedServices: eventState.selectedServices.filter(item => categoryKey(item) !== categoryKey(service)) });
    const updated = { ...conversationState, event, expectedField: nextExpectedField(event, conversationState.eventDateParts, eventAmbiguities) };
    setConversationState(updated); setAllowAlternatives(false); setServicePickerRequested(true);
    setMessages(list => [...list, { type: 'text', id: ++nextMessageId.current, role: 'user', text: `Quitar ${service} de mi selección.` }, ...(getEventStatus(event) !== 'ready' ? [{ type: 'text' as const, id: ++nextMessageId.current, role: 'assistant' as const, text: conversationQuestion(updated) }] : [])]);
  }
  function adjustGuestCount(guestCount: number) {
    if (locked.current || !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100000) return;
    const event = applyEventUpdates(eventState, { guestCount });
    setConversationState(current => ({ ...current, event, expectedField: nextExpectedField(event, current.eventDateParts, current.ambiguities) }));
    setAllowAlternatives(false);
    setMessages(list => [...list, { type: 'text', id: ++nextMessageId.current, role: 'user', text: `Actualizo la cantidad a ${guestCount} invitados.` }]);
  }
  function changeDate() {
    if (locked.current) return;
    const event = applyEventUpdates(eventState, { date: null, datePreference: null });
    const updated = { ...conversationState, event, eventDateParts: {}, ambiguities: [], expectedField: nextExpectedField(event) };
    setConversationState(updated);
    setAllowAlternatives(false);
    setProposalError('');
    setMessages(list => [...list,
      { type: 'text', id: ++nextMessageId.current, role: 'user', text: 'Quiero probar otra fecha.' },
      { type: 'text', id: ++nextMessageId.current, role: 'assistant', text: `Claro. ${conversationQuestion(updated)}` },
    ]);
  }
  function startOver() {
    if (locked.current) return;
    const fresh = createConversationState();
    lastProposalSearch.current = '';
    setConversationState(fresh);
    setMessages([{ type: 'text', id: ++nextMessageId.current, role: 'assistant', text: `Vamos con una nueva cotización. ${conversationQuestion(fresh)}` }]);
    setDraft('');
    setServicePickerRequested(false);
    setAllowAlternatives(false);
    setProposalRevision(0);
    setProposalError('');
    setState('friendly');
  }
  const proposalActions = { onBudget: adjustBudget, onGuestCount: adjustGuestCount, onRemoveService: removeProposalService, onChangeDate: changeDate, onStartOver: startOver, onAlternatives: () => { if (!locked.current) setAllowAlternatives(true); }, onRetry: () => { if (!locked.current) setProposalRevision(current => current + 1); } };
  function changeDraft(value: string) { setDraft(value); if (!locked.current && value.trim()) setState('friendly'); activity(); }
  return { state, phase, messages, draft, isBusy, eventState, conversationState, servicePickerRequested, proposalLoading, proposalError, proposalActions, missingFields: getMissingFields(eventState), eventStatus: eventAmbiguities.length || Object.keys(conversationState.eventDateParts).length ? 'collecting' : getEventStatus(eventState), wakeUp, sendMessage, confirmServices, reactToEmptyTap, setDraft: changeDraft, activity };
}

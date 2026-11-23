import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MonkeyAvatar, descriptions } from './components/MonkeyAvatar';
import { LandingPage } from './components/LandingPage';
import { ChatInput } from './components/ChatInput';
import { ChatWindow } from './components/ChatWindow';
import { ProviderWhatsApp } from './components/ProviderWhatsApp';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthMenu } from './auth/AuthMenu';
import { PendingCoordination } from './auth/PendingCoordination';
import { Notifications } from './auth/Notifications';
import { useMonkeyState } from './hooks/useMonkeyState';
import './styles/variables.css';
import './styles/animations.css';
import './styles/app.css';
import './styles/water.css';
import './styles/refinements.css';
import './styles/conversation-layout.css';
import './components/LandingPage.css';

function App() {
  const chat = useMonkeyState();
  const hasConversation = chat.messages.length > 0;
  const send = () => { if (chat.draft.trim()) void chat.sendMessage(chat.draft); else chat.reactToEmptyTap(); };

  return <div className={`app phase-${chat.phase} ${chat.phase === 'chat' ? '' : 'hero'} ${hasConversation ? 'has-messages' : ''} ${chat.messages.some(message => message.role === 'assistant') ? 'has-response' : ''}`} onPointerDown={chat.activity}>
    <div className="water-world" aria-hidden="true"><div className="water-light"/><div className="water-caustics"/><div className="water-orbit orbit-one"/><div className="water-orbit orbit-two"/>{Array.from({ length: 8 }, (_, i) => <i key={i} className={`water-bubble bubble-${i}`}/>)}</div>
    {chat.phase !== 'chat' ? <LandingPage onStart={() => void chat.wakeUp()} transitioning={chat.phase === 'transitioning'}/> : <>
      <header><a className="wordmark" href={import.meta.env.BASE_URL} aria-label="CreafIA, inicio">creaf<span>ia</span><i/></a>{hasConversation && <div className="compact-chat-assistant"><span>{chat.isBusy ? descriptions[chat.state] : 'Tu evento empieza aquí'}</span><div className="compact-chat-avatar"><MonkeyAvatar state={chat.state}/></div></div>}<div className="chat-header-actions"><ProviderWhatsApp/><AuthMenu/></div></header>
      <main>{!hasConversation && <div className="character-stage"><div className="water-pool"><span/><span/><span/></div><MonkeyAvatar state={chat.state} hero interactive ready={!!chat.draft.trim() && !chat.isBusy} disabled={chat.isBusy} onClick={send}/><div className="character-caption" aria-hidden="true"><i/>{chat.isBusy ? descriptions[chat.state] : chat.draft.trim() ? 'Tócame y lo pensamos' : 'Aquí, contigo'}</div></div>}
        <section className="chat-shell" aria-label="Chat con CreafIA" aria-busy={chat.isBusy}><div className={hasConversation ? 'visually-hidden' : 'chat-heading'}><h1>{hasConversation ? 'Tu planificación con CreafIA' : '¿Cotizamos tu evento?'}</h1>{!hasConversation && <p>Empieza con un hola o cuéntame qué estás planeando.</p>}</div><ChatWindow messages={chat.messages} state={chat.state} busy={chat.isBusy} eventState={chat.eventState} servicePickerRequested={chat.servicePickerRequested} onConfirmServices={chat.confirmServices} proposalLoading={chat.proposalLoading} proposalError={chat.proposalError} proposalActions={chat.proposalActions}/><ChatInput value={chat.draft} onChange={chat.setDraft} onSend={send} busy={chat.isBusy}/></section>
      </main>
      <footer><span>La IA puede equivocarse. Verifica lo importante.</span></footer>
    </>}
    {chat.phase !== 'chat' && <ProviderWhatsApp/>}
    <PendingCoordination/>
    <span className="visually-hidden" role="status">{descriptions[chat.state]}</span>
  </div>;
}

const ProviderAdmin = lazy(() => import('./components/admin/ProviderAdmin'));
const MyQuotes = lazy(() => import('./auth/MyQuotes'));
const Profile = lazy(() => import('./auth/Profile'));
const adminPath = `${import.meta.env.BASE_URL}admin/providers`;
const isAdmin = window.location.pathname.replace(/\/$/, '') === adminPath;
function AdminRoute() {
  const { user, isAdmin, loading, openAuth } = useAuth();
  if (loading) return <p style={{ padding: 40 }}>Comprobando acceso…</p>;
  if (!user || !isAdmin) return <div style={{ padding: 40 }}><a href={import.meta.env.BASE_URL}>← Inicio</a><h1>Panel privado</h1><p>{user ? 'Esta cuenta no tiene acceso administrativo.' : 'Inicia sesión con una cuenta administradora.'}</p>{!user && <button type="button" onClick={() => openAuth()}>Iniciar sesión</button>}<AuthMenu/></div>;
  return <ProviderAdmin/>;
}
const path = window.location.pathname.replace(/\/$/, '');
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><Suspense fallback={<p style={{ padding: 40 }}>Abriendo CreafIA…</p>}>{isAdmin ? <AdminRoute/> : path === `${import.meta.env.BASE_URL}my-quotes` ? <MyQuotes/> : path === `${import.meta.env.BASE_URL}profile` ? <Profile/> : <App/>}</Suspense><Notifications/></AuthProvider></React.StrictMode>);

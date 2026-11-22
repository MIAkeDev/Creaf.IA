import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { googleEnabled, supabase } from './client';
import { authErrorMessage } from './auth-messages';
import { notify } from './toast-events';
import { useAuth } from './AuthProvider';
import './auth.css';

export function AuthDialog() {
  const { authMode, closeAuth, openAuth } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captcha] = useState(() => ({ first: 2 + Math.floor(Math.random() * 7), second: 1 + Math.floor(Math.random() * 6) }));
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    const afterRegistration = authMode === 'login' ? sessionStorage.getItem('creafia-registration-notice') : null;
    const redirectError = authMode === 'login' ? sessionStorage.getItem('creafia-auth-redirect-error') : null;
    if (afterRegistration) sessionStorage.removeItem('creafia-registration-notice');
    if (redirectError) sessionStorage.removeItem('creafia-auth-redirect-error');
    setPassword(''); setCaptchaAnswer(''); setNotice(afterRegistration || ''); setError(redirectError || ''); setBusy(false); setNeedsConfirmation(!!redirectError);
    if (authMode !== 'login' && authMode !== 'register') return;
    let active = true;
    setGoogleAvailable(null);
    void googleEnabled().then(enabled => { if (active) setGoogleAvailable(enabled); }).catch(() => { if (active) setGoogleAvailable(false); });
    return () => { active = false; };
  }, [authMode]);

  if (!authMode) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !authMode || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const redirect = `${window.location.origin}${import.meta.env.BASE_URL}`;
      if (authMode === 'reset') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        closeAuth(); notify('Contraseña actualizada. Ya puedes continuar con tu cuenta.', 'success');
      } else if (authMode === 'recover') {
        const { error: recoverError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
        if (recoverError) throw recoverError;
        const message = 'Si el correo está registrado, recibirás un enlace para recuperar tu contraseña.';
        setNotice(message); notify(message, 'success');
      } else if (authMode === 'register') {
        if (website || Number(captchaAnswer) !== captcha.first + captcha.second) throw new Error('captcha_incorrect');
        if (name.trim().length < 2) throw new Error('name_required');
        const { data, error: registerError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim().slice(0, 100) } } });
        if (registerError) throw registerError;
        const message = data.user?.identities?.length === 0
          ? 'Este correo ya podría tener una cuenta. Inicia sesión o recupera tu contraseña.'
          : data.session ? 'Cuenta creada. Ahora inicia sesión con tu correo y contraseña.' : 'La configuración actual exige confirmar el correo antes de entrar. Revisa la opción Confirm Email en Supabase.';
        if (data.session) await supabase.auth.signOut();
        sessionStorage.setItem('creafia-registration-notice', message);
        openAuth('login'); notify(message, 'success');
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
        closeAuth(); notify('Iniciaste sesión. Ya puedes guardar y revisar tus cotizaciones.', 'success');
      }
    } catch (cause) {
      const message = (cause as Error)?.message === 'captcha_incorrect' ? 'Resuelve la suma para crear tu cuenta.' : (cause as Error)?.message === 'name_required' ? 'Escribe tu nombre para identificar tus cotizaciones.' : authErrorMessage(cause, authMode);
      setNeedsConfirmation((cause as { code?: string })?.code === 'email_not_confirmed');
      setError(message); notify(message, 'error');
    } finally { setBusy(false); }
  }
  async function google() {
    if (!supabase || busy) return;
    if (googleAvailable !== true) {
      const message = 'Google aún no está habilitado en Supabase. Usa correo y contraseña por ahora.';
      setError(message); notify(message, 'info'); return;
    }
    setBusy(true); setError('');
    try {
      sessionStorage.setItem('creafia-google-login', '1');
      const { error: googleError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } });
      if (googleError) throw googleError;
    } catch (cause) {
      sessionStorage.removeItem('creafia-google-login');
      const message = authErrorMessage(cause, 'google');
      setError(message); notify(message, 'error');
    } finally { setBusy(false); }
  }
  async function resendConfirmation() {
    if (!supabase || !email.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } });
      if (resendError) throw resendError;
      const message = 'Si el correo está registrado, recibirás otro enlace de confirmación.';
      setNotice(message); notify(message, 'success');
    } catch (cause) { const message = authErrorMessage(cause, 'register'); setError(message); notify(message, 'error'); }
    finally { setBusy(false); }
  }
  const title = authMode === 'register' ? 'Crea tu cuenta' : authMode === 'recover' ? 'Recupera tu contraseña' : authMode === 'reset' ? 'Nueva contraseña' : notice ? 'Ahora inicia sesión' : 'Tu cuenta CreafIA';
  const description = authMode === 'reset' ? 'Escribe una contraseña nueva para tu cuenta.' : authMode === 'recover' ? 'Te enviaremos un enlace si el correo tiene una cuenta.' : authMode === 'register' ? 'Usa cualquier correo al que tengas acceso, como Gmail, y crea una contraseña para guardar tus cotizaciones.' : 'Entra con el correo y la contraseña que elegiste al registrarte.';
  return createPortal(<div className="auth-backdrop" onClick={closeAuth}><section className="auth-dialog" role="dialog" aria-modal="true" aria-label="Cuenta CreafIA" onClick={event => event.stopPropagation()}><button className="auth-close" type="button" onClick={closeAuth} aria-label="Cerrar">×</button><h2>{title}</h2><p>{description}</p>
    {!supabase ? <p role="alert">Las cuentas estarán disponibles cuando se configure Supabase.</p> : <><form onSubmit={event => void submit(event)}>{authMode === 'register' && <label>Tu nombre<input type="text" required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)}/></label>}{authMode !== 'reset' && <label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></label>}{authMode !== 'recover' && <label>Contraseña<input type="password" required minLength={6} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)}/></label>}{authMode === 'register' && <><label className="auth-human-check">Comprobación: ¿cuánto es {captcha.first} + {captcha.second}?<input type="number" required inputMode="numeric" value={captchaAnswer} onChange={event => setCaptchaAnswer(event.target.value)}/></label><input className="auth-trap" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={event => setWebsite(event.target.value)}/></>}<button type="submit" disabled={busy}>{busy ? 'Espera un momento…' : authMode === 'register' ? 'Crear cuenta' : authMode === 'recover' ? 'Enviar enlace' : authMode === 'reset' ? 'Guardar contraseña' : 'Iniciar sesión'}</button></form>
      {(authMode === 'login' || authMode === 'register') && googleAvailable === true && <button className="auth-google" type="button" disabled={busy} onClick={() => void google()}>Continuar con Google</button>}
      {notice && <p role="status" className="auth-feedback auth-feedback-success">{notice}</p>}{error && <p role="alert" className="auth-feedback auth-feedback-error">{error}</p>}{authMode === 'login' && needsConfirmation && <><p className="auth-provider-note">Escribe tu correo arriba para recibir un enlace nuevo.</p><button className="auth-resend" type="button" disabled={busy || !email.trim()} onClick={() => void resendConfirmation()}>Reenviar correo de confirmación</button></>}
      {authMode !== 'reset' && <div className="auth-links"><button type="button" onClick={() => openAuth(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}</button>{authMode !== 'recover' && <button type="button" onClick={() => openAuth('recover')}>Olvidé mi contraseña</button>}</div>}</>}
  </section></div>, document.body);
}


export function authErrorMessage(error: unknown, action: 'login' | 'register' | 'recover' | 'reset' | 'google'): string {
  const value = error as { code?: string; message?: string } | null;
  const code = value?.code || '';
  const message = value?.message?.toLowerCase() || '';
  if (code === 'email_address_not_authorized') return 'Este correo no puede recibir mensajes del servicio de prueba de Supabase. El propietario debe configurar SMTP para permitir registros públicos.';
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'No pudimos iniciar sesión con esos datos. Revisa el correo y la contraseña; si aún no tienes cuenta, crea una.';
  if (code === 'email_address_invalid' || message.includes('email address') && message.includes('invalid')) return 'Escribe un correo electrónico válido.';
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'Primero confirma tu correo desde el enlace que te enviamos y luego inicia sesión.';
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) return 'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.';
  if (code === 'weak_password' || message.includes('password should be')) return 'Usa una contraseña más segura; prueba con al menos 8 caracteres.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || message.includes('rate limit')) return 'Se alcanzó el límite temporal de intentos o correos. Espera unos minutos y vuelve a probar.';
  if (code === 'provider_disabled') return 'Google aún no está habilitado para este proyecto. Usa correo y contraseña por ahora.';
  if (code === 'otp_expired' || code === 'flow_state_expired') return 'El enlace venció. Solicita uno nuevo e inténtalo otra vez.';
  if (message.includes('fetch failed') || message.includes('network') || message.includes('failed to fetch')) return 'No pudimos conectar con el servicio de cuentas. Revisa tu conexión e inténtalo otra vez.';
  return { login: 'No se pudo iniciar sesión. Revisa tus datos e inténtalo otra vez.', register: 'No se pudo crear la cuenta. Revisa tus datos e inténtalo otra vez.', recover: 'No se pudo enviar el enlace. Inténtalo otra vez.', reset: 'No se pudo cambiar la contraseña. Solicita otro enlace si es necesario.', google: 'No se pudo iniciar sesión con Google. Inténtalo otra vez.' }[action];
}

import type { Provider } from '../types/provider';
import type { ProposalResults, ServiceOptions } from '../types/proposal';
import type { ConversationState } from '../types/event';
import { accessToken, privateApi } from '../auth/client';
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (response.status === 429) throw new Error('Hay muchas solicitudes en este momento. Espera un minuto y vuelve a intentar.');
  const data = await response.json().catch(() => ({ error: 'El servidor no devolvió una respuesta válida.' }));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data as T;
}
export const listProviders = () => privateApi<{ providers: Provider[] }>('admin/providers');
export type UploadedProviderImage = { source: string; originalBytes: number; bytes: number; width: number; height: number };
export async function uploadProviderImage(file: File, signal?: AbortSignal): Promise<UploadedProviderImage> {
  const token = await accessToken();
  const response = await fetch(`${import.meta.env.BASE_URL}api/admin/provider-images`, { method: 'POST', headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` }, body: file, signal });
  const data = await response.json().catch(() => ({ error: 'No pude recibir la foto optimizada. Inténtalo otra vez.' }));
  if (!response.ok) throw new Error(data.error || 'No se pudo subir la foto.');
  return data.image;
}
export const getServiceOptions = (eventType: string, city: string | null, guestCount: number | null, signal?: AbortSignal) => {
  const query = new URLSearchParams({ eventType, ...(city ? { city } : {}), ...(guestCount ? { guestCount: String(guestCount) } : {}) });
  return api<ServiceOptions>(`api/service-options?${query}`, { signal });
};
export const saveProvider = (provider: Provider, isNew: boolean) => privateApi<{ provider: Provider }>(`admin/providers${isNew ? '' : `/${provider.id}`}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(provider) });
export const deleteProvider = (id: string) => privateApi<{ removed: boolean }>(`admin/providers/${id}`, { method: 'DELETE' });
export const findProposals = (conversationState: ConversationState, allowAlternatives: boolean, signal?: AbortSignal) => api<ProposalResults>('api/proposals', { method: 'POST', body: JSON.stringify({ conversationState, allowAlternatives }), signal });

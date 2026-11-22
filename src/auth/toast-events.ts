export type NoticeKind = 'success' | 'error' | 'info';

export function notify(message: string, kind: NoticeKind = 'info') {
  window.dispatchEvent(new CustomEvent('creafia-notification', { detail: { message, kind } }));
}

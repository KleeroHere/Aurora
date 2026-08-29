
export type ToastRole = "success" | "error" | "neutral";

const DEFAULT_DURATION_MS = 4000;

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastRequest {
  message: string;
  role?: ToastRole;
  durationMs?: number;
  action?: ToastAction;
}

export interface ToastInstance {
  id: string;
  message: string;
  role: ToastRole;
  durationMs: number;
  action?: ToastAction;
}

const EVENT_NAME = "aurora:toast";
let counter = 0;

export function showToast(request: ToastRequest): string {
  const id = `toast-${Date.now()}-${counter++}`;
  const instance: ToastInstance = {
    id,
    message: request.message,
    role: request.role ?? "neutral",
    durationMs: request.durationMs ?? DEFAULT_DURATION_MS,
    action: request.action,
  };
  window.dispatchEvent(new CustomEvent<ToastInstance>(EVENT_NAME, { detail: instance }));
  return id;
}

export function onToast(handler: (toast: ToastInstance) => void): () => void {
  function listener(event: Event): void {
    handler((event as CustomEvent<ToastInstance>).detail);
  }
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

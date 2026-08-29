
const EVENT_NAME = "aurora:pins-changed";

export function triggerPinsChanged(): void {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function onPinsChanged(handler: () => void): () => void {
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

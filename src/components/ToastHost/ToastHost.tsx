import { useEffect, useRef, useState } from "react";
import { onToast } from "../../data/toastBus";
import type { ToastInstance } from "../../data/toastBus";
import Icon from "../icons/Icon";
import "./ToastHost.css";

const MAX_VISIBLE = 3;
const LEAVE_ANIMATION_MS = 240;

export default function ToastHost() {
  const [visible, setVisible] = useState<ToastInstance[]>([]);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const queueRef = useRef<ToastInstance[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const dismissingRef = useRef<Set<string>>(new Set());

  function dismiss(id: string) {
    if (dismissingRef.current.has(id)) return;
    dismissingRef.current.add(id);
    setLeaving((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setVisible((prev) => prev.filter((t) => t.id !== id));
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      const timer = timersRef.current.get(id);
      if (timer) window.clearTimeout(timer);
      timersRef.current.delete(id);

      const next = queueRef.current.shift();
      if (next) {
        setVisible((prev) => [...prev, next]);
        scheduleDismiss(next);
      }
    }, LEAVE_ANIMATION_MS);
  }

  function scheduleDismiss(toast: ToastInstance) {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    timersRef.current.set(toast.id, timer);
  }

  useEffect(() => {
    return onToast((toast) => {
      setVisible((prev) => {
        if (prev.length < MAX_VISIBLE) {
          scheduleDismiss(toast);
          return [...prev, toast];
        }
        queueRef.current.push(toast);
        return prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  if (visible.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {visible.map((toast) => (
        <div
          key={toast.id}
          className={"toast surface-glass toast--" + toast.role + (leaving.has(toast.id) ? " toast--leaving" : "")}
          role="status"
        >
          <span className="toast__message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.action!.onClick();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast__close"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="close" size={12} />
          </button>
          <span
            className="toast__timer"
            aria-hidden="true"
            style={{ animationDuration: `${toast.durationMs}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

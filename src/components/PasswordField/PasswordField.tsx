import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import "./PasswordField.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  hint?: string | null;
  error?: string | null;
};

export default function PasswordField({ label, hint, error, className, ...inputProps }: Props) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const inputId = useId();
  const describedBy = useId();

  return (
    <div className="password-field">
      {label && (
        <label className="password-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="password-field__row">
        <input
          {...inputProps}
          id={inputId}
          type={visible ? "text" : "password"}
          className={`password-field__input${className ? ` ${className}` : ""}`}
          aria-describedby={error || hint ? describedBy : undefined}
          aria-invalid={error ? true : undefined}
          onKeyUp={(event) => {
            setCapsLock(event.getModifierState?.("CapsLock") ?? false);
            inputProps.onKeyUp?.(event);
          }}
          onKeyDown={(event) => {
            setCapsLock(event.getModifierState?.("CapsLock") ?? false);
            inputProps.onKeyDown?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            inputProps.onBlur?.(event);
          }}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {capsLock && (
        <p className="password-field__caps" role="status">
          Caps Lock is on — the password is being typed in capitals.
        </p>
      )}

      {(error || hint) && (
        <p id={describedBy} className={error ? "password-field__error" : "password-field__hint"}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

import { forwardRef } from "react";
import type { KeyboardEvent } from "react";
import "./SearchInput.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  "aria-activedescendant"?: string;
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, placeholder, "aria-label": ariaLabel, onKeyDown, ...aria },
  ref,
) {
  return (
    <label className="search-input">
      <svg
        className="search-input__icon"
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <line
          x1="13.4"
          y1="13.4"
          x2="17.5"
          y2="17.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <input
        ref={ref}
        type="text"
        className="search-input__field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        role="combobox"
        autoComplete="off"
        {...aria}
      />
    </label>
  );
});

export default SearchInput;

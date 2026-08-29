import { useState } from "react";
import { useHelp } from "../../help/HelpContext";
import { useTheme } from "../../context/ThemeContext";
import type { Palette } from "../../context/ThemeContext";
import { useLiteMode } from "../../context/LiteModeContext";
import { useDayNightMode } from "../../context/DayNightModeContext";
import { isAffirmationHidden, setAffirmationHidden } from "../../utils/affirmations";
import { shouldSkipPrintPreview, setSkipPrintPreview } from "../../utils/printPreviewSettings";
import { TEXT_SCALE_OPTIONS, getTextScale, setTextScale } from "../../utils/textScale";
import "./AppearanceSettings.css";

const PALETTE_OPTIONS: { value: Palette; label: string; hint: string }[] = [
  { value: "aurora", label: "Aurora", hint: "The default look: cool blues with a deep indigo sidebar." },
  { value: "clinic", label: "Clinic", hint: "Calm blue-green with a lot of air — easiest to read on a shared screen in a brightly lit room." },
  { value: "nightshift", label: "Night shift", hint: "Warm and low-glare for work after dark: graphite with amber accents and almost no pure white." },
];

export default function AppearanceSettings() {
  const { theme, toggleTheme, palette, setPalette } = useTheme();
  const { liteMode, setLiteMode } = useLiteMode();
  const { startTour } = useHelp();
  const { enabled: dayNightEnabled, setEnabled: setDayNightEnabled } = useDayNightMode();
  const [affirmationHidden, setAffirmationHiddenState] = useState(isAffirmationHidden);
  const [skipPrintPreview, setSkipPrintPreviewState] = useState(shouldSkipPrintPreview);
  const [textScale, setTextScaleState] = useState(getTextScale);

  function handleTextScaleChange(next: number) {
    setTextScale(next);
    setTextScaleState(next);
  }

  function handleAffirmationVisibilityChange(hidden: boolean) {
    setAffirmationHidden(hidden);
    setAffirmationHiddenState(hidden);
  }

  function handlePrintPreviewChange(skip: boolean) {
    setSkipPrintPreview(skip);
    setSkipPrintPreviewState(skip);
  }

  function handlePaletteChange(next: Palette) {
    if (next !== palette) {
      setPalette(next);
    }
  }

  return (
    <div className="appearance-settings" data-help="settings-appearance">
      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Palette</span>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Palette">
          {PALETTE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={palette === option.value}
              className="appearance-settings__option"
              data-selected={palette === option.value}
              onClick={() => handlePaletteChange(option.value)}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Text size</span>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Text size">
          {TEXT_SCALE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={textScale === option.value}
              className="appearance-settings__option"
              data-selected={textScale === option.value}
              onClick={() => handleTextScaleChange(option.value)}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Theme</span>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Theme">
          <button
            type="button"
            role="radio"
            aria-checked={theme === "light"}
            className="appearance-settings__option"
            data-selected={theme === "light"}
            onClick={() => theme !== "light" && toggleTheme()}
          >
            Light
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "dark"}
            className="appearance-settings__option"
            data-selected={theme === "dark"}
            onClick={() => theme !== "dark" && toggleTheme()}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Performance</span>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Performance">
          <button
            type="button"
            role="radio"
            aria-checked={!liteMode}
            className="appearance-settings__option"
            data-selected={!liteMode}
            onClick={() => liteMode && setLiteMode(false)}
          >
            Normal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={liteMode}
            className="appearance-settings__option"
            data-selected={liteMode}
            onClick={() => !liteMode && setLiteMode(true)}
          >
            Lite
          </button>
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Day/night appearance</span>
        <p className="appearance-settings__hint">
          Dark theme after 10 PM and a background tint that adapts to the time of day.
          Disabled in Lite Mode. A manual theme choice always overrides the automation until the end of the session.
        </p>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Day/night appearance">
          <button
            type="button"
            role="radio"
            aria-checked={!dayNightEnabled}
            className="appearance-settings__option"
            data-selected={!dayNightEnabled}
            onClick={() => setDayNightEnabled(false)}
          >
            Off
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={dayNightEnabled}
            className="appearance-settings__option"
            data-selected={dayNightEnabled}
            onClick={() => setDayNightEnabled(true)}
          >
            On
          </button>
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Print preview</span>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Print preview">
          <button
            type="button"
            role="radio"
            aria-checked={!skipPrintPreview}
            className="appearance-settings__option"
            data-selected={!skipPrintPreview}
            onClick={() => handlePrintPreviewChange(false)}
          >
            Show
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={skipPrintPreview}
            className="appearance-settings__option"
            data-selected={skipPrintPreview}
            onClick={() => handlePrintPreviewChange(true)}
          >
            Skip
          </button>
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Getting to know the app</span>
        <p className="appearance-settings__hint">
          A short tour of the main areas of the app. You can also open it at any time
          with the question mark in the top right corner — it labels what is visible on screen.
        </p>
        <div className="appearance-settings__options">
          <button type="button" className="appearance-settings__option" onClick={startTour}>
            Show the tour
          </button>
        </div>
      </div>

      <div className="appearance-settings__control">
        <span className="appearance-settings__label">Thought of the day on the home page</span>
        <div className="appearance-settings__options" role="radiogroup" aria-label="Thought of the day on the home page">
          <button
            type="button"
            role="radio"
            aria-checked={!affirmationHidden}
            className="appearance-settings__option"
            data-selected={!affirmationHidden}
            onClick={() => handleAffirmationVisibilityChange(false)}
          >
            Show
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={affirmationHidden}
            className="appearance-settings__option"
            data-selected={affirmationHidden}
            onClick={() => handleAffirmationVisibilityChange(true)}
          >
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}

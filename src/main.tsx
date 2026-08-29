import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LiteModeProvider } from "./context/LiteModeContext";
import { ZenModeProvider } from "./context/ZenModeContext";
import { EmergencyModeProvider } from "./context/EmergencyModeContext";
import { DayNightModeProvider } from "./context/DayNightModeContext";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import DbBootSplash from "./components/DbBootSplash/DbBootSplash";
import { bootstrapRepository } from "./data/bootstrap";
import { initTextScale } from "./utils/textScale";
import "./styles/global.css";

const rootElement = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

initTextScale();

root.render(<DbBootSplash />);

bootstrapRepository()
  .then(() => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <LiteModeProvider>
            <ThemeProvider>
              <DayNightModeProvider>
                <EmergencyModeProvider>
                  <ZenModeProvider>
                    <HashRouter>
                      <App />
                    </HashRouter>
                  </ZenModeProvider>
                </EmergencyModeProvider>
              </DayNightModeProvider>
            </ThemeProvider>
          </LiteModeProvider>
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error("Failed to initialize the database:", err);
    root.render(
      <div className="app-boot-hint app-boot-hint--error">
        The database could not be loaded. Details are in the console.
      </div>,
    );
  });

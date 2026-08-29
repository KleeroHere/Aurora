import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { exportDiagnosticsLog, logAppEvent } from "../../data/repository";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logAppEvent("error", "react.error", {
      message: error.message,
      name: error.name,
      componentStack: info.componentStack ?? null,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleExportDiagnostics = async () => {
    try {
      await exportDiagnosticsLog({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
        liteMode: window.localStorage.getItem("aurora.liteMode") === "true",
      });
    } catch {
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__panel">
          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__message">
            The app ran into an unexpected error and cannot continue in this state.
          </p>
          <p className="error-boundary__detail">{error.message}</p>
          <div className="error-boundary__actions">
            <button type="button" className="error-boundary__button" onClick={this.handleReload}>
              Reload
            </button>
            <button
              type="button"
              className="error-boundary__button error-boundary__button--secondary"
              onClick={this.handleExportDiagnostics}
            >
              Export diagnostics log
            </button>
          </div>
        </div>
      </div>
    );
  }
}

import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ fontFamily: "monospace", padding: "2rem", color: "#c00" }}>
          <h2>Error al cargar la app</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{err.message}</pre>
          <pre style={{ fontSize: "0.75rem", color: "#666", marginTop: "1rem", whiteSpace: "pre-wrap" }}>{err.stack}</pre>
        </div>
      );
    }
    return this.state.error === null ? this.props.children : null;
  }
}

const root = document.getElementById("root")!;

window.onerror = (msg, _src, _line, _col, err) => {
  root.innerHTML = `<div style="font-family:monospace;padding:2rem;color:#c00">
    <h2>Error al cargar la app</h2>
    <pre>${err?.message || msg}</pre>
  </div>`;
};

createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);

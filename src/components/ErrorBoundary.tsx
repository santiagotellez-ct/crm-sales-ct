import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render/runtime errors in the authenticated shell so a throw in
 * CompanyDataProvider (or a page) does not blank the whole SPA.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Error inesperado" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.message}</p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.assign("/");
            }}
          >
            Recargar
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Result } from "antd";

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Result
        status="500"
        title="Algo salió mal"
        subTitle="Ocurrió un error inesperado en esta pantalla."
        extra={[
          <Button key="home" type="primary" onClick={() => window.location.assign("/")}>
            Ir al inicio
          </Button>,
          <Button key="reload" onClick={() => window.location.reload()}>
            Recargar
          </Button>,
        ]}
      />
    );
  }
}

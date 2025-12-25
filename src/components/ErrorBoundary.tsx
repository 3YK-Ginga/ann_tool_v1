import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI error boundary:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="error-boundary">
        <h2>アプリでエラーが発生しました</h2>
        <p>操作を続けられません。再読み込みしてください。</p>
        <div className="error-details">{this.state.error.message}</div>
        <button type="button" onClick={this.handleReload}>
          再読み込み
        </button>
      </div>
    );
  }
}

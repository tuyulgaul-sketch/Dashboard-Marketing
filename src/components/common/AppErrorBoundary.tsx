import React from "react";

type Props = { children: React.ReactNode };
type State = { crashed: boolean; revision: number };

/**
 * A transient failure while mounting an authenticated route must not leave
 * the entire Vite/React app as a blank white screen. Retry the React tree once
 * (without a browser refresh), then surface a recoverable error on recurrence.
 *
 * Authentication is NOT bypassed: remounting App reinstalls AuthProvider and
 * ProtectedRoute, which revalidate the actual Supabase session and MFA AAL.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false, revision: 0 };
  private attemptedAutoRecovery = false;
  private recoveryTimer: number | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[Dashboard] React render failed", error, info.componentStack);

    if (!this.attemptedAutoRecovery) {
      this.attemptedAutoRecovery = true;
      this.recoveryTimer = window.setTimeout(() => {
        this.recoveryTimer = null;
        this.setState(state => ({
          crashed: false,
          revision: state.revision + 1,
        }));
      }, 300);
    }
  }

  componentWillUnmount(): void {
    if (this.recoveryTimer !== null) {
      window.clearTimeout(this.recoveryTimer);
    }
  }

  private retry = () => {
    this.setState(state => ({
      crashed: false,
      revision: state.revision + 1,
    }));
  };

  render(): React.ReactNode {
    if (this.state.crashed) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div role="alert" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">Dashboard belum berhasil ditampilkan</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ada kendala saat memuat tampilan. Sesi login dan verifikasi MFA tetap dilindungi.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mt-5 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Coba muat dashboard
            </button>
          </div>
        </main>
      );
    }

    return <React.Fragment key={this.state.revision}>{this.props.children}</React.Fragment>;
  }
}

export default AppErrorBoundary;

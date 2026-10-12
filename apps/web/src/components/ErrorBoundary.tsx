import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Ao mudar (ex.: a rota), o erro é descartado e a árvore tenta renderizar de novo */
  resetKey?: string;
  /** Tela cheia (fora do layout) em vez de ocupar só a área de conteúdo */
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey?: string;
}

/**
 * Captura erros de renderização para não deixar a tela em branco:
 * mostra o que aconteceu e oferece tentar de novo.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro de renderização capturado:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Chunk de uma versão antiga (deploy novo enquanto a aba estava aberta): recarregar resolve
    const isStaleChunk = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);

    return (
      <div
        role="alert"
        className={
          this.props.fullScreen
            ? "flex min-h-dvh items-center justify-center bg-background p-6"
            : "flex h-full items-center justify-center p-6"
        }
      >
        <div className="w-full max-w-md border border-ink bg-card p-6 shadow-[6px_6px_0_0_var(--ink)]">
          <span className="chip bg-destructive text-destructive-foreground">
            <AlertTriangle className="size-3" /> Erro
          </span>
          <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight">
            {isStaleChunk ? "Há uma versão nova do app" : "Algo deu errado nesta tela"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isStaleChunk
              ? "Recarregue a página para usar a versão mais recente."
              : "O restante do app continua funcionando. Você pode tentar de novo ou recarregar a página."}
          </p>
          {!isStaleChunk && (
            <pre className="mt-4 max-h-28 overflow-auto border border-line bg-surface-2 p-3 font-mono text-[0.7rem] text-muted-foreground">
              {error.message}
            </pre>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {!isStaleChunk && (
              <Button variant="outline" onClick={() => this.setState({ error: null })}>
                <RotateCw /> Tentar novamente
              </Button>
            )}
            <Button onClick={() => window.location.reload()}>
              <RefreshCw /> Recarregar página
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

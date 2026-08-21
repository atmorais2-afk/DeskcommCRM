export interface ApiSuccess<T> {
  data: T;
  meta?: { cursor?: string; has_more?: boolean; total?: number; request_id?: string };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: Record<string, unknown> | undefined,
    public readonly requestId: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

/**
 * A requisição não chegou a virar resposta: conexão caiu, DNS falhou, ou o
 * tempo estourou. **Não é `ApiError`** de propósito — não há status nem código
 * do servidor, porque o servidor pode nem ter sido alcançado.
 *
 * Existe para o toast poder dizer O QUE falhou. Sem ela, o erro cru caía no
 * genérico "Erro inesperado. Tente novamente.", e uma pilha desses na tela não
 * diz ao operador nem a quem for investigar qual rota morreu — e o servidor não
 * tem rastro nenhum, porque a falha morre no cliente.
 */
export class NetworkError extends Error {
  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly timeoutMs: number,
    public readonly requestId: string,
    public readonly cause: unknown,
  ) {
    const motivo =
      cause instanceof Error && cause.name === "AbortError"
        ? `sem resposta em ${Math.round(timeoutMs / 1000)}s`
        : "conexão falhou";
    super(`${method} ${path} — ${motivo}`);
    this.name = "NetworkError";
  }
}

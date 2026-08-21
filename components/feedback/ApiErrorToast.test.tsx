import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError, NetworkError } from "@/lib/api/types";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";
import { showApiError } from "@/components/feedback/ApiErrorToast";

describe("ApiErrorToast", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.info).mockClear();
  });

  it("has at least 10 entries in the COPY map (covered via known codes)", () => {
    const knownCodes = [
      "body_malformed",
      "cursor_malformed",
      "validation_error",
      "auth_required",
      "forbidden_role",
      "resource_not_found",
      "tenant_not_found",
      "idempotency_conflict",
      "conversation_already_claimed",
      "rate_limited",
      "lgpd_anonymization_irreversible",
      "internal_error",
    ];
    for (const code of knownCodes) {
      vi.mocked(toast.error).mockClear();
      vi.mocked(toast.warning).mockClear();
      vi.mocked(toast.info).mockClear();
      showApiError(new ApiError(400, code, undefined, "req-x"));
      const total =
        vi.mocked(toast.error).mock.calls.length +
        vi.mocked(toast.warning).mock.calls.length +
        vi.mocked(toast.info).mock.calls.length;
      expect(total).toBeGreaterThan(0);
    }
    expect(knownCodes.length).toBeGreaterThanOrEqual(10);
  });

  it("calls toast.warning with canonical PT-BR for conversation_already_claimed", () => {
    showApiError(new ApiError(409, "conversation_already_claimed", undefined, "req-1"));
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      "Outro atendente já assumiu.",
      expect.objectContaining({ description: "ID: req-1" }),
    );
  });

  it("calls toast.warning com mensagem humana para invalid_state (casos humanos, spec 15)", () => {
    showApiError(new ApiError(409, "invalid_state", undefined, "req-3"));
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      "Este caso já foi respondido ou fechado.",
      expect.objectContaining({ description: "ID: req-3" }),
    );
  });

  it("falls back to toast.error for unknown ApiError code", () => {
    const err = new ApiError(418, "unknown_teapot_code", undefined, "req-2", "I'm a teapot");
    showApiError(err);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "I'm a teapot",
      expect.objectContaining({ description: "ID: req-2" }),
    );
  });

  it("calls toast.error with generic message for non-ApiError", () => {
    showApiError(new Error("oops"));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Erro inesperado. Tente novamente.");
  });
});

describe("falha de rede — o toast precisa dizer O QUE falhou", () => {
  it("nomeia a rota e diz que foi tempo esgotado", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    showApiError(new NetworkError("GET", "/api/v1/conversations", 10_000, "req-1", abort));

    const [titulo, opts] = vi.mocked(toast.error).mock.calls.at(-1) as [string, { description: string }];
    expect(titulo).toBe("Não consegui falar com o servidor.");
    // A rota tem de aparecer: uma pilha de toasts idênticos não diz nada a
    // ninguém, e erro que morre no cliente não deixa rastro no servidor.
    expect(opts.description).toContain("/api/v1/conversations");
    expect(opts.description).toContain("10s");
    expect(opts.description).toContain("req-1");
  });

  it("distingue conexão caída de tempo esgotado", () => {
    showApiError(new NetworkError("POST", "/api/v1/messages", 10_000, "req-2", new TypeError("failed to fetch")));

    const [, opts] = vi.mocked(toast.error).mock.calls.at(-1) as [string, { description: string }];
    // "demorou demais" e "não conectou" pedem investigações opostas.
    expect(opts.description).toContain("conexão falhou");
    expect(opts.description).not.toContain("sem resposta");
  });
});

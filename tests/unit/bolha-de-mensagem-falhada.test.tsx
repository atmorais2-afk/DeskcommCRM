/**
 * A BOLHA DE MENSAGEM FALHADA PRECISA RENDERIZAR — e nenhum teste cobria isso.
 *
 * Medido em produção (2026-08-21): a caixa de entrada inteira virava "Algo deu
 * errado" com um id opaco do Sentry e NENHUM rastro no servidor. Só em conversa
 * que continha mensagem `failed`; conversa sem falha abria normalmente.
 *
 * A causa foi um comentário `//` escrito DENTRO do JSX, entre o
 * `<TooltipTrigger asChild>` e o `<span>`. Em JSX isso não é comentário: é nó
 * de TEXTO. E `asChild` exige um ÚNICO filho elemento — com texto ao lado do
 * span, o Slot do Radix lança e o React derruba a árvore.
 *
 * O que NÃO pegou o defeito, e por isso este arquivo existe:
 *   - typecheck: texto solto em JSX é válido;
 *   - lint: idem;
 *   - a suíte inteira: nenhum teste renderizava uma bolha `failed`.
 *
 * O caminho `failed` é o mais raro da tela e o mais caro quando quebra — é
 * justamente quando o operador precisa entender por que a mensagem não saiu.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MessageBubble } from "@/components/inbox/MessageBubble";
import type { Message } from "@/lib/types/messaging";

function mensagem(over: Partial<Message> = {}): Message {
  return {
    id: "m1",
    organization_id: "org",
    conversation_id: "conv",
    channel_session_id: "sess",
    contact_id: "contato",
    external_id: null,
    type: "text",
    direction: "outbound",
    status: "sent",
    ack: 0,
    error_code: null,
    error_message: null,
    body: "oi",
    media_url: null,
    media_mime: null,
    media_size_bytes: null,
    media_storage_path: null,
    sent_via: "ai",
    sent_by_user_id: null,
    sent_at: "2026-08-21T14:00:00.000Z",
    delivered_at: null,
    read_at: null,
    metadata: {},
    edited_at: null,
    revoked_at: null,
    created_at: "2026-08-21T14:00:00.000Z",
    ...over,
  };
}

describe("bolha de mensagem", () => {
  it("renderiza mensagem FALHADA sem derrubar a árvore", () => {
    // Se o Slot do Radix receber mais de um filho, este render lança e o teste
    // reprova — que é exatamente o sinal que faltava.
    expect(() =>
      render(
        <MessageBubble
          message={mensagem({
            status: "failed",
            error_code: "meta_error",
            error_message: "meta_131037: display name pendente",
          })}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });

  it("o selo de falha não usa cor de texto sobre a cor da marca", () => {
    // `text-destructive` dentro da bolha `bg-primary` é vermelho sobre a cor da
    // marca — ilegível nesta instalação e invisível numa marca vermelha. O chip
    // preenchido carrega o próprio fundo e independe da marca.
    render(<MessageBubble message={mensagem({ status: "failed" })} />);
    const selo = screen.getByText("Falhou").closest("span");
    expect(selo?.className).toContain("bg-destructive");
    expect(selo?.className).toContain("text-destructive-foreground");
  });

  it("mensagem normal continua renderizando", () => {
    render(<MessageBubble message={mensagem({ body: "tudo certo" })} />);
    expect(screen.getByText("tudo certo")).toBeInTheDocument();
  });
});

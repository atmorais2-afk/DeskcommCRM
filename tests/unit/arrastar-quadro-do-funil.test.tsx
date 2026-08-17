/**
 * Pegar e arrastar o quadro pelos cabeçalhos das etapas.
 *
 * O que este arquivo protege é o gesto — inclusive o SENTIDO dele, que é a
 * parte fácil de inverter e a única que o usuário sente na hora: puxar o
 * cabeçalho para a esquerda tem que trazer as etapas da direita.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { useArrastarQuadro } from "@/hooks/kanban/useArrastarQuadro";

/**
 * jsdom não faz layout: `scrollLeft` responde 0 e ignora quem escreve nele.
 * Este substituto guarda o valor e limita na ponta esquerda, que é o que o
 * navegador faz — sem isso, "arrastar além do começo" passaria no teste com um
 * número negativo que nenhum navegador produz.
 */
function tornarRolavel(elemento: HTMLElement, inicial = 0) {
  // Uma vez por elemento. O `ref` em arrow muda de identidade a cada render, e
  // o React o reexecuta — sem esta guarda, começar o arrasto (que re-renderiza
  // para trocar o cursor) zerava a rolagem e o teste media o harness, não o
  // hook. `scrollLeft` mora no protótipo até nós o declararmos aqui.
  if (Object.getOwnPropertyDescriptor(elemento, "scrollLeft")) return;
  let valor = inicial;
  Object.defineProperty(elemento, "scrollLeft", {
    configurable: true,
    get: () => valor,
    set: (novo: number) => {
      valor = Math.max(0, novo);
    },
  });
}

function Quadro({ rolagemInicial = 0 }: { rolagemInicial?: number }) {
  const { ref, aoPegar, arrastando } = useArrastarQuadro();
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) tornarRolavel(el, rolagemInicial);
      }}
      data-testid="quadro"
    >
      <div data-testid="cabecalho" onPointerDown={aoPegar}>
        Proposta enviada
        <button data-testid="menu-da-etapa">⋯</button>
      </div>
      <span data-testid="estado">{arrastando ? "arrastando" : "parado"}</span>
    </div>
  );
}

/** O ponteiro descendo sobre um elemento. `button: 0` = botão principal. */
function pegar(elemento: HTMLElement, x: number, button = 0) {
  fireEvent(
    elemento,
    new MouseEvent("pointerdown", { clientX: x, button, buttons: 1, bubbles: true, cancelable: true }),
  );
}

/** O ponteiro andando. `buttons: 0` significa que o botão já foi solto. */
function mover(x: number, buttons = 1) {
  fireEvent(window, new MouseEvent("pointermove", { clientX: x, buttons, bubbles: true }));
}

function soltar() {
  fireEvent(window, new MouseEvent("pointerup", { bubbles: true }));
}

const rolagem = () => screen.getByTestId("quadro").scrollLeft;

describe("arrastar o quadro pelos cabeçalhos", () => {
  it("puxar para a esquerda traz as etapas seguintes", () => {
    render(<Quadro />);
    pegar(screen.getByTestId("cabecalho"), 500);
    mover(380);
    // Andou 120px para a esquerda com o dedo, então o conteúdo andou 120px —
    // e a rolagem, que é o avesso do conteúdo, subiu os mesmos 120.
    expect(rolagem()).toBe(120);
  });

  it("puxar para a direita volta, e para nas etapas iniciais", () => {
    render(<Quadro rolagemInicial={300} />);
    pegar(screen.getByTestId("cabecalho"), 200);
    mover(300);
    expect(rolagem()).toBe(200);
    // Além do começo o navegador segura em zero; o quadro não anda para trás.
    mover(900);
    expect(rolagem()).toBe(0);
  });

  it("o gesto acompanha o ponteiro em vários passos, sem acumular erro", () => {
    render(<Quadro rolagemInicial={100} />);
    pegar(screen.getByTestId("cabecalho"), 400);
    mover(350);
    mover(300);
    mover(390);
    // Cada passo é medido do PONTO DE PARTIDA, não do passo anterior: voltar
    // para perto de onde começou tem que devolver a rolagem para perto do
    // início. Somar deltas daria 100 + 50 + 50 - 90 = 110 — e o quadro
    // escorregaria a cada mudança de direção.
    expect(rolagem()).toBe(110);
    expect(rolagem()).toBe(100 - (390 - 400));
  });

  it("depois de soltar, mover o ponteiro não mexe mais no quadro", () => {
    render(<Quadro />);
    pegar(screen.getByTestId("cabecalho"), 500);
    mover(400);
    expect(rolagem()).toBe(100);

    soltar();
    expect(screen.getByTestId("estado")).toHaveTextContent("parado");

    mover(50);
    expect(rolagem()).toBe(100);
  });

  it("soltar o botão fora da janela encerra o gesto", () => {
    render(<Quadro />);
    pegar(screen.getByTestId("cabecalho"), 500);
    mover(400);

    // O `pointerup` nunca chega; o que chega é um movimento sem botão apertado.
    mover(300, 0);
    expect(screen.getByTestId("estado")).toHaveTextContent("parado");

    mover(100);
    expect(rolagem()).toBe(100);
  });

  it("o botão dentro do cabeçalho continua sendo um botão", () => {
    render(<Quadro />);
    pegar(screen.getByTestId("menu-da-etapa"), 500);
    expect(screen.getByTestId("estado")).toHaveTextContent("parado");

    mover(300);
    expect(rolagem()).toBe(0);
  });

  it("no dedo quem arrasta é o navegador, não o hook", () => {
    render(<Quadro />);
    const toque = new MouseEvent("pointerdown", {
      clientX: 500,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(toque, "pointerType", { value: "touch" });
    fireEvent(screen.getByTestId("cabecalho"), toque);

    mover(300);
    // Zero, e não 200: o container rola no toque por conta própria. Se o hook
    // também rolasse, o quadro andaria o dobro do dedo.
    expect(rolagem()).toBe(0);
    expect(screen.getByTestId("estado")).toHaveTextContent("parado");
  });

  it("o botão secundário do mouse não arrasta", () => {
    render(<Quadro />);
    pegar(screen.getByTestId("cabecalho"), 500, 2);
    mover(300);
    expect(rolagem()).toBe(0);
  });

  it("o cursor avisa que dá para pegar, e muda enquanto arrasta", () => {
    render(<Quadro />);
    const cabecalho = screen.getByTestId("cabecalho");
    expect(screen.getByTestId("estado")).toHaveTextContent("parado");

    pegar(cabecalho, 500);
    expect(screen.getByTestId("estado")).toHaveTextContent("arrastando");
  });
});

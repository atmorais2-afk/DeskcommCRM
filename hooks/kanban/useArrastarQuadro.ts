"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as EventoDePonteiro,
  type RefObject,
} from "react";

/**
 * Elementos que têm ação PRÓPRIA no clique e por isso não puxam o quadro.
 *
 * Hoje o cabeçalho da etapa é só texto e contagem, mas o dia em que ganhar um
 * menu (renomear, arquivar) o botão precisa continuar sendo um botão — e a
 * diferença entre "clicou" e "começou a arrastar" some sem esta linha.
 */
const SELETOR_INTERATIVO = 'button, a, input, select, textarea, [role="button"]';

export interface QuadroArrastavel {
  /** Vai no container que rola na horizontal. */
  ref: RefObject<HTMLDivElement | null>;
  /** Vai no `onPointerDown` do cabeçalho de cada etapa. */
  aoPegar: (evento: EventoDePonteiro<HTMLElement>) => void;
  /** Verdadeiro entre o "peguei" e o "soltei" — só serve para o cursor. */
  arrastando: boolean;
}

/**
 * Pegar e arrastar o quadro pelos cabeçalhos das etapas.
 *
 * ⚠️ A BARRA DE ROLAGEM NÃO É ALCANÇÁVEL EM FUNIL CHEIO. As colunas crescem com
 * os cards e o container cresce junto, então a barra horizontal fica no rodapé
 * do CONTEÚDO — com 25 leads numa etapa, ver a etapa seguinte exige rolar a
 * página inteira até o fim, mover para o lado e voltar. Os cabeçalhos ficam
 * onde o olho já está e servem de alça.
 *
 * Não conflita com o arrasto de cards: aquele nasce no card (@hello-pangea/dnd),
 * este só no cabeçalho.
 */
export function useArrastarQuadro(): QuadroArrastavel {
  const ref = useRef<HTMLDivElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  /**
   * Onde o gesto começou — ponteiro e rolagem, juntos.
   *
   * Em ref e não em estado de propósito: isto é lido a cada `pointermove` e
   * nada na tela depende dele. Como estado, seria um render por pixel arrastado,
   * com os cards do funil inteiro no caminho.
   */
  const inicio = useRef<{ x: number; rolagem: number } | null>(null);

  const aoPegar = useCallback((evento: EventoDePonteiro<HTMLElement>) => {
    const quadro = ref.current;
    if (!quadro) return;
    // Só o botão principal: o direito abre o menu do sistema, e o do meio é
    // colar no X11 — nenhum dos dois é "pegar para arrastar".
    if (evento.button !== 0) return;
    // ⚠️ NO DEDO O NAVEGADOR JÁ ARRASTA SOZINHO. O container rola na horizontal,
    // então deslizar o dedo sobre o cabeçalho já o move — somar este cálculo por
    // cima faria o quadro andar o DOBRO do dedo. Mouse e caneta entram; toque
    // não. (`pointerType` vem indefinido quando o evento é sintetizado, e nesse
    // caso o gesto segue: quem não se declara toque é tratado como ponteiro.)
    if (evento.pointerType === "touch") return;
    if (evento.target instanceof Element && evento.target.closest(SELETOR_INTERATIVO)) {
      return;
    }

    inicio.current = { x: evento.clientX, rolagem: quadro.scrollLeft };
    setArrastando(true);
    // Sem isto o navegador entende o gesto como seleção de texto e o arrasto
    // vira um rastro azul por cima dos nomes das etapas.
    evento.preventDefault();
  }, []);

  useEffect(() => {
    if (!arrastando) return;

    const soltar = () => {
      inicio.current = null;
      setArrastando(false);
    };

    const mover = (evento: PointerEvent) => {
      const quadro = ref.current;
      const partida = inicio.current;
      if (!quadro || !partida) return;
      // Soltou o botão FORA da janela: o `pointerup` nunca chega, e o primeiro
      // movimento de volta vem sem botão nenhum pressionado. Sem este teste o
      // quadro seguiria colado no ponteiro depois de o gesto ter acabado.
      if (evento.buttons === 0) {
        soltar();
        return;
      }
      // Puxar para a ESQUERDA traz as etapas da direita: o conteúdo acompanha o
      // dedo, então a rolagem anda no sentido oposto ao do ponteiro. O navegador
      // limita nas pontas — não há o que segurar aqui.
      quadro.scrollLeft = partida.rolagem - (evento.clientX - partida.x);
    };

    // No WINDOW, não no cabeçalho: quem arrasta sai de cima da coluna no
    // primeiro instante, e um ouvinte preso ao elemento perderia o resto do
    // gesto — inclusive o "soltei".
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [arrastando]);

  return { ref, aoPegar, arrastando };
}

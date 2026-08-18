/**
 * A trava que impede o agente de responder "de nada" a um "até mais".
 *
 * Os casos positivos são TEXTOS REAIS da conversa que motivou a trava
 * (número 5521971447080, 18/08/2026), onde o agente mandou quatro mensagens
 * para uma conversa que já tinha terminado.
 *
 * Os negativos são o que a trava NÃO pode engolir: em silêncio, cada um deles
 * é um lead perdido.
 */
import { describe, it, expect } from 'vitest';

import { ehSoEncerramento } from '@/lib/agent-engine/edge/crm/fechamento-de-conversa';

describe('ehSoEncerramento', () => {
  describe('silencia (a conversa acabou)', () => {
    const encerra = [
      'Até mais!',
      'Combinado, até mais!',
      'Até mais! 😊',
      'Obrigado!',
      'Muito obrigada 🙏',
      'Valeu!',
      'vlw',
      'obg',
      'Tchau tchau'.replace(' tchau', ''),
      'Obrigado, até logo',
      'obrigado e até mais',
      'Perfeito, obrigado!',
      'ok, valeu',
      'Grato!',
      'ate mais',
      'ABRAÇOS',
    ];
    for (const t of encerra) {
      it(JSON.stringify(t), () => expect(ehSoEncerramento(t)).toBe(true));
    }
  });

  describe('responde (tem assunto)', () => {
    const responde = [
      // Pergunta educada — o "obrigado" não apaga a pergunta.
      'Obrigado, quanto custa?',
      'Valeu! Como funciona?',
      // Pedido explícito.
      'obrigado, me manda a proposta',
      'Até mais, mas antes me tira uma dúvida',
      'Perfeito, pode enviar',
      // ⚠️ Concordância PURA não silencia: depois de "posso te enviar?", um
      // "ok" é um SIM. Calar aqui perderia o negócio.
      'ok',
      'combinado',
      'Beleza',
      'perfeito',
      'Certo',
      // "fechado" neste negócio é negócio FECHADO, não despedida.
      'fechado',
      'fechou',
      // Saudação abre conversa, não fecha.
      'Bom dia',
      'Oi',
      // Texto longo nunca é só um adeus.
      'Obrigado pelo retorno, vou avaliar com meu sócio e te falo semana que vem sobre o site',
      // Nada.
      '',
      '   ',
    ];
    for (const t of responde) {
      it(JSON.stringify(t), () => expect(ehSoEncerramento(t)).toBe(false));
    }
  });

  it('mensagem ausente não quebra nem silencia', () => {
    expect(ehSoEncerramento(null)).toBe(false);
    expect(ehSoEncerramento(undefined)).toBe(false);
  });

  it('só emoji não conta como despedida', () => {
    // Sobra string vazia depois de limpar — e vazio não autoriza silêncio.
    expect(ehSoEncerramento('👍')).toBe(false);
    expect(ehSoEncerramento('😊😊')).toBe(false);
  });
});

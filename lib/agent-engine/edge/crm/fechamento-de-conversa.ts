/**
 * "Esta mensagem é só um adeus?" — a pergunta que evita o pingue-pongue de cortesia.
 *
 * ⚠️ O PROBLEMA MEDIDO (2026-08-18, número 5521971447080): o lead escreveu
 * "Até mais!", o agente respondeu "Por nada! Ficando à disposição por aqui 😊",
 * o lead respondeu "Combinado, até mais!", o agente respondeu "Até mais! 😊", o
 * lead respondeu "Até mais!"... Quatro mensagens do agente para uma conversa que
 * já tinha acabado, cada uma consumindo cota diária de um número em aquecimento —
 * a cota que existe para a conversa que IMPORTA.
 *
 * Humano nenhum responde "de nada" a um "até mais". O agente respondia porque
 * TODA mensagem de entrada acordava um turno, e um turno sempre tem algo a dizer.
 *
 * A REGRA, e o porquê de ela ser conservadora:
 *
 *   Silencia só quando a mensagem inteira é fechamento E carrega uma despedida
 *   ou um agradecimento explícito.
 *
 * Concordância pura ("ok", "combinado", "beleza") NÃO silencia sozinha, e isso é
 * deliberado: depois de "posso te enviar a proposta?", um "ok" é um SIM — calar
 * ali perderia o negócio. Ela só entra como acompanhante ("Combinado, até mais!"),
 * onde a despedida é que decide.
 *
 * Fora do vocabulário de propósito: "fechado" e "fechou". Neste negócio elas
 * significam negócio FECHADO, não "tchau" — é o gatilho do contrato.
 */

/** Despedida ou agradecimento — só estas AUTORIZAM o silêncio. */
const ENCERRAMENTOS = new Set([
  // despedidas
  'ate mais', 'ate logo', 'ate breve', 'ate mais ver', 'ate a proxima', 'ate',
  'tchau', 'tchauzinho', 'xau', 'adeus', 'falou', 'falous', 'flw', 'fui',
  'abraco', 'abracos', 'abs', 'um abraco', 'boa noite entao',
  // agradecimentos
  'obrigado', 'obrigada', 'obrigado mesmo', 'obrigada mesmo', 'obg', 'obgd',
  'valeu', 'valew', 'vlw', 'grato', 'grata', 'agradeco', 'agradecido',
  'agradecida', 'gratidao', 'thanks', 'tks', 'muito obrigado', 'muito obrigada',
]);

/**
 * Cortesia que ACOMPANHA um encerramento, mas nunca o dispara sozinha.
 * "Combinado, até mais!" silencia; "Combinado" sozinho, não.
 */
const ACOMPANHANTES = new Set([
  'ok', 'okay', 'ok entao', 'blz', 'beleza', 'certo', 'combinado', 'perfeito',
  'otimo', 'show', 'top', 'joia', 'legal', 'massa', 'tranquilo', 'imagina',
  'de nada', 'disponha', 'sem problema', 'sem problemas', 'ta bom', 'tudo bem',
  'entao ta', 'entao ta bom', 'por nada', 'nada', 'certo entao', 'bom demais',
]);

/** Teto de tamanho: adeus é curto. Texto longo tem assunto, e assunto merece resposta. */
const TETO_DE_CARACTERES = 80;

/**
 * Tira acento, emoji e pontuação decorativa, deixando só as palavras.
 *
 * O emoji some porque "Até mais! 😊" e "Até mais!" são a MESMA mensagem para
 * quem lê — e o agente respondia às duas.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    // Faixa dos diacríticos combinantes: é o que o NFD separou da letra.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, ' ')
    .replace(/[!.…~*_"'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A mensagem é APENAS um encerramento de conversa?
 *
 * `false` para qualquer dúvida — o custo dos dois erros não é o mesmo. Silenciar
 * demais é perder um lead; silenciar de menos é uma mensagem cortês a mais.
 */
export function ehSoEncerramento(texto: string | null | undefined): boolean {
  if (texto === null || texto === undefined) return false;
  const t = texto.trim();
  if (t.length === 0 || t.length > TETO_DE_CARACTERES) return false;
  // Pergunta nunca é despedida, por mais educada que seja ("obrigado, quanto custa?").
  if (t.includes('?')) return false;

  const limpo = normalizar(t);
  if (limpo.length === 0) return false;

  // Fatiado por vírgula, ponto-e-vírgula e o "e" que liga cortesias
  // ("obrigado e até mais"). Cada pedaço tem que ser cortesia conhecida.
  const pedacos = limpo
    .split(/[,;]| e /)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (pedacos.length === 0) return false;

  let temEncerramento = false;
  for (const pedaco of pedacos) {
    if (ENCERRAMENTOS.has(pedaco)) {
      temEncerramento = true;
      continue;
    }
    if (ACOMPANHANTES.has(pedaco)) continue;
    // Um pedaço fora do vocabulário = há assunto na mensagem. Responde.
    return false;
  }
  return temEncerramento;
}

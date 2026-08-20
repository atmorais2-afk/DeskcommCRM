/**
 * OS TOKENS DE TEXTO NEUTRO PRECISAM SER LEGÍVEIS — e ninguém estava medindo.
 *
 * `lib/branding/contraste.ts` vigia os papéis da MARCA contra as superfícies, e
 * faz isso bem: extrai os pares do próprio `globals.css` em vez de listá-los à
 * mão. Mas ele classifica papel pelo sufixo `-fg`, e `--color-text-muted` /
 * `--color-text-subtle` não têm esse sufixo — então nunca entraram na conta.
 *
 * O resultado, medido no tema escuro antes desta guarda existir:
 *
 *   text-subtle sobre surface-elevated   2,33:1
 *   text-subtle sobre bg                 2,81:1
 *   text-muted  sobre surface-elevated   4,44:1
 *
 * A suíte inteira estava VERDE com esses números — e é essa a prova de que os
 * tokens não eram vigiados por ninguém. É a assinatura de um gate que mede o
 * que foi inscrito em vez do que existe.
 *
 * A conta é a da WCAG 2.1 (luminância relativa), repetida aqui de propósito
 * para o arquivo poder ser lido sozinho por quem investiga "não consigo ler".
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** AA para texto normal. Estes tokens aparecem em rótulo de 10px — o piso tem
 *  de ser o do texto pequeno, não os 3,0 que o texto grande aceitaria. */
const PISO_AA = 4.5;

function canalLinear(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  // Indexado com fallback, e não desestruturado: sob `noUncheckedIndexedAccess`
  // o destructuring de array devolve `number | undefined` e o typecheck reprova.
  const c = [0, 2, 4].map((i) => canalLinear(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
}

function razao(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Os literais de um bloco de tema.
 *
 * Procura o seletor SEGUIDO DA CHAVE: o cabeçalho do `globals.css` cita
 * `[data-theme="dark"]` em prosa, e procurar o seletor cru casava com o
 * comentário — o teste media um bloco inexistente e passava verde.
 *
 * Só hex direto: `var(...)` não é cor final e não dá para medir.
 */
function tokensDoBloco(css: string, seletor: string): Record<string, string> {
  const i = css.indexOf(seletor + " {");
  if (i === -1) return {};
  const fim = css.indexOf("\n}", i);
  const bloco = css.slice(i, fim === -1 ? undefined : fim);
  const out: Record<string, string> = {};
  for (const m of bloco.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const nome = m[1];
    const valor = m[2];
    if (nome && valor) out[nome] = valor;
  }
  return out;
}

const CSS = readFileSync("app/globals.css", "utf8");
const TEMAS = [
  ['[data-theme="dark"]', "escuro"],
  ['[data-theme="light"]', "claro"],
] as const;

const TEXTOS = ["color-text", "color-text-muted", "color-text-subtle"];
const SUPERFICIES = ["color-bg", "color-surface", "color-surface-elevated"];

describe("legibilidade do texto neutro sobre as superfícies", () => {
  for (const [seletor, nome] of TEMAS) {
    const t = tokensDoBloco(CSS, seletor);

    it(`tema ${nome}: a varredura acha os tokens (controle de vacuidade)`, () => {
      // Sem isto, renomear um token faria os laços abaixo rodarem vazios e o
      // arquivo passaria verde sem medir nada — o mesmo defeito que ele existe
      // para não repetir.
      for (const chave of [...TEXTOS, ...SUPERFICIES]) {
        expect(t[chave], `${seletor} não declara --${chave}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    for (const texto of TEXTOS) {
      for (const superficie of SUPERFICIES) {
        it(`tema ${nome}: ${texto} sobre ${superficie} passa AA`, () => {
          // `?? ""` nunca acontece na prática: o controle de vacuidade acima
          // reprova antes se algum token sumir. Está aqui só para o typecheck.
          const r = razao(t[texto] ?? "", t[superficie] ?? "");
          expect(
            r,
            `${t[texto]} sobre ${t[superficie]} dá ${r.toFixed(2)}:1, abaixo de ${PISO_AA}. ` +
              `Clareie (tema escuro) ou escureça (tema claro) o token de TEXTO. Nunca mexa na ` +
              `superfície para resolver: ela é o fundo de tudo, e mudá-la desloca o sistema inteiro.`,
          ).toBeGreaterThanOrEqual(PISO_AA);
        });
      }
    }

    it(`tema ${nome}: a hierarquia text > muted > subtle continua visível`, () => {
      // Passar no contraste clareando tudo até virar a mesma cor resolveria o
      // número e destruiria a informação: os três degraus dizem o que é
      // principal, o que é apoio e o que é acessório.
      const l = (k: string) => luminancia(t[k] ?? "");
      const sentido = nome === "escuro" ? 1 : -1;
      expect((l("color-text") - l("color-text-muted")) * sentido).toBeGreaterThan(0);
      expect((l("color-text-muted") - l("color-text-subtle")) * sentido).toBeGreaterThan(0);
    });
  }
});

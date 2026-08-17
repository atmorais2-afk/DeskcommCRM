/**
 * A leitura de `crm_pipelines.settings.fields` — jsonb livre virando lista de
 * campos que a tela do negócio consegue desenhar.
 *
 * O que estes casos protegem: a coluna NÃO passou toda pela tela de
 * configuração (tem seed, migração e edição direta no banco), então cada
 * afirmação aqui é sobre o que a tela faz quando o dado não obedece.
 */
import { describe, it, expect } from "vitest";

import { camposDoFunil } from "./campos-do-funil";

const texto = { key: "cnpj", label: "CNPJ", type: "text" as const };
const lista = {
  key: "origem",
  label: "Origem",
  type: "select" as const,
  required: true,
  options: [{ value: "indicacao", label: "Indicação" }],
};

describe("camposDoFunil", () => {
  it("funil sem settings, sem `fields`, ou com `fields` que não é lista → nenhum campo", () => {
    // Os três são o estado NORMAL da maioria das instalações, não erro: a
    // tela precisa tratá-los como "não há campo", nunca como falha.
    expect(camposDoFunil(undefined)).toEqual([]);
    expect(camposDoFunil(null)).toEqual([]);
    expect(camposDoFunil({})).toEqual([]);
    expect(camposDoFunil({ fields: { cnpj: "text" } })).toEqual([]);
  });

  it("devolve os campos declarados, com opções e obrigatoriedade", () => {
    expect(camposDoFunil({ fields: [texto, lista] })).toEqual([texto, lista]);
  });

  it("campo malformado sai SOZINHO — os vizinhos continuam na tela", () => {
    // Um `type` inventado ou um `label` faltando é erro de configuração de UM
    // campo. Derrubar a lista inteira transformaria isso num negócio que
    // parece não ter campo nenhum, e ninguém saberia onde procurar.
    const campos = camposDoFunil({
      fields: [texto, { key: "x", label: "X", type: "rocket" }, { key: "y" }, null, lista],
    });
    expect(campos).toEqual([texto, lista]);
  });

  it("chave repetida entra uma vez só — o jsonb tem uma coluna por chave", () => {
    // Dois inputs disputando a mesma chave: o segundo venceria em silêncio, e
    // quem preenchesse o primeiro veria o valor sumir ao salvar.
    const campos = camposDoFunil({
      fields: [texto, { ...texto, label: "CNPJ (novo)" }],
    });
    expect(campos).toEqual([texto]);
  });
});

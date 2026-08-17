import type { z } from "zod";

import { customFieldSchema } from "@/lib/schemas/settings";

/** Um campo personalizado já validado — a forma que o editor da tela consome. */
export type CampoDoFunil = z.infer<typeof customFieldSchema>;

/**
 * Os campos personalizados declarados num funil, lidos de `settings.fields`.
 *
 * `crm_pipelines.settings` é jsonb livre: o schema de escrita
 * (`pipelineConfigPatchSchema`) só vale para quem passou pela tela de
 * configuração, e a coluna também recebeu seed, migração e edição direta no
 * banco. Ler daí sem validar é confiar num contrato que ninguém garante.
 *
 * A validação é POR ENTRADA, não pelo array inteiro: um campo malformado no meio
 * da lista não pode apagar os outros da tela. O funil com um campo estragado
 * mostra os que estão bons — perder todos seria transformar um erro de
 * configuração num negócio que parece não ter campo nenhum.
 */
export function camposDoFunil(
  settings: Record<string, unknown> | undefined | null,
): CampoDoFunil[] {
  const bruto = settings?.fields;
  if (!Array.isArray(bruto)) return [];

  const campos: CampoDoFunil[] = [];
  const vistos = new Set<string>();
  for (const entrada of bruto) {
    const parsed = customFieldSchema.safeParse(entrada);
    if (!parsed.success) continue;
    // Chave repetida é uma só coluna no jsonb: renderizar as duas daria dois
    // inputs disputando o mesmo valor, e o segundo venceria em silêncio.
    if (vistos.has(parsed.data.key)) continue;
    vistos.add(parsed.data.key);
    campos.push(parsed.data);
  }
  return campos;
}

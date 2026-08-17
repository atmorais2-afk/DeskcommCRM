"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CustomFieldsEditor } from "@/components/contacts/CustomFieldsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEditLead } from "@/hooks/kanban/useUpdateLead";
import type { Lead } from "@/lib/types/leads";
import type { CampoDoFunil } from "@/lib/kanban/campos-do-funil";
import { updateLeadSchema, type UpdateLeadInput } from "@/lib/schemas/leads";
import { parseReaisToCents } from "@/lib/money";
import { EcoDoValor } from "./EcoDoValor";

interface FormShape {
  title: string;
  description: string;
  valueReais: string;
  tagsRaw: string;
  expected_close_date: string;
}

interface Props {
  lead: Lead;
  pipelineId: string;
  /**
   * O que o FUNIL declarou em `settings.fields` — quem tem o funil em mãos
   * passa daqui (o board), porque este formulário só recebe o `pipelineId` e
   * buscar as settings de novo seria uma segunda leitura do que a tela já tem.
   * Vazio (o padrão) = funil sem campo personalizado.
   */
  camposPersonalizados?: CampoDoFunil[];
  /** Quando o salvamento dá certo. O dossiê NÃO fecha aqui — ver abaixo. */
  onSaved?: () => void;
  /** O dossiê não tem "cancelar"; o diálogo tem. */
  onCancel?: () => void;
}

function centsToReais(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Os campos do lead — extraídos do `EditLeadDialog` para o dossiê usar os
 * MESMOS, em vez de uma cópia que diverge no mês.
 *
 * `onSaved` existe para o dossiê NÃO FECHAR ao salvar: quem edita precisa ver a
 * atividade que acabou de gerar entrar na timeline. Fechar esconderia o
 * registro justamente de quem o produziu — a funcionalidade que prova "sua ação
 * fica registrada" provaria isso para todo mundo menos para o autor.
 */
export function LeadFieldsForm({
  lead,
  pipelineId,
  camposPersonalizados = [],
  onSaved,
  onCancel,
}: Props) {
  const edit = useEditLead(pipelineId);

  /**
   * Os campos personalizados ficam FORA do react-hook-form: as chaves são dado
   * do tenant, não nomes conhecidos em tempo de compilação, e registrá-las como
   * campos exigiria `register(chave)` com string arbitrária — inclusive as que
   * o RHF lê como caminho (`a.b`, `a[0]`), que viraria objeto aninhado onde o
   * jsonb espera uma chave só.
   *
   * O valor ATUAL do lead é a semente, não um objeto vazio: `custom_fields`
   * também recebe escrita de webhook, importador e agente, e o PATCH substitui
   * o jsonb inteiro — partir do vazio apagaria em silêncio tudo que o funil não
   * declara.
   */
  const [personalizados, setPersonalizados] = useState<Record<string, unknown>>(
    () => ({ ...(lead.custom_fields ?? {}) }),
  );

  /**
   * Trocou de negócio → repõe. Ajuste DURANTE o render, o padrão do React para
   * "a prop mudou, reponha o estado": em efeito ele dispararia render em
   * cascata (o compilador avisa, e com razão) — o mesmo caminho já tomado em
   * app/app/kanban/_client.tsx.
   *
   * O gatilho é o `id`, não o lead inteiro: o board recebe o próprio salvamento
   * de volta pelo realtime, e repor a cada objeto novo atropelaria o que a
   * pessoa está digitando.
   */
  const [negocioDosPersonalizados, setNegocioDosPersonalizados] = useState(lead.id);
  if (negocioDosPersonalizados !== lead.id) {
    setNegocioDosPersonalizados(lead.id);
    setPersonalizados({ ...(lead.custom_fields ?? {}) });
  }

  const form = useForm<FormShape>({
    defaultValues: {
      title: lead.title,
      description: lead.description ?? "",
      valueReais: centsToReais(lead.value_cents),
      tagsRaw: (lead.tags ?? []).join(", "),
      expected_close_date: lead.expected_close_date ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      title: lead.title,
      description: lead.description ?? "",
      valueReais: centsToReais(lead.value_cents),
      tagsRaw: (lead.tags ?? []).join(", "),
      expected_close_date: lead.expected_close_date ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function onSubmit(values: FormShape) {
    const tags = values.tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const reais = values.valueReais.trim();
    let valueCents: number | null = null;
    if (reais.length > 0) {
      valueCents = parseReaisToCents(reais);
      if (valueCents === null) {
        form.setError("valueReais", { message: "Valor inválido" });
        return;
      }
    }

    const patch: Record<string, unknown> = {
      title: values.title.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      value_cents: valueCents,
      tags,
      expected_close_date: values.expected_close_date || null,
    };

    // Só entra no patch o funil que DECLARA campo. Sem esta guarda, todo
    // salvamento em funil sem campo personalizado mandaria `custom_fields` que
    // este formulário nunca mostrou — escrever de volta um jsonb que a tela não
    // exibe é assinar por dado que ninguém reviu.
    if (camposPersonalizados.length > 0) {
      patch.custom_fields = personalizados;
    }

    const parsed = updateLeadSchema.safeParse(patch);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Dados inválidos");
      return;
    }

    try {
      await edit.mutateAsync({
        leadId: lead.id,
        patch: parsed.data as UpdateLeadInput,
      });
      toast.success("Lead atualizado");
      onSaved?.();
    } catch {
      // toast already shown
    }
  }


  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            {...form.register("title", { required: true, minLength: 2 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea id="description" rows={3} {...form.register("description")} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="valueReais">Valor (R$)</Label>
            <Input
              id="valueReais"
              inputMode="decimal"
              placeholder="0,00"
              {...form.register("valueReais")}
            />
            <EcoDoValor control={form.control} />
            {form.formState.errors.valueReais && (
              <p className="text-xs text-error-fg">
                {form.formState.errors.valueReais.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected_close_date">Fechamento previsto</Label>
            <Input
              id="expected_close_date"
              type="date"
              {...form.register("expected_close_date")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagsRaw">Tags (separadas por vírgula)</Label>
          <Input id="tagsRaw" placeholder="vip, recompra" {...form.register("tagsRaw")} />
        </div>

        {/* Seção só existe quando o funil declara campo: um título "Campos
            personalizados" sobre o vazio prometeria uma configuração que a
            instalação não tem, e mandaria procurar o que não foi criado. */}
        {camposPersonalizados.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Campos personalizados
            </h4>
            <CustomFieldsEditor
              mode="lead"
              fields={camposPersonalizados}
              value={personalizados}
              onChange={setPersonalizados}
              disabled={edit.isPending}
            />
          </div>
        )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={edit.isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={edit.isPending}>
          {edit.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

// Middlewares HTTP do backend (spec Task 6): hoje só as rotas admin do Benefício Conjunto.
// Schemas exportados para as rotas inferirem `z.infer<typeof Schema>` no tipo de `AuthenticatedMedusaRequest<Body>`
// — uma única fonte de verdade para forma do body e validação.
import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "zod"
import { TIPOS_DESCONTO } from "../modules/beneficio-conjunto/utils/tipos"

// `valor` é inteiro ≥ 1 (percentual inteiro 1–100, ou centavos ≥ 1) — spec §4.1. O teto de 100
// só faz sentido para tipos percentuais (`*_percentual`); tipos `*_valor` guardam centavos e não
// têm teto aqui (o próprio motor de desconto já limita ao preço da peça, ver `descontoDoConjunto`).
const valorSchema = z.number().int().min(1)
const valorCoerenteComTipo = (tipo_desconto: string, valor: number) => !(tipo_desconto.endsWith("percentual") && valor > 100)
const MENSAGEM_VALOR_PERCENTUAL = "Valor percentual não pode passar de 100."

export const CriarRegraSchema = z
  .object({
    nome: z.string().min(1),
    escopo: z.enum(["padrao", "colecao"]),
    collection_id: z.string().min(1).optional(),
    tipo_desconto: z.enum(TIPOS_DESCONTO),
    valor: valorSchema,
    ativa: z.boolean().optional(),
  })
  .refine((d) => valorCoerenteComTipo(d.tipo_desconto, d.valor), { message: MENSAGEM_VALOR_PERCENTUAL, path: ["valor"] })

// Body parcial (spec): nunca inclui `escopo`/`collection_id` — o modo estrito do validador do
// framework (zodValidator chama `.strict()`) rejeita qualquer chave fora deste schema com 400,
// o que já impede a troca de escopo/coleção por essa rota sem checagem extra na rota.
export const AtualizarRegraSchema = z
  .object({
    nome: z.string().min(1).optional(),
    tipo_desconto: z.enum(TIPOS_DESCONTO).optional(),
    valor: valorSchema.optional(),
    ativa: z.boolean().optional(),
  })
  .refine((d) => !d.tipo_desconto || d.valor === undefined || valorCoerenteComTipo(d.tipo_desconto, d.valor), {
    message: MENSAGEM_VALOR_PERCENTUAL,
    path: ["valor"],
  })

const ParInputSchema = z.object({ categoria_a: z.string().min(1), categoria_b: z.string().min(1), ativo: z.boolean().optional() })
export const AtualizarParesSchema = z.object({ pares: z.array(ParInputSchema) })

export const CriarCuradoSchema = z
  .object({
    nome: z.string().min(1),
    handle: z.string().min(1).optional(),
    capa_url: z.string().min(1).optional(),
    product_ids: z.array(z.string().min(1)).min(1),
    tipo_desconto: z.enum(TIPOS_DESCONTO),
    valor: valorSchema,
    ativo: z.boolean().optional(),
    ordem: z.number().int().optional(),
  })
  .refine((d) => valorCoerenteComTipo(d.tipo_desconto, d.valor), { message: MENSAGEM_VALOR_PERCENTUAL, path: ["valor"] })

// `handle` fica de fora de propósito (imutável — spec): o modo estrito rejeita com 400 quem tentar
// mandá-lo neste body, então a rota nunca precisa decidir se ignora ou aplica um handle novo.
export const AtualizarCuradoSchema = z
  .object({
    nome: z.string().min(1).optional(),
    capa_url: z.string().min(1).optional(),
    product_ids: z.array(z.string().min(1)).min(1).optional(),
    tipo_desconto: z.enum(TIPOS_DESCONTO).optional(),
    valor: valorSchema.optional(),
    ativo: z.boolean().optional(),
    ordem: z.number().int().optional(),
  })
  .refine((d) => !d.tipo_desconto || d.valor === undefined || valorCoerenteComTipo(d.tipo_desconto, d.valor), {
    message: MENSAGEM_VALOR_PERCENTUAL,
    path: ["valor"],
  })

export default defineMiddlewares({
  routes: [
    { method: "POST", matcher: "/admin/conjuntos/regras", middlewares: [validateAndTransformBody(CriarRegraSchema)] },
    { method: "PUT", matcher: "/admin/conjuntos/regras/:id", middlewares: [validateAndTransformBody(AtualizarRegraSchema)] },
    { method: "PUT", matcher: "/admin/conjuntos/pares", middlewares: [validateAndTransformBody(AtualizarParesSchema)] },
    { method: "POST", matcher: "/admin/conjuntos/curados", middlewares: [validateAndTransformBody(CriarCuradoSchema)] },
    { method: "PUT", matcher: "/admin/conjuntos/curados/:id", middlewares: [validateAndTransformBody(AtualizarCuradoSchema)] },
  ],
})

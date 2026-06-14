# architecture/catalog.md — SOP do Catálogo (Parte 1)

> Schema de referência do catálogo da use.ÉCLAT (Data-First). APROVADO em 2026-06-13.
> Mapeado aos primitivos do Medusa v2. Toda mudança estrutural do catálogo se documenta aqui primeiro.

## 1. Mapeamento aos primitivos do Medusa v2
| Conceito Éclat | Primitivo Medusa | Observações |
|---|---|---|
| Peça | **Product** | title, subtitle, handle, description, thumbnail, images, status |
| Variação vendável | **Variant** | SKU próprio, preço (BRL centavos), estoque |
| Eixos de variação | **Product Options** | `Tamanho` e `Cor` |
| Tipo de peça | **Category** (1 nível) | navegação principal da vitrine |
| Drop/linha editorial | **Collection** | curadoria, opcional por produto |
| Filtros | **Tags** | ex.: "alta compressão", "cintura alta" |
| Ficha técnica | **Metadata** (product) | chaves padronizadas (seção 6) |
| Canal de venda | **Sales Channel** | usar o "Default Sales Channel" (vitrine) |

## 2. Opções e variantes
Toda peça de vestuário tem **duas opções**:
- **Tamanho:** `P`, `M`, `G`, `GG` (grade global; pode ser estendida por produto se necessário).
- **Cor:** livre por produto (ex.: Preto, Areia, Vinho, Verde Musgo).

**Variantes = Tamanho × Cor.** Cada variante tem SKU, preço e estoque próprios.

### Convenção de SKU
`ECL-<TIPO>-<SLUG>-<COR>-<TAM>`
- `<TIPO>`: 3 letras do tipo (LEG, TOP, SHO, CAL, BLU, MAC, CON, CAS)
- `<SLUG>`: nome curto da peça (maiúsculas, sem espaço)
- `<COR>`: 3 letras da cor (PRT, ARE, VIN, MUS…)
- `<TAM>`: P | M | G | GG

Ex.: `ECL-LEG-RESPLENDOR-PRT-M`

## 3. Categorias (por tipo de peça — 1 nível)
- Leggings
- Tops & Sutiãs
- Shorts
- Calças
- Blusas & Cropped
- Macacões
- Conjuntos
- Casacos & Jaquetas

Cada produto pertence a **uma** categoria principal. Hierarquia pode evoluir em fase futura.

## 4. Coleções (editorial / drops)
Agrupamentos de curadoria, independentes da categoria. Um produto pode estar em 0 ou 1 coleção.
Exemplos iniciais: **"Resplendor"** (carro-chefe), **"Luz Primeira"** (lançamento).

## 5. Preço, região e moeda (invariante 3)
- **Região:** Brasil. **Moeda:** BRL. Demo Europe/EUR será **removida**.
- Vitrine: `NEXT_PUBLIC_DEFAULT_REGION` apontando para o Brasil (`br`).
- Preço com imposto incluso (padrão BR) — confirmar tax settings em fase futura.
- **Sobre "centavos inteiros" (invariante 3):**
  - No **Medusa**, o preço é informado em **unidade decimal da moeda** (ex.: `199.90` = R$ 199,90).
    O Medusa armazena/calcula via **BigNumber** (não usa float em operação de dinheiro). Esse é o contrato do Medusa.
  - O invariante "centavos inteiros, nunca float" governa **os nossos módulos** (integração Mercado Pago,
    persistência no Supabase, cálculos do Cockpit): ali, dinheiro trafega como inteiro em centavos.
  - Regra prática: ao sair/entrar do Medusa, converter centavos ↔ decimal de forma explícita e centralizada.

## 6. Ficha técnica (metadata do produto) — chaves padronizadas
| Chave | Tipo | Exemplo |
|---|---|---|
| `composicao` | string | "78% poliamida, 22% elastano" |
| `compressao` | enum string | "alta" \| "media" \| "leve" |
| `caimento` | enum string | "justo" \| "regular" \| "solto" |
| `cuidados` | string | "Lavar à mão. Não usar secadora. Não passar." |
| `modelo_veste` | string | "Modelo 1,70 m veste M" |
| `guia_medidas` | string/url | tabela de medidas por tamanho (texto ou link) |

> Regra: metadata é só leitura de ficha. Nada de preço/estoque em metadata (esses são primitivos).

## 7. Status e publicação
- Fluxo: `draft` → `published`. Só `published` aparece na Store API / vitrine.
- Toda peça publicada deve ter: ≥1 imagem, todas as variantes com preço BRL e estoque definido.

## 8. Fonte da verdade (invariante 2)
- Medusa é dono de produto, variante, preço, estoque. Supabase **não** escreve catálogo.
- Imagens podem ser hospedadas em storage (definir provider em fase futura; por ora, URLs).

## 9. Pendências para a implementação
- [ ] Criar região Brasil/BRL e remover Europe/EUR (ajustar default region da vitrine).
- [ ] Garantir opções Tamanho (P/M/G/GG) e Cor na criação de produtos.
- [ ] Criar as 8 categorias e as coleções iniciais.
- [ ] Definir dados reais dos produtos (nomes, cores, preços, imagens) — ou seed de exemplos on-brand.

"use client"

import { conferirPagamento, gerarPix } from "@lib/data/pagamento-mercadopago"
import { pixVigente, tempoRestante } from "@lib/util/pagamento-mercadopago"
import { HttpTypes } from "@medusajs/types"
import { Button, Text } from "@modules/common/components/ui"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import ErrorMessage from "../error-message"

const INTERVALO_DA_CONSULTA_MS = 5000

/**
 * Pix do Mercado Pago (spec §6). O pedido só nasce quando o Pix é pago (decisão D1): esta tela
 * consulta a cada 5 s e, no instante em que o pagamento cai — por webhook ou pela própria
 * consulta —, a ação de servidor redireciona para a confirmação do pedido.
 */
const PixMercadoPago = ({ cart, bloqueado }: { cart: HttpTypes.StoreCart; bloqueado: boolean }) => {
  const router = useRouter()
  const [agora, setAgora] = useState(() => Date.now())
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const consultando = useRef(false)

  const pix = pixVigente(cart, agora)
  const expiraEm = pix?.expiraEm
  const jaTevePix = useRef(false)
  if (pix) jaTevePix.current = true

  // Relógio da validade — quando passa de `expiraEm`, `pixVigente` devolve null sozinho.
  useEffect(() => {
    if (!expiraEm) return
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiraEm])

  // Consulta do pagamento. `setTimeout` encadeado (não `setInterval`) para nunca empilhar
  // chamadas se o backend demorar mais que o intervalo.
  useEffect(() => {
    if (!expiraEm) return
    let ativo = true
    let id: ReturnType<typeof setTimeout>
    const consultar = async () => {
      if (!ativo || consultando.current) return
      consultando.current = true
      try {
        await conferirPagamento() // pago → redireciona e esta página deixa de existir
      } catch {
        // rede instável: tenta de novo na próxima volta
      } finally {
        consultando.current = false
        if (ativo) id = setTimeout(consultar, INTERVALO_DA_CONSULTA_MS)
      }
    }
    id = setTimeout(consultar, INTERVALO_DA_CONSULTA_MS)
    return () => {
      ativo = false
      clearTimeout(id)
    }
  }, [expiraEm])

  const gerar = async () => {
    setGerando(true)
    setErro(null)
    const { erro: falha } = await gerarPix()
    if (falha) setErro(falha)
    else router.refresh()
    setAgora(Date.now())
    setGerando(false)
  }

  const copiar = async () => {
    if (!pix) return
    try {
      await navigator.clipboard.writeText(pix.qrCode)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro("Não deu pra copiar automaticamente. Seleciona o código e copia manualmente.")
    }
  }

  if (!pix) {
    return (
      <div data-testid="pix-gerar">
        <Text className="txt-medium text-ui-fg-subtle mb-4">
          {jaTevePix.current
            ? "O código anterior expirou. Gera um novo pra continuar — ele vale por 30 minutos."
            : "Você paga pelo app do seu banco e o pedido é confirmado na hora. O código vale por 30 minutos."}
        </Text>
        <Button size="large" onClick={gerar} isLoading={gerando} disabled={bloqueado} data-testid="pix-gerar-botao">
          Gerar código Pix
        </Button>
        <ErrorMessage error={erro} data-testid="pix-erro" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-5" data-testid="pix-aguardando">
      <div className="flex flex-col small:flex-row gap-6 items-center small:items-start">
        {pix.qrCodeBase64 && (
          // eslint-disable-next-line @next/next/no-img-element -- imagem em data URI, não passa pelo otimizador
          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR code do Pix"
            width={208}
            height={208}
            className="w-52 h-52 border border-eclat-pedra rounded-rounded bg-white p-2"
          />
        )}
        <ol className="txt-medium text-ui-fg-subtle list-decimal pl-5 flex flex-col gap-y-2">
          <li>Abra o app do seu banco e escolha pagar com Pix.</li>
          <li>Aponte a câmera para o QR code ou cole o código abaixo.</li>
          <li>Confirme o pagamento. Seu pedido é criado automaticamente.</li>
        </ol>
      </div>

      <div>
        <Text className="txt-medium-plus text-ui-fg-base mb-1">Pix copia e cola</Text>
        <div className="flex gap-2">
          <input
            readOnly
            value={pix.qrCode}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Código Pix copia e cola"
            className="flex-1 min-w-0 h-10 px-3 border border-eclat-pedra rounded-md bg-eclat-luz text-sm text-eclat-grafite truncate"
            data-testid="pix-codigo"
          />
          <Button variant="secondary" onClick={copiar} data-testid="pix-copiar">
            {copiado ? "Copiado" : "Copiar código"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-eclat-blush-claro rounded-rounded px-4 py-3" role="status" aria-live="polite">
        <Text className="txt-medium text-eclat-grafite">
          Aguardando o pagamento. Assim que o Pix cair, seu pedido é confirmado nesta página.
        </Text>
        <Text className="txt-medium-plus text-eclat-terracota tabular-nums whitespace-nowrap" data-testid="pix-validade">
          {tempoRestante(pix.expiraEm, agora)}
        </Text>
      </div>
      <ErrorMessage error={erro} data-testid="pix-erro" />
    </div>
  )
}

export default PixMercadoPago

"use client"

import { notFound } from "next/navigation"
import Sidebar from "@/components/sidebar"
import {
  Aviso,
  Cartao,
  Carregando,
  LinhaVazia,
  Metrica,
  Rotulo,
  Secao,
  Selo,
  Tabela,
  Td,
  Th,
  Tr,
  TituloPagina,
  Vazio,
  botaoCls,
  botaoSecundarioCls,
  campoCls,
  selectCls,
} from "@/components/ui"

// Mostruário das peças de leitura do painel. Serve para conferir contraste, escala e densidade
// sem precisar de dados reais nem de login — e para a próxima pessoa ver o vocabulário inteiro
// numa tela só, em vez de caçar exemplos dentro das 17 páginas.
//
// Nunca vai ao ar: em produção a rota não existe.
//
// Cliente porque a linha de tabela clicável precisa de `onClick` — o mesmo motivo pelo qual
// as telas do painel que usam `Tr` já são componentes de cliente.
export default function EstiloPage() {
  if (process.env.NODE_ENV === "production") notFound()

  // Mesma moldura do painel (menu + área de conteúdo), para conferir o conjunto e não só as
  // peças soltas.
  return (
    <div className="lg:flex min-h-screen">
      <Sidebar email="voce@useeclat.com.br" />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 max-w-7xl flex flex-col gap-10">
      <TituloPagina
        titulo="Peças do Cockpit"
        descricao="Mostruário de desenvolvimento — não existe em produção."
        acoes={
          <>
            <button className={botaoSecundarioCls}>Ação secundária</button>
            <button className={botaoCls}>Ação principal</button>
          </>
        }
      />

      <Secao titulo="Números de fila">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Metrica rotulo="Pedidos a enviar" valor={3} detalhe="despachar" atencao href="/estilo" />
          <Metrica rotulo="Conversas pendentes" valor={0} detalhe="responder" href="/estilo" />
          <Metrica rotulo="Reativação" valor={12} detalhe="recorrentes inativos +60d" />
        </div>
      </Secao>

      <Secao titulo="Tabela">
        <Tabela>
          <thead>
            <tr>
              <Th>Pedido</Th>
              <Th>Cliente</Th>
              <Th>Data</Th>
              <Th>Pagamento</Th>
              <Th>Envio</Th>
              <Th alinhamento="direita">Total</Th>
            </tr>
          </thead>
          <tbody>
            <Tr onClick={() => {}} rotuloDoClique="Abrir pedido 21">
              <Td className="font-medium">#21</Td>
              <Td tom="apoio">daniwwlopes@gmail.com</Td>
              <Td tom="meta">20/09 19:07</Td>
              <Td>
                <Selo tom="ok">Pago</Selo>
              </Td>
              <Td>
                <Selo tom="atencao">A enviar</Selo>
              </Td>
              <Td alinhamento="direita" className="font-medium">
                R$ 313,90
              </Td>
            </Tr>
            <Tr onClick={() => {}} rotuloDoClique="Abrir pedido 10">
              <Td className="font-medium">#10</Td>
              <Td tom="apoio">cliente@exemplo.com</Td>
              <Td tom="meta">19/09 14:22</Td>
              <Td>
                <Selo tom="erro">Estornado</Selo>
              </Td>
              <Td>
                <Selo tom="andamento">Enviado</Selo>
              </Td>
              <Td alinhamento="direita" className="font-medium">
                R$ 49,80
              </Td>
            </Tr>
            <LinhaVazia colunas={6}>Nenhum pedido no filtro.</LinhaVazia>
          </tbody>
        </Tabela>
      </Secao>

      <Secao titulo="Superfícies e sinais">
        <div className="grid md:grid-cols-2 gap-3">
          <Cartao>
            <Rotulo>Cartão normal</Rotulo>
            <p className="text-corpo mt-2">
              Texto principal em 15px. <span className="text-eclat-texto-2">Apoio em texto-2.</span>{" "}
              <span className="text-eclat-texto-3">Rótulo em texto-3.</span>
            </p>
          </Cartao>
          <Cartao tom="atencao">
            <Rotulo>Cartão de atenção</Rotulo>
            <p className="text-corpo mt-2">Só quando existe algo esperando por você.</p>
          </Cartao>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Selo>Neutro</Selo>
          <Selo tom="ok">Pago</Selo>
          <Selo tom="atencao">A enviar</Selo>
          <Selo tom="erro">Recusado</Selo>
          <Selo tom="andamento">Enviado</Selo>
        </div>
        <Aviso>Falha ao carregar os pedidos. Tente de novo.</Aviso>
        <Aviso tom="atencao">A conferência ainda não fechou.</Aviso>
        <Carregando />
        <Vazio>Nenhuma peça cadastrada ainda.</Vazio>
      </Secao>

      <Secao titulo="Controles">
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${campoCls} w-56`} placeholder="Buscar nº ou e-mail…" />
          <select className={selectCls} defaultValue="">
            <option value="">Pagamento: todos</option>
            <option value="captured">Pago</option>
          </select>
          <button className={botaoSecundarioCls}>Limpar</button>
          <button className={botaoCls}>Despachar</button>
        </div>
      </Secao>
      </main>
    </div>
  )
}

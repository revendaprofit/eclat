"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { rotuloStatus, corDoStatus, type StatusDocumento } from "@/lib/fiscal"

// Cockpit — aba Fiscal (Projeto A, Task 13). Três blocos: Configuração (emitente + interruptor
// de emissão), Perfis tributários (CSOSN/CFOPs por escopo) e Fila de exceções (documentos que
// exigem ação do operador). Fala com o backend só via /api/fiscal/* (proxy para /admin/fiscal/*
// — Invariante 2).

type Ambiente = "homologacao" | "producao"

type Config = {
  id: number
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  ie: string
  im: string | null
  crt: number
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  municipio_ibge: string
  uf: string
  cep: string
  serie_nfe: number
  ambiente: Ambiente
  emissao_ativa: boolean
}

type Perfil = {
  id: string
  escopo: "padrao" | "categoria" | "produto"
  alvo_id: string | null
  csosn: string
  cfop_dentro_uf: string
  cfop_fora_uf: string
  cfop_devolucao_dentro_uf: string
  cfop_devolucao_fora_uf: string
  origem_padrao: number
  ativo: boolean
}

type Documento = {
  id: string
  medusa_order_id: string
  tipo: "venda" | "devolucao"
  status: StatusDocumento
  ambiente: Ambiente
  chave_acesso: string | null
  rejeicao_codigo: string | null
  rejeicao_motivo: string | null
  verificado_em: string | null
}

const card = "border border-eclat-pedra/40 rounded-lg p-5 bg-eclat-luz flex flex-col gap-3"
const input = "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const hint = "text-xs text-eclat-grafite/55 leading-relaxed"
const btn = "bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
const btn2 = "border border-eclat-grafite/30 text-eclat-grafite uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:border-eclat-dourado disabled:opacity-50"

const CORES_STATUS: Record<"verde" | "amarelo" | "vermelho", string> = {
  verde: "bg-emerald-100 text-emerald-900",
  amarelo: "bg-amber-100 text-amber-900",
  vermelho: "bg-red-100 text-red-900",
}

const PERFIL_VAZIO: Omit<Perfil, "id"> = {
  escopo: "padrao",
  alvo_id: null,
  csosn: "",
  cfop_dentro_uf: "",
  cfop_fora_uf: "",
  cfop_devolucao_dentro_uf: "",
  cfop_devolucao_fora_uf: "",
  origem_padrao: 0,
  ativo: true,
}

export default function FiscalPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [credenciaisOk, setCredenciaisOk] = useState(false)
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgResp, perfisResp, docsResp] = await Promise.all([
        fetch("/api/fiscal/config", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/fiscal/perfis", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/fiscal/documentos", { cache: "no-store" }).then((r) => r.json()),
      ])
      setConfig(cfgResp?.config ?? null)
      setCredenciaisOk(Boolean(cfgResp?.credenciais_ok))
      setPerfis(Array.isArray(perfisResp?.perfis) ? perfisResp.perfis : [])
      setDocumentos(Array.isArray(docsResp?.documentos) ? docsResp.documentos : [])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  // Chama o proxy do cockpit; devolve o corpo já em JSON e propaga a mensagem de erro do
  // backend (422 de negócio, 400 malformado) em vez de um "algo deu errado" genérico.
  async function api(path: string, method: string, body?: unknown) {
    setBusy(true); setAviso(null)
    try {
      const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `Erro ${r.status}`)
      await carregar()
      return d
    } catch (e) {
      setAviso((e as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const perfilPadraoAtivo = useMemo(
    () => perfis.some((p) => p.escopo === "padrao" && p.ativo),
    [perfis]
  )

  if (loading && !config) return <p className="text-sm text-eclat-grafite/50">Carregando…</p>
  if (!config) return <p className="text-sm text-red-800">Não foi possível carregar a configuração fiscal.</p>

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">Fiscal</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">
          Emissão de NF-e via Brasil NFe. Config do emitente, perfis tributários que decidem CSOSN/CFOP
          por venda ou devolução, e a fila de documentos que precisam da sua atenção.
        </p>
      </div>

      {aviso && <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-4 py-2">{aviso}</div>}

      <ConfiguracaoBlock config={config} credenciaisOk={credenciaisOk} busy={busy} salvar={(p) => api("/api/fiscal/config", "PATCH", p)} />

      <PerfisBlock perfis={perfis} config={config} busy={busy} perfilPadraoAtivo={perfilPadraoAtivo} salvar={(p) => api("/api/fiscal/perfis", "POST", p)} />

      <FilaBlock
        documentos={documentos}
        busy={busy}
        reconciliar={(id) => api("/api/fiscal/reconciliar", "POST", { documento_id: id })}
        resolver={(documento_id, acao, extra) => api("/api/fiscal/resolver", "POST", { documento_id, acao, ...extra })}
      />
    </div>
  )
}

function ConfiguracaoBlock({
  config, credenciaisOk, busy, salvar,
}: {
  config: Config
  credenciaisOk: boolean
  busy: boolean
  salvar: (patch: Partial<Config>) => Promise<unknown>
}) {
  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-eclat-grafite">Emissão {config.emissao_ativa ? "LIGADA" : "DESLIGADA"}</p>
          <p className={hint}>Interruptor-mestre. Desligado, o sistema nunca transmite nota — só monta prévia.</p>
        </div>
        <button disabled={busy} onClick={() => salvar({ emissao_ativa: !config.emissao_ativa })} className={config.emissao_ativa ? btn2 : btn}>
          {config.emissao_ativa ? "Desligar" : "Ligar"}
        </button>
      </div>

      <div className="grid grid-cols-2 small:grid-cols-4 gap-3 text-sm">
        <Stat rotulo="Credenciais Brasil NFe" valor={credenciaisOk ? "configuradas" : "⚠ faltando"} alerta={!credenciaisOk} />
        <Stat rotulo="Ambiente" valor={config.ambiente === "producao" ? "produção" : "homologação"} alerta={config.ambiente === "producao"} />
        <Stat rotulo="Série NF-e" valor={String(config.serie_nfe)} />
        <Stat rotulo="CNPJ" valor={config.cnpj} />
      </div>
      <p className={hint}>
        Credenciais nunca aparecem aqui — só o indicador de configuradas ou não. O token da Brasil NFe fica
        só no backend.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Ambiente</label>
          <select className={input} value={config.ambiente} onChange={(e) => salvar({ ambiente: e.target.value as Ambiente })}>
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </div>
        <div><label className={label}>Série NF-e</label><input type="number" min={1} className={input} defaultValue={config.serie_nfe} onBlur={(e) => salvar({ serie_nfe: Number(e.target.value) })} /></div>
        <div><label className={label}>Razão social</label><input className={input} defaultValue={config.razao_social} onBlur={(e) => salvar({ razao_social: e.target.value })} /></div>
        <div><label className={label}>Nome fantasia</label><input className={input} defaultValue={config.nome_fantasia || ""} onBlur={(e) => salvar({ nome_fantasia: e.target.value })} /></div>
        <div><label className={label}>IE</label><input className={input} defaultValue={config.ie} onBlur={(e) => salvar({ ie: e.target.value })} /></div>
        <div><label className={label}>IM</label><input className={input} defaultValue={config.im || ""} onBlur={(e) => salvar({ im: e.target.value })} /></div>
        <div className="col-span-2"><label className={label}>Logradouro</label><input className={input} defaultValue={config.logradouro} onBlur={(e) => salvar({ logradouro: e.target.value })} /></div>
        <div><label className={label}>Número</label><input className={input} defaultValue={config.numero} onBlur={(e) => salvar({ numero: e.target.value })} /></div>
        <div><label className={label}>Complemento</label><input className={input} defaultValue={config.complemento || ""} onBlur={(e) => salvar({ complemento: e.target.value })} /></div>
        <div><label className={label}>Bairro</label><input className={input} defaultValue={config.bairro} onBlur={(e) => salvar({ bairro: e.target.value })} /></div>
        <div><label className={label}>Município</label><input className={input} defaultValue={config.municipio} onBlur={(e) => salvar({ municipio: e.target.value })} /></div>
        <div><label className={label}>Município (IBGE)</label><input className={input} defaultValue={config.municipio_ibge} onBlur={(e) => salvar({ municipio_ibge: e.target.value })} /></div>
        <div><label className={label}>UF</label><input className={input} maxLength={2} defaultValue={config.uf} onBlur={(e) => salvar({ uf: e.target.value.toUpperCase() })} /></div>
        <div><label className={label}>CEP</label><input className={input} defaultValue={config.cep} onBlur={(e) => salvar({ cep: e.target.value })} /></div>
      </div>
    </section>
  )
}

function PerfisBlock({
  perfis, config, busy, perfilPadraoAtivo, salvar,
}: {
  perfis: Perfil[]
  config: Config
  busy: boolean
  perfilPadraoAtivo: boolean
  salvar: (p: Record<string, unknown>) => Promise<unknown>
}) {
  const [form, setForm] = useState<Omit<Perfil, "id">>(PERFIL_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  function editar(p: Perfil) {
    setEditandoId(p.id)
    setForm({ ...p })
  }
  function novo() {
    setEditandoId(null)
    setForm(PERFIL_VAZIO)
  }

  return (
    <section className={card}>
      <p className="font-semibold text-eclat-grafite">Perfis tributários</p>
      <p className={hint}>
        Cada perfil decide o CSOSN e os quatro CFOPs (venda e devolução, dentro e fora de {config.uf || "UF"}) usados
        na nota. O escopo &quot;padrão&quot; vale quando produto e categoria não têm perfil próprio.
      </p>

      {!perfilPadraoAtivo && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          Falta um perfil tributário <strong>padrão</strong> ativo. Sem ele, o sistema recusa emitir qualquer nota
          que não tenha um perfil específico de produto ou categoria — cadastre um abaixo antes de emitir.
        </div>
      )}

      {perfis.length === 0 ? (
        <p className={hint}>Nenhum perfil cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-eclat-grafite/60">
                <th className="pr-3">Escopo</th><th className="pr-3">Alvo</th><th className="pr-3">CSOSN</th>
                <th className="pr-3">Ativo</th><th className="pr-3" />
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.id}>
                  <td className="pr-3">{p.escopo}</td>
                  <td className="pr-3">{p.alvo_id || "—"}</td>
                  <td className="pr-3">{p.csosn}</td>
                  <td className="pr-3">{p.ativo ? "sim" : "não"}</td>
                  <td className="pr-3"><button className={btn2} onClick={() => editar(p)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-eclat-pedra/30 pt-3 flex flex-col gap-3">
        <p className="font-semibold text-eclat-grafite text-sm">{editandoId ? "Editar perfil" : "Novo perfil"}</p>
        <div className="grid grid-cols-2 small:grid-cols-4 gap-3">
          <div>
            <label className={label}>Escopo</label>
            <select disabled={!!editandoId} className={input} value={form.escopo} onChange={(e) => setForm({ ...form, escopo: e.target.value as Perfil["escopo"], alvo_id: e.target.value === "padrao" ? null : form.alvo_id })}>
              <option value="padrao">Padrão</option>
              <option value="categoria">Categoria</option>
              <option value="produto">Produto</option>
            </select>
            {/* Escopo e Alvo travados na edição: a edição manda "id" (allowlist do backend inclui "id",
                achado crítico C4) e o PostgREST resolve o merge-duplicates pela CHAVE PRIMÁRIA — não
                por escopo+alvo_id, que ele não tem como usar num ON CONFLICT sem a cláusula WHERE dos
                índices parciais. Mudar escopo/alvo aqui editaria o mesmo registro sob uma chave de
                negócio diferente da que ele tinha; mais seguro cadastrar um perfil novo. */}
            {editandoId && <p className={hint}>Travado na edição — para mudar o escopo, cadastre um perfil novo.</p>}
          </div>
          {form.escopo !== "padrao" && (
            <div className="col-span-2">
              <label className={label}>ID {form.escopo === "categoria" ? "da categoria" : "do produto"}</label>
              <input disabled={!!editandoId} className={input} value={form.alvo_id || ""} onChange={(e) => setForm({ ...form, alvo_id: e.target.value })} />
            </div>
          )}
          <div><label className={label}>CSOSN</label><input className={input} value={form.csosn} onChange={(e) => setForm({ ...form, csosn: e.target.value })} /></div>
          <div><label className={label}>CFOP venda dentro de {config.uf || "UF"}</label><input className={input} value={form.cfop_dentro_uf} onChange={(e) => setForm({ ...form, cfop_dentro_uf: e.target.value })} /></div>
          <div><label className={label}>CFOP venda fora de {config.uf || "UF"}</label><input className={input} value={form.cfop_fora_uf} onChange={(e) => setForm({ ...form, cfop_fora_uf: e.target.value })} /></div>
          <div><label className={label}>CFOP devolução dentro de {config.uf || "UF"}</label><input className={input} value={form.cfop_devolucao_dentro_uf} onChange={(e) => setForm({ ...form, cfop_devolucao_dentro_uf: e.target.value })} /></div>
          <div><label className={label}>CFOP devolução fora de {config.uf || "UF"}</label><input className={input} value={form.cfop_devolucao_fora_uf} onChange={(e) => setForm({ ...form, cfop_devolucao_fora_uf: e.target.value })} /></div>
          <div><label className={label}>Origem padrão</label><input type="number" min={0} className={input} value={form.origem_padrao} onChange={(e) => setForm({ ...form, origem_padrao: Number(e.target.value) })} /></div>
          <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> ativo</label></div>
        </div>
        <div className="flex gap-2">
          <button disabled={busy || !form.csosn} className={btn} onClick={async () => { await salvar({ ...(editandoId ? { id: editandoId } : {}), ...form }); novo() }}>
            {editandoId ? "Salvar perfil" : "Cadastrar perfil"}
          </button>
          {editandoId && <button className={btn2} onClick={novo}>Cancelar edição</button>}
        </div>
      </div>
    </section>
  )
}

function FilaBlock({
  documentos, busy, reconciliar, resolver,
}: {
  documentos: Documento[]
  busy: boolean
  reconciliar: (id: string) => Promise<{ verificado?: boolean; divergencias?: string[] } | null>
  // F3 entregue pela metade (achado I5/5.4): a rota /admin/fiscal/resolver existia mas nenhuma
  // tela chamava. Cobre o documento preso em transmitido_sem_confirmacao sem chave (anexar a
  // chave que o operador confirmou no painel da Brasil NFe, ou marcar como não transmitida) e a
  // chave anexada errada em autorizado_nao_verificado (limpar pra tentar de novo).
  resolver: (
    documentoId: string,
    acao: "anexar_chave" | "marcar_rejeitado" | "limpar_chave",
    extra?: { chave_acesso?: string; motivo?: string }
  ) => Promise<{ documento?: Documento } | null>
}) {
  const [resultado, setResultado] = useState<Record<string, { verificado?: boolean; divergencias?: string[] }>>({})
  const [chaves, setChaves] = useState<Record<string, string>>({})

  return (
    <section className={card}>
      <p className="font-semibold text-eclat-grafite">Fila de exceções</p>
      <p className={hint}>
        Documentos rejeitados, denegados, em contingência ou ainda sem confirmação da SEFAZ. Reconciliar busca o XML
        autorizado e grava o número do item real de cada linha — só depois disso o documento libera devolução.
      </p>

      {documentos.length === 0 && <p className={hint}>Nenhum documento pendente de ação.</p>}

      {documentos.map((d) => {
        const semChaveTransmitida = d.status === "transmitido_sem_confirmacao" && !d.chave_acesso
        const autorizadoSemVerificar = d.status === "autorizado_nao_verificado" && !d.verificado_em
        return (
          <div key={d.id} className="border border-eclat-pedra/30 rounded-md p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className={`px-2 py-0.5 rounded ${CORES_STATUS[corDoStatus(d.status)]}`}>{rotuloStatus(d.status)}</span>
              <span className="text-eclat-grafite/60">{d.tipo === "venda" ? "Venda" : "Devolução"} · pedido {d.medusa_order_id} · {d.ambiente === "producao" ? "produção" : "homologação"}</span>
            </div>
            {d.rejeicao_motivo && (
              <p className="text-sm text-red-800">
                {d.rejeicao_codigo ? `[${d.rejeicao_codigo}] ` : ""}{d.rejeicao_motivo}
              </p>
            )}
            <div className="flex gap-2 items-center">
              <button disabled={busy} className={btn2} onClick={async () => { const res = await reconciliar(d.id); setResultado((r) => ({ ...r, [d.id]: res || {} })) }}>
                Reconciliar
              </button>
            </div>
            {resultado[d.id] && (
              <div className="text-sm bg-white border border-eclat-pedra/40 rounded-md p-2">
                <p>{resultado[d.id].verificado ? "Verificado com sucesso." : "Não verificado — veja divergências abaixo."}</p>
                {(resultado[d.id].divergencias || []).map((div, i) => <p key={i} className="text-amber-800">{div}</p>)}
              </div>
            )}

            {semChaveTransmitida && (
              <div className="border-t border-eclat-pedra/30 pt-2 flex flex-col gap-2">
                <p className={hint}>
                  Transmitiu e a rede caiu antes da resposta. Consulte o painel da Brasil NFe: se a nota saiu, cole a
                  chave de 44 dígitos abaixo; se não saiu, marque como não transmitida para liberar o pedido.
                </p>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    className={input + " max-w-xs"}
                    placeholder="Chave de acesso (44 dígitos)"
                    maxLength={44}
                    value={chaves[d.id] || ""}
                    onChange={(e) => setChaves((c) => ({ ...c, [d.id]: e.target.value.replace(/\D/g, "") }))}
                  />
                  <button
                    disabled={busy || (chaves[d.id] || "").length !== 44}
                    className={btn2}
                    onClick={() => resolver(d.id, "anexar_chave", { chave_acesso: chaves[d.id] })}
                  >
                    Anexar chave
                  </button>
                  <button
                    disabled={busy}
                    className={btn2}
                    onClick={() => resolver(d.id, "marcar_rejeitado")}
                  >
                    Marcar como não transmitida
                  </button>
                </div>
              </div>
            )}

            {autorizadoSemVerificar && (
              <div className="border-t border-eclat-pedra/30 pt-2 flex flex-col gap-2">
                <p className={hint}>
                  Chave anexada errada e a reconciliação ainda não confirmou — limpe para poder anexar a chave certa.
                </p>
                <button disabled={busy} className={btn2} onClick={() => resolver(d.id, "limpar_chave")}>
                  Limpar chave
                </button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

function Stat({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 ${alerta ? "bg-amber-50 border border-amber-200" : "bg-white border border-eclat-pedra/40"}`}>
      <div className="text-[11px] uppercase tracking-wider text-eclat-grafite/60">{rotulo}</div>
      <div className="text-lg font-semibold text-eclat-grafite">{valor}</div>
    </div>
  )
}

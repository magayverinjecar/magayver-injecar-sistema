import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, User, Clock, Wrench, AlertTriangle, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

// ─── Definição das colunas (etapas do pátio) ────────────────────────────────
// Ordem = fluxo real: entrada → diagnóstico → aprovação → reparo → pronto.
// Cada coluna aceita fichas (ckStatus) e/ou ordens (osStatus), pois o mesmo
// estágio pode estar numa ficha (antes da OS) ou numa OS (depois).
// Status de OS 'Entregue', 'Rejeitada' e 'Cancelada' ficam fora do quadro.
const COLUNAS = [
  { id: 'aguard_diag',  titulo: 'Aguardando diagnóstico', cor: '#854F0B', ckStatus: 'Aguardando diagnóstico', osStatus: [] },
  { id: 'em_diag',      titulo: 'Em diagnóstico',         cor: '#185FA5', ckStatus: 'Em diagnóstico',         osStatus: ['Diagnóstico'] },
  { id: 'orcamento',    titulo: 'Orçamento',              cor: '#534AB7', ckStatus: 'Diagnóstico concluído',  osStatus: ['Aguardando Aprovação'] },
  { id: 'aguard_peca',  titulo: 'Aguardando peça',        cor: '#A32D2D', ckStatus: null,                     osStatus: ['Aguardando Peça'] },
  { id: 'em_execucao',  titulo: 'Em execução',            cor: '#993C1D', ckStatus: null,                     osStatus: ['Aberta', 'Aprovada', 'Em Execução', 'Em Andamento'] },
  { id: 'pronto',       titulo: 'Pronto p/ retirada',     cor: '#3B6D11', ckStatus: null,                     osStatus: ['Concluída'] },
]

// Status canônico da OS ao soltar em cada coluna (para arrastar ordens entre etapas)
const OS_STATUS_DESTINO = {
  em_diag: 'Diagnóstico', orcamento: 'Aguardando Aprovação',
  aguard_peca: 'Aguardando Peça', em_execucao: 'Em Execução', pronto: 'Concluída',
}

// Limites de tempo parado (em horas) — amarelo a partir de warn, vermelho a partir de danger.
// Configurável no futuro; padrões conservadores por enquanto.
const LIMITES = { warn: 24, danger: 72 }

// Converte datas pt-BR ('dd/mm/aaaa' ou 'dd/mm/aaaa hh:mm') para timestamp
function parseBR(s) {
  if (!s) return null
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
}

function idadeInfo(ts) {
  if (!ts) return { label: '—', cor: 'text-slate-400', bg: 'bg-slate-100' }
  const h = (Date.now() - ts) / 3600000
  const label = h < 1 ? '<1h' : h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)} dia(s)`
  if (h >= LIMITES.danger) return { label, cor: 'text-red-700', bg: 'bg-red-100' }
  if (h >= LIMITES.warn)   return { label, cor: 'text-amber-700', bg: 'bg-amber-100' }
  return { label, cor: 'text-green-700', bg: 'bg-green-50' }
}

const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PatioQuadro() {
  const navigate = useNavigate()
  const {
    checklists, setChecklists, ordens, novaOrdem, mudarStatusOrdem, reabrirOrdem,
    totalOrdem, getCliente, getVeiculo, getFuncionario, carregando,
  } = useApp()
  const { currentUser } = useAuth()
  // Só mostra valores para quem tem a permissão "Ver preços e valores"
  const podeVerValores = !!currentUser?.permissoes?.verPrecos

  const [arrastando, setArrastando] = useState(null) // card sendo arrastado
  const [sobre, setSobre] = useState(null)           // coluna com hover de drop
  const [confirmar, setConfirmar] = useState(null)   // { card, coluna, tipo, texto }

  // ── Monta os cards de cada coluna a partir dos dados existentes ──
  function cardDoChecklist(ck) {
    const ts = parseBR(ck.criadoEm) || (Number.isFinite(Number(ck.id)) ? Number(ck.id) : null)
    const tsEtapa = ck.etapaEm || ts
    return {
      key: `ck-${ck.id}`, kind: 'checklist', id: ck.id,
      titulo: ck.veiculoModelo || '—', placa: ck.veiculoPlaca || '',
      cliente: ck.clienteNome || '—', mecanico: ck.tecnicoNome || '',
      valor: null, aReceber: false, ts: tsEtapa,
    }
  }

  function cardDaOrdem(os) {
    const veic = getVeiculo(os.veiculoId)
    const cli = getCliente(os.clienteId)
    const mec = os.mecanicoId ? getFuncionario(os.mecanicoId) : null
    const ts = os.etapaEm || parseBR(os.dataEntrada) || parseBR(os.data)
    return {
      key: `os-${os.id}`, kind: 'os', id: os.id,
      titulo: veic?.modelo || os.veiculoInfo || os.veiculoModelo || '—',
      placa: veic?.placa || os.veiculoPlaca || '',
      cliente: cli?.nome || os.clienteNome || '—',
      mecanico: mec?.nome || '',
      valor: totalOrdem(os), aReceber: os.status === 'Concluída' && !os.pago, ts,
    }
  }

  const veiculosComOS = new Set(ordens.map(o => o.veiculoId).filter(Boolean))

  function cardsDaColuna(col) {
    const lista = []
    // Fichas (só as que ainda não viraram OS) na etapa da coluna
    if (col.ckStatus) {
      for (const c of checklists) {
        if (!c.osId && c.status === col.ckStatus) {
          if (c.veiculoId && veiculosComOS.has(c.veiculoId)) continue
          lista.push(cardDoChecklist(c))
        }
      }
    }
    // Ordens de serviço cujo status pertence a esta etapa
    if (col.osStatus.length) {
      for (const o of ordens) {
        if (col.osStatus.includes(o.status) && !(o.status === 'Concluída' && o.pago)) {
          lista.push(cardDaOrdem(o))
        }
      }
    }
    return lista.sort((a, b) => (a.ts || 0) - (b.ts || 0)) // parado há mais tempo no topo
  }

  // Descobre em qual coluna um card está atualmente
  function colId(card) {
    if (card.kind === 'checklist') {
      const ck = checklists.find(c => c.id === card.id)
      return COLUNAS.find(col => col.ckStatus && col.ckStatus === ck?.status)?.id
    }
    const os = ordens.find(o => o.id === card.id)
    return COLUNAS.find(col => col.osStatus.includes(os?.status))?.id
  }

  // ── Ação ao soltar um card numa coluna ──
  function soltarNaColuna(destinoId, card) {
    setArrastando(null); setSobre(null)
    if (!card) return
    const origemId = colId(card)
    if (!origemId || origemId === destinoId) return

    const destino = COLUNAS.find(c => c.id === destinoId)

    if (card.kind === 'checklist') {
      // Entre etapas de ficha (coluna com ckStatus): só troca de status — seguro
      if (destino.ckStatus) {
        setChecklists(prev => prev.map(c => c.id === card.id
          ? { ...c, status: destino.ckStatus, etapaEm: Date.now() } : c))
        return
      }
      // Ficha → Em execução: precisa CRIAR OS (ação pesada) — confirma
      if (destinoId === 'em_execucao') {
        setConfirmar({ card, destinoId, tipo: 'criarOS',
          texto: `Gerar Ordem de Serviço para ${card.titulo}${card.placa ? ' (' + card.placa + ')' : ''} e mover para "Em execução"?` })
      }
      return // ficha → outras colunas de OS (pular o reparo) não é permitido
    }

    // card é uma OS
    const novoStatus = OS_STATUS_DESTINO[destinoId]
    if (!novoStatus) return // ex.: mover OS para "Aguardando diagnóstico" não é permitido

    // Concluir (lança receita no financeiro) — confirma
    if (destinoId === 'pronto') {
      setConfirmar({ card, destinoId, tipo: 'concluir',
        texto: `Concluir a OS ${card.id}? A receita será lançada no Financeiro.` })
      return
    }
    // Reabrir (voltar de Pronto — estorna a receita lançada) — confirma
    if (origemId === 'pronto') {
      setConfirmar({ card, destinoId, tipo: 'reabrir',
        texto: `Reabrir a OS ${card.id}? A receita lançada será estornada.` })
      return
    }
    // Demais mudanças de status da OS (Diagnóstico, Aguardando Aprovação, Em Execução) — direto
    mudarStatusOrdem(card.id, novoStatus)
  }

  function executarConfirmado() {
    const c = confirmar
    setConfirmar(null)
    if (!c) return
    if (c.tipo === 'criarOS') {
      const ck = checklists.find(x => x.id === c.card.id)
      if (!ck) return
      const osId = novaOrdem({
        clienteId: ck.clienteId,
        veiculoId: ck.veiculoId,
        kmEntrada: ck.kmEntrada,
        descricaoProblema: ck.relatoCliente || '',
        diagnostico: ck.observacoesTecnicas || '',
        status: 'Em Execução',
      })
      setChecklists(prev => prev.map(x => x.id === ck.id ? { ...x, osId } : x))
    } else if (c.tipo === 'concluir') {
      mudarStatusOrdem(c.card.id, 'Concluída')
    } else if (c.tipo === 'reabrir') {
      reabrirOrdem(c.card.id)
    }
  }

  function abrirCard(card) {
    // O id da OS começa com '#'; encodeURIComponent evita que vire âncora na URL
    if (card.kind === 'checklist') navigate(`/checklist/${card.id}`)
    else navigate(`/ordens-servico/${encodeURIComponent(card.id)}`)
  }

  // ── Arraste por pointer events: funciona igual no mouse E no toque ──
  // Um movimento curto = toque/clique (abre o card); mover além do limiar = arrastar.
  function iniciarArraste(e, card) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const sx = e.clientX, sy = e.clientY
    const origem = e.currentTarget
    let arrastou = false
    let clone = null

    const colunaSob = (x, y) => document.elementFromPoint(x, y)?.closest('[data-coluna]')?.getAttribute('data-coluna') || null

    const mover = (ev) => {
      if (!arrastou) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return
        arrastou = true
        setArrastando(card)
        clone = origem.cloneNode(true)
        Object.assign(clone.style, {
          position: 'fixed', margin: '0', left: '0', top: '0',
          width: origem.offsetWidth + 'px', pointerEvents: 'none',
          opacity: '0.95', zIndex: '9999', transform: 'rotate(2deg)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.28)',
        })
        document.body.appendChild(clone)
        origem.style.opacity = '0.35'
      }
      clone.style.left = (ev.clientX - origem.offsetWidth / 2) + 'px'
      clone.style.top = (ev.clientY - 22) + 'px'
      setSobre(colunaSob(ev.clientX, ev.clientY))
    }

    const soltar = (ev) => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      if (clone) clone.remove()
      origem.style.opacity = ''
      if (arrastou) {
        const destino = colunaSob(ev.clientX, ev.clientY)
        if (destino) soltarNaColuna(destino, card)
        else { setArrastando(null); setSobre(null) }
      } else {
        abrirCard(card) // foi um toque simples, sem arrastar
      }
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }

  const totalCarros = COLUNAS.reduce((s, col) => s + cardsDaColuna(col).length, 0)

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando o pátio...</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quadro do Pátio</h2>
          <p className="text-sm text-slate-500">{totalCarros} veículo(s) no pátio · arraste os cards entre as etapas</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> no prazo</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> atenção</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> parado demais</span>
        </div>
      </div>

      {/* Quadro */}
      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3" style={{ minWidth: '1140px' }}>
          {COLUNAS.map(col => {
            const cards = cardsDaColuna(col)
            const ativa = sobre === col.id
            return (
              <div key={col.id}
                data-coluna={col.id}
                className="flex-1 min-w-[184px] flex flex-col">
                {/* Cabeçalho colorido da etapa */}
                <div style={{ backgroundColor: col.cor }}
                  className="flex items-center justify-between rounded-t-xl px-3 py-2 text-white">
                  <span className="text-xs font-bold uppercase tracking-wide truncate">{col.titulo}</span>
                  <span className="text-xs font-bold bg-white/25 rounded-full px-2 py-0.5 flex-shrink-0">{cards.length}</span>
                </div>

                <div style={{ maxHeight: 'calc(100vh - 220px)' }}
                  className={`flex-1 overflow-y-auto rounded-b-xl p-2 space-y-2 min-h-[80px] transition-colors ${ativa ? 'bg-primary-50 ring-2 ring-inset ring-primary-200' : 'bg-slate-100'}`}>
                  {cards.map(card => {
                    const idade = idadeInfo(card.ts)
                    return (
                      <div key={card.key}
                        onPointerDown={e => iniciarArraste(e, card)}
                        style={{ touchAction: 'pan-y' }}
                        className="bg-white border border-slate-200 rounded-xl p-3 cursor-grab select-none hover:border-slate-300 hover:shadow-sm transition-all active:cursor-grabbing">
                        <p className="text-sm font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                          <Car size={13} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{card.titulo}</span>
                          {card.placa && (
                            <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">{card.placa}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                          <User size={11} className="flex-shrink-0" /> {card.cliente}
                        </p>
                        {card.mecanico && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded">
                            <Wrench size={10} /> {card.mecanico}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${idade.bg} ${idade.cor}`}>
                            <Clock size={10} /> {idade.label}
                          </span>
                          {card.aReceber && (
                            <span className="text-[10px] text-blue-500 font-medium">a receber</span>
                          )}
                          {podeVerValores && card.valor != null && (
                            <span className="text-xs font-semibold text-slate-700">
                              {fmtBRL(card.valor)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {cards.length === 0 && (
                    <div className="text-center text-xs text-slate-300 py-6 border-2 border-dashed border-slate-200 rounded-xl">
                      vazio
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de confirmação para ações pesadas (criar OS, concluir, reabrir) */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 mb-1">Confirmar mudança</p>
                <p className="text-sm text-slate-500">{confirmar.texto}</p>
              </div>
              <button onClick={() => setConfirmar(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmar(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={executarConfirmado}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

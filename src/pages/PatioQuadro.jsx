import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, User, Clock, Wrench, Monitor, Minimize2, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { useAuth } from '../context/AuthContext'

const COLUNAS = [
  { id: 'recepcao',    titulo: 'Recepção',           cor: '#854F0B', osStatus: ['Recepção', 'Aguardando diagnóstico'] },
  { id: 'diagnostico', titulo: 'Diagnóstico',        cor: '#185FA5', osStatus: ['Em Diagnóstico', 'Diagnóstico', 'Em diagnóstico'] },
  { id: 'orcamento',   titulo: 'Orçamento',          cor: '#534AB7', osStatus: ['Aguardando Aprovação', 'Rejeitada', 'Diagnóstico concluído'] },
  { id: 'em_execucao', titulo: 'Em execução',        cor: '#993C1D', osStatus: ['Aprovado', 'Aguardando Peça', 'Em Execução', 'Aberta', 'Aprovada', 'Em Andamento'] },
  { id: 'conferencia', titulo: 'Conferência',        cor: '#0E7490', osStatus: ['Em Conferência'] },
  { id: 'pronto',      titulo: 'Pronto p/ retirada', cor: '#3B6D11', osStatus: ['Concluída'] },
]

// O quadro é retrato do pátio, não painel de controle: ele não muda status.
// Cada etapa é concluída na tela de quem faz o trabalho, e o card só reflete.
// Aqui fica apenas a dica do que falta acontecer em cada coluna.
const PROXIMO_PASSO = {
  'Recepção':             'Aguardando diagnóstico',
  'Em Diagnóstico':       'Diagnóstico em andamento',
  'Diagnóstico':          'Diagnóstico em andamento',
  'Aguardando Aprovação': 'Aguardando resposta do cliente',
  'Rejeitada':            'Recusado — falta fechar e entregar',
  'Aprovado':             'Aprovado — aguardando reparador',
  'Aguardando Peça':      'Aguardando peça chegar',
  'Em Execução':          'Reparo em andamento',
  'Em Conferência':       'Aguardando conferência',
  'Concluída':            'Pronto — aguardando o cliente buscar',
}

// Status em que o carro está parado esperando alguém pegar
const AGUARDANDO_ALGUEM = ['Recepção', 'Aprovado']

const LIMITES = { warn: 24, danger: 72 }

function parseBR(s) {
  if (!s) return null
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
}

function idadeInfo(ts) {
  if (!ts) return { label: '—', cor: 'text-slate-400', bg: 'bg-slate-100', nivel: 0 }
  const h = (Date.now() - ts) / 3600000
  const label = h < 1 ? '<1h' : h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)} dia(s)`
  if (h >= LIMITES.danger) return { label, cor: 'text-red-700', bg: 'bg-red-100', nivel: 2 }
  if (h >= LIMITES.warn)   return { label, cor: 'text-amber-700', bg: 'bg-amber-100', nivel: 1 }
  return { label, cor: 'text-green-700', bg: 'bg-green-50', nivel: 0 }
}

const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function AutoScrollColumn({ children, ativo }) {
  const ref = useRef(null)
  const dirRef = useRef(1)

  useEffect(() => {
    if (!ativo) return
    const el = ref.current
    if (!el) return
    const id = setInterval(() => {
      if (!el || el.scrollHeight <= el.clientHeight) return
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
      const atTop = el.scrollTop <= 0
      if (atBottom) dirRef.current = -1
      if (atTop) dirRef.current = 1
      el.scrollBy({ top: dirRef.current * 1, behavior: 'auto' })
    }, 50)
    return () => clearInterval(id)
  }, [ativo])

  return <div ref={ref} className="tv-scroll-col">{children}</div>
}

export default function PatioQuadro() {
  const navigate = useNavigate()
  const {
    ordens, veiculos, totalOrdem, getCliente, getVeiculo, getFuncionario, carregando,
    realtimeOk, ultimaSync, sincronizarOrdens,
  } = useApp()
  const { temPermissao, podeVerPrecos } = useAuth()
  const podeVerValores = podeVerPrecos
  const podeConferir = temPermissao('conferir-os')
  const podeVerOS = temPermissao('ordens-servico')

  const [modoTV, setModoTV] = useState(false)
  const hora = useClock()

  const tvContainerRef = useRef(null)

  const entrarModoTV = useCallback(() => {
    setModoTV(true)
    setTimeout(() => {
      tvContainerRef.current?.requestFullscreen?.().catch(() => {})
    }, 50)
  }, [])

  const sairModoTV = useCallback(() => {
    setModoTV(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && modoTV) setModoTV(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [modoTV])

  useEffect(() => {
    if (!modoTV) return
    const onKey = (e) => { if (e.key === 'Escape') sairModoTV() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modoTV, sairModoTV])

  // Numa TV que fica ligada o dia inteiro, o Realtime pode cair sem avisar.
  // Relemos o pátio a cada minuto: além de garantir dado fresco, a falha da
  // leitura é o que acende o alerta de "sem conexão".
  const [falhouSync, setFalhouSync] = useState(false)
  useEffect(() => {
    if (!modoTV) return
    let vivo = true
    const checar = async () => {
      const ok = await sincronizarOrdens()
      if (vivo) setFalhouSync(!ok)
    }
    checar()
    const id = setInterval(checar, 60000)
    return () => { vivo = false; clearInterval(id) }
  }, [modoTV])

  // Relógio de 30s já força re-render, então o cálculo acompanha sozinho
  const minutosDesdeSync = Math.floor((Date.now() - ultimaSync) / 60000)
  const conexaoRuim = falhouSync || !realtimeOk || minutosDesdeSync >= 3

  // Detecção de placas duplicadas — só conta o que está de fato no quadro
  const placasDuplicadas = useMemo(() => {
    const contagem = {}
    for (const o of ordens) {
      if (!COLUNAS.some(c => c.osStatus.includes(o.status))) continue
      if (!noPatio(o)) continue
      const placa = (getVeiculo(o.veiculoId)?.placa || o.veiculoPlaca || '').toUpperCase().trim()
      if (!placa) continue
      contagem[placa] = (contagem[placa] || 0) + 1
    }
    const dup = new Set()
    for (const [p, n] of Object.entries(contagem)) { if (n > 1) dup.add(p) }
    return dup
  }, [ordens, veiculos])

  function cardDaOrdem(os) {
    const veic = getVeiculo(os.veiculoId)
    const cli = getCliente(os.clienteId)
    const mec = os.mecanicoId ? getFuncionario(os.mecanicoId) : null
    const ts = os.etapaEm || parseBR(os.dataEntrada) || parseBR(os.data)
    const placa = veic?.placa || os.veiculoPlaca || ''
    return {
      key: `os-${os.id}`, id: os.id, status: os.status,
      titulo: nomeVeiculo(veic, os),
      placa,
      cliente: cli?.nome || os.clienteNome || '—',
      // Quem está com o carro agora tem prioridade sobre o mecânico fixo da OS
      mecanico: os.responsavelNome || mec?.nome || '',
      valor: totalOrdem(os), aReceber: os.status === 'Concluída' && !os.pago,
      aguardandoPeca: os.status === 'Aguardando Peça',
      motivoPeca: os.motivoPeca || '',
      // Aprovado ou recém-chegado e ninguém assumiu — é o que precisa saltar aos olhos
      semDono: AGUARDANDO_ALGUEM.includes(os.status),
      reprovado: os.conferencias?.some(c => !c.aprovado) && os.status === 'Em Execução',
      garantia: !!os.garantiaDeOsId,
      duplicado: placa && placasDuplicadas.has(placa.toUpperCase().trim()),
      ts,
    }
  }

  // Um carro só ocupa vaga no quadro se ainda estiver fisicamente no pátio:
  // fora os pagos, também saem os que foram retirados sem pagar.
  function noPatio(o) {
    if (o.retirado) return false
    if (o.status === 'Concluída' && o.pago) return false
    return true
  }

  function cardsDaColuna(col) {
    const lista = []
    for (const o of ordens) {
      if (col.osStatus.includes(o.status) && noPatio(o)) {
        lista.push(cardDaOrdem(o))
      }
    }
    // Carro parado esperando alguém pegar vai para o topo — é o que se perde de vista
    return lista.sort((a, b) => {
      if (a.semDono !== b.semDono) return a.semDono ? -1 : 1
      return (a.ts || 0) - (b.ts || 0)
    })
  }

  // Clicar no card leva a pessoa para onde ela PODE agir. Quem tem acesso à OS
  // resolve tudo por lá; quem não tem (o reparador) vai para a tela dele.
  function abrirCard(card) {
    const destino = card.status === 'Em Conferência' && podeConferir
      ? `/conferencia/${encodeURIComponent(card.id)}`
      : podeVerOS
        ? `/ordens-servico/${encodeURIComponent(card.id)}`
        : `/oficina/diagnostico/${encodeURIComponent(card.id)}`
    navigate(destino)
  }

  const totalCarros = COLUNAS.reduce((s, col) => s + cardsDaColuna(col).length, 0)

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando o pátio...</p>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // MODO TV
  // ════════════════════════════════════════════════════════════════════════════
  if (modoTV) {
    return (
      <div ref={tvContainerRef} style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'linear-gradient(135deg, #0c1222 0%, #162032 50%, #0c1222 100%)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Car size={28} color="#f97316" />
            <span style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700 }}>Quadro do Pátio</span>
            <span style={{
              background: 'rgba(249,115,22,0.15)', color: '#fb923c',
              padding: '4px 14px', borderRadius: '20px', fontSize: '18px', fontWeight: 700,
            }}>{totalCarros} veículo{totalCarros !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#94a3b8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} /> OK</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} /> Atenção</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> Crítico</span>
            </div>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              fontSize: '13px', fontWeight: 600,
              background: conexaoRuim ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.12)',
              color: conexaoRuim ? '#fca5a5' : '#86efac',
              padding: '5px 12px', borderRadius: '20px',
              border: `1px solid ${conexaoRuim ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.25)'}`,
              animation: conexaoRuim ? 'tvPulseRed 2s ease-in-out infinite' : 'none',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: conexaoRuim ? '#ef4444' : '#22c55e' }} />
              {conexaoRuim
                ? `Sem conexão — dados de ${minutosDesdeSync < 1 ? 'menos de 1 min' : `${minutosDesdeSync} min`} atrás`
                : 'Ao vivo'}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '20px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{hora}</span>
            <button onClick={sairModoTV} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '6px 14px',
              color: '#94a3b8', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}><Minimize2 size={14} /> ESC</button>
          </div>
        </div>

        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: `repeat(${COLUNAS.length}, 1fr)`,
          gap: '10px', padding: '12px 16px 16px', overflow: 'hidden', minHeight: 0,
        }}>
          {COLUNAS.map(col => {
            const cards = cardsDaColuna(col)
            return (
              <div key={col.id} style={{
                display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 0,
              }}>
                <div style={{
                  background: col.cor, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.titulo}</span>
                  <span style={{
                    background: 'rgba(255,255,255,0.25)', color: '#fff',
                    borderRadius: '20px', padding: '2px 12px', fontSize: '16px', fontWeight: 800, minWidth: '32px', textAlign: 'center',
                  }}>{cards.length}</span>
                </div>
                <AutoScrollColumn ativo={modoTV}>
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cards.map(card => {
                      const idade = idadeInfo(card.ts)
                      const corBorda = idade.nivel === 2 ? '#ef4444' : idade.nivel === 1 ? '#f59e0b' : `${col.cor}44`
                      return (
                        <div key={card.key} style={{
                          background: `linear-gradient(135deg, ${col.cor}18, ${col.cor}08)`,
                          border: `2px solid ${corBorda}`, borderRadius: '12px', padding: '10px 12px',
                          animation: idade.nivel === 2 ? 'tvPulseRed 2s ease-in-out infinite' : idade.nivel === 1 ? 'tvPulseAmber 3s ease-in-out infinite' : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                            <span style={{
                              fontFamily: "'Courier New', monospace", fontSize: '22px', fontWeight: 900, letterSpacing: '2px',
                              color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                            }}>{card.placa || '---'}</span>
                            <span style={{
                              fontSize: '13px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px',
                              background: idade.nivel === 2 ? 'rgba(239,68,68,0.2)' : idade.nivel === 1 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)',
                              color: idade.nivel === 2 ? '#fca5a5' : idade.nivel === 1 ? '#fcd34d' : '#86efac',
                              display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            }}><Clock size={12} /> {idade.label}</span>
                          </div>
                          <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Car size={14} color="#94a3b8" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.titulo}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <User size={11} /> {card.cliente}
                            </span>
                            {card.mecanico && (
                              <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(251,191,36,0.1)', padding: '1px 8px', borderRadius: '8px' }}>
                                <Wrench size={10} /> {card.mecanico}
                              </span>
                            )}
                          </div>
                          {card.aguardandoPeca && (
                            <div style={{ marginTop: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600, background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '8px' }}>Aguardando peça</span>
                            </div>
                          )}
                          {card.duplicado && (
                            <div style={{ marginTop: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#fdba74', fontWeight: 600, background: 'rgba(251,146,60,0.15)', padding: '2px 8px', borderRadius: '8px' }}>⚠ OS duplicada</span>
                            </div>
                          )}
                          {(podeVerValores && card.valor != null) || card.aReceber ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', gap: '6px' }}>
                              {card.aReceber && (
                                <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600, background: 'rgba(96,165,250,0.12)', padding: '1px 8px', borderRadius: '8px' }}>a receber</span>
                              )}
                              {podeVerValores && card.valor != null && (
                                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 700, marginLeft: 'auto' }}>{fmtBRL(card.valor)}</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                    {cards.length === 0 && (
                      <div style={{
                        textAlign: 'center', color: 'rgba(255,255,255,0.15)', padding: '32px 0', fontSize: '14px',
                        border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '12px',
                      }}>vazio</div>
                    )}
                  </div>
                </AutoScrollColumn>
              </div>
            )
          })}
        </div>

        <style>{`
          .tv-scroll-col { flex: 1; overflow-y: hidden; min-height: 0; }
          @keyframes tvPulseRed {
            0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0); }
            50% { border-color: #f87171; box-shadow: 0 0 12px 2px rgba(239,68,68,0.25); }
          }
          @keyframes tvPulseAmber {
            0%, 100% { border-color: #f59e0b; box-shadow: 0 0 0 0 rgba(245,158,11,0); }
            50% { border-color: #fbbf24; box-shadow: 0 0 10px 2px rgba(245,158,11,0.2); }
          }
        `}</style>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MODO NORMAL
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quadro do Pátio</h2>
          <p className="text-sm text-slate-500">{totalCarros} veículo(s) no pátio · clique num card para abrir</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {temPermissao('patio-limpeza') && (
            <button onClick={() => navigate('/patio/limpeza')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
              <Trash2 size={16} /> Limpeza
            </button>
          )}
          <button onClick={entrarModoTV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors shadow-sm">
            <Monitor size={16} /> Modo TV
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> no prazo</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> atenção</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> parado demais</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3" style={{ minWidth: '1140px' }}>
          {COLUNAS.map(col => {
            const cards = cardsDaColuna(col)
            return (
              <div key={col.id} className="flex-1 min-w-[184px] flex flex-col">
                <div style={{ backgroundColor: col.cor }} className="flex items-center justify-between rounded-t-xl px-3 py-2 text-white">
                  <span className="text-xs font-bold uppercase tracking-wide truncate">{col.titulo}</span>
                  <span className="text-xs font-bold bg-white/25 rounded-full px-2 py-0.5 flex-shrink-0">{cards.length}</span>
                </div>

                <div style={{ maxHeight: 'calc(100vh - 220px)' }}
                  className="flex-1 overflow-y-auto rounded-b-xl p-2 space-y-2 min-h-[80px] bg-slate-100">
                  {cards.map(card => {
                    const idade = idadeInfo(card.ts)
                    return (
                      <div key={card.key}
                        onClick={() => abrirCard(card)}
                        className={`bg-white border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all ${
                          card.semDono ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        {card.semDono && (
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Livre para pegar</p>
                        )}
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
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {card.mecanico && (
                            <span className="text-[11px] text-amber-700 bg-amber-50 inline-flex items-center gap-1 px-1.5 py-0.5 rounded">
                              <Wrench size={10} /> {card.mecanico}
                            </span>
                          )}
                          {card.garantia && (
                            <span className="text-[11px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-medium">Garantia</span>
                          )}
                          {card.reprovado && (
                            <span className="text-[11px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded font-medium">Reprovado na conferência</span>
                          )}
                          {card.aguardandoPeca && (
                            <span className="text-[11px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded font-medium" title={card.motivoPeca}>
                              Aguardando peça{card.motivoPeca ? `: ${card.motivoPeca}` : ''}
                            </span>
                          )}
                          {card.duplicado && (
                            <span className="text-[11px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded font-medium">OS duplicada</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${idade.bg} ${idade.cor}`}>
                            <Clock size={10} /> {idade.label}
                          </span>
                          {card.aReceber && <span className="text-[10px] text-blue-500 font-medium">a receber</span>}
                          {podeVerValores && card.valor != null && (
                            <span className="text-xs font-semibold text-slate-700">{fmtBRL(card.valor)}</span>
                          )}
                        </div>

                        {PROXIMO_PASSO[card.status] && (
                          <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                            {PROXIMO_PASSO[card.status]}
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {cards.length === 0 && (
                    <div className="text-center text-xs text-slate-300 py-6 border-2 border-dashed border-slate-200 rounded-xl">vazio</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, User, Clock, Wrench, Monitor, Minimize2, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

// ─── 5 colunas (padrão mercado): Recepção → Diagnóstico → Orçamento → Execução → Pronto ───
// ckStatus: array de status de checklist que aparecem nesta coluna
// osStatus: array de status de OS que aparecem nesta coluna
const COLUNAS = [
  { id: 'recepcao',    titulo: 'Recepção',           cor: '#854F0B', ckStatus: ['Aguardando diagnóstico'],                    osStatus: [] },
  { id: 'diagnostico', titulo: 'Diagnóstico',        cor: '#185FA5', ckStatus: ['Em diagnóstico'],                            osStatus: ['Diagnóstico'] },
  { id: 'orcamento',   titulo: 'Orçamento',          cor: '#534AB7', ckStatus: ['Diagnóstico concluído', 'Aguardando peça'],  osStatus: ['Aguardando Aprovação', 'Rejeitada'] },
  { id: 'em_execucao', titulo: 'Em execução',        cor: '#993C1D', ckStatus: [],                                           osStatus: ['Aberta', 'Aprovada', 'Em Execução', 'Em Andamento', 'Aguardando Peça'] },
  { id: 'pronto',      titulo: 'Pronto p/ retirada', cor: '#3B6D11', ckStatus: [],                                           osStatus: ['Concluída'] },
]

// Status da OS ao soltar em cada coluna (apenas colunas intermediárias — Pronto é bloqueado no modo híbrido)
const OS_STATUS_DESTINO = {
  diagnostico: 'Diagnóstico',
  orcamento: 'Aguardando Aprovação',
  em_execucao: 'Em Execução',
}

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
    checklists, setChecklists, ordens, mudarStatusOrdem,
    totalOrdem, getCliente, getVeiculo, getFuncionario, carregando,
  } = useApp()
  const { currentUser, temPermissao } = useAuth()
  const podeVerValores = !!currentUser?.permissoes?.verPrecos

  const [arrastando, setArrastando] = useState(null)
  const [sobre, setSobre] = useState(null)
  const [modoTV, setModoTV] = useState(false)
  const hora = useClock()

  // ── Fullscreen API ──
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

  // ── Monta os cards ──
  function cardDoChecklist(ck) {
    const ts = parseBR(ck.criadoEm) || (Number.isFinite(Number(ck.id)) ? Number(ck.id) : null)
    const tsEtapa = ck.etapaEm || ts
    return {
      key: `ck-${ck.id}`, kind: 'checklist', id: ck.id,
      titulo: ck.veiculoModelo || '—', placa: ck.veiculoPlaca || '',
      cliente: ck.clienteNome || '—', mecanico: ck.tecnicoNome || '',
      valor: null, aReceber: false, aguardandoPeca: false, ts: tsEtapa,
    }
  }

  const veiculosComOS = new Set(ordens.map(o => o.veiculoId).filter(Boolean))

  const placasDuplicadas = (() => {
    const contagem = {}
    for (const o of ordens) {
      const placa = (getVeiculo(o.veiculoId)?.placa || o.veiculoPlaca || '').toUpperCase().trim()
      if (!placa) continue
      const col = COLUNAS.find(c => c.osStatus.includes(o.status))
      if (!col) continue
      if (o.status === 'Concluída' && o.pago) continue
      contagem[placa] = (contagem[placa] || 0) + 1
    }
    const dup = new Set()
    for (const [p, n] of Object.entries(contagem)) { if (n > 1) dup.add(p) }
    return dup
  })()

  function cardDaOrdem(os) {
    const veic = getVeiculo(os.veiculoId)
    const cli = getCliente(os.clienteId)
    const mec = os.mecanicoId ? getFuncionario(os.mecanicoId) : null
    const ts = os.etapaEm || parseBR(os.dataEntrada) || parseBR(os.data)
    const placa = veic?.placa || os.veiculoPlaca || ''
    return {
      key: `os-${os.id}`, kind: 'os', id: os.id,
      titulo: veic?.modelo || os.veiculoInfo || os.veiculoModelo || '—',
      placa,
      cliente: cli?.nome || os.clienteNome || '—',
      mecanico: mec?.nome || '',
      valor: totalOrdem(os), aReceber: os.status === 'Concluída' && !os.pago,
      aguardandoPeca: os.status === 'Aguardando Peça',
      duplicado: placa && placasDuplicadas.has(placa.toUpperCase().trim()),
      ts,
    }
  }

  function cardsDaColuna(col) {
    const lista = []
    if (col.ckStatus.length) {
      for (const c of checklists) {
        if (!c.osId && col.ckStatus.includes(c.status)) {
          if (c.veiculoId && veiculosComOS.has(c.veiculoId)) continue
          lista.push(cardDoChecklist(c))
        }
      }
    }
    if (col.osStatus.length) {
      for (const o of ordens) {
        if (col.osStatus.includes(o.status) && !(o.status === 'Concluída' && o.pago)) {
          lista.push(cardDaOrdem(o))
        }
      }
    }
    return lista.sort((a, b) => (a.ts || 0) - (b.ts || 0))
  }

  function colId(card) {
    if (card.kind === 'checklist') {
      const ck = checklists.find(c => c.id === card.id)
      return COLUNAS.find(col => col.ckStatus.length && col.ckStatus.includes(ck?.status))?.id
    }
    const os = ordens.find(o => o.id === card.id)
    return COLUNAS.find(col => col.osStatus.includes(os?.status))?.id
  }

  // ── Valida se o card pode ser solto nesta coluna (modo híbrido) ──
  function podeDropar(card, destinoId) {
    if (!card) return false
    const origemId = colId(card)
    if (!origemId || origemId === destinoId) return false

    const destino = COLUNAS.find(c => c.id === destinoId)

    if (card.kind === 'checklist') {
      return destino.ckStatus.length > 0
    }

    // OS: bloqueado mover para/de Pronto e para Recepção
    if (destinoId === 'pronto') return false
    if (origemId === 'pronto') return false
    if (destinoId === 'recepcao') return false
    return !!OS_STATUS_DESTINO[destinoId]
  }

  // ── Ação ao soltar (modo híbrido: só mudanças de status leves) ──
  function soltarNaColuna(destinoId, card) {
    setArrastando(null); setSobre(null)
    if (!card || !podeDropar(card, destinoId)) return

    const destino = COLUNAS.find(c => c.id === destinoId)

    if (card.kind === 'checklist') {
      setChecklists(prev => prev.map(c => c.id === card.id
        ? { ...c, status: destino.ckStatus[0], etapaEm: Date.now() } : c))
      return
    }

    // OS: muda status entre colunas intermediárias
    const novoStatus = OS_STATUS_DESTINO[destinoId]
    if (novoStatus) mudarStatusOrdem(card.id, novoStatus)
  }

  function abrirCard(card) {
    if (card.kind === 'checklist') navigate(`/checklist/${card.id}`)
    else navigate(`/ordens-servico/${encodeURIComponent(card.id)}`)
  }

  // ── Arraste por pointer events ──
  function iniciarArraste(e, card) {
    if (modoTV) return
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
      const col = colunaSob(ev.clientX, ev.clientY)
      setSobre(col && podeDropar(card, col) ? col : null)
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
        abrirCard(card)
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
        {/* Barra superior TV */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Car size={28} color="#f97316" />
            <span style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700 }}>
              Quadro do Pátio
            </span>
            <span style={{
              background: 'rgba(249,115,22,0.15)', color: '#fb923c',
              padding: '4px 14px', borderRadius: '20px',
              fontSize: '18px', fontWeight: 700,
            }}>
              {totalCarros} veículo{totalCarros !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#94a3b8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} /> OK
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} /> Atenção
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> Crítico
              </span>
            </div>

            <span style={{
              color: '#94a3b8', fontSize: '20px', fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {hora}
            </span>

            <button onClick={sairModoTV} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '6px 14px',
              color: '#94a3b8', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Minimize2 size={14} /> ESC
            </button>
          </div>
        </div>

        {/* Colunas TV */}
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: `repeat(${COLUNAS.length}, 1fr)`,
          gap: '10px', padding: '12px 16px 16px', overflow: 'hidden',
          minHeight: 0,
        }}>
          {COLUNAS.map(col => {
            const cards = cardsDaColuna(col)
            return (
              <div key={col.id} style={{
                display: 'flex', flexDirection: 'column',
                borderRadius: '16px', overflow: 'hidden',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                minHeight: 0,
              }}>
                <div style={{
                  background: col.cor, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <span style={{
                    color: '#fff', fontSize: '14px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{col.titulo}</span>
                  <span style={{
                    background: 'rgba(255,255,255,0.25)', color: '#fff',
                    borderRadius: '20px', padding: '2px 12px',
                    fontSize: '16px', fontWeight: 800, minWidth: '32px', textAlign: 'center',
                  }}>{cards.length}</span>
                </div>

                <AutoScrollColumn ativo={modoTV}>
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cards.map(card => {
                      const idade = idadeInfo(card.ts)
                      const corBorda = idade.nivel === 2 ? '#ef4444'
                        : idade.nivel === 1 ? '#f59e0b' : `${col.cor}44`

                      return (
                        <div key={card.key} style={{
                          background: `linear-gradient(135deg, ${col.cor}18, ${col.cor}08)`,
                          border: `2px solid ${corBorda}`,
                          borderRadius: '12px', padding: '10px 12px',
                          animation: idade.nivel === 2 ? 'tvPulseRed 2s ease-in-out infinite'
                            : idade.nivel === 1 ? 'tvPulseAmber 3s ease-in-out infinite' : 'none',
                        }}>
                          {/* PLACA */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '8px', marginBottom: '6px',
                          }}>
                            <span style={{
                              fontFamily: "'Courier New', monospace",
                              fontSize: '22px', fontWeight: 900, letterSpacing: '2px',
                              color: '#fff', background: 'rgba(0,0,0,0.4)',
                              padding: '3px 10px', borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }}>
                              {card.placa || '---'}
                            </span>
                            <span style={{
                              fontSize: '13px', fontWeight: 700,
                              padding: '2px 10px', borderRadius: '12px',
                              background: idade.nivel === 2 ? 'rgba(239,68,68,0.2)'
                                : idade.nivel === 1 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)',
                              color: idade.nivel === 2 ? '#fca5a5'
                                : idade.nivel === 1 ? '#fcd34d' : '#86efac',
                              display: 'flex', alignItems: 'center', gap: '4px',
                              flexShrink: 0,
                            }}>
                              <Clock size={12} /> {idade.label}
                            </span>
                          </div>

                          {/* Modelo */}
                          <div style={{
                            color: '#e2e8f0', fontSize: '14px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            marginBottom: '4px',
                          }}>
                            <Car size={14} color="#94a3b8" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {card.titulo}
                            </span>
                          </div>

                          {/* Cliente + Mecânico */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '8px', flexWrap: 'wrap',
                          }}>
                            <span style={{
                              color: '#94a3b8', fontSize: '12px',
                              display: 'flex', alignItems: 'center', gap: '4px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              <User size={11} /> {card.cliente}
                            </span>
                            {card.mecanico && (
                              <span style={{
                                color: '#fbbf24', fontSize: '12px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '4px',
                                background: 'rgba(251,191,36,0.1)',
                                padding: '1px 8px', borderRadius: '8px',
                              }}>
                                <Wrench size={10} /> {card.mecanico}
                              </span>
                            )}
                          </div>

                          {/* Tag Aguardando peça (TV) */}
                          {card.aguardandoPeca && (
                            <div style={{ marginTop: '6px' }}>
                              <span style={{
                                fontSize: '11px', color: '#fca5a5', fontWeight: 600,
                                background: 'rgba(239,68,68,0.15)',
                                padding: '2px 8px', borderRadius: '8px',
                              }}>Aguardando peça</span>
                            </div>
                          )}
                          {card.duplicado && (
                            <div style={{ marginTop: '6px' }}>
                              <span style={{
                                fontSize: '11px', color: '#fdba74', fontWeight: 600,
                                background: 'rgba(251,146,60,0.15)',
                                padding: '2px 8px', borderRadius: '8px',
                              }}>⚠ OS duplicada</span>
                            </div>
                          )}

                          {/* Valor + A Receber */}
                          {(podeVerValores && card.valor != null) || card.aReceber ? (
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              marginTop: '6px', gap: '6px',
                            }}>
                              {card.aReceber && (
                                <span style={{
                                  fontSize: '11px', color: '#60a5fa', fontWeight: 600,
                                  background: 'rgba(96,165,250,0.12)',
                                  padding: '1px 8px', borderRadius: '8px',
                                }}>a receber</span>
                              )}
                              {podeVerValores && card.valor != null && (
                                <span style={{
                                  fontSize: '13px', color: '#e2e8f0', fontWeight: 700,
                                  marginLeft: 'auto',
                                }}>{fmtBRL(card.valor)}</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                    {cards.length === 0 && (
                      <div style={{
                        textAlign: 'center', color: 'rgba(255,255,255,0.15)',
                        padding: '32px 0', fontSize: '14px',
                        border: '2px dashed rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                      }}>
                        vazio
                      </div>
                    )}
                  </div>
                </AutoScrollColumn>
              </div>
            )
          })}
        </div>

        <style>{`
          .tv-scroll-col {
            flex: 1;
            overflow-y: hidden;
            min-height: 0;
          }
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
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quadro do Pátio</h2>
          <p className="text-sm text-slate-500">{totalCarros} veículo(s) no pátio · arraste os cards entre as etapas</p>
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

      {/* Quadro */}
      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3" style={{ minWidth: '960px' }}>
          {COLUNAS.map(col => {
            const cards = cardsDaColuna(col)
            const ativa = sobre === col.id
            return (
              <div key={col.id}
                data-coluna={col.id}
                className="flex-1 min-w-[184px] flex flex-col">
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
                        {card.aguardandoPeca && (
                          <p className="text-[11px] text-red-700 bg-red-50 inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded font-medium">
                            Aguardando peça
                          </p>
                        )}
                        {card.duplicado && (
                          <p className="text-[11px] text-orange-700 bg-orange-50 inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded font-medium">
                            ⚠ OS duplicada p/ este veículo
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
    </div>
  )
}

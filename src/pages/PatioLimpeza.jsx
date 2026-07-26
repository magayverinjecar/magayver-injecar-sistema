import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle, Car, User, Clock, DollarSign, Ban, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function parseBR(s) {
  if (!s) return null
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
}

function diasParado(os) {
  const ts = os.etapaEm || parseBR(os.dataEntrada) || parseBR(os.data)
  if (!ts) return 999
  return Math.round((Date.now() - ts) / 86400000)
}

const STATUS_CORES = {
  'Concluída': 'bg-green-100 text-green-700',
  'Em Execução': 'bg-orange-100 text-orange-700',
  'Em Andamento': 'bg-orange-100 text-orange-700',
  'Aberta': 'bg-blue-100 text-blue-700',
  'Aprovada': 'bg-blue-100 text-blue-700',
  'Diagnóstico': 'bg-blue-100 text-blue-700',
  'Aguardando Aprovação': 'bg-purple-100 text-purple-700',
  'Aguardando Peça': 'bg-red-100 text-red-700',
}

export default function PatioLimpeza() {
  const navigate = useNavigate()
  const {
    ordens, checklists, setChecklists,
    getCliente, getVeiculo, totalOrdem,
    pagarOrdem, mudarStatusOrdem, reabrirOrdem, setFinanceiro,
  } = useApp()

  const [filtro, setFiltro] = useState('todos')
  const [confirmar, setConfirmar] = useState(null)
  const [processados, setProcessados] = useState(new Set())

  const osParadas = useMemo(() => {
    const statusAtivos = ['Concluída', 'Em Execução', 'Em Andamento', 'Aberta', 'Aprovada', 'Diagnóstico', 'Aguardando Aprovação', 'Aguardando Peça']
    return ordens
      .filter(o => statusAtivos.includes(o.status))
      .filter(o => !(o.status === 'Concluída' && o.pago))
      .map(o => {
        const cli = getCliente(o.clienteId)
        const veic = getVeiculo(o.veiculoId)
        const dias = diasParado(o)
        return {
          ...o,
          clienteNome: cli?.nome || o.clienteNome || '—',
          clienteTelefone: cli?.telefone || cli?.celular || '',
          placa: veic?.placa || o.veiculoPlaca || '',
          modelo: veic?.modelo || o.veiculoInfo || o.veiculoModelo || '—',
          valor: totalOrdem(o),
          dias,
        }
      })
      .sort((a, b) => b.dias - a.dias)
  }, [ordens, getCliente, getVeiculo, totalOrdem])

  const filtradas = useMemo(() => {
    if (filtro === 'concluidas') return osParadas.filter(o => o.status === 'Concluída')
    if (filtro === 'execucao') return osParadas.filter(o => ['Em Execução', 'Em Andamento', 'Aberta', 'Aprovada'].includes(o.status))
    if (filtro === 'outras') return osParadas.filter(o => ['Diagnóstico', 'Aguardando Aprovação', 'Aguardando Peça'].includes(o.status))
    return osParadas
  }, [osParadas, filtro])

  const totalValor = filtradas.reduce((s, o) => s + o.valor, 0)
  const totalConcluidas = osParadas.filter(o => o.status === 'Concluída').length
  const totalExecucao = osParadas.filter(o => ['Em Execução', 'Em Andamento', 'Aberta', 'Aprovada'].includes(o.status)).length

  function executarAcao(os, acao) {
    setConfirmar(null)
    setProcessados(prev => new Set(prev).add(os.id))

    if (acao === 'pagou_retirou') {
      if (os.status !== 'Concluída') {
        mudarStatusOrdem(os.id, 'Concluída')
      }
      pagarOrdem(os.id)
    } else if (acao === 'retirou_sem_pagar') {
      if (os.status !== 'Concluída') {
        mudarStatusOrdem(os.id, 'Concluída')
      }
      // Não marca como pago — fica como devedor
    } else if (acao === 'cancelar') {
      if (os.status === 'Concluída') {
        reabrirOrdem(os.id)
      }
      mudarStatusOrdem(os.id, 'Cancelada')
    } else if (acao === 'ainda_aqui') {
      setProcessados(prev => {
        const n = new Set(prev)
        n.delete(os.id)
        return n
      })
    }
  }

  // Checklists órfãs (sem OS, parados há muito tempo)
  const veiculosComOS = new Set(ordens.map(o => o.veiculoId).filter(Boolean))
  const checklistsOrfas = useMemo(() => {
    return checklists
      .filter(c => !c.osId && !(c.veiculoId && veiculosComOS.has(c.veiculoId)))
      .map(c => {
        const ts = parseBR(c.criadoEm) || (Number.isFinite(Number(c.id)) ? Number(c.id) : null)
        const dias = ts ? Math.round((Date.now() - ts) / 86400000) : 999
        return { ...c, dias }
      })
      .filter(c => c.dias >= 7)
      .sort((a, b) => b.dias - a.dias)
  }, [checklists, veiculosComOS])

  function removerChecklist(id) {
    setChecklists(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/patio')} className="mt-1 text-slate-400 hover:text-slate-600">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Limpeza do Pátio</h2>
          <p className="text-sm text-slate-500">Organize as OS paradas e corrija o financeiro</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">OS pendentes</p>
          <p className="text-2xl font-bold text-slate-800">{osParadas.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Concluídas s/ baixa</p>
          <p className="text-2xl font-bold text-green-600">{totalConcluidas}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Em execução paradas</p>
          <p className="text-2xl font-bold text-orange-600">{totalExecucao}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Valor total pendente</p>
          <p className="text-2xl font-bold text-slate-800">{fmtBRL(totalValor)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'todos', label: 'Todas' },
          { id: 'concluidas', label: `Concluídas a receber (${totalConcluidas})` },
          { id: 'execucao', label: `Em execução paradas (${totalExecucao})` },
          { id: 'outras', label: 'Diagnóstico / Orçamento' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === f.id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de OS */}
      <div className="space-y-2">
        {filtradas.map(os => {
          const jaProcessou = processados.has(os.id)
          if (jaProcessou) {
            return (
              <div key={os.id} className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                <span className="text-sm text-green-700 font-medium">
                  {os.id} — {os.modelo} ({os.placa}) — Processado
                </span>
              </div>
            )
          }

          return (
            <div key={os.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Info do veículo */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {os.placa || '---'}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{os.modelo}</span>
                    <span className="text-xs text-slate-400">{os.id}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CORES[os.status] || 'bg-slate-100 text-slate-600'}`}>
                      {os.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><User size={11} /> {os.clienteNome}</span>
                    {os.clienteTelefone && <span>{os.clienteTelefone}</span>}
                    <span className={`flex items-center gap-1 font-semibold ${os.dias >= 14 ? 'text-red-600' : os.dias >= 7 ? 'text-amber-600' : 'text-slate-500'}`}>
                      <Clock size={11} /> {os.dias} dia(s) parado
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <DollarSign size={11} /> {fmtBRL(os.valor)}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 flex-wrap flex-shrink-0">
                  <button onClick={() => setConfirmar({ os, acao: 'pagou_retirou', texto: `Marcar ${os.id} como PAGO e ENTREGUE? O veículo sairá do quadro.`, cor: 'bg-green-500 hover:bg-green-600' })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors">
                    <CheckCircle2 size={13} /> Pagou e retirou
                  </button>
                  <button onClick={() => setConfirmar({ os, acao: 'retirou_sem_pagar', texto: `Marcar ${os.id} como ENTREGUE SEM PAGAR? Ficará na lista de devedores.`, cor: 'bg-amber-500 hover:bg-amber-600' })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors">
                    <AlertTriangle size={13} /> Retirou sem pagar
                  </button>
                  <button onClick={() => setConfirmar({ os, acao: 'cancelar', texto: `CANCELAR ${os.id}? A receita será estornada do financeiro.`, cor: 'bg-red-500 hover:bg-red-600' })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors">
                    <Ban size={13} /> Cancelar OS
                  </button>
                  <button onClick={() => executarAcao(os, 'ainda_aqui')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
                    <Car size={13} /> Ainda está aqui
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filtradas.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            Nenhuma OS encontrada com este filtro.
          </div>
        )}
      </div>

      {/* Checklists órfãs */}
      {checklistsOrfas.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Fichas de checklist antigas (sem OS)</h3>
          <p className="text-sm text-slate-500 mb-4">
            Checklists com mais de 7 dias que nunca geraram OS. Provavelmente o cliente não voltou.
          </p>
          <div className="space-y-2">
            {checklistsOrfas.map(ck => (
              <div key={ck.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {ck.veiculoPlaca || '---'}
                  </span>
                  <span className="text-slate-800 font-medium">{ck.veiculoModelo || '—'}</span>
                  <span className="text-slate-500">{ck.clienteNome || '—'}</span>
                  <span className="text-xs text-red-600 font-semibold">{ck.dias} dia(s)</span>
                  <span className="text-xs text-slate-400">{ck.status}</span>
                </div>
                <button onClick={() => removerChecklist(ck.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors">
                  <X size={12} /> Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 mb-1">Confirmar ação</p>
                <p className="text-sm text-slate-500">{confirmar.texto}</p>
                <div className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-2">
                  <p><strong>Veículo:</strong> {confirmar.os.modelo} ({confirmar.os.placa})</p>
                  <p><strong>Cliente:</strong> {confirmar.os.clienteNome}</p>
                  <p><strong>Valor:</strong> {fmtBRL(confirmar.os.valor)}</p>
                  <p><strong>Parado há:</strong> {confirmar.os.dias} dia(s)</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmar(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => executarAcao(confirmar.os, confirmar.acao)}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${confirmar.cor}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, ArrowBigLeftDash, AlertTriangle, Car, User, Wrench, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { novaConferencia, STATUS_CONFERENCIA } from '../utils/conferencia'

export default function Conferencia() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const {
    ordens, config, getCliente, getVeiculo,
    liberarConferencia, reprovarConferencia, carregando,
  } = useApp()

  const os = ordens.find(o => o.id === osId)
  const [itens, setItens] = useState(null)
  const [salvando, setSalvando] = useState(false)

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando...</p>
    </div>
  )

  if (!os) return (
    <div className="p-6 text-center">
      <p className="text-slate-400">OS não encontrada.</p>
      <button onClick={() => navigate('/patio')} className="mt-3 text-primary-500 text-sm">Voltar ao pátio</button>
    </div>
  )

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  // Uma conferência anterior reprovada não volta marcada — a checagem é refeita do zero
  const lista = itens ?? novaConferencia(config)

  const marcados = lista.filter(i => i.status).length
  const problemas = lista.filter(i => i.status === 'problema')
  const todosMarcados = marcados === lista.length
  const podeLiberar = todosMarcados && problemas.length === 0
  const podeDevolver = problemas.length > 0

  function marcar(itemId, status) {
    setItens(lista.map(i => i.id === itemId
      ? { ...i, status, nota: status === 'problema' ? i.nota : '' }
      : i))
  }

  function anotar(itemId, nota) {
    setItens(lista.map(i => i.id === itemId ? { ...i, nota } : i))
  }

  function liberar() {
    if (!podeLiberar || salvando) return
    setSalvando(true)
    liberarConferencia(os.id, lista)
    navigate('/patio')
  }

  function devolver() {
    if (!podeDevolver || salvando) return
    const semNota = problemas.filter(p => !p.nota.trim())
    if (semNota.length > 0) {
      alert(`Descreva o que está errado em: ${semNota.map(p => p.label).join(', ')}`)
      return
    }
    if (!confirm(`Devolver para reparo com ${problemas.length} item(ns) com problema?`)) return
    setSalvando(true)
    reprovarConferencia(os.id, lista)
    navigate('/patio')
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/patio')} aria-label="Voltar ao pátio"
          className="mt-1 text-slate-400 hover:text-slate-600"><ArrowLeft size={18} /></button>
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-500" />Conferência antes da entrega
          </h2>
          <p className="text-sm text-slate-500">OS {os.id}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Car size={14} className="text-slate-400" />
            {nomeVeiculo(veiculo, os)}
            {veiculo?.placa && <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{veiculo.placa}</span>}
          </span>
          <span className="text-slate-500 flex items-center gap-1.5">
            <User size={13} />{cliente?.nome || os.clienteNome || '—'}
          </span>
          {(os.reparadorNome || os.responsavelNome) && (
            <span className="text-amber-700 flex items-center gap-1.5">
              <Wrench size={13} />Reparo: {os.reparadorNome || os.responsavelNome}
            </span>
          )}
        </div>
        {os.conferencias?.some(c => !c.aprovado) && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>Este veículo já foi reprovado {os.conferencias.filter(c => !c.aprovado).length}x nesta OS.</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">Itens a conferir</h3>
          <span className={`text-xs font-medium ${todosMarcados ? 'text-green-600' : 'text-slate-400'}`}>
            {marcados} de {lista.length}
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {lista.map(item => (
            <div key={item.id} className={item.status === 'problema' ? 'bg-red-50' : ''}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
                <span className={`text-sm ${item.status === 'problema' ? 'text-red-700 font-medium' : 'text-slate-700'}`}>
                  {item.label}
                </span>
                <div className="flex gap-1.5 flex-shrink-0">
                  {Object.entries(STATUS_CONFERENCIA).map(([key, { label, cls }]) => (
                    <button key={key} onClick={() => marcar(item.id, key)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        item.status === key ? cls : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {item.status === 'problema' && (
                <div className="px-4 pb-3">
                  <input type="text" value={item.nota} autoFocus
                    onChange={e => anotar(item.id, e.target.value)}
                    placeholder="O que está errado?"
                    className="w-full border border-red-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={devolver} disabled={!podeDevolver || salvando}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors">
            <ArrowBigLeftDash size={16} />Devolver para reparo
          </button>
          <button onClick={liberar} disabled={!podeLiberar || salvando}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors">
            <CheckCircle2 size={16} />Liberar para entrega
          </button>
        </div>
        <p className="text-xs text-slate-500 text-center">
          {problemas.length > 0
            ? `${problemas.length} item(ns) com problema impedem a liberação.`
            : !todosMarcados
              ? `Marque todos os ${lista.length} itens para liberar.`
              : 'Tudo conferido — pode liberar.'}
        </p>
      </div>
    </div>
  )
}

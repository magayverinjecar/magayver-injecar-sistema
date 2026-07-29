import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Search, User, Clock, Wrench, AlertTriangle, Stethoscope, ArrowRight, CheckCircle2, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { momentoEntrada, nomeVeiculo } from '../utils/datas'
import { statusColor } from './OrdensServico'

// Há quanto tempo o carro espera. Usa o momento de entrada porque `etapaEm`
// ficou igual em todas as OS antigas depois da migração.
function horasParado(os) {
  const ts = momentoEntrada(os)
  if (!ts) return null
  return Math.floor((Date.now() - ts) / 3600000)
}

function rotuloEspera(h) {
  if (h == null) return '—'
  if (h < 1) return 'agora há pouco'
  if (h < 24) return `há ${h}h`
  return `há ${Math.round(h / 24)} dia(s)`
}

export default function OficinaDiagnostico() {
  const { ordens, getCliente, getVeiculo, iniciarDiagnostico, carregando } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [modoBusca, setModoBusca] = useState('placa')
  const [ocupado, setOcupado] = useState(null)
  const [filtro, setFiltro] = useState('fila')

  // A fila real: carros que chegaram e ainda não foram diagnosticados
  const naFila = ordens.filter(o => o.status === 'Recepção' && !o.retirado)
  const emAndamento = ordens.filter(o => o.status === 'Em Diagnóstico' && !o.retirado)
  // Diagnóstico já entregue: a OS passou da fase, e o carimbo confirma que foi
  // finalizado de verdade (e não só arrastado de status).
  const finalizados = ordens.filter(o =>
    !['Recepção', 'Em Diagnóstico', 'Cancelada'].includes(o.status) &&
    (o.diagnosticadoEm || o.tecnicoNome || (o.diagnosticoItens || []).some(i => String(i?.value ?? i?.valor ?? '').trim()))
  )

  function enriquecer(o) {
    const veic = getVeiculo(o.veiculoId)
    const cli = getCliente(o.clienteId)
    const h = horasParado(o)
    return {
      ...o,
      placa: veic?.placa || o.veiculoPlaca || '',
      modelo: nomeVeiculo(veic, o),
      cliente: cli?.nome || o.clienteNome || '—',
      horas: h,
      espera: rotuloEspera(h),
      urgente: h != null && h >= 24,
      meu: o.responsavelId != null && o.responsavelId === currentUser?.id,
      entrouEm: momentoEntrada(o),
    }
  }

  // Último a dar entrada aparece primeiro. Carro parado há muito tempo não some
  // da vista: o relógio do card fica vermelho a partir de 24h.
  function filtrar(lista) {
    const enriquecidos = lista.map(enriquecer)
    const q = busca.trim().toLowerCase()
    const filtrados = q
      ? enriquecidos.filter(o => modoBusca === 'placa'
          ? o.placa.toLowerCase().includes(q)
          : o.cliente.toLowerCase().includes(q))
      : enriquecidos
    return filtrados.sort((a, b) => b.entrouEm - a.entrouEm)
  }

  const fila = filtrar(naFila)
  const andamento = filtrar(emAndamento)
  const prontos = filtrar(finalizados)

  const ABAS = [
    { id: 'fila',        label: 'Na fila',        n: fila.length },
    { id: 'andamento',   label: 'Em diagnóstico', n: andamento.length },
    { id: 'finalizados', label: 'Finalizados',    n: prontos.length },
  ]
  const listaAtual = filtro === 'fila' ? fila : filtro === 'andamento' ? andamento : prontos

  function assumir(e, os) {
    e.stopPropagation()
    if (ocupado) return
    if (!confirm(`Iniciar o diagnóstico de ${os.placa || os.modelo}?\n\nVai ficar registrado como ${currentUser?.nome || 'você'}.`)) return
    setOcupado(os.id)
    iniciarDiagnostico(os.id)
    setTimeout(() => {
      setOcupado(null)
      navigate(`/oficina/diagnostico/${encodeURIComponent(os.id)}`)
    }, 150)
  }

  function abrir(os) {
    navigate(`/oficina/diagnostico/${encodeURIComponent(os.id)}`)
  }

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando a fila...</p>
    </div>
  )

  function Card({ os, tipo }) {
    const naFila = tipo === 'fila'
    const pronto = tipo === 'finalizados'
    const borda = pronto ? 'border-green-200 hover:border-green-400'
      : naFila ? 'border-amber-200 hover:border-amber-400'
      : 'border-blue-200 hover:border-blue-400'
    const fundoIcone = pronto ? 'bg-green-50' : naFila ? 'bg-amber-50' : 'bg-blue-50'
    const corIcone = pronto ? 'text-green-500' : naFila ? 'text-amber-500' : 'text-blue-500'
    return (
      <div onClick={() => abrir(os)}
        className={`w-full bg-white border rounded-2xl p-4 text-left transition-all cursor-pointer hover:shadow-md ${borda}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${fundoIcone}`}>
            {pronto ? <CheckCircle2 size={18} className={corIcone} /> : <Wrench size={18} className={corIcone} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800">{os.modelo}</span>
              {os.placa && (
                <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{os.placa}</span>
              )}
              {os.meu && <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">seu</span>}
            </div>

            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
              <User size={12} className="text-slate-400" /> {os.cliente}
            </p>

            {os.descricaoProblema && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{os.descricaoProblema}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
              <span className={`flex items-center gap-1 ${!pronto && os.urgente ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                <Clock size={11} /> {pronto ? (os.diagnosticadoEm || os.espera) : os.espera}
              </span>
              <span className="text-slate-400">{os.id}</span>
              {pronto && (
                <span className={`font-medium px-2 py-0.5 rounded-full ${statusColor[os.status] || 'bg-slate-100 text-slate-600'}`}>
                  {os.status}
                </span>
              )}
              {os.luzesPainel?.length > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle size={11} /> {os.luzesPainel.length} luz(es)
                </span>
              )}
              {(os.tecnicoNome || (!naFila && os.responsavelNome)) && (
                <span className={`font-medium flex items-center gap-1 ${pronto ? 'text-green-700' : 'text-blue-600'}`}>
                  <Wrench size={11} /> {os.tecnicoNome || os.responsavelNome}
                </span>
              )}
            </div>
          </div>
        </div>

        {naFila && (
          <button onClick={e => assumir(e, os)} disabled={ocupado === os.id}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            <Stethoscope size={15} /> Vou diagnosticar
          </button>
        )}
        {tipo === 'andamento' && (
          <button onClick={e => { e.stopPropagation(); abrir(os) }}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-blue-200 text-blue-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-50 transition-colors">
            <ArrowRight size={15} /> Continuar diagnóstico
          </button>
        )}
        {pronto && (
          <button onClick={e => { e.stopPropagation(); abrir(os) }}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-green-200 text-green-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-green-50 transition-colors">
            <FileText size={15} /> Ver diagnóstico
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Realizar Diagnóstico</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {fila.length === 0 ? 'Nenhum veículo aguardando' : `${fila.length} veículo(s) na fila`}
          </p>
        </div>
        {fila.length > 0 && (
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
            {fila.length}
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setFiltro(a.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              filtro === a.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {a.label}
            <span className={`text-xs px-1.5 rounded-full ${filtro === a.id ? 'bg-white/25' : 'bg-white'}`}>{a.n}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          {['placa', 'nome'].map(m => (
            <button key={m} onClick={() => { setModoBusca(m); setBusca('') }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                modoBusca === m ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {m === 'placa' ? 'Buscar por Placa' : 'Buscar por Nome'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input type="text"
            placeholder={modoBusca === 'placa' ? 'ABC-1234...' : 'Nome do cliente...'}
            value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
      </div>

      {listaAtual.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <ClipboardCheck size={32} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {busca ? 'Nenhum veículo encontrado'
              : filtro === 'fila' ? 'Nenhum veículo na fila'
              : filtro === 'andamento' ? 'Nenhum diagnóstico em andamento'
              : 'Nenhum diagnóstico finalizado'}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {busca ? 'Tente outro termo de busca.' : 'Todos os diagnósticos estão em dia.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaAtual.map(os => <Card key={os.id} os={os} tipo={filtro} />)}
        </div>
      )}
    </div>
  )
}

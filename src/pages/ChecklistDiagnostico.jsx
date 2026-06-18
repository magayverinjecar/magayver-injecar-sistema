import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Search, Car, User, Clock, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function ChecklistDiagnostico() {
  const { checklists } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [modoBusca, setModoBusca] = useState('placa') // 'placa' | 'nome'

  const pendentes = checklists.filter(c =>
    c.status === 'Aguardando diagnóstico' || c.status === 'Em diagnóstico'
  )

  const concluidos = checklists.filter(c => c.status === 'Diagnóstico concluído')

  function filtrar(lista) {
    if (!busca.trim()) return lista
    const q = busca.toLowerCase()
    return lista.filter(c =>
      modoBusca === 'placa'
        ? c.veiculoPlaca?.toLowerCase().includes(q)
        : c.clienteNome?.toLowerCase().includes(q)
    )
  }

  const pendentesFiltrados = filtrar(pendentes).sort((a, b) => a.id - b.id) // mais antigo primeiro = mais urgente
  const concluidosFiltrados = filtrar(concluidos).sort((a, b) => b.id - a.id)

  function Card({ ck }) {
    const aguardando = ck.status === 'Aguardando diagnóstico'
    return (
      <button onClick={() => navigate(`/checklist/diagnostico/${ck.id}`)}
        className={`w-full bg-white border rounded-2xl p-4 text-left transition-all flex items-start gap-4 hover:shadow-md group ${
          aguardando ? 'border-amber-200 hover:border-amber-400' : 'border-blue-200 hover:border-blue-400'
        }`}>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
          aguardando ? 'bg-amber-50' : 'bg-blue-50'
        }`}>
          <Wrench size={18} className={aguardando ? 'text-amber-500' : 'text-blue-500'} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Veículo + placa */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{ck.veiculoModelo || ck.veiculoInfo || '—'}</span>
            {ck.veiculoPlaca && (
              <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {ck.veiculoPlaca}
              </span>
            )}
          </div>

          {/* Cliente + telefone */}
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="font-medium text-slate-700 flex items-center gap-1">
              <User size={12} className="text-slate-400" /> {ck.clienteNome || '—'}
            </span>
            {ck.clienteTelefone && (
              <a href={`https://wa.me/55${ck.clienteTelefone.replace(/\D/g,'')}`}
                onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-0.5 rounded transition-colors">
                WhatsApp
              </a>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={11} /> {ck.criadoEm}</span>
            <span className="flex items-center gap-1"><Car size={11} /> {ck.numero}</span>
            {ck.luzesPainel?.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle size={11} /> {ck.luzesPainel.length} luz(es)
              </span>
            )}
            {ck.tecnicoNome && (
              <span className="text-blue-600 font-medium">🔧 {ck.tecnicoNome}</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            aguardando ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {aguardando ? 'Aguardando' : 'Em diagnóstico'}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Realizar Diagnóstico</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendentes.length === 0
              ? 'Nenhum veículo aguardando diagnóstico'
              : `${pendentes.length} veículo(s) na fila`}
          </p>
        </div>
        {pendentes.length > 0 && (
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
            {pendentes.length}
          </div>
        )}
      </div>

      {/* Busca */}
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

      {/* Fila de pendentes */}
      {pendentesFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <ClipboardCheck size={32} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum veículo na fila</p>
          <p className="text-slate-400 text-sm mt-1">
            {busca ? 'Tente outro termo de busca.' : 'Todos os diagnósticos estão em dia!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendentesFiltrados.map(ck => <Card key={ck.id} ck={ck} />)}
        </div>
      )}

      {/* Histórico de concluídos */}
      {concluidosFiltrados.length > 0 && (
        <div className="mt-8 opacity-70">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} /> Histórico — Concluídos ({concluidosFiltrados.length})
          </h3>
          <div className="space-y-2">
            {concluidosFiltrados.map(ck => (
              <button key={ck.id} onClick={() => navigate(`/checklist/diagnostico/${ck.id}`)}
                className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 text-left flex items-center justify-between text-sm transition-colors">
                <div>
                  <span className="font-semibold text-slate-700">{ck.veiculoModelo || '—'}</span>
                  <span className="text-slate-400 ml-2 font-mono">{ck.veiculoPlaca}</span>
                  <span className="text-slate-400 ml-2">· {ck.clienteNome}</span>
                </div>
                <span className="text-xs text-slate-400">{ck.criadoEm?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

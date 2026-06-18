import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Plus, Search, Clock, CheckCircle2, Wrench, Car, User } from 'lucide-react'
import { useApp } from '../context/AppContext'

const STATUS_CONFIG = {
  'Aguardando diagnóstico': { label: 'Aguardando', cor: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  'Em diagnóstico':         { label: 'Em diagnóstico', cor: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  'Diagnóstico concluído':  { label: 'Concluído', cor: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

const ABAS = ['Todos', 'Aguardando diagnóstico', 'Em diagnóstico', 'Diagnóstico concluído']

export default function Checklist() {
  const { checklists, getCliente, getVeiculo } = useApp()
  const navigate = useNavigate()
  const [aba, setAba] = useState('Todos')
  const [busca, setBusca] = useState('')

  const filtrados = checklists
    .filter(c => aba === 'Todos' || c.status === aba)
    .filter(c => {
      if (!busca) return true
      const q = busca.toLowerCase()
      return (
        c.numero?.toLowerCase().includes(q) ||
        c.clienteNome?.toLowerCase().includes(q) ||
        c.veiculoInfo?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.id - a.id)

  const contagem = (status) => checklists.filter(c => c.status === status).length

  return (
    <div className="p-6 space-y-5">
      {/* Topo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Checklist de Entrada</h2>
          <p className="text-sm text-slate-500 mt-0.5">Recepção e diagnóstico de veículos</p>
        </div>
        <button
          onClick={() => navigate('/checklist/novo')}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Novo Checklist
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { status: 'Aguardando diagnóstico', label: 'Aguardando', icon: Clock, cor: 'text-amber-500', bg: 'bg-amber-50' },
          { status: 'Em diagnóstico',         label: 'Em diagnóstico', icon: Wrench, cor: 'text-blue-500', bg: 'bg-blue-50' },
          { status: 'Diagnóstico concluído',  label: 'Concluídos', icon: CheckCircle2, cor: 'text-green-500', bg: 'bg-green-50' },
        ].map(({ status, label, icon: Icon, cor, bg }) => (
          <button
            key={status}
            onClick={() => setAba(aba === status ? 'Todos' : status)}
            className={`rounded-2xl p-4 text-left border transition-all ${aba === status ? 'border-primary-300 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'} bg-white`}
          >
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={cor} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{contagem(status)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filtro busca + abas */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número, cliente ou veículo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {ABAS.map(a => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                aba === a ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {a === 'Todos' ? `Todos (${checklists.length})` : STATUS_CONFIG[a]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <ClipboardCheck size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Nenhum checklist encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Clique em "Novo Checklist" para iniciar a recepção de um veículo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(ck => {
            const cfg = STATUS_CONFIG[ck.status] || STATUS_CONFIG['Aguardando diagnóstico']
            return (
              <button
                key={ck.id}
                onClick={() => navigate(`/checklist/${ck.id}`)}
                className="w-full bg-white border border-slate-200 hover:border-primary-300 hover:shadow-sm rounded-2xl p-4 text-left transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck size={18} className="text-primary-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-sm">{ck.numero}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><User size={12} />{ck.clienteNome || 'Sem cliente'}</span>
                    <span className="flex items-center gap-1"><Car size={12} />{ck.veiculoInfo || 'Sem veículo'}</span>
                    {ck.kmEntrada && <span>KM {ck.kmEntrada}</span>}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{ck.criadoEm?.split(' ')[0]}</p>
                  {ck.luzesPainel?.length > 0 && (
                    <p className="text-xs text-amber-500 mt-0.5">{ck.luzesPainel.length} luz(es)</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

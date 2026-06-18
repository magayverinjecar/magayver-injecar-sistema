import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Search, Car, User, Clock, Image, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

const STATUS_COR = {
  'Aguardando diagnóstico': 'bg-amber-100 text-amber-700',
  'Em diagnóstico':         'bg-blue-100 text-blue-700',
  'Diagnóstico concluído':  'bg-green-100 text-green-700',
}

export default function ChecklistFotos() {
  const { checklists } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')

  const lista = checklists
    .filter(c => {
      if (!busca) return true
      const q = busca.toLowerCase()
      return c.clienteNome?.toLowerCase().includes(q) || c.veiculoPlaca?.toLowerCase().includes(q) || c.veiculoModelo?.toLowerCase().includes(q)
    })
    .sort((a, b) => b.id - a.id)

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Fotos e Vistoria</h2>
        <p className="text-sm text-slate-500 mt-0.5">Anexe fotos e registre a vistoria dos veículos</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-3 text-slate-400" />
        <input type="text" placeholder="Buscar por placa, cliente ou modelo..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Camera size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Nenhum veículo encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Crie uma nova entrada para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(ck => (
            <button key={ck.id} onClick={() => navigate(`/checklist/fotos/${ck.id}`)}
              className="w-full bg-white border border-slate-200 hover:border-cyan-300 hover:shadow-sm rounded-2xl p-4 text-left transition-all flex items-center gap-4">

              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
                <Camera size={18} className="text-cyan-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800 text-sm">{ck.veiculoModelo || ck.veiculoInfo || '—'}</span>
                  {ck.veiculoPlaca && (
                    <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{ck.veiculoPlaca}</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COR[ck.status] || 'bg-slate-100 text-slate-500'}`}>
                    {ck.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><User size={11} /> {ck.clienteNome || '—'}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {ck.criadoEm?.split(' ')[0]}</span>
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Image size={14} className={ck.fotos?.length ? 'text-cyan-500' : 'text-slate-300'} />
                  <span className={ck.fotos?.length ? 'text-cyan-600' : 'text-slate-300'}>
                    {ck.fotos?.length || 0} foto(s)
                  </span>
                </div>
                {ck.inspecaoVisual?.length > 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1 justify-end mt-0.5">
                    <CheckCircle2 size={11} /> Vistoria feita
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

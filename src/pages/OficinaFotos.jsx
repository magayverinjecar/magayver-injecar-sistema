import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Search, User, Clock, Image, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { statusColor } from './OrdensServico'
import { momentoEntrada, dataEntradaLegivel, nomeVeiculo } from '../utils/datas'
import { fotosDaEntrada, fotosDoReparo } from '../utils/vistoria'

// Carro que já saiu não precisa mais de vistoria de entrada
const FORA = ['Entregue', 'Cancelada']

export default function OficinaFotos() {
  const { ordens, getCliente, getVeiculo, carregando } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')

  const lista = ordens
    .filter(o => !FORA.includes(o.status) && !o.retirado)
    .map(o => {
      const veic = getVeiculo(o.veiculoId)
      const cli = getCliente(o.clienteId)
      const fotos = fotosDaEntrada(o.fotos).length
      const fotosReparo = fotosDoReparo(o.fotos).length
      const vistoriado = (o.inspecaoVisual || []).some(i => i.status)
      return {
        ...o,
        placa: veic?.placa || o.veiculoPlaca || '',
        modelo: nomeVeiculo(veic, o),
        cliente: cli?.nome || o.clienteNome || '—',
        fotos,
        fotosReparo,
        vistoriado,
        entrouEm: momentoEntrada(o),
        dataEntradaTexto: dataEntradaLegivel(o),
        // Carro recém-chegado ainda sem registro é o que corre risco
        pendente: fotos === 0 || !vistoriado,
      }
    })
    .filter(o => {
      if (!busca.trim()) return true
      const q = busca.toLowerCase()
      return o.cliente.toLowerCase().includes(q)
        || o.placa.toLowerCase().includes(q)
        || o.modelo.toLowerCase().includes(q)
    })
    // Último a dar entrada aparece primeiro — é o que acabou de chegar e precisa de foto
    .sort((a, b) => b.entrouEm - a.entrouEm)

  const pendentes = lista.filter(o => o.pendente).length

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando...</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Fotos e Vistoria</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {pendentes > 0
            ? `${pendentes} veículo(s) sem registro completo`
            : 'Todos os veículos do pátio já têm foto e vistoria'}
        </p>
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
          <p className="text-slate-500 font-medium">Nenhum veículo no pátio</p>
          <p className="text-slate-400 text-sm mt-1">Registre uma nova entrada para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(os => (
            <button key={os.id} onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
              className={`w-full bg-white border rounded-2xl p-4 text-left transition-all flex items-center gap-4 hover:shadow-sm ${
                os.pendente ? 'border-amber-200 hover:border-amber-400' : 'border-slate-200 hover:border-cyan-300'
              }`}>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${os.pendente ? 'bg-amber-50' : 'bg-cyan-50'}`}>
                <Camera size={18} className={os.pendente ? 'text-amber-500' : 'text-cyan-500'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-slate-800 text-sm">{os.modelo}</span>
                  {os.placa && (
                    <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{os.placa}</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[os.status] || 'bg-slate-100 text-slate-500'}`}>
                    {os.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><User size={11} /> {os.cliente}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {os.dataEntradaTexto}</span>
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-1.5 text-sm font-semibold justify-end">
                  <Image size={14} className={os.fotos ? 'text-cyan-500' : 'text-amber-500'} />
                  <span className={os.fotos ? 'text-cyan-600' : 'text-amber-600'}>
                    {os.fotos} foto(s)
                  </span>
                </div>
                {os.vistoriado ? (
                  <p className="text-xs text-green-600 flex items-center gap-1 justify-end mt-0.5">
                    <CheckCircle2 size={11} /> Vistoria feita
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1 justify-end mt-0.5">
                    <AlertTriangle size={11} /> Sem vistoria
                  </p>
                )}
                {os.fotosReparo > 0 && (
                  <p className="text-xs text-orange-600 flex items-center gap-1 justify-end mt-0.5">
                    <Wrench size={11} /> {os.fotosReparo} do reparo
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

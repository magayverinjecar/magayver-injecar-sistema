import { useState } from 'react'
import { Search, Plus, Car, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { placa: '', modelo: '', ano: '', cor: '', clienteId: '', km: '' }

export default function Veiculos() {
  const { veiculos, setVeiculos, clientes, getCliente, ordensPorVeiculo } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)

  const filtrados = veiculos.filter(v => {
    const cliente = getCliente(v.clienteId)
    return (
      v.modelo.toLowerCase().includes(busca.toLowerCase()) ||
      v.placa.toLowerCase().includes(busca.toLowerCase()) ||
      cliente?.nome.toLowerCase().includes(busca.toLowerCase())
    )
  })

  function salvar() {
    if (!form.placa.trim() || !form.modelo.trim()) return
    setVeiculos(prev => [...prev, { ...form, id: Date.now(), clienteId: Number(form.clienteId) || null }])
    setForm(vazio)
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir este veículo?')) setVeiculos(prev => prev.filter(v => v.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar placa, modelo ou cliente..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-72" />
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Veículo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map(v => {
          const cliente = getCliente(v.clienteId)
          const ordens = ordensPorVeiculo(v.id)
          return (
            <div key={v.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Car size={20} className="text-slate-500" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{v.placa}</span>
                  <button onClick={() => excluir(v.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-slate-800">{v.modelo}</p>
              <p className="text-sm text-slate-400">{v.ano}{v.cor ? ` • ${v.cor}` : ''}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Proprietário</p>
                  <p className="text-xs font-medium text-slate-700">{cliente?.nome || '—'}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">KM atual</p>
                  <p className="text-xs text-slate-600">{v.km || '—'}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">OS realizadas</p>
                  <p className="text-xs font-semibold text-primary-600">{ordens.length}</p>
                </div>
              </div>
            </div>
          )
        })}
        {filtrados.length === 0 && <p className="text-sm text-slate-400 py-4">Nenhum veículo encontrado.</p>}
      </div>

      {modal && (
        <Modal title="Novo Veículo" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proprietário</label>
              <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Selecione o cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placa *</label>
                <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value }))} placeholder="ABC-1234" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label>
                <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Honda Civic" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ano</label>
                <input value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} placeholder="2020" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cor</label>
                <input value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} placeholder="Prata" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">KM</label>
                <input value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} placeholder="45.000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

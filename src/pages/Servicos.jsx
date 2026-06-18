import { useState } from 'react'
import { Plus, Search, Wrench, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { nome: '', categoria: '', preco: '', tempo: '' }

export default function Servicos() {
  const { servicos, setServicos } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)

  const filtrados = servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))

  function salvar() {
    if (!form.nome.trim()) return
    setServicos(prev => [...prev, { ...form, id: Date.now() }])
    setForm(vazio)
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir serviço?')) setServicos(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar serviço..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Serviço
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                <Wrench size={16} className="text-primary-500" />
              </div>
              <div className="flex items-center gap-2">
                {s.categoria && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{s.categoria}</span>}
                <button onClick={() => excluir(s.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="font-semibold text-slate-800 mb-1">{s.nome}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-lg font-bold text-primary-600">R$ {s.preco}</span>
              {s.tempo && <span className="text-xs text-slate-400">⏱ {s.tempo}</span>}
            </div>
          </div>
        ))}
        {filtrados.length === 0 && <p className="text-sm text-slate-400 py-4">Nenhum serviço cadastrado.</p>}
      </div>

      {modal && (
        <Modal title="Novo Serviço" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Troca de Óleo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Manutenção, Freios..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
                <input value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tempo estimado</label>
                <input value={form.tempo} onChange={e => setForm(f => ({ ...f, tempo: e.target.value }))} placeholder="1h30" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

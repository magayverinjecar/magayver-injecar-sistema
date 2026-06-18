import { useState } from 'react'
import { Search, Plus, AlertTriangle, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { codigo: '', nome: '', categoria: '', estoque: '', minimo: '', preco: '' }

export default function Estoque() {
  const { estoque, setEstoque } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)

  const filtrados = estoque.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (i.codigo || '').toLowerCase().includes(busca.toLowerCase())
  )

  const emFalta = estoque.filter(i => Number(i.estoque) <= Number(i.minimo)).length

  function salvar() {
    if (!form.nome.trim()) return
    setEstoque(prev => [...prev, { ...form, id: Date.now(), estoque: Number(form.estoque) || 0, minimo: Number(form.minimo) || 0 }])
    setForm(vazio)
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir este item?')) setEstoque(prev => prev.filter(i => i.id !== id))
  }

  function ajustar(id, delta) {
    setEstoque(prev => prev.map(i => i.id === id ? { ...i, estoque: Math.max(0, Number(i.estoque) + delta) } : i))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar peça ou código..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova Peça
        </button>
      </div>

      {emFalta > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-2.5 rounded-lg">
          <AlertTriangle size={16} />
          <span><strong>{emFalta} {emFalta === 1 ? 'item' : 'itens'}</strong> com estoque abaixo do mínimo</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Produto</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estoque</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Preço</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrados.map(item => {
              const baixo = Number(item.estoque) <= Number(item.minimo)
              return (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{item.codigo || '—'}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{item.nome}</td>
                  <td className="px-5 py-3.5"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{item.categoria || '—'}</span></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {baixo && <AlertTriangle size={13} className="text-yellow-500" />}
                      <button onClick={() => ajustar(item.id, -1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm flex items-center justify-center">−</button>
                      <span className={`text-sm font-semibold w-6 text-center ${baixo ? 'text-yellow-600' : 'text-slate-700'}`}>{item.estoque}</span>
                      <button onClick={() => ajustar(item.id, 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm flex items-center justify-center">+</button>
                      <span className="text-xs text-slate-400">mín: {item.minimo}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">R$ {item.preco}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => excluir(item.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum item encontrado.</p>}
      </div>

      {modal && (
        <Modal title="Nova Peça / Item" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="FLT-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Filtros, Óleos..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Filtro de Óleo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Inicial</label>
                <input type="number" value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Mínima</label>
                <input type="number" value={form.minimo} onChange={e => setForm(f => ({ ...f, minimo: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
                <input value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

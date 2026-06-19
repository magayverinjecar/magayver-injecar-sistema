import { useState } from 'react'
import { Search, Plus, AlertTriangle, Trash2, Pencil } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { codigo: '', nome: '', categoria: '', estoque: '', minimo: '', precoCusto: '', preco: '' }

export default function Estoque() {
  const { estoque, setEstoque } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState(null) // item sendo editado

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

  function abrirEdicao(item) {
    setEditando({ ...item, estoque: String(item.estoque), minimo: String(item.minimo) })
  }

  function salvarEdicao() {
    if (!editando.nome.trim()) return
    setEstoque(prev => prev.map(i => i.id === editando.id
      ? { ...editando, estoque: Number(editando.estoque) || 0, minimo: Number(editando.minimo) || 0 }
      : i
    ))
    setEditando(null)
  }

  function excluir(id) {
    if (confirm('Excluir este item?')) setEstoque(prev => prev.filter(i => i.id !== id))
  }

  function ajustar(id, delta) {
    setEstoque(prev => prev.map(i => i.id === id ? { ...i, estoque: Math.max(0, Number(i.estoque) + delta) } : i))
  }

  const camposForm = (f, set) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
          <input value={f.codigo} onChange={e => set(x => ({ ...x, codigo: e.target.value }))} placeholder="FLT-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <input value={f.categoria} onChange={e => set(x => ({ ...x, categoria: e.target.value }))} placeholder="Filtros, Óleos..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto *</label>
        <input value={f.nome} onChange={e => set(x => ({ ...x, nome: e.target.value }))} placeholder="Ex: Filtro de Óleo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. em Estoque</label>
          <input type="number" value={f.estoque} onChange={e => set(x => ({ ...x, estoque: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Mínima</label>
          <input type="number" value={f.minimo} onChange={e => set(x => ({ ...x, minimo: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo (R$)</label>
          <input value={f.precoCusto} onChange={e => set(x => ({ ...x, precoCusto: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Venda (R$)</label>
          <input value={f.preco} onChange={e => set(x => ({ ...x, preco: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar peça ou código..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        </div>
        <button onClick={() => { setForm(vazio); setModal(true) }} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Custo</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Venda</th>
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
                  <td className="px-5 py-3.5 text-sm text-slate-700">{item.precoCusto ? `R$ ${item.precoCusto}` : '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">R$ {item.preco}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEdicao(item)} className="p-1.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400 transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluir(item.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum item encontrado.</p>}
      </div>

      {/* Modal Nova Peça */}
      {modal && (
        <Modal title="Nova Peça / Item" onClose={() => setModal(false)}>
          {camposForm(form, setForm)}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
          </div>
        </Modal>
      )}

      {/* Modal Editar Peça */}
      {editando && (
        <Modal title="Editar Peça" onClose={() => setEditando(null)}>
          {camposForm(editando, setEditando)}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setEditando(null)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={salvarEdicao} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar Alterações</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

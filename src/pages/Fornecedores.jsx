import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, X, CheckCircle, Circle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useApp } from '../context/AppContext'

const VAZIO = { nome: '', cnpj: '', contato: '', telefone: '', email: '', endereco: '', ativo: true }

export default function Fornecedores() {
  const { fornecedores, setFornecedores } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)

  const filtrados = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj || '').includes(busca)
  )

  function abrirNovo() {
    setForm(VAZIO)
    setEditId(null)
    setModal(true)
  }

  function abrirEditar(f) {
    setForm({ ...VAZIO, ...f })
    setEditId(f.id)
    setModal(true)
  }

  function salvar() {
    if (!form.nome.trim()) return
    if (editId) {
      setFornecedores(prev => prev.map(f => f.id === editId ? { ...f, ...form } : f))
    } else {
      setFornecedores(prev => [...prev, { ...form, id: Date.now() }])
    }
    setModal(false)
    setForm(VAZIO)
    setEditId(null)
  }

  function excluir(id) {
    if (confirm('Excluir este fornecedor?')) setFornecedores(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Fornecedores</h2>
        <button onClick={abrirNovo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Fornecedor
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhum fornecedor cadastrado.</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CNPJ</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contato</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ativo</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{f.nome}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{f.cnpj || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{f.contato || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{f.telefone || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      {f.ativo !== false
                        ? <CheckCircle size={16} className="text-green-500 mx-auto" />
                        : <Circle size={16} className="text-slate-300 mx-auto" />}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditar(f)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-primary-500 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => excluir(f.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
              <span>1–{filtrados.length} de {filtrados.length}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs">Por página: 25</span>
                <div className="flex items-center gap-1 text-slate-300">
                  <ChevronsLeft size={16} /><ChevronLeft size={16} />
                  <span className="text-slate-600 px-1">1 / 1</span>
                  <ChevronRight size={16} /><ChevronsRight size={16} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                  <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contato</label>
                  <input value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
                <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.ativo ? 'bg-primary-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-slate-600">Ativo</span>
              </div>
            </div>
            <div className="px-5 py-4">
              <button onClick={salvar} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                {editId ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

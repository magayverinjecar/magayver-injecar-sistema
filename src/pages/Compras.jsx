import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useApp } from '../context/AppContext'

const statusColor = {
  Rascunho: 'bg-slate-100 text-slate-600',
  Pedido: 'bg-blue-100 text-blue-700',
  Recebida: 'bg-green-100 text-green-700',
  Cancelada: 'bg-red-100 text-red-700',
}

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Compras() {
  const { compras, criarCompra } = useApp()
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('Todos')

  const filtradas = filtro === 'Todos' ? compras : compras.filter(c => c.status === filtro)

  function nova() {
    const id = criarCompra()
    navigate(`/compras/${id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Compras</h2>
        <button onClick={nova} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova Compra
        </button>
      </div>

      <select value={filtro} onChange={e => setFiltro(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option>Todos</option>
        <option>Rascunho</option>
        <option>Pedido</option>
        <option>Recebida</option>
        <option>Cancelada</option>
      </select>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {filtradas.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhuma compra registrada.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nº</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fornecedor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Pedido</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtradas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/compras/${c.id}`)}>
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{c.numero}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{c.fornecedorNome || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700">{fmt(c.total)}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{c.data}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end">
                      <button onClick={e => { e.stopPropagation(); navigate(`/compras/${c.id}`) }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filtradas.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>1–{filtradas.length} de {filtradas.length}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs">Por página: 25</span>
              <div className="flex items-center gap-1 text-slate-300">
                <ChevronsLeft size={16} /><ChevronLeft size={16} />
                <span className="text-slate-600 px-1">1 / 1</span>
                <ChevronRight size={16} /><ChevronsRight size={16} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

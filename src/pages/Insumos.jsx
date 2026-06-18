import { useState } from 'react'
import { Plus, Search, Pencil, ArrowUpDown, AlertTriangle, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useApp } from '../context/AppContext'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function parseNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

const INICIAL = [
  { id: 1, nome: 'Sabão', marca: 'Norte', codigo: '', custo: '10,00', estoque: 1, minimo: 1, descricao: '' },
]

const VAZIO = { nome: '', marca: '', codigo: '', custo: '', estoque: '0', minimo: '', descricao: '' }

export default function Insumos() {
  const { adicionarLancamento } = useApp()
  const [insumos, setInsumos] = useLocalStorage('insumos', INICIAL)
  const [busca, setBusca] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)
  const [modalMov, setModalMov] = useState(null)
  const [movQtd, setMovQtd] = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [movLancarFinanceiro, setMovLancarFinanceiro] = useState(false)

  const filtrados = insumos.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (i.marca || '').toLowerCase().includes(busca.toLowerCase()) ||
    (i.descricao || '').toLowerCase().includes(busca.toLowerCase())
  )

  const criticos = insumos.filter(i => Number(i.estoque) <= Number(i.minimo)).length

  function abrirNovo() {
    setForm(VAZIO); setEditId(null); setModalNovo(true)
  }
  function abrirEditar(i) {
    setForm({ ...VAZIO, ...i, estoque: String(i.estoque), minimo: String(i.minimo) })
    setEditId(i.id); setModalNovo(true)
  }
  function salvarInsumo() {
    if (!form.nome.trim()) return
    if (editId) {
      setInsumos(prev => prev.map(i => i.id === editId ? { ...i, ...form, estoque: Number(form.estoque) || 0, minimo: Number(form.minimo) || 0 } : i))
    } else {
      setInsumos(prev => [...prev, { ...form, id: Date.now(), estoque: Number(form.estoque) || 0, minimo: Number(form.minimo) || 0 }])
    }
    setModalNovo(false); setForm(VAZIO); setEditId(null)
  }

  function abrirMov(i) {
    setModalMov(i); setMovQtd(''); setMovMotivo(''); setMovLancarFinanceiro(false)
  }
  function confirmarMov() {
    const delta = parseInt(movQtd, 10)
    if (isNaN(delta) || delta === 0) return
    setInsumos(prev => prev.map(i => i.id === modalMov.id ? { ...i, estoque: Math.max(0, Number(i.estoque) + delta) } : i))
    // consumo (delta negativo) com opção de lançar no financeiro
    if (delta < 0 && movLancarFinanceiro && parseNum(modalMov.custo) > 0) {
      const valorTotal = parseNum(modalMov.custo) * Math.abs(delta)
      adicionarLancamento({
        descricao: `Consumo insumo - ${modalMov.nome}${movMotivo ? ` (${movMotivo})` : ''}`,
        tipo: 'despesa',
        valor: valorTotal.toFixed(2).replace('.', ','),
      })
    }
    setModalMov(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Insumos</h2>
          <p className="text-sm text-slate-500">Controle de materiais consumíveis e suprimentos.</p>
        </div>
        <button onClick={abrirNovo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Insumo
        </button>
      </div>

      {criticos > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-2.5 rounded-lg">
          <AlertTriangle size={16} />
          <span><strong>{criticos} insumo(s)</strong> com estoque crítico</span>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar por nome, marca ou descrição..." value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhum insumo cadastrado.</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Insumo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marca</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd Atual</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mínimo</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Custo Unit.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map(i => {
                  const critico = Number(i.estoque) <= Number(i.minimo)
                  return (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{i.nome}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{i.marca || '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-sm font-semibold ${critico ? 'text-yellow-600' : 'text-slate-700'}`}>{i.estoque}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm text-slate-500">{i.minimo}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-700">{fmt(parseNum(i.custo))}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => abrirMov(i)} className="flex items-center gap-1 text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                            <ArrowUpDown size={13} />Movim.
                          </button>
                          <button onClick={() => abrirEditar(i)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-primary-500 transition-colors">
                            <Pencil size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

      {/* Modal Novo/Editar Insumo */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalNovo(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editId ? 'Editar Insumo' : 'Novo Insumo'}</h3>
              <button onClick={() => setModalNovo(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Insumo *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Graxa Azul, Limpa Contato..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                  <input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno</label>
                  <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço Custo (R$)</label>
                  <input value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))}
                    placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Qtd Inicial</label>
                  <input type="number" value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))}
                    disabled={!!editId}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo</label>
                  <input type="number" value={form.minimo} onChange={e => setForm(f => ({ ...f, minimo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição / Observações</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 flex gap-3 justify-end">
              <button onClick={() => setModalNovo(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvarInsumo} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {editId ? 'Salvar' : 'Cadastrar Insumo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Movimentar */}
      {modalMov && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalMov(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Movimentar Insumo: {modalMov.nome}</h3>
              <button onClick={() => setModalMov(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade a adicionar ou remover</label>
                <input type="number" value={movQtd} onChange={e => setMovQtd(e.target.value)}
                  placeholder="Use negativo (-) para remover (consumo)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <p className="text-xs text-slate-400 mt-1">Estoque atual: <strong>{modalMov.estoque}</strong> • Custo unit.: R$ {modalMov.custo || '0,00'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Observação</label>
                <input value={movMotivo} onChange={e => setMovMotivo(e.target.value)}
                  placeholder="Ex: Compra lote novo, uso em serviço..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              {parseInt(movQtd, 10) < 0 && parseNum(modalMov.custo) > 0 && (
                <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <button onClick={() => setMovLancarFinanceiro(v => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${movLancarFinanceiro ? 'bg-primary-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${movLancarFinanceiro ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Lançar como despesa no Financeiro</p>
                    <p className="text-xs text-slate-500">
                      Valor: R$ {(parseNum(modalMov.custo) * Math.abs(parseInt(movQtd, 10) || 0)).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 flex gap-3 justify-end">
              <button onClick={() => setModalMov(null)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmarMov} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Confirmar Movimentação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

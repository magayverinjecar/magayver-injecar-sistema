import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Trash2, Package, Save } from 'lucide-react'
import { useApp } from '../context/AppContext'

const statusColor = {
  Rascunho: 'bg-slate-100 text-slate-600',
  Pedido: 'bg-blue-100 text-blue-700',
  Recebida: 'bg-green-100 text-green-700',
  Cancelada: 'bg-red-100 text-red-700',
}

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function parseNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

const VAZIO_ITEM = { produtoId: '', descricao: '', codigo: '', quantidade: '1', valorUnitario: '' }

export default function CompraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { compras, atualizarCompra, receberCompra, excluirCompra, fornecedores, estoque } = useApp()

  const compra = compras.find(c => c.id === Number(id))
  const [modalItem, setModalItem] = useState(false)
  const [item, setItem] = useState(VAZIO_ITEM)
  const [salvo, setSalvo] = useState(false)

  if (!compra) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-400">Compra não encontrada.</p>
        <button onClick={() => navigate('/compras')} className="mt-3 text-primary-500 text-sm font-medium">Voltar para Compras</button>
      </div>
    )
  }

  const recebida = compra.recebida
  const totalCompra = compra.itens.reduce((s, it) => s + parseNum(it.valorUnitario) * parseNum(it.quantidade), 0)
  const subtotalItem = parseNum(item.valorUnitario) * parseNum(item.quantidade)

  function salvarDados(campo, valor) {
    if (campo === 'fornecedorId') {
      const f = fornecedores.find(x => x.id === Number(valor))
      atualizarCompra(compra.id, { fornecedorId: valor, fornecedorNome: f?.nome || '' })
    } else {
      atualizarCompra(compra.id, { [campo]: valor })
    }
  }

  function salvarManual() {
    atualizarCompra(compra.id, { total: totalCompra })
    setSalvo(true)
    setTimeout(() => setSalvo(false), 1500)
  }

  function selecionarProduto(pid) {
    if (!pid) { setItem(it => ({ ...it, produtoId: '' })); return }
    const p = estoque.find(x => x.id === Number(pid))
    if (p) setItem(it => ({ ...it, produtoId: pid, descricao: p.nome, codigo: p.codigo, valorUnitario: p.preco }))
  }

  function adicionarItem() {
    if (!item.descricao.trim()) return
    const novosItens = [...compra.itens, { ...item, id: Date.now() }]
    const novoTotal = novosItens.reduce((s, it) => s + parseNum(it.valorUnitario) * parseNum(it.quantidade), 0)
    atualizarCompra(compra.id, { itens: novosItens, total: novoTotal })
    setItem(VAZIO_ITEM)
    setModalItem(false)
  }

  function removerItem(itemId) {
    const novosItens = compra.itens.filter(i => i.id !== itemId)
    const novoTotal = novosItens.reduce((s, it) => s + parseNum(it.valorUnitario) * parseNum(it.quantidade), 0)
    atualizarCompra(compra.id, { itens: novosItens, total: novoTotal })
  }

  function confirmar() {
    if (compra.itens.length === 0) { alert('Adicione itens antes de receber.'); return }
    if (confirm(`Confirmar recebimento? Isso dará entrada no estoque e gerará uma conta a pagar de ${fmt(totalCompra)}.`)) {
      receberCompra(compra.id)
    }
  }

  function excluir() {
    if (confirm('Excluir esta compra?')) {
      excluirCompra(compra.id)
      navigate('/compras')
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/compras')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Compra {compra.numero}</h2>
            <p className="text-xs text-slate-400">Pedido em {compra.data}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[compra.status]}`}>{compra.status}</span>
          {!recebida && (
            <button onClick={excluir} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Dados da Compra */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Dados da Compra</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
            <select value={compra.fornecedorId} onChange={e => salvarDados('fornecedorId', e.target.value)} disabled={recebida}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50">
              <option value="">Selecione o fornecedor</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={compra.status} onChange={e => salvarDados('status', e.target.value)} disabled={recebida}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50">
              <option>Rascunho</option>
              <option>Pedido</option>
              <option>Recebida</option>
              <option>Cancelada</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea value={compra.observacoes} onChange={e => salvarDados('observacoes', e.target.value)} disabled={recebida}
            rows={2} placeholder="Notas, NF, etc..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:bg-slate-50" />
        </div>
        {!recebida && (
          <div className="flex justify-end">
            <button onClick={salvarManual} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Save size={15} />{salvo ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* Itens da Compra */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Itens da Compra</h3>
          {!recebida && (
            <button onClick={() => { setItem(VAZIO_ITEM); setModalItem(true) }} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={15} />Adicionar Item
            </button>
          )}
        </div>

        {compra.itens.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">Nenhum item adicionado</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Produto / Descrição</th>
                <th className="text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor Unit.</th>
                <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {compra.itens.map(it => (
                <tr key={it.id}>
                  <td className="py-3">
                    <p className="text-sm font-medium text-slate-800">{it.descricao}</p>
                    {it.codigo && <p className="text-xs text-slate-400">Cód: {it.codigo}</p>}
                  </td>
                  <td className="py-3 text-center text-sm text-slate-600">{it.quantidade}</td>
                  <td className="py-3 text-right text-sm text-slate-600">{fmt(parseNum(it.valorUnitario))}</td>
                  <td className="py-3 text-right text-sm font-semibold text-slate-700">{fmt(parseNum(it.valorUnitario) * parseNum(it.quantidade))}</td>
                  <td className="py-3 text-right">
                    {!recebida && (
                      <button onClick={() => removerItem(it.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100">
                <td colSpan={3} className="py-3 text-right text-sm text-slate-500">Total da Compra</td>
                <td className="py-3 text-right text-base font-bold text-slate-800">{fmt(totalCompra)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Receber Compra */}
      {!recebida && compra.itens.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Package size={20} className="text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Receber Compra</p>
              <p className="text-sm text-slate-500">Atualiza o estoque automaticamente e gera conta a pagar de {fmt(totalCompra)}</p>
            </div>
          </div>
          <button onClick={confirmar} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Package size={15} />Confirmar Recebimento
          </button>
        </div>
      )}

      {recebida && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-700">Compra recebida</p>
            <p className="text-sm text-slate-500">Estoque atualizado e conta a pagar de {fmt(totalCompra)} lançada no Financeiro.</p>
          </div>
        </div>
      )}

      {/* Modal Adicionar Item */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalItem(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Adicionar Item</h3>
              <button onClick={() => setModalItem(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Produto do estoque (opcional)</label>
                <select value={item.produtoId} onChange={e => selecionarProduto(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Selecione ou deixe em branco</option>
                  {estoque.map(p => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input value={item.descricao} onChange={e => setItem(it => ({ ...it, descricao: e.target.value }))}
                  placeholder="Nome do produto/peça" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input type="number" value={item.quantidade} onChange={e => setItem(it => ({ ...it, quantidade: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input value={item.valorUnitario} onChange={e => setItem(it => ({ ...it, valorUnitario: e.target.value }))}
                    placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <p className="text-right text-sm text-slate-600">Subtotal: <span className="font-semibold text-slate-800">{fmt(subtotalItem)}</span></p>
            </div>
            <div className="px-5 py-4 flex gap-3">
              <button onClick={() => setModalItem(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={adicionarItem} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

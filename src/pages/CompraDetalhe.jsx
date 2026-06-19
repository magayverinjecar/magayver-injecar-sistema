import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Trash2, Package, Save, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
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
const VAZIO_NOVO = { nome: '', codigo: '', categoria: '', precoVenda: '', minimo: '0' }

export default function CompraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { compras, atualizarCompra, receberCompra, excluirCompra, fornecedores, estoque } = useApp()

  const compra = compras.find(c => c.id === Number(id))
  const [modalItem, setModalItem] = useState(false)
  const [item, setItem] = useState(VAZIO_ITEM)
  const [salvo, setSalvo] = useState(false)

  // Estados do modal de item
  const [buscarCodigo, setBuscarCodigo] = useState('')
  const [itemEncontrado, setItemEncontrado] = useState(null)
  const [cadastrarNova, setCadastrarNova] = useState(false)
  const [novoItemDados, setNovoItemDados] = useState(VAZIO_NOVO)

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

  // Busca no estoque pelo código de referência
  function handleBuscarCodigo(codigo) {
    setBuscarCodigo(codigo)
    setCadastrarNova(false)
    setNovoItemDados(VAZIO_NOVO)
    if (!codigo.trim()) {
      setItemEncontrado(null)
      setItem(VAZIO_ITEM)
      return
    }
    const found = estoque.find(p =>
      (p.codigo || '').trim().toLowerCase() === codigo.trim().toLowerCase()
    )
    if (found) {
      setItemEncontrado(found)
      setItem(it => ({
        ...it,
        produtoId: String(found.id),
        descricao: found.nome,
        codigo: found.codigo,
        valorUnitario: String(found.preco || ''),
      }))
    } else {
      setItemEncontrado(null)
      setItem(it => ({ ...it, produtoId: '', descricao: '', codigo: codigo, valorUnitario: '' }))
    }
  }

  function abrirModalItem() {
    setItem(VAZIO_ITEM)
    setBuscarCodigo('')
    setItemEncontrado(null)
    setCadastrarNova(false)
    setNovoItemDados(VAZIO_NOVO)
    setModalItem(true)
  }

  function adicionarItem() {
    const descricao = cadastrarNova ? novoItemDados.nome : item.descricao
    if (!descricao.trim()) return
    const novoItem = {
      ...item,
      descricao,
      codigo: cadastrarNova ? novoItemDados.codigo : item.codigo,
      id: Date.now(),
      ...(cadastrarNova ? { cadastrarNova: true, novoItemDados: { ...novoItemDados } } : {}),
    }
    const novosItens = [...compra.itens, novoItem]
    const novoTotal = novosItens.reduce((s, it) => s + parseNum(it.valorUnitario) * parseNum(it.quantidade), 0)
    atualizarCompra(compra.id, { itens: novosItens, total: novoTotal })
    abrirModalItem()
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

        {/* Vencimento do boleto */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento do Boleto</label>
          <input
            type="date"
            value={compra.vencimento || ''}
            onChange={e => salvarDados('vencimento', e.target.value)}
            disabled={recebida}
            className="w-full md:w-64 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
          />
          {compra.vencimento && !recebida && (() => {
            const hoje = new Date(); hoje.setHours(0,0,0,0)
            const venc = new Date(compra.vencimento + 'T00:00:00')
            const diff = Math.ceil((venc - hoje) / 86400000)
            if (diff < 0) return <p className="text-xs text-red-500 mt-1">Vencido há {Math.abs(diff)} dia(s)</p>
            if (diff === 0) return <p className="text-xs text-amber-500 mt-1">Vence hoje!</p>
            if (diff <= 3) return <p className="text-xs text-amber-500 mt-1">Vence em {diff} dia(s)</p>
            return <p className="text-xs text-slate-400 mt-1">Vence em {diff} dia(s)</p>
          })()}
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
            <button onClick={abrirModalItem} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={15} />Adicionar Item
            </button>
          )}
        </div>

        {compra.itens.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">Nenhum item adicionado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
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
                      <div className="flex items-center gap-2 mt-0.5">
                        {it.codigo && <p className="text-xs text-slate-400">Cód: {it.codigo}</p>}
                        {it.cadastrarNova && (
                          <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded">Nova peça</span>
                        )}
                        {it.produtoId && !it.cadastrarNova && (
                          <span className="text-[10px] bg-green-100 text-green-600 font-semibold px-1.5 py-0.5 rounded">No estoque</span>
                        )}
                      </div>
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
          </div>
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
              <p className="text-sm text-slate-500">
                Atualiza o estoque automaticamente e gera conta a pagar de {fmt(totalCompra)}
                {compra.vencimento && ` (venc. ${new Date(compra.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')})`}
              </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalItem(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-slate-800">Adicionar Item</h3>
              <button onClick={() => setModalItem(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Busca por código de referência */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Buscar por código / referência</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={buscarCodigo}
                    onChange={e => handleBuscarCodigo(e.target.value)}
                    placeholder="Digite o código da peça..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                </div>

                {/* Peça encontrada no estoque */}
                {buscarCodigo && itemEncontrado && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-800">{itemEncontrado.nome}</p>
                      <p className="text-xs text-green-600">Estoque atual: {itemEncontrado.estoque} un. · Preço: {fmt(itemEncontrado.preco || 0)}</p>
                    </div>
                  </div>
                )}

                {/* Peça não encontrada */}
                {buscarCodigo && !itemEncontrado && !cadastrarNova && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700">Peça não encontrada no estoque.</p>
                    </div>
                    <button
                      onClick={() => {
                        setCadastrarNova(true)
                        setNovoItemDados(d => ({ ...d, codigo: buscarCodigo }))
                        setItem(it => ({ ...it, produtoId: '', codigo: buscarCodigo }))
                      }}
                      className="text-sm font-medium text-orange-600 hover:text-orange-700 underline"
                    >
                      + Cadastrar nova peça no estoque
                    </button>
                  </div>
                )}
              </div>

              {/* Formulário de nova peça */}
              {cadastrarNova && (
                <div className="border border-orange-200 rounded-xl p-4 bg-orange-50 space-y-3">
                  <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Cadastrar nova peça no estoque</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nome da peça *</label>
                    <input
                      value={novoItemDados.nome}
                      onChange={e => setNovoItemDados(d => ({ ...d, nome: e.target.value }))}
                      placeholder="Ex: Filtro de óleo Mann W713"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Código / Referência</label>
                      <input
                        value={novoItemDados.codigo}
                        onChange={e => setNovoItemDados(d => ({ ...d, codigo: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                      <input
                        value={novoItemDados.categoria}
                        onChange={e => setNovoItemDados(d => ({ ...d, categoria: e.target.value }))}
                        placeholder="Ex: Filtros"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Preço de venda (R$)</label>
                      <input
                        value={novoItemDados.precoVenda}
                        onChange={e => setNovoItemDados(d => ({ ...d, precoVenda: e.target.value }))}
                        placeholder="0,00"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Estoque mínimo</label>
                      <input
                        type="number"
                        value={novoItemDados.minimo}
                        onChange={e => setNovoItemDados(d => ({ ...d, minimo: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quantidade e valor de compra — sempre visíveis quando há seleção */}
              {(itemEncontrado || cadastrarNova) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={e => setItem(it => ({ ...it, quantidade: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor de compra (R$)</label>
                    <input
                      value={item.valorUnitario}
                      onChange={e => setItem(it => ({ ...it, valorUnitario: e.target.value }))}
                      placeholder="0,00"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {(itemEncontrado || cadastrarNova) && (
                <p className="text-right text-sm text-slate-600">
                  Subtotal: <span className="font-semibold text-slate-800">{fmt(subtotalItem)}</span>
                </p>
              )}

              {/* Fallback: busca vazia — selecionar pelo nome */}
              {!buscarCodigo && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ou selecionar do estoque</label>
                    <select value={item.produtoId} onChange={e => {
                      const pid = e.target.value
                      if (!pid) { setItem(VAZIO_ITEM); setItemEncontrado(null); return }
                      const p = estoque.find(x => x.id === Number(pid))
                      if (p) {
                        setItemEncontrado(p)
                        setItem(it => ({ ...it, produtoId: pid, descricao: p.nome, codigo: p.codigo, valorUnitario: String(p.preco || '') }))
                        setBuscarCodigo(p.codigo || '')
                      }
                    }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">Selecione ou use o código acima</option>
                      {estoque.map(p => <option key={p.id} value={p.id}>{p.nome}{p.codigo ? ` (${p.codigo})` : ''}</option>)}
                    </select>
                  </div>
                  {itemEncontrado && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                        <input type="number" min="1" value={item.quantidade}
                          onChange={e => setItem(it => ({ ...it, quantidade: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Valor de compra (R$)</label>
                        <input value={item.valorUnitario}
                          onChange={e => setItem(it => ({ ...it, valorUnitario: e.target.value }))}
                          placeholder="0,00"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  )}
                  {itemEncontrado && (
                    <p className="text-right text-sm text-slate-600">Subtotal: <span className="font-semibold text-slate-800">{fmt(subtotalItem)}</span></p>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setModalItem(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button
                onClick={adicionarItem}
                disabled={cadastrarNova ? !novoItemDados.nome.trim() : !itemEncontrado}
                className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

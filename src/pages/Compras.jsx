import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Trash2, Upload } from 'lucide-react'
import { useApp } from '../context/AppContext'

const statusColor = {
  Rascunho: 'bg-slate-100 text-slate-600',
  Pedido: 'bg-blue-100 text-blue-700',
  Recebida: 'bg-green-100 text-green-700',
  Cancelada: 'bg-red-100 text-red-700',
}

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Na coluna de dinheiro o "R$" nao se repete: o cabecalho ja diz o que aquilo
// e, e o prefixo em toda linha empurra o numero para longe da virgula da linha
// de cima — justamente o que se compara com o olho ao correr a coluna.
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Compras() {
  const { compras, criarCompra, excluirCompra } = useApp()
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('Todos')

  const filtradas = filtro === 'Todos' ? compras : compras.filter(c => c.status === filtro)

  // Contas do rodape: somam exatamente as linhas que estao na tela, e mudam
  // junto com o filtro. Rodape que nao bate com a lista visivel e pior do que
  // rodape nenhum — ensina a desconfiar do numero.
  const totalFiltrado = filtradas.reduce((s, c) => s + (Number(c.total) || 0), 0)
  const totalItens = filtradas.reduce((s, c) => s + (c.itens?.length || 0), 0)
  const canceladas = filtradas.filter(c => c.status === 'Cancelada').length

  function nova() {
    const id = criarCompra()
    navigate(`/compras/${id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Compras</h2>
        <div className="flex items-center gap-2">
          {/* Importar vem ANTES de "Nova Compra": quando existe o XML, digitar
              item por item e o boleto a mao e trabalho jogado fora — e e onde o
              codigo e a quantidade sao errados. */}
          <button onClick={() => navigate('/compras/importar')}
            className="flex items-center gap-2 border border-primary-300 text-primary-700 hover:bg-primary-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Upload size={16} />Importar XML
          </button>
          <button onClick={nova} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />Nova Compra
          </button>
        </div>
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
                {/* Quantas linhas a compra tem so aparecia depois de abrir, e e
                    o que separa o rascunho vazio do pedido pronto para receber.
                    O dado ja estava no registro — faltava na lista. */}
                <th className="hidden lg:table-cell text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Itens</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor (R$)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Pedido</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtradas.map(c => {
                const qtdItens = c.itens?.length || 0
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/compras/${c.id}`)}>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{c.numero}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{c.fornecedorNome || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[c.status]}`}>{c.status}</span>
                    </td>
                    {/* Zero fica apagado de proposito: e a compra que ninguem
                        terminou de montar, nao um numero a conferir. */}
                    <td className="hidden lg:table-cell px-5 py-3.5 text-right text-sm text-slate-600 tabular-nums">
                      {qtdItens === 0 ? <span className="text-slate-300">0</span> : qtdItens}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700 tabular-nums">{fmtNum(c.total)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{c.data}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => { e.stopPropagation(); navigate(`/compras/${c.id}`) }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Ver / Editar">
                          <Eye size={16} />
                        </button>
                        <button onClick={e => {
                          e.stopPropagation()
                          const msg = c.recebida
                            ? `A compra ${c.numero} já foi recebida. Excluir vai RETIRAR do estoque o que entrou com ela e apagar os lançamentos financeiros dela. Confirmar exclusão?`
                            : `Excluir compra ${c.numero}?`
                          if (confirm(msg)) excluirCompra(c.id)
                        }} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Rodape de sistema no lugar da paginacao que ficava aqui: "Por
            pagina: 25", "1 / 1" e as setas eram enfeite — a lista sempre veio
            inteira, e o rodape falso mandava procurar uma pagina 2 que nao
            existe. Ficam os numeros que se pergunta olhando a tela. */}
        {filtradas.length > 0 && (
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {filtradas.length} {filtradas.length === 1 ? 'compra' : 'compras'}
              {filtro !== 'Todos' && ` (de ${compras.length})`}
              {/* O total soma tudo que esta na tela, cancelada inclusive. Tirar
                  as canceladas da conta por baixo do pano faria o rodape
                  discordar da coluna, entao o aviso fica a vista. */}
              {canceladas > 0 && <span className="ml-2 text-red-700">· inclui {canceladas} cancelada{canceladas > 1 ? 's' : ''}</span>}
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              <span>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
              <span>Total: <strong className="font-medium">{fmt(totalFiltrado)}</strong></span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

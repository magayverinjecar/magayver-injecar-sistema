import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Wrench, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { parseValorBR } from '../utils/numero'

const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Servicos() {
  const navigate = useNavigate()
  const { servicos, setServicos } = useApp()
  const [busca, setBusca] = useState('')

  const filtrados = servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))

  // Serviço é tabela de preço, não prateleira: somar tudo não diz nada. O que
  // o dono olha é a média da mão de obra e quantos serviços ainda estão sem
  // preço — cada um desses é uma parada no meio do orçamento para perguntar
  // "quanto é mesmo?".
  const comPreco = filtrados.filter(s => parseValorBR(s.preco) > 0)
  const precoMedio = comPreco.length
    ? comPreco.reduce((t, s) => t + parseValorBR(s.preco), 0) / comPreco.length
    : 0
  const semPreco = filtrados.length - comPreco.length

  // Cadastrar vive em tela propria (`pages/Servico.jsx`): ficha de
  // cadastro nao e decisao curta, e como popup ela nao tinha endereco proprio
  // nem sobrevivia a um clique fora.

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
        <button onClick={() => navigate('/servicos/novo')} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Serviço
        </button>
      </div>

      {/* Computador: a tabela de preços da oficina, uma linha por serviço.
          Em card cabiam nove serviços na tela e o preço ficava em nove lugares
          diferentes; em coluna alinhada dá para descer o olho e comparar. */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Serviço</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tempo</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Preço</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrados.map(s => {
              // O preço é texto livre digitado à mão. Quando dá para ler como
              // número, sai formatado para a coluna alinhar na vírgula; quando
              // não dá ("A COMBINAR", "0,00"), mostra apagado o que a pessoa
              // escreveu — em vez de inventar um R$ 0,00 que não é verdade, e
              // sem misturar com os preços de verdade na hora de comparar.
              const valor = parseValorBR(s.preco)
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  {/* Vários serviços foram cadastrados com o procedimento
                      inteiro no nome (dez linhas de texto). Na tabela ficam em
                      duas linhas, senão uma linha só empurra o resto da lista
                      para fora da tela; o texto completo sai ao passar o mouse
                      e continua inteiro no card do celular. */}
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">
                    <span className="line-clamp-2" title={s.nome}>{s.nome}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">{s.categoria || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">{s.tempo || <span className="text-slate-300">—</span>}</td>
                  {/* Sem quebra: o nome do serviço é longo e empurrava o preço,
                      que quebrava em "R$" numa linha e o valor na outra. */}
                  <td className="px-5 py-3.5 text-sm text-slate-700 text-right tabular-nums whitespace-nowrap">
                    {valor > 0
                      ? fmtBRL(valor)
                      : <span className="text-slate-400">{s.preco || '—'}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => excluir(s.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum serviço encontrado.</p>}
        {filtrados.length > 0 && (
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {filtrados.length} {filtrados.length === 1 ? 'serviço' : 'serviços'}
              {busca && ` (de ${servicos.length})`}
              {semPreco > 0 && <span className="ml-2 text-yellow-700">· {semPreco} sem preço</span>}
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              {/* Sem nenhum serviço com preço, "R$ 0,00" seria lido como "a
                  média é zero" em vez de "não há o que calcular". */}
              <span>Preço médio: <strong className="font-medium">{comPreco.length ? fmtBRL(precoMedio) : '—'}</strong></span>
            </span>
          </div>
        )}
      </div>

      {/* Celular: os cards de sempre — na mão o alvo tem que ser grande e a
          tabela de cinco colunas não cabe. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
        {filtrados.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                <Wrench size={16} className="text-primary-500" />
              </div>
              <div className="flex items-center gap-2">
                {s.categoria && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{s.categoria}</span>}
                <button onClick={() => excluir(s.id)} className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
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

    </div>
  )
}

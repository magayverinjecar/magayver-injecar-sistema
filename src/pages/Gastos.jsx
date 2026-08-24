import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, TrendingUp, Zap, Clock, CheckCircle, Repeat, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { parseValorBR } from '../utils/numero'
import { sincronizarFinanceiro } from '../utils/gastoFinanceiro'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Parser unico em utils/numero.js — cada tela tinha a propria copia, e a
// versao antiga lia "1.500" como 1,5.
const parseNum = parseValorBR

const STATUS_COR = {
  Pago: 'bg-orange-100 text-orange-700',
  Pendente: 'bg-yellow-100 text-yellow-700',
  Atrasado: 'bg-red-100 text-red-700',
}

export default function Gastos() {
  // Os gastos ficavam no localStorage: cada aparelho tinha a própria lista e
  // limpar o navegador apagava o custo fixo inteiro da oficina. Agora vêm do
  // banco como todo o resto. A lista também não nasce mais com dados de
  // exemplo ("Terreno", "Água da empresa") — aquilo era teste e entrava na soma.
  const { adicionarLancamento, setFinanceiro, gastos, setGastos } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState('Todos')

  const fixos = gastos.filter(g => g.tipo === 'Fixo').reduce((s, g) => s + parseNum(g.valor), 0)
  const variaveis = gastos.filter(g => g.tipo === 'Variável').reduce((s, g) => s + parseNum(g.valor), 0)
  const pendente = gastos.filter(g => g.status !== 'Pago').reduce((s, g) => s + parseNum(g.valor), 0)
  const pago = gastos.filter(g => g.status === 'Pago').reduce((s, g) => s + parseNum(g.valor), 0)

  const cards = [
    { label: 'Fixos', value: fmt(fixos), icon: TrendingUp, cor: 'text-slate-700', ic: 'text-blue-500' },
    { label: 'Variáveis', value: fmt(variaveis), icon: Zap, cor: 'text-slate-700', ic: 'text-purple-500' },
    { label: 'Pendente', value: fmt(pendente), icon: Clock, cor: 'text-orange-600', ic: 'text-orange-500' },
    { label: 'Pago', value: fmt(pago), icon: CheckCircle, cor: 'text-green-600', ic: 'text-green-500' },
  ]

  const filtrados = gastos.filter(g => {
    // Sem as guardas, uma linha migrada sem descrição ou categoria derruba a
    // tela inteira assim que alguém digita na busca.
    const alvo = `${g.descricao || ''} ${g.categoria || ''}`.toLowerCase()
    const matchBusca = !busca || alvo.includes(busca.toLowerCase())
    const matchAba =
      aba === 'Todos' ||
      (aba === 'Fixos' && g.tipo === 'Fixo') ||
      (aba === 'Variáveis' && g.tipo === 'Variável') ||
      (aba === 'Pendentes' && g.status !== 'Pago') ||
      (aba === 'Pagos' && g.status === 'Pago')
    return matchBusca && matchAba
  })

  // O cadastro deixou de ser popup e virou tela com endereço próprio: dá para
  // atualizar a página no meio sem perder o preenchimento, e o voltar do
  // navegador faz o que promete. Ver GastoCadastro.jsx.
  function mudarStatus(id, status) {
    setGastos(prev => prev.map(g => {
      if (g.id !== id) return g
      const atualizado = { ...g, status }
      sincronizarFinanceiro(atualizado, g.status, { adicionarLancamento, setFinanceiro })
      return atualizado
    }))
  }

  function excluir(id) {
    if (!confirm('Excluir este gasto?')) return
    setFinanceiro(fp => fp.filter(f => f.gastoId !== id))
    setGastos(prev => prev.filter(g => g.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gastos da Oficina</h2>
          <p className="text-sm text-slate-500">Controle seus gastos fixos e variáveis</p>
        </div>
        <button onClick={() => navigate('/gastos/novo')} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Gasto
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, cor, ic }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className={ic} />
              <p className="text-sm text-slate-500">{label}</p>
            </div>
            <p className={`text-lg font-bold ${cor}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Busca + abas */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por descrição ou categoria..." value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {['Todos', 'Fixos', 'Variáveis', 'Pendentes', 'Pagos'].map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === a ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhum gasto registrado.</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descrição</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vencimento</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-800">{g.descricao}</p>
                      {g.recorrente && (
                        <p className="text-xs text-slate-400 flex items-center gap-1"><Repeat size={11} />Recorrente{g.diaRecorrencia ? ` · Dia ${g.diaRecorrencia}` : ''}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{g.categoria}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{g.tipo}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700">{fmt(parseNum(g.valor))}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{g.vencimento}</td>
                    <td className="px-5 py-3.5">
                      <select value={g.status} onChange={e => mudarStatus(g.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${STATUS_COR[g.status]}`}>
                        <option>Pendente</option>
                        <option>Pago</option>
                        <option>Atrasado</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/gastos/${g.id}`)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-primary-500 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => excluir(g.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition-colors">
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

    </div>
  )
}

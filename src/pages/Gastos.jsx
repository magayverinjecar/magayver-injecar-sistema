import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, X, TrendingUp, Zap, Clock, CheckCircle, Repeat, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import { parseValorBR } from '../utils/numero'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Parser unico em utils/numero.js — cada tela tinha a propria copia, e a
// versao antiga lia "1.500" como 1,5.
const parseNum = parseValorBR

// "Retirada" e "Pró-labore" escritos EXATAMENTE assim: o DRE reconhece a
// categoria pelo nome e tira o valor de dentro do custo fixo, para a retirada
// aparecer depois do resultado, como distribuição — e não como despesa da
// oficina. Antes disso a detecção dependia de a pessoa escrever a frase certa
// na descrição, e retirada rotulada errado fazia o mês parecer pior do que foi.
const CATEGORIAS = ['Outros', 'Aluguel', 'Água', 'Energia', 'Internet', 'Telefone', 'Salário', 'Impostos', 'Manutenção', 'Marketing', 'Retirada', 'Pró-labore']
const STATUS_COR = {
  Pago: 'bg-orange-100 text-orange-700',
  Pendente: 'bg-yellow-100 text-yellow-700',
  Atrasado: 'bg-red-100 text-red-700',
}

// Gasto "Fixo" nasce recorrente: aluguel, energia e salário se repetem todo mês
// por definição. Deixar o toggle desmarcado por padrão fazia o custo fixo da
// oficina somar zero no ponto de equilíbrio — em silêncio, porque tipo e
// recorrência são dois campos separados e ninguém liga um ao outro na hora.
const VAZIO = { descricao: '', categoria: 'Outros', tipo: 'Fixo', valor: '', status: 'Pendente', data: '', recorrente: true, observacoes: '' }

// "16/08/2026" → "2026-08-16", que é o formato que <input type="date"> entende.
function paraISO(vencimentoBR) {
  const m = String(vencimentoBR || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export default function Gastos() {
  // Os gastos ficavam no localStorage: cada aparelho tinha a própria lista e
  // limpar o navegador apagava o custo fixo inteiro da oficina. Agora vêm do
  // banco como todo o resto. A lista também não nasce mais com dados de
  // exemplo ("Terreno", "Água da empresa") — aquilo era teste e entrava na soma.
  const { adicionarLancamento, setFinanceiro, gastos, setGastos } = useApp()
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState('Todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [editId, setEditId] = useState(null)

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

  // Sincroniza com o financeiro: gasto pago vira despesa.
  //
  // O lançamento carrega a data do pagamento além do `gastoId`. Sem ela, marcar
  // o aluguel como Pago de novo no mês seguinte apagava TODOS os lançamentos
  // daquele gasto, de todos os meses — o histórico de doze aluguéis sumia numa
  // remarcação. Ver o filtro do desfazer logo abaixo.
  function sincronizarFinanceiro(gasto, antigoStatus) {
    if (gasto.status === 'Pago' && antigoStatus !== 'Pago') {
      adicionarLancamento({ descricao: `Gasto - ${gasto.descricao}`, tipo: 'despesa', valor: gasto.valor, gastoId: gasto.id, competencia: gasto.vencimento || '' })
    } else if (gasto.status !== 'Pago' && antigoStatus === 'Pago') {
      // Desfaz só o lançamento DAQUELA competência. Filtrar por `gastoId`
      // sozinho apagava o histórico inteiro do gasto recorrente.
      const comp = gasto.vencimento || ''
      setFinanceiro(fp => fp.filter(f =>
        f.gastoId !== gasto.id || (f.competencia && f.competencia !== comp)
      ))
    }
  }

  function abrirNovo() { setForm(VAZIO); setEditId(null); setModal(true) }
  function abrirEditar(g) {
    // Preenche a data com o vencimento que o gasto já tem. Antes o campo abria
    // vazio e o salvar recarimbava a data de HOJE: editar um gasto só para
    // corrigir o valor apagava o vencimento original. Isso passou a importar de
    // verdade quando o vencimento virou o que decide em qual mês o gasto entra.
    setForm({ ...VAZIO, ...g, data: paraISO(g.vencimento) })
    setEditId(g.id); setModal(true)
  }

  function salvar() {
    if (!form.descricao.trim() || !form.valor) return
    // Sem data informada numa EDIÇÃO, mantém o vencimento que já existia.
    const anterior = editId ? gastos.find(g => g.id === editId) : null
    const vencimento = form.data
      ? new Date(form.data + 'T12:00:00').toLocaleDateString('pt-BR')
      : (anterior?.vencimento || new Date().toLocaleDateString('pt-BR'))
    if (editId) {
      const antigo = gastos.find(g => g.id === editId)
      const atualizado = { ...antigo, ...form, vencimento }
      setGastos(prev => prev.map(g => g.id === editId ? atualizado : g))
      sincronizarFinanceiro(atualizado, antigo.status)
    } else {
      const novo = { ...form, id: gerarId(), vencimento }
      setGastos(prev => [novo, ...prev])
      sincronizarFinanceiro(novo, null)
    }
    setModal(false); setForm(VAZIO); setEditId(null)
  }

  function mudarStatus(id, status) {
    setGastos(prev => prev.map(g => {
      if (g.id !== id) return g
      const atualizado = { ...g, status }
      sincronizarFinanceiro(atualizado, g.status)
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
        <button onClick={abrirNovo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
                        <button onClick={() => abrirEditar(g)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-primary-500 transition-colors">
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Aluguel do galpão" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  {/* Trocar para Fixo religa a recorrência; para Variável,
                      desliga — gasto variável costuma ser pontual. Continua
                      editável no toggle abaixo para os casos fora da regra. */}
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value, recorrente: e.target.value === 'Fixo' }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option>Fixo</option>
                    <option>Variável</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) *</label>
                  <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option>Pendente</option>
                    <option>Pago</option>
                    <option>Atrasado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Referência</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                <button onClick={() => setForm(f => ({ ...f, recorrente: !f.recorrente }))}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${form.recorrente ? 'bg-primary-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.recorrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-700">Gasto recorrente (todo mês)</p>
                  <p className="text-xs text-slate-400">Marque para gastos que se repetem todo mês (aluguel, internet, salário).</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2} placeholder="Notas adicionais..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100">
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

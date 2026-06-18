import { useState } from 'react'
import { TrendingUp, CheckCircle, Clock, Users, Plus, Search, X, Trash2, AlertCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useLocalStorage } from '../hooks/useLocalStorage'

function parseValor(v) {
  return parseFloat((v || '0').toString().replace('.', '').replace(',', '.')) || 0
}

const fmt = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const VAZIO = { mecanicoId: '', data: '', osId: '', servico: '', valorServico: '', percentual: '', observacoes: '' }

export default function Produtividade() {
  const { funcionarios, ordens, getCliente, adicionarLancamento, setFinanceiro, totalOrdem } = useApp()
  const [registros, setRegistros] = useLocalStorage('produtividade', [])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [busca, setBusca] = useState('')
  const [filtroMecanico, setFiltroMecanico] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')

  const comissaoCalc = parseValor(form.valorServico) * (parseFloat(form.percentual) || 0) / 100

  const totalComissoes = registros.reduce((s, r) => s + r.comissao, 0)
  const totalPago = registros.filter(r => r.pago).reduce((s, r) => s + r.comissao, 0)
  const totalPendente = registros.filter(r => !r.pago).reduce((s, r) => s + r.comissao, 0)
  const mecanicosComRegistro = new Set(registros.map(r => r.mecanicoId)).size

  // OS concluídas/entregues com mecânico que ainda não têm comissão registrada
  const osSemComissao = ordens.filter(o =>
    (o.status === 'Concluída' || o.status === 'Entregue') &&
    o.mecanicoId &&
    !registros.find(r => r.osId === o.id)
  )

  const cards = [
    { label: 'Total Comissões', value: fmt(totalComissoes), icon: TrendingUp, bg: 'bg-primary-50', text: 'text-primary-600' },
    { label: 'Pago', value: fmt(totalPago), icon: CheckCircle, bg: 'bg-green-50', text: 'text-green-600' },
    { label: 'Pendente', value: fmt(totalPendente), icon: Clock, bg: 'bg-yellow-50', text: 'text-yellow-600' },
    { label: 'Mecânicos', value: mecanicosComRegistro, icon: Users, bg: 'bg-blue-50', text: 'text-blue-600' },
  ]

  const getMecanico = (id) => funcionarios.find(f => f.id === id)

  const filtrados = registros.filter(r => {
    const mec = getMecanico(r.mecanicoId)
    const matchBusca = !busca ||
      mec?.nome.toLowerCase().includes(busca.toLowerCase()) ||
      r.servico?.toLowerCase().includes(busca.toLowerCase())
    const matchMec = !filtroMecanico || r.mecanicoId === Number(filtroMecanico)
    const matchStatus = filtroStatus === 'Todos' ||
      (filtroStatus === 'Pago' && r.pago) ||
      (filtroStatus === 'Pendente' && !r.pago)
    return matchBusca && matchMec && matchStatus
  })

  function salvar() {
    if (!form.mecanicoId || !form.servico.trim()) return
    const comissao = parseValor(form.valorServico) * (parseFloat(form.percentual) || 0) / 100
    const dataFmt = form.data ? new Date(form.data + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
    const novo = {
      id: Date.now(),
      mecanicoId: Number(form.mecanicoId),
      data: dataFmt,
      osId: form.osId || null,
      servico: form.servico,
      valorServico: form.valorServico,
      percentual: form.percentual,
      comissao,
      observacoes: form.observacoes,
      pago: false,
    }
    setRegistros(prev => [novo, ...prev])
    setForm(VAZIO)
    setModal(false)
  }

  function togglePago(id) {
    setRegistros(prev => prev.map(r => {
      if (r.id !== id) return r
      const novoPago = !r.pago
      const mec = getMecanico(r.mecanicoId)
      if (novoPago) {
        adicionarLancamento({
          descricao: `Comissão - ${mec?.nome || 'Mecânico'} (${r.servico})`,
          tipo: 'despesa',
          valor: r.comissao.toFixed(2).replace('.', ','),
          comissaoId: r.id,
        })
      } else {
        setFinanceiro(fp => fp.filter(f => f.comissaoId !== r.id))
      }
      return { ...r, pago: novoPago }
    }))
  }

  function excluir(id) {
    if (!confirm('Excluir este registro?')) return
    setFinanceiro(fp => fp.filter(f => f.comissaoId !== id))
    setRegistros(prev => prev.filter(r => r.id !== id))
  }

  function selecionarOS(osId) {
    if (!osId) { setForm(f => ({ ...f, osId: '' })); return }
    const os = ordens.find(o => o.id === osId)
    if (os) {
      const total = totalOrdem(os)
      const descricao = os.descricaoProblema || os.servico || ''
      setForm(f => ({
        ...f,
        osId,
        servico: descricao || f.servico,
        valorServico: total > 0 ? total.toFixed(2).replace('.', ',') : f.valorServico,
        mecanicoId: os.mecanicoId ? String(os.mecanicoId) : f.mecanicoId,
      }))
    }
  }

  function abrirSugestao(os) {
    const total = totalOrdem(os)
    const descricao = os.descricaoProblema || os.servico || ''
    setForm({
      ...VAZIO,
      osId: os.id,
      mecanicoId: os.mecanicoId ? String(os.mecanicoId) : '',
      servico: descricao,
      valorServico: total > 0 ? total.toFixed(2).replace('.', ',') : '',
      data: '',
      percentual: '',
    })
    setModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Produtividade &amp; Comissões</h2>
        <button onClick={() => { setForm(VAZIO); setModal(true) }} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Registro
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={text} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-lg font-bold text-slate-800">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sugestões automáticas: OS concluídas sem comissão */}
      {osSemComissao.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              {osSemComissao.length} OS concluída(s) com mecânico sem comissão registrada
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {osSemComissao.map(os => {
              const mec = getMecanico(os.mecanicoId)
              const cliente = getCliente(os.clienteId)
              const total = totalOrdem(os)
              return (
                <div key={os.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-700">{os.id}</span>
                      <span className="text-xs text-slate-500">• {cliente?.nome || '—'}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      Mecânico: <span className="text-amber-700">{mec?.nome || '—'}</span>
                      {total > 0 && <span className="text-slate-500"> · {fmt(total)}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => abrirSugestao(os)}
                    className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    <Plus size={13} />Registrar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filtroMecanico} onChange={e => setFiltroMecanico(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos os mecânicos</option>
          {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option>Todos</option>
          <option>Pago</option>
          <option>Pendente</option>
        </select>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">Nenhum registro de produtividade</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mecânico</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Serviço</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comissão</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(r => {
                const mec = getMecanico(r.mecanicoId)
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-semibold">
                          {mec?.nome?.[0] || '?'}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{mec?.nome || 'Mecânico'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-slate-700">{r.servico}</p>
                      {r.osId && <p className="text-xs text-slate-400 font-mono">{r.osId}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{r.data}</td>
                    <td className="px-5 py-3.5 text-right text-sm text-slate-600">{fmt(parseValor(r.valorServico))}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-primary-600">{fmt(r.comissao)}</span>
                      <span className="text-xs text-slate-400 block">{r.percentual}%</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button onClick={() => togglePago(r.id)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${r.pago ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}>
                        {r.pago ? '✓ Pago' : 'Pendente'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => excluir(r.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Novo Registro de Produtividade</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mecânico *</label>
                  <select value={form.mecanicoId} onChange={e => setForm(f => ({ ...f, mecanicoId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Selecione</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">OS vinculada (opcional)</label>
                <select value={form.osId} onChange={e => selecionarOS(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Nenhuma</option>
                  {ordens.map(o => {
                    const cliente = getCliente(o.clienteId)
                    return <option key={o.id} value={o.id}>{o.id} — {cliente?.nome || 'Cliente'} ({o.status})</option>
                  })}
                </select>
                <p className="text-xs text-slate-400 mt-1">Ao selecionar uma OS, o serviço e valor são preenchidos automaticamente.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do serviço *</label>
                <input value={form.servico} onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Serviço (R$)</label>
                  <input value={form.valorServico} onChange={e => setForm(f => ({ ...f, valorServico: e.target.value }))}
                    placeholder="0,00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">% Comissão</label>
                  <input value={form.percentual} onChange={e => setForm(f => ({ ...f, percentual: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comissão</label>
                  <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-primary-600">
                    {fmt(comissaoCalc)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <button onClick={salvar} disabled={!form.mecanicoId || !form.servico.trim()} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

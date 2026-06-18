import { useApp } from '../context/AppContext'
import { ClipboardList, Users, DollarSign, Package, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const statusColor = {
  'Em andamento': 'bg-blue-100 text-blue-700',
  'Aguardando': 'bg-yellow-100 text-yellow-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Cancelada': 'bg-red-100 text-red-700',
}

export default function Dashboard() {
  const { clientes, ordens, resumoFinanceiro, estoqueAlerta, agenda, devedores, getCliente, getVeiculo } = useApp()
  const navigate = useNavigate()

  const ordensAbertas = ordens.filter(o => o.status !== 'Concluída' && o.status !== 'Cancelada')
  const ordensConcluidas = ordens.filter(o => o.status === 'Concluída')
  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const lucro = resumoFinanceiro.receitas - resumoFinanceiro.despesas

  const stats = [
    { label: 'OS Abertas', value: ordensAbertas.length, icon: ClipboardList, bg: 'bg-blue-50', text: 'text-blue-600', rota: '/ordens-servico' },
    { label: 'Clientes', value: clientes.length, icon: Users, bg: 'bg-green-50', text: 'text-green-600', rota: '/clientes' },
    { label: 'Faturamento', value: fmt(resumoFinanceiro.receitas), icon: DollarSign, bg: 'bg-primary-50', text: 'text-primary-600', rota: '/financeiro' },
    { label: 'Estoque Crítico', value: estoqueAlerta.length, icon: Package, bg: 'bg-red-50', text: 'text-red-500', rota: '/estoque' },
  ]

  const agendaHoje = agenda.filter(a => {
    const hoje = new Date().toLocaleDateString('pt-BR')
    return a.data === hoje || !a.data
  })

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, bg, text, rota }) => (
          <button key={label} onClick={() => navigate(rota)} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-left hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500 font-medium">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={18} className={text} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
          </button>
        ))}
      </div>

      {/* Lucro destaque */}
      <div className={`rounded-xl px-5 py-4 flex items-center justify-between shadow-sm border ${lucro >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
        <div>
          <p className="text-sm text-slate-500">Lucro líquido</p>
          <p className={`text-2xl font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(lucro)}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Receitas: <span className="text-green-600 font-semibold">{fmt(resumoFinanceiro.receitas)}</span></p>
          <p>Despesas: <span className="text-red-500 font-semibold">{fmt(resumoFinanceiro.despesas)}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas OS */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Ordens de Serviço Recentes</h2>
            <button onClick={() => navigate('/ordens-servico')} className="text-sm text-primary-500 hover:text-primary-600 font-medium">Ver todas</button>
          </div>
          <div className="divide-y divide-slate-50">
            {ordens.slice(0, 5).map(os => {
              const cliente = getCliente(os.clienteId)
              const veiculo = getVeiculo(os.veiculoId)
              return (
                <div key={os.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{os.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[os.status]}`}>{os.status}</span>
                      {os.status === 'Concluída' && !os.pago && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">A receber</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{cliente?.nome || '—'}</p>
                    <p className="text-xs text-slate-400">{veiculo?.modelo} • {veiculo?.placa}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">R$ {os.valor}</p>
                </div>
              )
            })}
            {ordens.length === 0 && <p className="text-center text-sm text-slate-400 py-6">Nenhuma OS cadastrada.</p>}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          {/* Alertas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Alertas</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/agenda')}>
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Clock size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{agendaHoje.length} agendamento(s)</p>
                  <p className="text-xs text-slate-400">Para hoje</p>
                </div>
              </div>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/ordens-servico')}>
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={16} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{ordensConcluidas.length} OS concluída(s)</p>
                  <p className="text-xs text-slate-400">{ordensAbertas.length} em aberto</p>
                </div>
              </div>

              {estoqueAlerta.length > 0 && (
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/estoque')}>
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{estoqueAlerta.length} peça(s) em falta</p>
                    <p className="text-xs text-slate-400">Estoque abaixo do mínimo</p>
                  </div>
                </div>
              )}

              {devedores.length > 0 && (
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/financeiro')}>
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{devedores.length} OS a receber</p>
                    <p className="text-xs text-slate-400">Serviços não pagos</p>
                  </div>
                </div>
              )}

              {estoqueAlerta.length === 0 && devedores.length === 0 && agendaHoje.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Tudo em ordem!</p>
              )}
            </div>
          </div>

          {/* Atalhos rápidos */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Atalhos</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nova OS', rota: '/ordens-servico' },
                { label: 'Novo Cliente', rota: '/clientes' },
                { label: 'Agenda', rota: '/agenda' },
                { label: 'Financeiro', rota: '/financeiro' },
              ].map(a => (
                <button key={a.rota} onClick={() => navigate(a.rota)}
                  className="text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 py-2 px-3 rounded-lg transition-colors text-center">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

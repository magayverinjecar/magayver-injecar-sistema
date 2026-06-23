import { useState } from 'react'
import { TrendingUp, Users, FileText, DollarSign, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../context/AppContext'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function parseDateBR(str) {
  if (!str) return null
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return new Date(+match[3], +match[2] - 1, +match[1])
}

const PERIODOS = [
  { value: 'semana',      label: 'Esta semana' },
  { value: 'mes_atual',   label: 'Este mês' },
  { value: 'mes_passado', label: 'Mês passado' },
  { value: 'ano',         label: 'Este ano' },
  { value: 'custom',      label: 'Personalizado' },
]

function getRange(periodo, dataInicio, dataFim) {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()

  if (periodo === 'semana') {
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay()); ini.setHours(0,0,0,0)
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23,59,59,999)
    return { inicio: ini, fim }
  }
  if (periodo === 'mes_atual')   return { inicio: new Date(y, m, 1),   fim: new Date(y, m+1, 0, 23, 59) }
  if (periodo === 'mes_passado') return { inicio: new Date(y, m-1, 1), fim: new Date(y, m, 0, 23, 59) }
  if (periodo === 'ano')         return { inicio: new Date(y, 0, 1),   fim: new Date(y, 11, 31, 23, 59) }
  return {
    inicio: dataInicio ? new Date(dataInicio) : null,
    fim:    dataFim    ? new Date(dataFim + 'T23:59:59') : null,
  }
}

export default function Produtividade() {
  const { funcionarios, ordens, getCliente, totalOrdem } = useApp()
  const [periodo, setPeriodo]       = useState('mes_atual')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim]       = useState('')
  const [expandido, setExpandido]   = useState(null)

  const { inicio, fim } = getRange(periodo, dataInicio, dataFim)

  const osFiltradas = ordens.filter(o => {
    if (o.status !== 'Concluída' && o.status !== 'Entregue') return false
    if (!o.mecanicoId) return false
    const data = parseDateBR(o.dataConclusao) || parseDateBR(o.dataEntrada || o.data)
    if (!data) return false
    if (inicio && data < inicio) return false
    if (fim    && data > fim)    return false
    return true
  })

  const statsPorMecanico = funcionarios
    .map(mec => {
      const osDoMec = osFiltradas
        .filter(o => o.mecanicoId === mec.id)
        .sort((a, b) => {
          const da = parseDateBR(a.dataConclusao || a.dataEntrada || a.data)
          const db = parseDateBR(b.dataConclusao || b.dataEntrada || b.data)
          return (db?.getTime() || 0) - (da?.getTime() || 0)
        })
      const receita = osDoMec.reduce((s, o) => s + totalOrdem(o), 0)
      return {
        mec,
        osCount: osDoMec.length,
        receita,
        ticketMedio: osDoMec.length > 0 ? receita / osDoMec.length : 0,
        os: osDoMec,
      }
    })
    .filter(s => s.osCount > 0)
    .sort((a, b) => b.osCount - a.osCount)

  const totalOS      = osFiltradas.length
  const totalReceita = osFiltradas.reduce((s, o) => s + totalOrdem(o), 0)
  const ticketMedio  = totalOS > 0 ? totalReceita / totalOS : 0
  const maxOS        = statsPorMecanico[0]?.osCount || 1

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Produtividade</h2>
        <p className="text-sm text-slate-400 mt-0.5">Desempenho dos mecânicos por período</p>
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={15} className="text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-600 mr-1">Período:</span>
          {PERIODOS.map(p => (
            <button key={p.value} onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === p.value ? 'bg-primary-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'custom' && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <span className="text-slate-400 text-sm">até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        )}
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardStat label="OS Concluídas"   value={totalOS}          icon={FileText}   bg="bg-blue-50"    text="text-blue-600" />
        <CardStat label="Receita Gerada"  value={fmt(totalReceita)} icon={DollarSign}  bg="bg-green-50"   text="text-green-600" />
        <CardStat label="Mecânicos Ativos" value={statsPorMecanico.length} icon={Users} bg="bg-primary-50" text="text-primary-600" />
        <CardStat label="Ticket Médio"    value={fmt(ticketMedio)} icon={TrendingUp}  bg="bg-purple-50"  text="text-purple-600" />
      </div>

      {/* Por mecânico */}
      {statsPorMecanico.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <Users size={36} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma OS concluída no período</p>
          <p className="text-slate-300 text-sm mt-1">Selecione outro período ou conclua algumas OS</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ranking de Mecânicos</h3>
          {statsPorMecanico.map((s, idx) => {
            const aberto = expandido === s.mec.id
            const barPct = Math.round((s.osCount / maxOS) * 100)
            const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null

            return (
              <div key={s.mec.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <button className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandido(aberto ? null : s.mec.id)}>
                  <div className="flex items-center gap-3">
                    {/* Posição */}
                    <div className="w-7 text-center flex-shrink-0">
                      {medalha
                        ? <span className="text-lg">{medalha}</span>
                        : <span className="text-sm font-bold text-slate-400">{idx + 1}</span>
                      }
                    </div>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                      {s.mec.nome[0]}
                    </div>
                    {/* Dados */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800">{s.mec.nome}</span>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span className="text-slate-500">
                            <span className="font-bold text-slate-700">{s.osCount}</span> OS
                          </span>
                          <span className="font-bold text-green-600">{fmt(s.receita)}</span>
                          <span className="text-slate-400 text-xs hidden sm:inline">
                            ticket médio {fmt(s.ticketMedio)}
                          </span>
                        </div>
                      </div>
                      {/* Barra */}
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-400 rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    {aberto
                      ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
                      : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                    }
                  </div>
                </button>

                {/* OS do mecânico */}
                {aberto && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full min-w-[480px]">
                      <thead>
                        <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                          <th className="text-left px-5 py-2 font-semibold">OS</th>
                          <th className="text-left px-5 py-2 font-semibold">Cliente</th>
                          <th className="text-left px-5 py-2 font-semibold">Conclusão</th>
                          <th className="text-right px-5 py-2 font-semibold">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {s.os.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="px-5 py-2.5 text-sm font-mono text-slate-500">{o.id}</td>
                            <td className="px-5 py-2.5 text-sm text-slate-700">{getCliente(o.clienteId)?.nome || '—'}</td>
                            <td className="px-5 py-2.5 text-sm text-slate-500">{o.dataConclusao || o.dataEntrada || o.data || '—'}</td>
                            <td className="px-5 py-2.5 text-right text-sm font-semibold text-slate-700">{fmt(totalOrdem(o))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50">
                          <td colSpan={3} className="px-5 py-2 text-xs font-semibold text-slate-500 text-right">Total</td>
                          <td className="px-5 py-2 text-right text-sm font-bold text-green-600">{fmt(s.receita)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardStat({ label, value, icon: Icon, bg, text }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={text} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
          <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
        </div>
      </div>
    </div>
  )
}

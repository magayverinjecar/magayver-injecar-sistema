import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CaixaHistorico() {
  const navigate = useNavigate()
  const { caixaHistorico, caixaTurno } = useApp()

  const hojeISO = new Date().toISOString().split('T')[0]
  const [inicio, setInicio] = useState(hojeISO)
  const [fim, setFim] = useState(hojeISO)

  // converte DD/MM/YYYY → YYYY-MM-DD para comparar com inputs de data
  function brToISO(br) {
    if (!br) return ''
    const [d, m, y] = br.split('/')
    return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
  }

  // turno aberto + fechados
  const todosTurnos = []
  if (caixaTurno) {
    todosTurnos.push({
      id: caixaTurno.id,
      data: caixaTurno.dataAbertura,
      operador: caixaTurno.operador,
      horaAbertura: caixaTurno.horaAbertura,
      horaFechamento: null,
      status: 'Aberto',
      saldoInicial: caixaTurno.saldoInicial,
      saldoFinal: null,
      divergencia: null,
    })
  }
  caixaHistorico.forEach(t => todosTurnos.push({
    id: t.id, data: t.dataAbertura, operador: t.operador,
    horaAbertura: t.horaAbertura, horaFechamento: t.horaFechamento,
    status: 'Fechado', saldoInicial: t.saldoInicial, saldoFinal: t.saldoFinal, divergencia: t.divergencia,
  }))

  const turnos = todosTurnos.filter(t => {
    const iso = brToISO(t.data)
    return iso >= inicio && iso <= fim
  })

  const totalTurnos = turnos.length
  const fechados = turnos.filter(t => t.status === 'Fechado').length
  const comDivergencia = turnos.filter(t => t.divergencia && Math.abs(t.divergencia) > 0.01).length

  function setPeriodo(dias) {
    const fimD = new Date()
    const iniD = new Date()
    iniD.setDate(iniD.getDate() - dias)
    setInicio(iniD.toISOString().split('T')[0])
    setFim(fimD.toISOString().split('T')[0])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/caixa')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} />Voltar
        </button>
        <h2 className="text-xl font-bold text-slate-800">Histórico de Caixa</h2>
      </div>

      {/* Filtros de data */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Data Início</label>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPeriodo(0)} className="border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Hoje</button>
          <button onClick={() => setPeriodo(7)} className="border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">7 dias</button>
          <button onClick={() => setPeriodo(30)} className="border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">30 dias</button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
          <p className="text-sm text-slate-500">Turnos no período</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalTurnos}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
          <p className="text-sm text-slate-500">Fechados</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fechados}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
          <p className="text-sm text-slate-500 flex items-center justify-center gap-1"><AlertTriangle size={13} className="text-orange-400" />Com divergência</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{comDivergencia}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {turnos.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">Nenhum turno no período.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Operador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Abertura</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fechamento</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo Inicial</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo Final</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Divergência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {turnos.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-slate-700">{t.data}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">{t.operador}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{t.horaAbertura}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{t.horaFechamento || '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.status === 'Aberto' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-slate-600">{fmt(t.saldoInicial)}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-slate-600">{t.saldoFinal != null ? fmt(t.saldoFinal) : '—'}</td>
                  <td className="px-5 py-3.5 text-right text-sm">
                    {t.divergencia != null
                      ? <span className={Math.abs(t.divergencia) < 0.01 ? 'text-green-600' : 'text-red-500 font-semibold'}>{fmt(t.divergencia)}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

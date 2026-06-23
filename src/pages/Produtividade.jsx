import { useState } from 'react'
import { TrendingUp, Users, FileText, Calendar, ChevronDown, ChevronUp, Wrench, Car } from 'lucide-react'
import { useApp } from '../context/AppContext'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

function parseDateBR(str) {
  if (!str) return null
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return new Date(+match[3], +match[2] - 1, +match[1])
}

function totalServicos(o) {
  return (o.itens || [])
    .filter(i => i.tipo === 'servico')
    .reduce((s, i) => s + pNum(i.valorUnitario) * (Number(i.quantidade) || 1) - pNum(i.desconto || 0), 0)
}

const PERIODOS = [
  { value: 'todos',       label: 'Todos' },
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
  if (periodo === 'todos')       return { inicio: null, fim: null }
  if (periodo === 'semana') {
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay()); ini.setHours(0,0,0,0)
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23,59,59,999)
    return { inicio: ini, fim }
  }
  if (periodo === 'mes_atual')   return { inicio: new Date(y, m, 1),     fim: new Date(y, m+1, 0, 23, 59) }
  if (periodo === 'mes_passado') return { inicio: new Date(y, m-1, 1),   fim: new Date(y, m, 0, 23, 59) }
  if (periodo === 'ano')         return { inicio: new Date(y, 0, 1),     fim: new Date(y, 11, 31, 23, 59) }
  return {
    inicio: dataInicio ? new Date(dataInicio) : null,
    fim:    dataFim    ? new Date(dataFim + 'T23:59:59') : null,
  }
}

export default function Produtividade() {
  const { funcionarios, ordens, getCliente, getVeiculo } = useApp()
  const [periodo, setPeriodo]         = useState('todos')
  const [dataInicio, setDataInicio]   = useState('')
  const [dataFim, setDataFim]         = useState('')
  const [mecSelecionado, setMecSelecionado] = useState(null)
  const [osExpandida, setOsExpandida] = useState(null)

  const { inicio, fim } = getRange(periodo, dataInicio, dataFim)

  function dentroDoPeriodo(o) {
    if (!inicio && !fim) return true
    const data = parseDateBR(o.dataConclusao) || parseDateBR(o.dataEntrada || o.data)
    if (!data) return true
    if (inicio && data < inicio) return false
    if (fim    && data > fim)    return false
    return true
  }

  // resolve o mecânico de um item: usa item.mecanicoId se existir, senão cai no os.mecanicoId (retrocompatibilidade)
  function mecDoItem(item, os) {
    return item.mecanicoId || os.mecanicoId || null
  }

  const osConcluidas = ordens.filter(o =>
    (o.status === 'Concluída' || o.status === 'Entregue') &&
    dentroDoPeriodo(o) &&
    (o.itens || []).some(i => i.tipo === 'servico' && mecDoItem(i, o))
  )

  // mecânicos que têm pelo menos 1 serviço no período
  const mecanicosAtivos = funcionarios.filter(f =>
    osConcluidas.some(o =>
      (o.itens || []).some(i => i.tipo === 'servico' && mecDoItem(i, o) === f.id)
    )
  )

  // OS que contêm pelo menos 1 serviço do mecânico selecionado
  const osMecanico = mecSelecionado
    ? osConcluidas
        .filter(o => (o.itens || []).some(i => i.tipo === 'servico' && mecDoItem(i, o) === mecSelecionado))
        .sort((a, b) => {
          const da = parseDateBR(a.dataConclusao || a.dataEntrada || a.data)
          const db = parseDateBR(b.dataConclusao || b.dataEntrada || b.data)
          return (db?.getTime() || 0) - (da?.getTime() || 0)
        })
    : []

  function totalServicosMec_OS(o) {
    return (o.itens || [])
      .filter(i => i.tipo === 'servico' && mecDoItem(i, o) === mecSelecionado)
      .reduce((s, i) => s + pNum(i.valorUnitario) * (Number(i.quantidade) || 1) - pNum(i.desconto || 0), 0)
  }

  const totalOSMec       = osMecanico.length
  const totalServicosMec = osMecanico.reduce((s, o) => s + totalServicosMec_OS(o), 0)
  const mecAtual         = funcionarios.find(f => f.id === mecSelecionado)

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Produtividade</h2>
        <p className="text-sm text-slate-400 mt-0.5">Serviços executados por mecânico</p>
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

      {/* Seletor de mecânico */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <p className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
          <Users size={15} className="text-slate-400" /> Selecione o Mecânico
        </p>
        {mecanicosAtivos.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Nenhum mecânico com OS concluídas no período</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {mecanicosAtivos.map(mec => {
              const qtd = osConcluidas.filter(o =>
                (o.itens || []).some(i => i.tipo === 'servico' && mecDoItem(i, o) === mec.id)
              ).length
              const selecionado = mecSelecionado === mec.id
              return (
                <button key={mec.id}
                  onClick={() => { setMecSelecionado(selecionado ? null : mec.id); setOsExpandida(null) }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${selecionado ? 'bg-primary-500 border-primary-500 text-white shadow-md' : 'border-slate-200 text-slate-700 hover:border-primary-300 hover:bg-primary-50'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${selecionado ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'}`}>
                    {mec.nome[0]}
                  </div>
                  <span>{mec.nome}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${selecionado ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {qtd} OS
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Conteúdo do mecânico selecionado */}
      {mecSelecionado && (
        <>
          {/* Cards resumo do mecânico */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Carros Atendidos</p>
                <p className="text-2xl font-bold text-slate-800">{totalOSMec}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total em Serviços</p>
                <p className="text-2xl font-bold text-green-600">{fmt(totalServicosMec)}</p>
              </div>
            </div>
          </div>

          {/* Lista de carros */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Veículos atendidos por {mecAtual?.nome}
            </h3>
            <div className="space-y-2">
              {osMecanico.map(o => {
                const cliente  = getCliente(o.clienteId)
                const veiculo  = getVeiculo(o.veiculoId)
                const servicos = (o.itens || []).filter(i => i.tipo === 'servico' && mecDoItem(i, o) === mecSelecionado)
                const totalSrv = totalServicosMec_OS(o)
                const aberto   = osExpandida === o.id

                return (
                  <div key={o.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {/* Linha do carro */}
                    <button className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                      onClick={() => setOsExpandida(aberto ? null : o.id)}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Car size={18} className="text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {veiculo?.placa && (
                              <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                {veiculo.placa}
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-700">
                              {veiculo?.modelo || '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                            <span>{cliente?.nome || '—'}</span>
                            <span>·</span>
                            <span>{o.dataConclusao || o.dataEntrada || o.data || '—'}</span>
                            <span>·</span>
                            <span className="text-blue-500 font-medium">{servicos.length} serviço(s)</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-green-600">{fmt(totalSrv)}</p>
                          <p className="text-xs text-slate-400">serviços</p>
                        </div>
                        <div className="ml-1 flex-shrink-0">
                          {aberto
                            ? <ChevronUp size={16} className="text-slate-400" />
                            : <ChevronDown size={16} className="text-slate-400" />
                          }
                        </div>
                      </div>
                    </button>

                    {/* Serviços do carro */}
                    {aberto && (
                      <div className="border-t border-slate-100 bg-slate-50">
                        {servicos.length === 0 ? (
                          <p className="px-5 py-4 text-sm text-slate-400 italic">Nenhum serviço registrado nesta OS</p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {servicos.map((srv, idx) => {
                              const sub = pNum(srv.valorUnitario) * (Number(srv.quantidade) || 1) - pNum(srv.desconto || 0)
                              return (
                                <div key={idx} className="flex items-center justify-between px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <Wrench size={13} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-700">{srv.descricao}</span>
                                    {Number(srv.quantidade) > 1 && (
                                      <span className="text-xs text-slate-400">x{srv.quantidade}</span>
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-700 ml-4 flex-shrink-0">{fmt(sub)}</span>
                                </div>
                              )
                            })}
                            <div className="flex items-center justify-between px-5 py-2.5 bg-white">
                              <span className="text-xs font-semibold text-slate-500 uppercase">Total serviços</span>
                              <span className="text-sm font-bold text-green-600">{fmt(totalSrv)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Estado inicial - nenhum mecânico selecionado */}
      {!mecSelecionado && mecanicosAtivos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
          <Users size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Selecione um mecânico acima</p>
          <p className="text-slate-300 text-sm mt-1">para ver os veículos e serviços executados</p>
        </div>
      )}
    </div>
  )
}

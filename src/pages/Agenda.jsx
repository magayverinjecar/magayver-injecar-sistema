import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock } from 'lucide-react'
import { useApp } from '../context/AppContext'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const DURACOES = ['30min', '1h', '1h30', '2h', '2h30', '3h', '4h']
const TIPOS = ['Serviço', 'Orçamento', 'Revisão', 'Entrega', 'Outro']

const TIPO_COR = {
  Serviço: 'bg-blue-100 border-blue-300 text-blue-800',
  Orçamento: 'bg-purple-100 border-purple-300 text-purple-800',
  Revisão: 'bg-green-100 border-green-300 text-green-800',
  Entrega: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  Outro: 'bg-slate-100 border-slate-300 text-slate-700',
}

function getInicioSemana(date) {
  const d = new Date(date)
  const dia = d.getDay()
  d.setDate(d.getDate() - dia)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDias(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toLocaleDateStr(date) {
  return date.toLocaleDateString('pt-BR')
}

function calcMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function calcAltura(duracao) {
  const map = { '30min': 40, '1h': 64, '1h30': 96, '2h': 128, '2h30': 160, '3h': 192, '4h': 256 }
  return map[duracao] || 64
}

const VAZIO_CADASTRADO = { clienteId: '', veiculoId: '', data: '', hora: '09:00', duracao: '1h', tipo: 'Serviço', servico: '', observacoes: '' }
const VAZIO_AVULSO = { nome: '', telefone: '', veiculo: '', data: '', hora: '09:00', duracao: '1h', tipo: 'Serviço', servico: '', observacoes: '' }

export default function Agenda() {
  const { agenda, setAgenda, clientes, veiculosPorCliente, getCliente, getVeiculo } = useApp()

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const [semanaBase, setSemanaBase] = useState(getInicioSemana(hoje))
  const [visao, setVisao] = useState('semana')
  const [modal, setModal] = useState(false)
  const [aba, setAba] = useState('cadastrado')
  const [formC, setFormC] = useState(VAZIO_CADASTRADO)
  const [formA, setFormA] = useState(VAZIO_AVULSO)
  const [filtro, setFiltro] = useState('Todos')

  const diasSemana = Array.from({ length: 7 }, (_, i) => addDias(semanaBase, i))
  const diaVisao = visao === 'dia' ? [hoje] : diasSemana

  const inicioStr = `${diasSemana[0].getDate()} ${MESES[diasSemana[0].getMonth()]}`
  const fimStr = `${diasSemana[6].getDate()} ${MESES[diasSemana[6].getMonth()]} ${diasSemana[6].getFullYear()}`

  const veiculosCliente = formC.clienteId ? veiculosPorCliente(Number(formC.clienteId)) : []

  const totalHoje = agenda.filter(a => a.data === toLocaleDateStr(hoje)).length
  const pendentes = agenda.filter(a => a.status === 'pendente').length

  const agendaFiltrada = filtro === 'Todos' ? agenda : agenda.filter(a => a.tipo === filtro)

  function agendamentosNoDia(dia) {
    const str = toLocaleDateStr(dia)
    return agendaFiltrada.filter(a => a.data === str).sort((a, b) => a.hora.localeCompare(b.hora))
  }

  function abrirModal(dia) {
    let dataStr = ''
    if (dia) {
      const y = dia.getFullYear()
      const m = String(dia.getMonth() + 1).padStart(2, '0')
      const d = String(dia.getDate()).padStart(2, '0')
      dataStr = `${y}-${m}-${d}`
    }
    setFormC({ ...VAZIO_CADASTRADO, data: dataStr })
    setFormA({ ...VAZIO_AVULSO, data: dataStr })
    setModal(true)
  }

  function salvar() {
    const hoje2 = new Date().toLocaleDateString('pt-BR')
    if (aba === 'cadastrado') {
      if (!formC.clienteId || !formC.hora || !formC.data) return
      const dataFmt = new Date(formC.data + 'T12:00:00').toLocaleDateString('pt-BR')
      const cliente = getCliente(Number(formC.clienteId))
      const veiculo = getVeiculo(Number(formC.veiculoId))
      setAgenda(prev => [...prev, {
        id: Date.now(),
        clienteId: Number(formC.clienteId),
        veiculoId: Number(formC.veiculoId) || null,
        nomeCliente: cliente?.nome || '',
        nomeVeiculo: veiculo ? `${veiculo.modelo} ${veiculo.placa}` : '',
        data: dataFmt,
        hora: formC.hora,
        duracao: formC.duracao,
        tipo: formC.tipo,
        servico: formC.servico,
        observacoes: formC.observacoes,
        status: 'pendente',
        avulso: false,
      }])
    } else {
      if (!formA.nome || !formA.hora || !formA.data) return
      const dataFmt = new Date(formA.data + 'T12:00:00').toLocaleDateString('pt-BR')
      setAgenda(prev => [...prev, {
        id: Date.now(),
        clienteId: null,
        nomeCliente: formA.nome,
        nomeVeiculo: formA.veiculo,
        telefone: formA.telefone,
        data: dataFmt,
        hora: formA.hora,
        duracao: formA.duracao,
        tipo: formA.tipo,
        servico: formA.servico,
        observacoes: formA.observacoes,
        status: 'pendente',
        avulso: true,
      }])
    }
    setModal(false)
    setFormC(VAZIO_CADASTRADO)
    setFormA(VAZIO_AVULSO)
  }

  function excluir(id) {
    setAgenda(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📅 Agenda
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Hoje: {totalHoje} &nbsp;·&nbsp; Pendentes: {pendentes}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filtro} onChange={e => setFiltro(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option>Todos</option>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setVisao('semana')} className={`px-4 py-2 text-sm font-medium transition-colors ${visao === 'semana' ? 'bg-primary-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Semana</button>
            <button onClick={() => setVisao('dia')} className={`px-4 py-2 text-sm font-medium transition-colors ${visao === 'dia' ? 'bg-primary-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Dia</button>
          </div>
          <button onClick={() => abrirModal(null)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />Agendar
          </button>
        </div>
      </div>

      {/* Navegação semana */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSemanaBase(d => addDias(d, -7))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <ChevronLeft size={16} className="text-slate-500" />
        </button>
        <button onClick={() => setSemanaBase(getInicioSemana(hoje))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          Hoje
        </button>
        <button onClick={() => setSemanaBase(d => addDias(d, 7))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <ChevronRight size={16} className="text-slate-500" />
        </button>
        <span className="text-sm font-medium text-slate-600">{inicioStr} — {fimStr}</span>
      </div>

      {/* Grade do calendário */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1">
        <div className={`grid border-b border-slate-100`} style={{ gridTemplateColumns: `repeat(${diaVisao.length}, 1fr)` }}>
          {diaVisao.map((dia, i) => {
            const ehHoje = toLocaleDateStr(dia) === toLocaleDateStr(hoje)
            const nomeDia = DIAS_SEMANA[dia.getDay()]
            return (
              <div key={i} className={`px-3 py-3 border-r border-slate-100 last:border-r-0 ${ehHoje ? 'bg-primary-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{nomeDia}</p>
                    <p className={`text-lg font-bold ${ehHoje ? 'text-primary-600' : 'text-slate-700'}`}>{dia.getDate()}</p>
                  </div>
                  <button onClick={() => abrirModal(dia)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-primary-100 hover:text-primary-600 text-slate-400 flex items-center justify-center transition-colors text-lg leading-none">
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className={`grid`} style={{ gridTemplateColumns: `repeat(${diaVisao.length}, 1fr)` }}>
          {diaVisao.map((dia, i) => {
            const ags = agendamentosNoDia(dia)
            const ehHoje = toLocaleDateStr(dia) === toLocaleDateStr(hoje)
            return (
              <div key={i} className={`border-r border-slate-100 last:border-r-0 p-2 overflow-y-auto space-y-1.5 ${ehHoje ? 'bg-primary-50/30' : ''}`} style={{ height: '420px' }}>
                {ags.length === 0 && (
                  <p className="text-xs text-slate-300 text-center mt-4">Sem agendamentos</p>
                )}
                {ags.map(a => (
                  <div key={a.id} className={`rounded-lg border px-2 py-1.5 text-xs cursor-pointer group relative ${TIPO_COR[a.tipo] || TIPO_COR['Outro']}`}
                    style={{ minHeight: calcAltura(a.duracao) }}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold flex items-center gap-1 truncate">
                          <Clock size={10} className="flex-shrink-0" />
                          {a.hora} — {a.duracao}
                        </p>
                        <p className="font-bold truncate mt-0.5">⚡ {a.nomeCliente}</p>
                        {a.nomeVeiculo && <p className="truncate opacity-75">{a.nomeVeiculo}</p>}
                        {a.servico && <p className="truncate opacity-75 mt-0.5">{a.tipo} · {a.servico}</p>}
                      </div>
                      <button onClick={() => excluir(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 flex-shrink-0">
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-base">Novo Agendamento</h3>
              <p className="text-xs text-slate-400 mt-0.5">Preencha as informações do agendamento</p>
            </div>

            {/* Abas */}
            <div className="flex mx-5 mt-4 gap-2">
              <button onClick={() => setAba('cadastrado')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${aba === 'cadastrado' ? 'bg-primary-500 text-white border-primary-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                👤 Cliente cadastrado
              </button>
              <button onClick={() => setAba('avulso')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${aba === 'avulso' ? 'bg-primary-500 text-white border-primary-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                ⚡ Avulso (rápido)
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-3">
              {aba === 'cadastrado' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                    <select value={formC.clienteId} onChange={e => setFormC(f => ({ ...f, clienteId: e.target.value, veiculoId: '' }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">Selecione o cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Veículo *</label>
                    <select value={formC.veiculoId} onChange={e => setFormC(f => ({ ...f, veiculoId: e.target.value }))}
                      disabled={!formC.clienteId}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400">
                      <option value="">{formC.clienteId ? 'Selecione um veículo' : 'Selecione um cliente primeiro'}</option>
                      {veiculosCliente.map(v => <option key={v.id} value={v.id}>{v.modelo} {v.placa}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do cliente *</label>
                    <input value={formA.nome} onChange={e => setFormA(f => ({ ...f, nome: e.target.value }))}
                      placeholder="Ex: João Silva"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                      <input value={formA.telefone} onChange={e => setFormA(f => ({ ...f, telefone: e.target.value }))}
                        placeholder="(opcional)"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Veículo</label>
                      <input value={formA.veiculo} onChange={e => setFormA(f => ({ ...f, veiculo: e.target.value }))}
                        placeholder="Ex: Civic ABC1D23"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Use o modo avulso para agendar rapidamente sem precisar criar ficha de cadastro. Você pode converter em cliente depois.</p>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
                  <input type="date"
                    value={aba === 'cadastrado' ? formC.data : formA.data}
                    onChange={e => aba === 'cadastrado' ? setFormC(f => ({ ...f, data: e.target.value })) : setFormA(f => ({ ...f, data: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horário *</label>
                  <input type="time"
                    value={aba === 'cadastrado' ? formC.hora : formA.hora}
                    onChange={e => aba === 'cadastrado' ? setFormC(f => ({ ...f, hora: e.target.value })) : setFormA(f => ({ ...f, hora: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duração</label>
                  <select value={aba === 'cadastrado' ? formC.duracao : formA.duracao}
                    onChange={e => aba === 'cadastrado' ? setFormC(f => ({ ...f, duracao: e.target.value })) : setFormA(f => ({ ...f, duracao: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {DURACOES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select value={aba === 'cadastrado' ? formC.tipo : formA.tipo}
                    onChange={e => aba === 'cadastrado' ? setFormC(f => ({ ...f, tipo: e.target.value })) : setFormA(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do serviço</label>
                <input
                  value={aba === 'cadastrado' ? formC.servico : formA.servico}
                  onChange={e => aba === 'cadastrado' ? setFormC(f => ({ ...f, servico: e.target.value })) : setFormA(f => ({ ...f, servico: e.target.value }))}
                  placeholder="Ex: Troca de óleo e filtros"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea
                  value={aba === 'cadastrado' ? formC.observacoes : formA.observacoes}
                  onChange={e => aba === 'cadastrado' ? setFormC(f => ({ ...f, observacoes: e.target.value })) : setFormA(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Notas internas..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Agendar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

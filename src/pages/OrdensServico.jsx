import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

export const STATUS_OS = [
  'Aberta', 'Diagnóstico', 'Aguardando Aprovação', 'Aprovada', 'Rejeitada',
  'Em Execução', 'Aguardando Peça', 'Concluída', 'Entregue', 'Cancelada',
]

export const statusColor = {
  'Aberta': 'bg-blue-100 text-blue-700',
  'Diagnóstico': 'bg-indigo-100 text-indigo-700',
  'Aguardando Aprovação': 'bg-yellow-100 text-yellow-700',
  'Aprovada': 'bg-teal-100 text-teal-700',
  'Rejeitada': 'bg-red-100 text-red-700',
  'Em Execução': 'bg-orange-100 text-orange-700',
  'Aguardando Peça': 'bg-amber-100 text-amber-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Entregue': 'bg-emerald-100 text-emerald-700',
  'Cancelada': 'bg-slate-200 text-slate-600',
}

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const vazio = { clienteId: '', veiculoId: '', kmEntrada: '', mecanicoId: '', descricaoProblema: '' }

export default function OrdensServico() {
  const { ordens, novaOrdem, getCliente, getVeiculo, clientes, veiculosPorCliente, funcionarios, totalOrdem, checklists } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroMec, setFiltroMec] = useState('Todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const buscaRef = useRef(null)

  const veiculosDoCliente = form.clienteId ? veiculosPorCliente(Number(form.clienteId)) : []

  // Clientes ordenados do mais recente + filtrados pela busca
  const clientesOrdenados = [...clientes].sort((a, b) => b.id - a.id)
  const clientesFiltrados = clientesOrdenados.filter(c =>
    !buscaCliente.trim() || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  function selecionarCliente(c) {
    setForm(f => ({ ...f, clienteId: String(c.id), veiculoId: '', descricaoProblema: '', kmEntrada: '' }))
    setBuscaCliente(c.nome)
    setDropdownAberto(false)
  }

  function abrirModal() {
    setForm(vazio)
    setBuscaCliente('')
    setDropdownAberto(false)
    setModal(true)
  }

  const filtradas = ordens.filter(o => {
    const cliente = getCliente(o.clienteId)
    const veiculo = getVeiculo(o.veiculoId)
    const termo = busca.toLowerCase()
    const matchBusca = o.id.toLowerCase().includes(termo)
      || (cliente?.nome || '').toLowerCase().includes(termo)
      || (veiculo?.placa || '').toLowerCase().includes(termo)
    const matchStatus = filtroStatus === 'Todos' || o.status === filtroStatus
    const matchMec = filtroMec === 'Todos' || String(o.mecanicoId) === filtroMec
    return matchBusca && matchStatus && matchMec
  })

  function salvar() {
    if (!form.clienteId || !form.veiculoId) return
    const id = novaOrdem({
      clienteId: Number(form.clienteId),
      veiculoId: Number(form.veiculoId),
      kmEntrada: form.kmEntrada,
      mecanicoId: form.mecanicoId ? Number(form.mecanicoId) : null,
      descricaoProblema: form.descricaoProblema,
    })
    setForm(vazio)
    setModal(false)
    navigate(`/ordens-servico/${encodeURIComponent(id)}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço</h2>
        <button onClick={abrirModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova OS
        </button>
      </div>

      {/* filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por número, cliente ou placa..." value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="Todos">Todos</option>
          {STATUS_OS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroMec} onChange={e => setFiltroMec(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="Todos">Todos os mecânicos</option>
          {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* Cards — mobile */}
      <div className="space-y-3 md:hidden">
        {filtradas.length === 0 && <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-slate-100">Nenhuma OS encontrada.</p>}
        {filtradas.map(o => {
          const cliente = getCliente(o.clienteId)
          const veiculo = getVeiculo(o.veiculoId)
          const total = totalOrdem(o)
          return (
            <div key={o.id} onClick={() => navigate(`/ordens-servico/${encodeURIComponent(o.id)}`)} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-semibold text-slate-700">{o.id}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusColor[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{cliente?.nome || '—'}</p>
              {veiculo && <p className="text-sm text-slate-500 mt-0.5">{veiculo.placa} · {veiculo.modelo}</p>}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">{o.data}</span>
                <span className="text-sm font-bold text-slate-700">{total > 0 ? fmt(total) : '—'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nº</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtradas.map(o => {
              const cliente = getCliente(o.clienteId)
              const veiculo = getVeiculo(o.veiculoId)
              const total = totalOrdem(o)
              return (
                <tr key={o.id} onClick={() => navigate(`/ordens-servico/${encodeURIComponent(o.id)}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 text-sm font-mono font-medium text-slate-700">{o.id}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{cliente?.nome || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{veiculo ? `${veiculo.placa} ${veiculo.modelo}` : '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700">{total > 0 ? fmt(total) : '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{o.data}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/ordens-servico/${encodeURIComponent(o.id)}`) }} className="text-xs text-primary-500 hover:text-primary-600 font-medium">Abrir</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Nenhuma OS encontrada.</p>}
      </div>

      {modal && (
        <Modal title="Nova Ordem de Serviço" onClose={() => { setModal(false); setForm(vazio) }}>
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  ref={buscaRef}
                  type="text"
                  placeholder="Buscar por nome..."
                  value={buscaCliente}
                  onChange={e => { setBuscaCliente(e.target.value); setDropdownAberto(true); setForm(f => ({ ...f, clienteId: '', veiculoId: '' })) }}
                  onFocus={() => setDropdownAberto(true)}
                  onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {dropdownAberto && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum cliente encontrado</p>
                  ) : (
                    clientesFiltrados.map((c, idx) => (
                      <button key={c.id} onMouseDown={() => selecionarCliente(c)}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                          {c.telefone && <p className="text-xs text-slate-400">{c.telefone}</p>}
                        </div>
                        {idx === 0 && <span className="text-[10px] bg-primary-50 text-primary-500 font-bold px-1.5 py-0.5 rounded">Recente</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {form.clienteId && (
                <p className="text-xs text-green-600 mt-1">✓ Cliente selecionado</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Veículo *</label>
              <select value={form.veiculoId} onChange={e => {
                const vId = e.target.value
                const ck = checklists
                  .filter(c => String(c.veiculoId) === vId && c.relatoCliente)
                  .sort((a, b) => b.id - a.id)[0]
                setForm(f => ({ ...f, veiculoId: vId, descricaoProblema: ck?.relatoCliente || f.descricaoProblema, kmEntrada: ck?.kmEntrada || f.kmEntrada }))
              }} disabled={!form.clienteId}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400">
                <option value="">{form.clienteId ? 'Selecione' : 'Selecione o cliente primeiro'}</option>
                {veiculosDoCliente.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">KM de Entrada</label>
              <input value={form.kmEntrada} onChange={e => setForm(f => ({ ...f, kmEntrada: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mecânico Responsável</label>
              <select value={form.mecanicoId} onChange={e => setForm(f => ({ ...f, mecanicoId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Nenhum</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Problema</label>
              <textarea value={form.descricaoProblema} onChange={e => setForm(f => ({ ...f, descricaoProblema: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
            <button onClick={salvar} disabled={!form.clienteId || !form.veiculoId} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Criar OS</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

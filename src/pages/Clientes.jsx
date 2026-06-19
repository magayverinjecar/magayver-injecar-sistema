import { useState } from 'react'
import { Search, Plus, Phone, Mail, Car, Trash2, ChevronRight, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { nome: '', telefone: '', email: '' }

export default function Clientes() {
  const { clientes, setClientes, veiculosPorCliente, ordensPorCliente, getVeiculo } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [erroNome, setErroNome] = useState(false)
  const [detalhe, setDetalhe] = useState(null)

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))

  function salvar() {
    if (!form.nome.trim()) { setErroNome(true); return }
    setErroNome(false)
    try {
      setClientes(prev => [...prev, { ...form, id: Date.now() }])
      setForm(vazio)
      setModal(false)
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
      alert('Erro ao salvar cliente: ' + err.message)
    }
  }

  function fecharModal() {
    setModal(false)
    setForm(vazio)
    setErroNome(false)
  }

  function excluir(id) {
    if (confirm('Excluir este cliente?')) {
      setClientes(prev => prev.filter(c => c.id !== id))
      if (detalhe?.id === id) setDetalhe(null)
    }
  }

  const clienteDetalhe = detalhe ? clientes.find(c => c.id === detalhe) : null
  const veiculosDetalhe = clienteDetalhe ? veiculosPorCliente(clienteDetalhe.id) : []
  const ordensDetalhe = clienteDetalhe ? ordensPorCliente(clienteDetalhe.id) : []

  const statusColor = {
    'Em andamento': 'bg-blue-100 text-blue-700',
    'Aguardando': 'bg-yellow-100 text-yellow-700',
    'Concluída': 'bg-green-100 text-green-700',
    'Cancelada': 'bg-red-100 text-red-700',
  }

  return (
    <div className="flex gap-5 h-full flex-col lg:flex-row">
      {/* Lista */}
      <div className={`space-y-4 ${detalhe ? 'lg:flex-1' : 'w-full'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-full" />
          </div>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
            <Plus size={16} />Novo Cliente
          </button>
        </div>

        {/* Cards — mobile */}
        <div className="space-y-3 md:hidden">
          {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8 bg-white rounded-xl border border-slate-100">Nenhum cliente encontrado.</p>}
          {filtrados.map(c => {
            const veics = veiculosPorCliente(c.id)
            const ordens = ordensPorCliente(c.id)
            return (
              <div key={c.id} onClick={() => setDetalhe(detalhe === c.id ? null : c.id)}
                className={`bg-white rounded-xl border border-slate-100 shadow-sm p-4 cursor-pointer transition-colors ${detalhe === c.id ? 'border-primary-300 bg-primary-50' : 'active:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-semibold flex-shrink-0">{c.nome[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{c.nome}</p>
                    {c.telefone && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Phone size={11} />{c.telefone}</p>}
                    {c.email && <p className="text-xs text-slate-400 truncate flex items-center gap-1"><Mail size={11} />{c.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs text-slate-400">
                    <span className="flex items-center gap-0.5"><Car size={12} />{veics.length}</span>
                    <button onClick={e => { e.stopPropagation(); excluir(c.id) }} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} className={`text-slate-300 transition-transform ${detalhe === c.id ? 'rotate-90' : ''}`} />
                  </div>
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                {!detalhe && <>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
                </>}
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veíc.</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OS</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(c => {
                const veics = veiculosPorCliente(c.id)
                const ordens = ordensPorCliente(c.id)
                return (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${detalhe === c.id ? 'bg-primary-50' : ''}`} onClick={() => setDetalhe(detalhe === c.id ? null : c.id)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-semibold">{c.nome[0]}</div>
                        <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                      </div>
                    </td>
                    {!detalhe && <>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" />{c.telefone || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" />{c.email || '—'}</div>
                      </td>
                    </>}
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      <div className="flex items-center gap-1"><Car size={13} className="text-slate-400" />{veics.length}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{ordens.length}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => { e.stopPropagation(); excluir(c.id) }} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={14} className={`text-slate-300 transition-transform ${detalhe === c.id ? 'rotate-90' : ''}`} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum cliente encontrado.</p>}
        </div>
      </div>

      {/* Painel de detalhe */}
      {clienteDetalhe && (
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">{clienteDetalhe.nome}</h3>
              <button onClick={() => setDetalhe(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-2 text-sm text-slate-600">
              {clienteDetalhe.telefone && <div className="flex items-center gap-2"><Phone size={13} className="text-slate-400" />{clienteDetalhe.telefone}</div>}
              {clienteDetalhe.email && <div className="flex items-center gap-2"><Mail size={13} className="text-slate-400" />{clienteDetalhe.email}</div>}
            </div>
          </div>

          {/* Veículos */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Veículos ({veiculosDetalhe.length})</p>
            </div>
            <div className="divide-y divide-slate-50">
              {veiculosDetalhe.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">Nenhum veículo.</p>}
              {veiculosDetalhe.map(v => (
                <div key={v.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">{v.modelo}</p>
                  <p className="text-xs text-slate-400">{v.placa} • {v.ano} • {v.cor}</p>
                </div>
              ))}
            </div>
          </div>

          {/* OS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Ordens de Serviço ({ordensDetalhe.length})</p>
            </div>
            <div className="divide-y divide-slate-50">
              {ordensDetalhe.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">Nenhuma OS.</p>}
              {ordensDetalhe.map(o => (
                <div key={o.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400">{o.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status]}`}>{o.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 truncate">{o.servico}</p>
                  <p className="text-xs font-semibold text-slate-700">R$ {o.valor}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <Modal title="Novo Cliente" onClose={fecharModal} backdropClose={false}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input
                value={form.nome}
                onChange={e => { setForm(f => ({ ...f, nome: e.target.value })); setErroNome(false) }}
                placeholder="Nome completo"
                autoFocus
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${erroNome ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
              />
              {erroNome && <p className="text-xs text-red-500 mt-1">Informe o nome do cliente.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-0000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={fecharModal} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button type="button" onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

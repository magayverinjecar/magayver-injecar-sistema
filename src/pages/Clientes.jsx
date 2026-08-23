import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Phone, Mail, Car, Trash2, ChevronRight, X, Megaphone } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { ORIGENS_CLIENTE } from '../utils/origemCliente'

export default function Clientes() {
  const navigate = useNavigate()
  const { clientes, setClientes, veiculos, ordens, veiculosPorCliente, ordensPorCliente, getVeiculo } = useApp()
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))

  // Totais do rodapé contados em UMA passada pelas listas inteiras, e não
  // chamando veiculosPorCliente/ordensPorCliente cliente a cliente: com a
  // carteira cheia isso varreria a tabela de ordens uma vez por linha da tela.
  const idsNaTela = new Set(filtrados.map(c => c.id))
  const totalVeiculos = veiculos.filter(v => idsNaTela.has(v.clienteId)).length
  const totalOrdens = ordens.filter(o => idsNaTela.has(o.clienteId)).length
  // Cliente sem telefone é o que trava o dia: o carro fica pronto e não tem
  // como avisar. O rodapé mostra quantos são para não descobrir um por um.
  const semTelefone = filtrados.filter(c => !String(c.telefone || '').trim()).length
  // A mesma lógica do "sem telefone", para a outra lacuna: enquanto este número
  // for alto, o relatório de origem no Financeiro fala de pouca gente. Aqui dá
  // para ir fechando a conta — abrir a ficha e responder leva um clique.
  const semOrigem = filtrados.filter(c => !String(c.origem || '').trim()).length

  // Cadastrar vive em tela propria (`pages/Cliente.jsx`): ficha de
  // cadastro nao e decisao curta, e como popup ela nao tinha endereco proprio
  // nem sobrevivia a um clique fora.

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
          <button onClick={() => navigate('/clientes/novo')} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
            <Plus size={16} />Novo Cliente
          </button>
        </div>

        {/* Cards — mobile */}
        <div className="space-y-3 md:hidden">
          {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8 bg-white rounded-xl border border-slate-100">Nenhum cliente encontrado.</p>}
          {filtrados.map(c => {
            const veics = veiculosPorCliente(c.id)
            const ordensDoCliente = ordensPorCliente(c.id)
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
                    <button onClick={e => { e.stopPropagation(); excluir(c.id) }} className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
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
                  {/* Placa e modelo já estão carregados aqui, mas hoje só
                      aparecem depois de abrir a ficha — e no balcão o cliente é
                      lembrado pelo carro, não pelo sobrenome. Some quando o
                      painel de detalhe abre, junto com telefone e e-mail. */}
                  <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
                </>}
                {/* Colunas de contagem à direita: número embaixo de número é o
                    que deixa a coluna conferível de cima a baixo. */}
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veíc.</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OS</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(c => {
                const veics = veiculosPorCliente(c.id)
                const ordensDoCliente = ordensPorCliente(c.id)
                return (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${detalhe === c.id ? 'bg-primary-50' : ''}`} onClick={() => setDetalhe(detalhe === c.id ? null : c.id)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-semibold">{c.nome[0]}</div>
                        <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                      </div>
                    </td>
                    {!detalhe && <>
                      {/* Mostra o primeiro carro e conta o resto: quem tem
                          frota não pode esticar a linha e quebrar a tabela. O
                          title traz a lista toda sem precisar abrir a ficha. */}
                      <td className="hidden lg:table-cell px-5 py-3.5 text-sm text-slate-600"
                        title={veics.length ? veics.map(v => [v.placa, v.modelo].filter(Boolean).join(' ')).join(' · ') : undefined}>
                        {veics.length === 0 ? <span className="text-slate-300">—</span> : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-slate-500 whitespace-nowrap">{veics[0].placa || '—'}</span>
                            <span className="text-slate-400 truncate max-w-[11rem]">{veics[0].modelo}</span>
                            {veics.length > 1 && <span className="text-[11px] text-slate-400 whitespace-nowrap">+{veics.length - 1}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" />{c.telefone || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" />{c.email || '—'}</div>
                      </td>
                    </>}
                    <td className="px-5 py-3.5 text-sm text-slate-600 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-1"><Car size={13} className="text-slate-400" />{veics.length}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 text-right tabular-nums">{ordensDoCliente.length}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => { e.stopPropagation(); excluir(c.id) }} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
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
          {/* Rodapé de sistema: com a busca aberta a lista mente sobre o
              tamanho da carteira, então ele diz quantos apareceram de quantos
              existem — e quantos carros e OS esse recorte carrega. */}
          {filtrados.length > 0 && (
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              <span>
                {filtrados.length} {filtrados.length === 1 ? 'cliente' : 'clientes'}
                {busca && ` (de ${clientes.length})`}
                {semTelefone > 0 && (
                  <span className="ml-2 text-slate-500" title="Sem telefone não dá para avisar que o carro ficou pronto">
                    · {semTelefone} sem telefone
                  </span>
                )}
                {semOrigem > 0 && (
                  <span className="ml-2 text-slate-500" title="Sem a origem, o relatório de canal no Financeiro não conta este cliente">
                    · {semOrigem} sem origem
                  </span>
                )}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                <span>Veículos: <strong className="font-medium">{totalVeiculos.toLocaleString('pt-BR')}</strong></span>
                <span>OS: <strong className="font-medium">{totalOrdens.toLocaleString('pt-BR')}</strong></span>
              </span>
            </div>
          )}
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

              {/* Preencher a origem dos cadastros antigos. Grava na escolha, sem
                  botão de salvar: são 200 fichas para completar, e um modal com
                  confirmação a cada uma faria ninguém completar nenhuma. */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
                  <Megaphone size={13} className="text-slate-400" /> Como nos conheceu
                </label>
                <select value={clienteDetalhe.origem || ''}
                  onChange={e => {
                    const v = e.target.value
                    setClientes(prev => prev.map(c => c.id === clienteDetalhe.id ? { ...c, origem: v } : c))
                  }}
                  className={`w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    clienteDetalhe.origem ? 'border-slate-200 text-slate-700' : 'border-amber-200 bg-amber-50 text-slate-400'
                  }`}>
                  <option value="">Não perguntado</option>
                  {ORIGENS_CLIENTE.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
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

    </div>
  )
}

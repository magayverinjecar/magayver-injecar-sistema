import { useState, useRef } from 'react'
import { Plus, FileText, Eye, Copy, MessageCircle, Printer, ArrowRight, Trash2, X, List, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const statusColor = {
  Pendente: 'bg-yellow-100 text-yellow-700',
  Aprovado: 'bg-green-100 text-green-700',
  Recusado: 'bg-red-100 text-red-700',
  Convertido: 'bg-blue-100 text-blue-700',
}

const VAZIO_CLIENTE = { clienteId: '', nome: '', telefone: '', veiculo: '', placa: '', km: '' }
const VAZIO_ITEM = { tipo: 'Serviço', refId: '', descricao: '', quantidade: '1', valorUnitario: '', desconto: '0' }

function parseNum(v) {
  return parseFloat((v || '0').toString().replace(',', '.')) || 0
}
const fmt = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Orcamentos() {
  const navigate = useNavigate()
  const { orcamentos, setOrcamentos, clientes, veiculos, veiculosPorCliente, servicos, estoque, getCliente, novaOrdem } = useApp()

  const [aba, setAba] = useState('salvos')
  const [dados, setDados] = useState(VAZIO_CLIENTE)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [itens, setItens] = useState([])
  const [observacoes, setObservacoes] = useState('')
  const [validade, setValidade] = useState('7 dias')
  const [modalItem, setModalItem] = useState(false)
  const [item, setItem] = useState(VAZIO_ITEM)

  const totalGeral = itens.reduce((s, it) => s + (parseNum(it.valorUnitario) * parseNum(it.quantidade) - parseNum(it.desconto)), 0)

  const veiculosCliente = dados.clienteId ? veiculosPorCliente(Number(dados.clienteId)) : []

  // Clientes ordenados do mais recente + filtrados pela busca
  const clientesOrdenados = [...clientes].sort((a, b) => b.id - a.id)
  const clientesFiltrados = clientesOrdenados.filter(c =>
    !buscaCliente.trim() || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  function selecionarCliente(c) {
    const veics = veiculosPorCliente(Number(c.id))
    const v = veics[0]
    setDados({
      clienteId: String(c.id),
      nome: c?.nome || '',
      telefone: c?.telefone || '',
      veiculo: v ? `${v.modelo} ${v.ano || ''}`.trim() : '',
      placa: v?.placa || '',
      km: v?.km || '',
    })
    setBuscaCliente(c.nome)
    setDropdownAberto(false)
  }

  function limparCliente() {
    setDados(VAZIO_CLIENTE)
  }

  // --- itens ---
  function selecionarServico(id) {
    if (!id) { setItem(it => ({ ...it, refId: '' })); return }
    const s = servicos.find(x => x.id === Number(id))
    if (s) setItem(it => ({ ...it, refId: id, descricao: s.nome, valorUnitario: s.preco }))
  }
  function selecionarProduto(id) {
    if (!id) { setItem(it => ({ ...it, refId: '' })); return }
    const p = estoque.find(x => x.id === Number(id))
    if (p) setItem(it => ({ ...it, refId: id, descricao: p.nome, valorUnitario: p.preco }))
  }

  function adicionarItem() {
    if (!item.descricao.trim()) return
    setItens(prev => [...prev, { ...item, id: Date.now() }])
    setItem(VAZIO_ITEM)
    setModalItem(false)
  }
  function removerItem(id) {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  function novo() {
    setDados(VAZIO_CLIENTE)
    setBuscaCliente('')
    setItens([])
    setObservacoes('')
    setValidade('7 dias')
    setAba('novo')
  }

  function salvar() {
    if (!dados.nome.trim()) { alert('Informe o nome do cliente.'); return }
    const numero = '#' + Math.floor(1000 + Math.random() * 9000)
    const novo = {
      id: Date.now(),
      numero,
      clienteId: dados.clienteId ? Number(dados.clienteId) : null,
      nome: dados.nome,
      telefone: dados.telefone,
      veiculo: dados.veiculo,
      placa: dados.placa,
      km: dados.km,
      itens,
      observacoes,
      validade,
      total: totalGeral,
      status: 'Pendente',
      data: new Date().toLocaleDateString('pt-BR'),
    }
    setOrcamentos(prev => [novo, ...prev])
    setAba('salvos')
  }

  function mudarStatus(id, status) {
    setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  function excluir(id) {
    if (confirm('Excluir este orçamento?')) setOrcamentos(prev => prev.filter(o => o.id !== id))
  }

  function converterEmOS(orc) {
    if (!confirm('Converter este orçamento em Ordem de Serviço?')) return

    // tenta encontrar o veículo pelo clienteId + placa
    const veiculosDoCliente = orc.clienteId ? veiculosPorCliente(Number(orc.clienteId)) : []
    const veiculo = orc.placa
      ? veiculosDoCliente.find(v => v.placa === orc.placa) || veiculos.find(v => v.placa === orc.placa)
      : veiculosDoCliente[0] || null

    // transfere os itens do orçamento para o formato da OS
    const itensOS = (orc.itens || []).map(i => ({
      id: Date.now() + Math.random(),
      tipo: i.tipo === 'Serviço' ? 'servico' : 'peca',
      produtoId: i.tipo !== 'Serviço' ? Number(i.refId) || null : null,
      servicoId: i.tipo === 'Serviço' ? Number(i.refId) || null : null,
      descricao: i.descricao,
      quantidade: Number(i.quantidade) || 1,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto || '0',
    }))

    novaOrdem({
      clienteId: orc.clienteId ? Number(orc.clienteId) : null,
      veiculoId: veiculo?.id || null,
      descricaoProblema: orc.observacoes || `Orçamento ${orc.numero}`,
      status: 'Aberta',
      itens: itensOS,
    })
    mudarStatus(orc.id, 'Convertido')
    alert(`Orçamento ${orc.numero} convertido em OS com sucesso!`)
  }

  function enviarWhatsapp() {
    const linhas = itens.map(i => `• ${i.descricao} (${i.quantidade}x) - ${fmt(parseNum(i.valorUnitario) * parseNum(i.quantidade) - parseNum(i.desconto))}`).join('%0A')
    const texto = `*Orçamento - Magayver Injecar*%0A%0ACliente: ${dados.nome}%0AVeículo: ${dados.veiculo} ${dados.placa}%0A%0A${linhas}%0A%0A*Total: ${fmt(totalGeral)}*%0AValidade: ${validade}`
    const tel = dados.telefone.replace(/\D/g, '')
    window.open(`https://wa.me/55${tel}?text=${texto}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Orçamentos</h2>
          <p className="text-sm text-slate-500">Crie, salve e envie orçamentos. Converta em OS quando aprovado.</p>
        </div>
        <button onClick={novo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Orçamento
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setAba('salvos')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'salvos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <List size={14} />Orçamentos Salvos
        </button>
        <button onClick={novo} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'novo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Plus size={14} />Novo
        </button>
      </div>

      {/* === ABA SALVOS === */}
      {aba === 'salvos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {orcamentos.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-16">Nenhum orçamento salvo ainda.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orcamentos.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{o.numero}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{o.nome}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{o.veiculo} {o.placa && `(${o.placa})`}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700">{fmt(o.total)}</td>
                    <td className="px-5 py-3.5">
                      <select value={o.status} onChange={e => mudarStatus(o.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${statusColor[o.status]}`}>
                        <option>Pendente</option>
                        <option>Aprovado</option>
                        <option>Recusado</option>
                        <option>Convertido</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{o.data}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button title="Imprimir" onClick={() => window.print()} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-600 transition-colors"><Printer size={15} /></button>
                        <button title="Converter em OS" onClick={() => converterEmOS(o)} className="p-1.5 rounded hover:bg-blue-50 hover:text-blue-500 transition-colors"><ArrowRight size={15} /></button>
                        <button title="Excluir" onClick={() => excluir(o.id)} className="p-1.5 rounded hover:bg-red-50 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* === ABA NOVO === */}
      {aba === 'novo' && (
        <div className="space-y-4">
          {/* Dados do Cliente / Veículo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800">Dados do Cliente / Veículo</h3>
            <p className="text-xs text-slate-400 mb-4">Selecione um cliente cadastrado ou preencha manualmente</p>

            <div className="mb-4 relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Selecionar Cliente Cadastrado</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={buscaCliente}
                  onChange={e => { setBuscaCliente(e.target.value); setDropdownAberto(true); limparCliente() }}
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
                        {idx === 0 && <span className="text-[10px] bg-primary-50 text-primary-500 font-bold px-1.5 py-0.5 rounded flex-shrink-0">Recente</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {dados.clienteId && (
                <p className="text-xs text-green-600 mt-1">✓ Cliente selecionado</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cliente</label>
                <input value={dados.nome} onChange={e => setDados(d => ({ ...d, nome: e.target.value }))} placeholder="Nome" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone (WhatsApp)</label>
                <input value={dados.telefone} onChange={e => setDados(d => ({ ...d, telefone: e.target.value }))} placeholder="(11) 99999-9999" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Veículo</label>
                <input value={dados.veiculo} onChange={e => setDados(d => ({ ...d, veiculo: e.target.value }))} placeholder="Ex: Gol 2020" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                <input value={dados.placa} onChange={e => setDados(d => ({ ...d, placa: e.target.value }))} placeholder="ABC-1234" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mt-3 max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">KM Atual</label>
              <input value={dados.km} onChange={e => setDados(d => ({ ...d, km: e.target.value }))} placeholder="Ex: 45.000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* Itens do Orçamento */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Itens do Orçamento</h3>
                <p className="text-xs text-slate-400">Serviços e peças</p>
              </div>
              <button onClick={() => { setItem(VAZIO_ITEM); setModalItem(true) }} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                <Plus size={15} />Adicionar Item
              </button>
            </div>

            {itens.length === 0 ? (
              <div className="text-center py-10">
                <FileText size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum item adicionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {itens.map(it => {
                  const subtotal = parseNum(it.valorUnitario) * parseNum(it.quantidade) - parseNum(it.desconto)
                  return (
                    <div key={it.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${it.tipo === 'Serviço' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{it.tipo}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{it.descricao}</p>
                          <p className="text-xs text-slate-400">{it.quantidade}x {fmt(parseNum(it.valorUnitario))}{parseNum(it.desconto) > 0 && ` · desc. ${fmt(parseNum(it.desconto))}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-700">{fmt(subtotal)}</span>
                        <button onClick={() => removerItem(it.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Total:</span>
                  <span className="text-lg font-bold text-primary-600">{fmt(totalGeral)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Observações + Validade */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Garantia, condições, prazo..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Validade</label>
                <select value={validade} onChange={e => setValidade(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>7 dias</option>
                  <option>15 dias</option>
                  <option>30 dias</option>
                  <option>60 dias</option>
                </select>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={salvar} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <FileText size={15} />Salvar Orçamento
            </button>
            <button onClick={enviarWhatsapp} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <MessageCircle size={15} />Enviar Orçamento via WhatsApp
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              <Printer size={15} />Imprimir
            </button>
          </div>
        </div>
      )}

      {/* === MODAL ADICIONAR ITEM === */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalItem(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Adicionar Item</h3>
              <button onClick={() => setModalItem(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select value={item.tipo} onChange={e => setItem(it => ({ ...VAZIO_ITEM, tipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="Serviço">🔧 Serviço</option>
                  <option value="Peça / Produto">⚙️ Peça / Produto</option>
                </select>
              </div>

              {item.tipo === 'Serviço' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-slate-700">Serviço cadastrado</label>
                    <button type="button" onClick={() => { setModalItem(false); navigate('/servicos') }} className="text-xs text-primary-500 hover:text-primary-700 font-medium">+ Criar novo</button>
                  </div>
                  <select value={item.refId} onChange={e => selecionarServico(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Selecione um serviço...</option>
                    {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} — R$ {s.preco}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-slate-700">Produto do estoque</label>
                    <button type="button" onClick={() => { setModalItem(false); navigate('/estoque') }} className="text-xs text-primary-500 hover:text-primary-700 font-medium">+ Criar novo</button>
                  </div>
                  <select value={item.refId} onChange={e => selecionarProduto(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Selecione um produto...</option>
                    {estoque.map(p => <option key={p.id} value={p.id}>{p.nome} — R$ {p.preco}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input value={item.descricao} onChange={e => setItem(it => ({ ...it, descricao: e.target.value }))}
                  placeholder="Descreva o serviço ou peça" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input type="number" value={item.quantidade} onChange={e => setItem(it => ({ ...it, quantidade: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input value={item.valorUnitario} onChange={e => setItem(it => ({ ...it, valorUnitario: e.target.value }))}
                    placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (R$)</label>
                  <input value={item.desconto} onChange={e => setItem(it => ({ ...it, desconto: e.target.value }))}
                    placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <button onClick={adicionarItem} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

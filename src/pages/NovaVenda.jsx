import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, Trash2, Printer, FileText, CheckCircle, Package } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { imprimirReciboCaixa } from '../utils/print'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

const FORMAS = ['Dinheiro', 'PIX', 'Transferência', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Vale Funcionário', 'Outro', 'Pagar Depois']
const COM_TAXA = ['Cartão Crédito', 'Cartão Débito']

const PASSOS = ['Identificação', 'Itens', 'Pagamento', 'Confirmação', 'Concluído']

export default function NovaVenda() {
  const navigate = useNavigate()
  const { caixaTurno, registrarVendaCaixa, clientes, veiculosPorCliente, servicos, estoque, ordens, orcamentos, getCliente } = useApp()

  const [passo, setPasso] = useState(1)
  const [clienteId, setClienteId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [importBusca, setImportBusca] = useState('')

  const [itens, setItens] = useState([])
  const [buscaPeca, setBuscaPeca] = useState('')
  const [buscaServico, setBuscaServico] = useState('')

  const [pagamentos, setPagamentos] = useState([])
  const [formaPag, setFormaPag] = useState('Dinheiro')
  const [valorPag, setValorPag] = useState('')
  const [taxaPag, setTaxaPag] = useState('')
  const [refPag, setRefPag] = useState('')
  const [obsPag, setObsPag] = useState('')

  const [vendaNumero, setVendaNumero] = useState('')
  const [vendaFinalizada, setVendaFinalizada] = useState(null)

  if (!caixaTurno) { navigate('/caixa'); return null }

  const subtotal = itens.reduce((s, i) => s + pNum(i.preco) * pNum(i.qtd) - pNum(i.desc), 0)
  const total = subtotal
  const totalPago = pagamentos.filter(p => p.forma !== 'Pagar Depois').reduce((s, p) => s + pNum(p.valor) - pNum(p.taxa), 0)
  const falta = Math.max(0, total - totalPago)

  const veiculosCliente = clienteId ? veiculosPorCliente(Number(clienteId)) : []
  const clientesFiltrados = buscaCliente
    ? clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()))
    : []

  const pecasFiltradas = buscaPeca ? estoque.filter(p => p.nome.toLowerCase().includes(buscaPeca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(buscaPeca.toLowerCase())) : estoque
  const servicosFiltrados = buscaServico ? servicos.filter(s => s.nome.toLowerCase().includes(buscaServico.toLowerCase())) : servicos

  // === importar OS / orçamento ===
  function importar() {
    const termo = importBusca.trim().toLowerCase().replace('#', '')
    if (!termo) return
    const os = ordens.find(o => o.id.toLowerCase().replace('os-', '').includes(termo))
    if (os) {
      const cli = getCliente(os.clienteId)
      if (cli) { setClienteId(String(cli.id)); setClienteNome(cli.nome) }
      setItens([{ id: Date.now(), tipo: 'servico', nome: os.servico, preco: os.valor, qtd: '1', desc: '0' }])
      alert(`OS ${os.id} importada!`)
      return
    }
    const orc = orcamentos.find(o => o.numero.toLowerCase().includes(termo))
    if (orc) {
      setClienteNome(orc.nome)
      if (orc.clienteId) setClienteId(String(orc.clienteId))
      setItens(orc.itens.map(it => ({ id: Date.now() + Math.random(), tipo: it.tipo === 'Serviço' ? 'servico' : 'peca', nome: it.descricao, preco: it.valorUnitario, qtd: it.quantidade, desc: it.desconto || '0' })))
      alert(`Orçamento ${orc.numero} importado!`)
      return
    }
    alert('OS ou orçamento não encontrado.')
  }

  function selecionarCliente(c) {
    setClienteId(String(c.id)); setClienteNome(c.nome); setBuscaCliente('')
  }

  function addItem(item) {
    setItens(prev => [...prev, item])
  }
  function addPeca(p) {
    addItem({ id: Date.now() + Math.random(), tipo: 'peca', nome: p.nome, produtoId: p.id, preco: p.preco, qtd: '1', desc: '0' })
  }
  function addServico(s) {
    addItem({ id: Date.now() + Math.random(), tipo: 'servico', nome: s.nome, preco: s.preco, qtd: '1', desc: '0' })
  }
  function updItem(id, campo, val) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [campo]: val } : i))
  }
  function delItem(id) { setItens(prev => prev.filter(i => i.id !== id)) }

  // === pagamentos ===
  function addPagamento() {
    const v = formaPag === 'Pagar Depois' ? falta : pNum(valorPag)
    if (formaPag !== 'Pagar Depois' && v <= 0) return
    setPagamentos(prev => [...prev, { id: Date.now(), forma: formaPag, valor: formaPag === 'Pagar Depois' ? 0 : v, taxa: pNum(taxaPag), ref: refPag, depois: formaPag === 'Pagar Depois' ? falta : 0 }])
    setValorPag(''); setTaxaPag(''); setRefPag('')
  }
  function preencherRestante() {
    setPagamentos(prev => [...prev, { id: Date.now(), forma: formaPag, valor: falta, taxa: pNum(taxaPag), ref: refPag }])
    setValorPag(''); setTaxaPag(''); setRefPag('')
  }
  function restantePagarDepois() {
    setPagamentos(prev => [...prev, { id: Date.now(), forma: 'Pagar Depois', valor: 0, taxa: 0, ref: '', depois: falta }])
  }
  function delPagamento(id) { setPagamentos(prev => prev.filter(p => p.id !== id)) }

  function finalizar() {
    const dadosVenda = {
      clienteId: clienteId ? Number(clienteId) : null,
      clienteNome: clienteNome || 'Consumidor',
      veiculoId: veiculoId ? Number(veiculoId) : null,
      itens,
      pagamentos,
      total,
      observacoes: obsPag,
    }
    const numero = registrarVendaCaixa(dadosVenda)
    setVendaFinalizada({ ...dadosVenda, numero })
    setVendaNumero(numero)
    setPasso(5)
  }

  const veiculoSel = veiculoId ? veiculosCliente.find(v => v.id === Number(veiculoId)) : null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/caixa')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} />Voltar
        </button>
        <h2 className="text-xl font-bold text-slate-800">Nova Venda / Recebimento</h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {PASSOS.map((nome, i) => {
          const num = i + 1
          const ativo = passo === num
          const feito = passo > num
          return (
            <div key={nome} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${feito ? 'bg-green-500 text-white' : ativo ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {feito ? <CheckCircle size={15} /> : num}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${ativo ? 'text-primary-600' : feito ? 'text-green-600' : 'text-slate-400'}`}>{nome}</span>
              </div>
              {i < PASSOS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${feito ? 'bg-green-300' : 'bg-slate-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* ====== PASSO 1: IDENTIFICAÇÃO ====== */}
      {passo === 1 && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-1"><FileText size={15} className="text-orange-500" />Importar OS ou Orçamento</p>
            <p className="text-xs text-slate-500 mb-2">Busque pelo número da OS ou orçamento para importar os itens automaticamente</p>
            <div className="flex gap-2">
              <input value={importBusca} onChange={e => setImportBusca(e.target.value)} placeholder="Digite o número da OS ou orçamento..."
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <button onClick={importar} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Importar</button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <p className="font-semibold text-slate-800 mb-3">Identificação do Cliente (opcional)</p>
            <label className="block text-sm font-medium text-slate-700 mb-1">Buscar Cliente</label>
            <input value={clienteNome || buscaCliente} onChange={e => { setBuscaCliente(e.target.value); setClienteNome(''); setClienteId('') }}
              placeholder="Nome do cliente..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {clientesFiltrados.length > 0 && (
              <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden">
                {clientesFiltrados.map(c => (
                  <button key={c.id} onClick={() => selecionarCliente(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-primary-500 hover:text-white transition-colors">
                    {c.nome}{c.telefone ? ` - ${c.telefone.replace(/\D/g, '')}` : ''}
                  </button>
                ))}
              </div>
            )}
            {clienteId && veiculosCliente.length > 0 && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Veículo (opcional)</label>
                <select value={veiculoId} onChange={e => setVeiculoId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Selecione...</option>
                  {veiculosCliente.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setPasso(2)} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Próximo <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== PASSO 2: ITENS ====== */}
      {passo === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p className="font-semibold text-slate-800">Itens</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Peças */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buscar Peça/Produto</label>
              <input value={buscaPeca} onChange={e => setBuscaPeca(e.target.value)} placeholder="Nome ou código..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {buscaPeca && (
                <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                  {pecasFiltradas.map(p => (
                    <button key={p.id} onClick={() => addPeca(p)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
                      <span className="text-slate-700">{p.nome}</span>
                      <span className="flex items-center gap-2 text-slate-500">{fmt(pNum(p.preco))} <Plus size={13} className="text-primary-500" /></span>
                    </button>
                  ))}
                  {pecasFiltradas.length === 0 && <p className="text-xs text-slate-400 px-3 py-2">Nenhuma peça.</p>}
                </div>
              )}
            </div>
            {/* Serviços */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buscar Serviço</label>
              <input value={buscaServico} onChange={e => setBuscaServico(e.target.value)} placeholder="Nome do serviço..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {servicosFiltrados.map(s => (
                  <button key={s.id} onClick={() => addServico(s)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
                    <span className="text-slate-700">{s.nome}</span>
                    <span className="flex items-center gap-2 text-slate-500">{fmt(pNum(s.preco))} <Plus size={13} className="text-primary-500" /></span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela de itens */}
          {itens.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-y border-slate-100 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 font-semibold">Item</th>
                  <th className="text-center py-2 font-semibold">Qtd</th>
                  <th className="text-center py-2 font-semibold">Preço</th>
                  <th className="text-center py-2 font-semibold">Desc.</th>
                  <th className="text-right py-2 font-semibold">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {itens.map(it => (
                  <tr key={it.id}>
                    <td className="py-2">
                      <span className="text-sm text-slate-700">{it.nome} </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${it.tipo === 'servico' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{it.tipo === 'servico' ? 'serviço' : 'peça'}</span>
                    </td>
                    <td className="py-2 text-center"><input value={it.qtd} onChange={e => updItem(it.id, 'qtd', e.target.value)} className="w-14 border border-slate-200 rounded px-2 py-1 text-sm text-center" /></td>
                    <td className="py-2 text-center"><input value={it.preco} onChange={e => updItem(it.id, 'preco', e.target.value)} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm text-center" /></td>
                    <td className="py-2 text-center"><input value={it.desc} onChange={e => updItem(it.id, 'desc', e.target.value)} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center" /></td>
                    <td className="py-2 text-right text-sm font-semibold text-slate-700">{fmt(pNum(it.preco) * pNum(it.qtd) - pNum(it.desc))}</td>
                    <td className="py-2 text-right"><button onClick={() => delItem(it.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="text-sm">
            <p className="text-slate-500">Subtotal: <span className="text-slate-700">{fmt(subtotal)}</span></p>
            <p className="font-bold text-slate-800">Total: {fmt(total)}</p>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setPasso(1)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><ArrowLeft size={15} />Voltar</button>
            <button onClick={() => setPasso(3)} disabled={itens.length === 0} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Próximo <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {/* ====== PASSO 3: PAGAMENTO ====== */}
      {passo === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div>
            <p className="font-semibold text-slate-800">Pagamento</p>
            <p className="text-base font-bold text-slate-800 mt-1">Total a pagar: {fmt(total)}</p>
            {falta > 0.001
              ? <p className="text-sm text-orange-500 font-medium">Falta: {fmt(falta)}</p>
              : <p className="text-sm text-green-600 font-medium">Pagamento completo ✓</p>}
          </div>

          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma</label>
              <select value={formaPag} onChange={e => setFormaPag(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {FORMAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {formaPag !== 'Pagar Depois' && <>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                <input value={valorPag} onChange={e => setValorPag(e.target.value)} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              {COM_TAXA.includes(formaPag) && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Taxa R$</label>
                  <input value={taxaPag} onChange={e => setTaxaPag(e.target.value)} placeholder="0.00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              <div className={COM_TAXA.includes(formaPag) ? 'col-span-3' : 'col-span-5'}>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ref. externa</label>
                <input value={refPag} onChange={e => setRefPag(e.target.value)} placeholder="Opcional" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </>}
            <div className="col-span-1">
              <button onClick={addPagamento} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg flex items-center justify-center transition-colors"><Plus size={16} /></button>
            </div>
          </div>

          {falta > 0.001 && (
            <div className="flex gap-2">
              <button onClick={preencherRestante} className="text-xs border border-primary-300 text-primary-600 px-3 py-1.5 rounded-lg font-medium hover:bg-primary-50 transition-colors">Preencher restante ({fmt(falta)})</button>
              <button onClick={restantePagarDepois} className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-1">⏱ Restante Pagar Depois ({fmt(falta)})</button>
            </div>
          )}

          {pagamentos.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-y border-slate-100 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 font-semibold">Forma</th>
                  <th className="text-left py-2 font-semibold">Valor</th>
                  <th className="text-left py-2 font-semibold">Referência</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagamentos.map(p => (
                  <tr key={p.id}>
                    <td className="py-2 text-sm text-slate-700">{p.forma}</td>
                    <td className="py-2 text-sm text-slate-700">
                      {p.forma === 'Pagar Depois' ? <span className="text-orange-500">{fmt(p.depois)} (a receber)</span> : <>{fmt(pNum(p.valor))}{pNum(p.taxa) > 0 && <span className="text-red-500"> (-{fmt(pNum(p.taxa))})</span>}</>}
                    </td>
                    <td className="py-2 text-sm text-slate-400">{p.ref || '-'}</td>
                    <td className="py-2 text-right"><button onClick={() => delPagamento(p.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={obsPag} onChange={e => setObsPag(e.target.value)} rows={2} placeholder="Observações opcionais..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setPasso(2)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><ArrowLeft size={15} />Voltar</button>
            <button onClick={() => setPasso(4)} disabled={pagamentos.length === 0} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Próximo <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {/* ====== PASSO 4: CONFIRMAÇÃO ====== */}
      {passo === 4 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p className="font-semibold text-slate-800 flex items-center gap-2"><Package size={16} className="text-primary-500" />Confirmar Venda</p>
          <div className="flex justify-between text-sm">
            <p className="text-slate-500">Cliente: <span className="font-medium text-slate-800">{clienteNome || 'Consumidor'}</span></p>
            {veiculoSel && <p className="text-slate-500">Veículo: <span className="font-medium text-slate-800">{veiculoSel.placa}</span></p>}
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-y border-slate-100 text-xs text-slate-500 uppercase">
                <th className="text-left py-2 font-semibold">Item</th>
                <th className="text-center py-2 font-semibold">Qtd</th>
                <th className="text-right py-2 font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {itens.map(it => (
                <tr key={it.id}>
                  <td className="py-2 text-sm text-slate-700">{it.nome}</td>
                  <td className="py-2 text-center text-sm text-slate-600">{it.qtd}</td>
                  <td className="py-2 text-right text-sm font-medium text-slate-700">{fmt(pNum(it.preco) * pNum(it.qtd) - pNum(it.desc))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center border-t border-slate-100 pt-3">
            <p className="font-bold text-slate-800">Total itens:</p>
            <p className="font-bold text-slate-800">{fmt(total)}</p>
          </div>

          <div className="text-sm text-slate-500">
            <p className="font-medium text-slate-600 mb-1">Pagamentos:</p>
            {pagamentos.map(p => (
              <p key={p.id}>{p.forma}: {p.forma === 'Pagar Depois' ? fmt(p.depois) : fmt(pNum(p.valor))}</p>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-slate-400 text-sm"><Printer size={14} />Recibo disponível após finalizar</span>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setPasso(3)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><ArrowLeft size={15} />Voltar</button>
            <button onClick={finalizar} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"><CheckCircle size={15} />Finalizar Venda</button>
          </div>
        </div>
      )}

      {/* ====== PASSO 5: CONCLUÍDO ====== */}
      {passo === 5 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-green-600 text-lg">Venda Finalizada!</p>
          <p className="text-sm text-slate-500 mt-1">Venda <span className="font-mono font-medium">{vendaNumero}</span> registrada com sucesso.</p>
          <div className="flex items-center justify-center gap-2 my-5">
            <button onClick={() => vendaFinalizada && imprimirReciboCaixa(vendaFinalizada)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Printer size={14} />Imprimir Recibo</button>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate('/caixa')} className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">Voltar ao Caixa</button>
            <button onClick={() => { setPasso(1); setClienteId(''); setClienteNome(''); setBuscaCliente(''); setVeiculoId(''); setItens([]); setPagamentos([]); setObsPag(''); setVendaFinalizada(null) }} className="border border-slate-200 text-slate-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Nova Venda</button>
          </div>
        </div>
      )}
    </div>
  )
}

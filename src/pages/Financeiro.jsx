import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, CalendarDays, Plus, Trash2, CheckCircle2, Package, X, Banknote, CreditCard, Smartphone, ArrowRightLeft, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { descricao: '', tipo: 'receita', valor: '' }

const VAZIO_BOLETO = { descricao: '', categoria: 'Equipamento', valor: '', parcelas: '1', vencimento: '' }
const CATEGORIAS_BOLETO = ['Equipamento', 'Aluguel', 'Energia / Água', 'Telefone / Internet', 'Serviço Terceiro', 'Imposto / Taxa', 'Outro']
const PARCELAS_OPCOES = ['1', '2', '3', '4', '5', '6', '10', '12']

const FORMAS = [
  { label: 'PIX',            icon: Smartphone },
  { label: 'Dinheiro',       icon: Banknote },
  { label: 'Cartão Débito',  icon: CreditCard },
  { label: 'Cartão Crédito', icon: CreditCard },
  { label: 'Transferência',  icon: ArrowRightLeft },
  { label: 'Boleto',         icon: CalendarDays },
]

function diasVencimento(dataStr) {
  if (!dataStr) return null
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const venc = new Date(dataStr + 'T00:00:00')
  return Math.ceil((venc - hoje) / 86400000)
}

function alertaVenc(vencimento) {
  const dias = diasVencimento(vencimento)
  let cls = 'text-slate-400'
  let label = vencimento ? new Date(vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'
  if (dias !== null) {
    if (dias < 0)       { cls = 'text-red-500 font-semibold'; label = `Vencido há ${Math.abs(dias)}d` }
    else if (dias === 0){ cls = 'text-amber-500 font-semibold'; label = 'Vence hoje!' }
    else if (dias <= 3) { cls = 'text-amber-500'; label = `${new Date(vencimento + 'T00:00:00').toLocaleDateString('pt-BR')} (${dias}d)` }
  }
  return { cls, label }
}

export default function Financeiro() {
  const {
    financeiro, setFinanceiro, adicionarLancamento,
    devedores, getCliente, pagarOrdem, resumoFinanceiro, totalOrdem,
    compras, atualizarCompra,
    caixaTurno, registrarSangria,
  } = useApp()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [aba, setAba] = useState('lancamentos')

  const [modalBoleto, setModalBoleto] = useState(null)
  const [formaPagamento, setFormaPagamento] = useState('PIX')

  const [modalNovoBoleto, setModalNovoBoleto] = useState(false)
  const [formBoleto, setFormBoleto] = useState(VAZIO_BOLETO)

  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const pNum = (v) => parseFloat((v || '0').toString().replace(',', '.')) || 0
  const lucro = resumoFinanceiro.receitas - resumoFinanceiro.despesas

  // Parcelas pendentes de compras cadastradas
  const contasAPagar = compras
    .filter(c => c.parcelas?.length > 0)
    .flatMap(c =>
      (c.parcelas || [])
        .filter(p => !p.pago)
        .map(p => ({
          tipo: 'compra',
          parcelaId: p.id,
          compraId: c.id,
          compraNumero: c.numero,
          fornecedor: c.fornecedorNome || 'Fornecedor',
          parcela: (c.parcelas || []).indexOf(p) + 1,
          totalParcelas: c.parcelas.length,
          valor: pNum(p.valor),
          vencimento: p.vencimento || '',
        }))
    )

  // Boletos avulsos pendentes (equipamentos, etc.)
  const boletosAvulsos = financeiro
    .filter(f => f.pendente && f.avulso && f.tipo === 'despesa')
    .map(f => ({
      tipo: 'avulso',
      id: f.id,
      descricao: f.descricao,
      categoria: f.categoria || 'Outro',
      valor: pNum(f.valor),
      vencimento: f.vencimento || '',
    }))

  // Lista unificada ordenada por vencimento
  const todasContasAPagar = [...contasAPagar, ...boletosAvulsos].sort((a, b) => {
    if (!a.vencimento) return 1
    if (!b.vencimento) return -1
    return a.vencimento.localeCompare(b.vencimento)
  })

  const totalAPagar = todasContasAPagar.reduce((s, p) => s + p.valor, 0)

  function abrirModalBoleto(p) {
    setFormaPagamento('PIX')
    setModalBoleto(p)
  }

  function confirmarBaixa() {
    if (!modalBoleto) return

    if (!caixaTurno) {
      if (!confirm('O caixa está fechado. O pagamento será registrado no financeiro, mas não será descontado do caixa. Deseja continuar?')) return
    }

    if (modalBoleto.tipo === 'avulso') {
      // Boleto avulso: marca como pago no financeiro
      setFinanceiro(prev => prev.map(f =>
        f.id === modalBoleto.id ? { ...f, pendente: false, formaPagamento } : f
      ))
      if (caixaTurno) {
        registrarSangria(modalBoleto.valor, `Pagto: ${modalBoleto.descricao} — ${formaPagamento}`)
      }
      setModalBoleto(null)
      return
    }

    // Compra parcela: comportamento existente
    const { parcelaId, compraId, compraNumero, fornecedor, valor, parcela, totalParcelas } = modalBoleto
    const descricao = `${fornecedor} ${compraNumero} — Parcela ${parcela}/${totalParcelas}`

    adicionarLancamento({ descricao, tipo: 'despesa', valor: valor.toFixed(2).replace('.', ','), formaPagamento, compraId })

    if (caixaTurno) {
      registrarSangria(valor, `Pagto boleto: ${descricao} — ${formaPagamento}`)
    }

    const compra = compras.find(c => c.id === compraId)
    if (compra) {
      const novasParcelas = (compra.parcelas || []).map(p =>
        p.id === parcelaId ? { ...p, pago: true, formaPagamento } : p
      )
      atualizarCompra(compraId, { parcelas: novasParcelas })
    }

    setModalBoleto(null)
  }

  function salvarBoleto() {
    if (!formBoleto.descricao.trim() || !formBoleto.valor || !formBoleto.vencimento) return
    const total = pNum(formBoleto.valor)
    const nParcelas = parseInt(formBoleto.parcelas) || 1
    const valorParcela = total / nParcelas
    const hoje2 = new Date().toLocaleDateString('pt-BR')

    const novas = []
    for (let i = 0; i < nParcelas; i++) {
      const venc = new Date(formBoleto.vencimento + 'T12:00:00')
      venc.setMonth(venc.getMonth() + i)
      const y = venc.getFullYear()
      const m = String(venc.getMonth() + 1).padStart(2, '0')
      const d = String(venc.getDate()).padStart(2, '0')
      novas.push({
        id: Date.now() + i,
        tipo: 'despesa',
        avulso: true,
        pendente: true,
        descricao: nParcelas > 1 ? `${formBoleto.descricao} (${i + 1}/${nParcelas})` : formBoleto.descricao,
        categoria: formBoleto.categoria,
        valor: valorParcela.toFixed(2).replace('.', ','),
        vencimento: `${y}-${m}-${d}`,
        data: hoje2,
      })
    }

    setFinanceiro(prev => [...novas, ...prev])
    setFormBoleto(VAZIO_BOLETO)
    setModalNovoBoleto(false)
  }

  function excluirBoletoAvulso(id) {
    if (confirm('Excluir este boleto?')) setFinanceiro(prev => prev.filter(f => f.id !== id))
  }

  function salvar() {
    if (!form.descricao.trim() || !form.valor) return
    adicionarLancamento(form)
    setForm(vazio)
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir lançamento?')) setFinanceiro(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receitas',          valor: fmt(resumoFinanceiro.receitas), icon: TrendingUp,    cor: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Despesas',          valor: fmt(resumoFinanceiro.despesas), icon: TrendingDown,   cor: 'text-red-500',    bg: 'bg-red-50' },
          { label: 'Lucro Líquido',     valor: fmt(lucro),                     icon: DollarSign,     cor: lucro >= 0 ? 'text-primary-600' : 'text-red-600', bg: 'bg-primary-50' },
          { label: 'A Pagar',           valor: fmt(totalAPagar),               icon: CalendarDays,   cor: 'text-orange-500', bg: 'bg-orange-50', badge: todasContasAPagar.length },
        ].map(({ label, valor, icon: Icon, cor, bg, badge }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center relative`}>
                <Icon size={18} className={cor} />
                {badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge}</span>}
              </div>
            </div>
            <p className={`text-xl font-bold ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          { key: 'lancamentos', label: 'Lançamentos' },
          { key: 'apagar',      label: `A Pagar${todasContasAPagar.length ? ` (${todasContasAPagar.length})` : ''}` },
          { key: 'devedores',   label: `A Receber${devedores.length ? ` (${devedores.length})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setAba(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lançamentos */}
      {aba === 'lancamentos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Lançamentos</h2>
            <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={14} />Novo
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {financeiro.filter(l => !l.pendente).length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum lançamento.</p>}
            {financeiro.filter(l => !l.pendente).map(l => (
              <div key={l.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <div>
                    <p className="text-sm text-slate-700">{l.descricao}</p>
                    <p className="text-xs text-slate-400">
                      {l.data}
                      {l.formaPagamento && <span className="ml-2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-medium">{l.formaPagamento}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {l.tipo === 'receita' ? '+' : '−'} R$ {l.valor}
                  </span>
                  <button onClick={() => excluir(l.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A Pagar */}
      {aba === 'apagar' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Boletos / Contas a Pagar</h2>
              <p className="text-xs text-slate-400 mt-0.5">Parcelas de compras e boletos avulsos pendentes</p>
            </div>
            <button
              onClick={() => setModalNovoBoleto(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={14} />Boleto Avulso
            </button>
          </div>

          {todasContasAPagar.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-slate-400">Nenhum boleto pendente.</p>
              <p className="text-xs text-slate-300">Use "+ Boleto Avulso" para cadastrar equipamentos, aluguel e outros.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {todasContasAPagar.map((p, idx) => {
                const { cls: alertaCls, label: alertaLabel } = alertaVenc(p.vencimento)

                if (p.tipo === 'avulso') {
                  return (
                    <div key={`av-${p.id}`} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.descricao}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{p.categoria}</span>
                            {p.vencimento && (
                              <span className={alertaCls}>
                                · <CalendarDays size={10} className="inline" /> {alertaLabel}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-orange-600">{fmt(p.valor)}</span>
                        <button onClick={() => abrirModalBoleto(p)}
                          className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                          <CheckCircle2 size={12} />Dar Baixa
                        </button>
                        <button onClick={() => excluirBoletoAvulso(p.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                }

                // Compra parcela
                return (
                  <div key={`cp-${idx}`} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Package size={16} className="text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {p.fornecedor}
                          <span className="ml-1.5 text-xs text-slate-400 font-normal">{p.compraNumero}</span>
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                          Parcela {p.parcela}/{p.totalParcelas}
                          {p.vencimento && (
                            <span className={alertaCls}>
                              · <CalendarDays size={10} className="inline" /> {alertaLabel}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold text-orange-600">{fmt(p.valor)}</span>
                      <button onClick={() => abrirModalBoleto(p)}
                        className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        <CheckCircle2 size={12} />Dar Baixa
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* A Receber */}
      {aba === 'devedores' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">OS Concluídas — Aguardando Pagamento</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {devedores.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhuma OS pendente de pagamento!</p>}
            {devedores.map(o => {
              const cliente = getCliente(o.clienteId)
              return (
                <div key={o.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{o.id}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{cliente?.nome || '—'}</p>
                    <p className="text-xs text-slate-400">{o.servico} · {o.data}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-orange-600">{fmt(totalOrdem(o))}</p>
                    <button onClick={() => pagarOrdem(o.id)}
                      className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Receber
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal Dar Baixa */}
      {modalBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalBoleto(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Dar Baixa</h3>
              <button onClick={() => setModalBoleto(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
                {modalBoleto.tipo === 'avulso' ? (
                  <>
                    <p className="text-xs text-slate-400">{modalBoleto.categoria}</p>
                    <p className="text-sm font-semibold text-slate-800">{modalBoleto.descricao}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">Fornecedor</p>
                    <p className="text-sm font-semibold text-slate-800">{modalBoleto.fornecedor} <span className="font-normal text-slate-400">{modalBoleto.compraNumero}</span></p>
                    <p className="text-xs text-slate-400">Parcela {modalBoleto.parcela}/{modalBoleto.totalParcelas}</p>
                  </>
                )}
                <p className="text-base font-bold text-orange-600 pt-1">{fmt(modalBoleto.valor)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Como foi pago?</label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS.map(({ label, icon: Icon }) => (
                    <button key={label} onClick={() => setFormaPagamento(label)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        formaPagamento === label ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      <Icon size={15} />{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModalBoleto(null)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmarBaixa} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <CheckCircle2 size={15} />Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Boleto Avulso */}
      {modalNovoBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalNovoBoleto(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Novo Boleto / Conta a Pagar</h3>
                <p className="text-xs text-slate-400 mt-0.5">Equipamento, aluguel, serviço ou qualquer conta avulsa</p>
              </div>
              <button onClick={() => setModalNovoBoleto(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input
                  value={formBoleto.descricao}
                  onChange={e => setFormBoleto(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Compressor de ar, Aluguel junho..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select
                  value={formBoleto.categoria}
                  onChange={e => setFormBoleto(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {CATEGORIAS_BOLETO.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$) *</label>
                  <input
                    value={formBoleto.valor}
                    onChange={e => setFormBoleto(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
                  <select
                    value={formBoleto.parcelas}
                    onChange={e => setFormBoleto(f => ({ ...f, parcelas: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {PARCELAS_OPCOES.map(p => <option key={p} value={p}>{p === '1' ? 'À vista' : `${p}x`}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formBoleto.parcelas === '1' ? 'Data de Vencimento *' : 'Vencimento 1ª Parcela *'}
                </label>
                <input
                  type="date"
                  value={formBoleto.vencimento}
                  onChange={e => setFormBoleto(f => ({ ...f, vencimento: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {parseInt(formBoleto.parcelas) > 1 && formBoleto.valor && (
                  <p className="text-xs text-slate-400 mt-1">
                    {formBoleto.parcelas}x de {fmt(pNum(formBoleto.valor) / parseInt(formBoleto.parcelas))} — demais parcelas geradas automaticamente (+1 mês cada)
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModalNovoBoleto(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvarBoleto}
                disabled={!formBoleto.descricao.trim() || !formBoleto.valor || !formBoleto.vencimento}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Plus size={15} />Cadastrar Boleto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Lançamento */}
      {modal && (
        <Modal title="Novo Lançamento" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <div className="flex gap-2">
                {['receita', 'despesa'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${form.tipo === t ? (t === 'receita' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do lançamento"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) *</label>
              <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

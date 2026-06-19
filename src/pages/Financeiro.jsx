import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, CalendarDays, Plus, Trash2, CheckCircle2, Package, X, Banknote, CreditCard, Smartphone, ArrowRightLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { descricao: '', tipo: 'receita', valor: '' }

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

export default function Financeiro() {
  const {
    financeiro, setFinanceiro, adicionarLancamento,
    devedores, getCliente, pagarOrdem, resumoFinanceiro,
    compras, atualizarCompra,
    caixaTurno, registrarSangria,
  } = useApp()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [aba, setAba] = useState('lancamentos')

  // Estado do modal de dar baixa no boleto
  const [modalBoleto, setModalBoleto] = useState(null) // { parcela, compraId, compraNumero, fornecedor, valor, parcelaIdx, totalParcelas, parcelaId }
  const [formaPagamento, setFormaPagamento] = useState('PIX')

  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const lucro = resumoFinanceiro.receitas - resumoFinanceiro.despesas

  // Parcelas pendentes (não pagas)
  const contasAPagar = compras
    .filter(c => c.parcelas?.length > 0)
    .flatMap(c =>
      (c.parcelas || [])
        .filter(p => !p.pago)
        .map((p, idx, arr) => ({
          parcelaId: p.id,
          compraId: c.id,
          compraNumero: c.numero,
          fornecedor: c.fornecedorNome || 'Fornecedor',
          parcela: (c.parcelas || []).indexOf(p) + 1,
          totalParcelas: c.parcelas.length,
          valor: parseFloat((p.valor || '0').toString().replace(',', '.')) || 0,
          vencimento: p.vencimento || '',
        }))
    )
    .sort((a, b) => {
      if (!a.vencimento) return 1
      if (!b.vencimento) return -1
      return a.vencimento.localeCompare(b.vencimento)
    })

  const totalAPagar = contasAPagar.reduce((s, p) => s + p.valor, 0)

  function abrirModalBoleto(p) {
    setFormaPagamento('PIX')
    setModalBoleto(p)
  }

  function confirmarBaixa() {
    if (!modalBoleto) return

    // Se caixa fechado, pede confirmação antes de prosseguir
    if (!caixaTurno) {
      if (!confirm('O caixa está fechado. O pagamento será registrado no financeiro, mas não será descontado do caixa. Deseja continuar?')) return
    }

    const { parcelaId, compraId, compraNumero, fornecedor, valor, parcela, totalParcelas } = modalBoleto
    const descricao = `${fornecedor} ${compraNumero} — Parcela ${parcela}/${totalParcelas}`

    // Cria lançamento no financeiro
    adicionarLancamento({
      descricao,
      tipo: 'despesa',
      valor: valor.toFixed(2).replace('.', ','),
      formaPagamento,
      compraId,
    })

    // Se caixa aberto, registra saída (sangria) no caixa também
    if (caixaTurno) {
      registrarSangria(valor, `Pagto boleto: ${descricao} — ${formaPagamento}`)
    }

    // Marca a parcela como paga na compra
    const compra = compras.find(c => c.id === compraId)
    if (compra) {
      const novasParcelas = (compra.parcelas || []).map(p =>
        p.id === parcelaId ? { ...p, pago: true, formaPagamento } : p
      )
      atualizarCompra(compraId, { parcelas: novasParcelas })
    }

    setModalBoleto(null)
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
          { label: 'Receitas',        valor: fmt(resumoFinanceiro.receitas), icon: TrendingUp,    cor: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Despesas',        valor: fmt(resumoFinanceiro.despesas), icon: TrendingDown,   cor: 'text-red-500',    bg: 'bg-red-50' },
          { label: 'Lucro Líquido',   valor: fmt(lucro),                     icon: DollarSign,     cor: lucro >= 0 ? 'text-primary-600' : 'text-red-600', bg: 'bg-primary-50' },
          { label: 'A Pagar (Boletos)', valor: fmt(totalAPagar),             icon: CalendarDays,   cor: 'text-orange-500', bg: 'bg-orange-50', badge: contasAPagar.length },
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
          { key: 'apagar',      label: `A Pagar${contasAPagar.length ? ` (${contasAPagar.length})` : ''}` },
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
            {financeiro.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum lançamento.</p>}
            {financeiro.map(l => (
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
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Boletos / Contas a Pagar</h2>
            <p className="text-xs text-slate-400 mt-0.5">Parcelas pendentes de compras cadastradas</p>
          </div>
          {contasAPagar.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">Nenhum boleto pendente.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {contasAPagar.map((p, idx) => {
                const dias = diasVencimento(p.vencimento)
                let alertaCls = 'text-slate-400'
                let alertaLabel = p.vencimento ? new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'
                if (dias !== null) {
                  if (dias < 0)   { alertaCls = 'text-red-500 font-semibold'; alertaLabel = `Vencido há ${Math.abs(dias)}d` }
                  else if (dias === 0) { alertaCls = 'text-amber-500 font-semibold'; alertaLabel = 'Vence hoje!' }
                  else if (dias <= 3)  { alertaCls = 'text-amber-500'; alertaLabel = `${new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')} (${dias}d)` }
                }
                return (
                  <div key={idx} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50">
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
                      <button
                        onClick={() => abrirModalBoleto(p)}
                        className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
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
                    <p className="text-sm font-bold text-orange-600">R$ {o.valor}</p>
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

      {/* Modal Dar Baixa no Boleto */}
      {modalBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalBoleto(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Dar Baixa no Boleto</h3>
              <button onClick={() => setModalBoleto(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Resumo do boleto */}
              <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
                <p className="text-xs text-slate-400">Fornecedor</p>
                <p className="text-sm font-semibold text-slate-800">{modalBoleto.fornecedor} <span className="font-normal text-slate-400">{modalBoleto.compraNumero}</span></p>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-slate-400">Parcela {modalBoleto.parcela}/{modalBoleto.totalParcelas}</p>
                  <p className="text-base font-bold text-orange-600">{fmt(modalBoleto.valor)}</p>
                </div>
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Como foi pago?</label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      onClick={() => setFormaPagamento(label)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        formaPagamento === label
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={15} />
                      {label}
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

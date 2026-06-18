import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, ShoppingCart, ArrowDownCircle, ArrowUpCircle, Clock, Printer, Pencil, Trash2, X, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { imprimirReciboCaixa } from '../utils/print'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

const FORMAS_FECHAMENTO = ['Dinheiro', 'PIX', 'Cartão Crédito', 'Cartão Débito', 'Transferência', 'Boleto', 'Vale Funcionário']

export default function Caixa() {
  const { caixaTurno, abrirCaixa, registrarSangria, registrarReforco, fecharCaixa, setCaixaTurno } = useApp()
  const navigate = useNavigate()

  const [modalAbrir, setModalAbrir] = useState(false)
  const [saldoInicial, setSaldoInicial] = useState('')
  const [modalMov, setModalMov] = useState(null) // 'sangria' | 'reforco'
  const [movValor, setMovValor] = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [modalFechar, setModalFechar] = useState(false)
  const [contagem, setContagem] = useState({})
  const [justificativa, setJustificativa] = useState('')
  const [aba, setAba] = useState('vendas')

  // ===== SEM TURNO =====
  if (!caixaTurno) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Caixa</h2>
          <button onClick={() => navigate('/caixa/historico')} className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Clock size={15} />Histórico
          </button>
        </div>

        <div className="flex items-center justify-center py-16">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center max-w-md">
            <DollarSign size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">Nenhum turno aberto</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Abra um turno para começar a registrar vendas e recebimentos.</p>
            <button onClick={() => { setSaldoInicial(''); setModalAbrir(true) }} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} />Abrir Caixa
            </button>
          </div>
        </div>

        {modalAbrir && (
          <ModalBase title="Abrir Turno de Caixa" onClose={() => setModalAbrir(false)}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Saldo inicial (dinheiro em caixa)</label>
            <input type="number" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)} placeholder="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" autoFocus />
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setModalAbrir(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={() => { abrirCaixa(saldoInicial); setModalAbrir(false) }} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Abrir Caixa</button>
            </div>
          </ModalBase>
        )}
      </div>
    )
  }

  // ===== COM TURNO ABERTO =====
  const t = caixaTurno
  const entradas = t.vendas.reduce((s, v) => s + (v.recebido || 0), 0)
    + t.movimentos.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0)
  const saidas = t.movimentos.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0)
  const saldoEsperado = t.saldoInicial + entradas - saidas

  // lista combinada de movimentos: pagamentos das vendas (entrada) + sangrias/reforços
  const movimentosCompletos = [
    ...t.vendas.flatMap(v =>
      (v.pagamentos || [])
        .filter(p => p.forma !== 'Pagar Depois')
        .map(p => ({
          id: 'p' + p.id,
          tipo: 'entrada',
          forma: p.forma,
          valor: pNum(p.valor),
          taxa: pNum(p.taxa),
          motivo: v.clienteNome && v.clienteNome !== 'Consumidor' ? v.clienteNome : 'venda_avulsa',
          hora: v.hora,
        }))
    ),
    ...t.movimentos.map(m => ({
      id: 'm' + m.id,
      tipo: m.tipo,
      forma: 'Dinheiro',
      valor: m.valor,
      taxa: 0,
      motivo: m.motivo || '—',
      hora: m.hora,
    })),
  ].sort((a, b) => b.hora.localeCompare(a.hora))

  const cards = [
    { label: 'Saldo Inicial', value: fmt(t.saldoInicial), cor: 'text-slate-800', sub: '' },
    { label: 'Entradas', value: fmt(entradas), cor: 'text-green-600', icon: ArrowUpCircle, ic: 'text-green-500' },
    { label: 'Saídas', value: fmt(saidas), cor: 'text-red-500', icon: ArrowDownCircle, ic: 'text-red-400' },
    { label: 'Saldo Esperado', value: fmt(saldoEsperado), cor: 'text-slate-800', sub: '' },
  ]

  function abrirMov(tipo) { setModalMov(tipo); setMovValor(''); setMovMotivo('') }
  function confirmarMov() {
    if (!movValor) return
    if (modalMov === 'sangria') registrarSangria(movValor, movMotivo)
    else registrarReforco(movValor, movMotivo)
    setModalMov(null)
  }

  function abrirFechar() {
    setContagem({}); setJustificativa(''); setModalFechar(true)
  }
  function confirmarFechar() {
    const totalContado = FORMAS_FECHAMENTO.reduce((s, f) => s + (parseFloat((contagem[f] || '0').toString().replace(',', '.')) || 0), 0)
    fecharCaixa(contagem, justificativa, saldoEsperado, totalContado)
    setModalFechar(false)
  }

  function excluirVenda(id) {
    if (confirm('Excluir esta venda do turno?')) {
      setCaixaTurno(prev => ({ ...prev, vendas: prev.vendas.filter(v => v.id !== id) }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Caixa</h2>
          <p className="text-xs text-slate-400">Turno aberto em {t.dataAbertura} {t.horaAbertura}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/caixa/nova-venda')} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <ShoppingCart size={15} />Nova Venda
          </button>
          <button onClick={() => abrirMov('sangria')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <ArrowDownCircle size={15} />Sangria
          </button>
          <button onClick={() => abrirMov('reforco')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <ArrowUpCircle size={15} />Reforço
          </button>
          <button onClick={() => navigate('/caixa/historico')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Clock size={15} />Histórico
          </button>
          <button onClick={abrirFechar} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <X size={15} />Fechar Caixa
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, cor, icon: Icon, ic }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              {Icon && <Icon size={14} className={ic} />}
              <p className="text-sm text-slate-500">{label}</p>
            </div>
            <p className={`text-xl font-bold ${cor}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setAba('vendas')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Vendas ({t.vendas.length})</button>
        <button onClick={() => setAba('movimentos')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'movimentos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Movimentos ({movimentosCompletos.length})</button>
      </div>

      {/* Vendas */}
      {aba === 'vendas' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {t.vendas.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">Nenhuma venda neste turno</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hora</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {t.vendas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{v.numero}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{v.clienteNome || 'Consumidor'}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700">{fmt(v.total)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${v.status === 'Paga' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{v.hora}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => imprimirReciboCaixa(v)} className="flex items-center gap-1 text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-1 rounded transition-colors"><Printer size={12} />Recibo</button>
                        <button onClick={() => excluirVenda(v.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Movimentos */}
      {aba === 'movimentos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {movimentosCompletos.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">Nenhuma movimentação neste turno</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Forma</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movimentosCompletos.map(m => {
                  const cor = m.tipo === 'sangria' ? 'bg-red-100 text-red-700' : m.tipo === 'reforco' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${cor}`}>
                          {m.tipo === 'reforco' ? 'reforço' : m.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-700">{m.forma}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-700">
                        {fmt(m.valor)}
                        {m.taxa > 0 && <span className="text-red-500 text-xs"> (-{fmt(m.taxa)})</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{m.motivo}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{m.hora}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modais Sangria/Reforço */}
      {modalMov && (
        <ModalBase title={modalMov === 'sangria' ? 'Registrar Sangria' : 'Registrar Reforço'} onClose={() => setModalMov(null)}>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
          <input type="number" value={movValor} onChange={e => setMovValor(e.target.value)} placeholder="0,00"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3" autoFocus />
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
          <textarea value={movMotivo} onChange={e => setMovMotivo(e.target.value)} rows={2} placeholder="Informe o motivo..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setModalMov(null)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button onClick={confirmarMov} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Confirmar</button>
          </div>
        </ModalBase>
      )}

      {/* Modal Fechar Caixa */}
      {modalFechar && (
        <ModalBase title="Fechar Caixa" onClose={() => setModalFechar(false)}>
          <p className="text-sm text-slate-400 mb-3">Informe os valores contados para cada forma de pagamento:</p>
          <div className="space-y-2">
            {FORMAS_FECHAMENTO.map(f => (
              <div key={f} className="grid grid-cols-2 gap-3 items-center">
                <label className="text-sm text-slate-600">{f}</label>
                <input type="number" value={contagem[f] || ''} onChange={e => setContagem(c => ({ ...c, [f]: e.target.value }))} placeholder="0,00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-1 mt-3">Justificativa (se houver divergência)</label>
          <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={2} placeholder="Opcional..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setModalFechar(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button onClick={confirmarFechar} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Fechar Caixa</button>
          </div>
        </ModalBase>
      )}
    </div>
  )
}

function ModalBase({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

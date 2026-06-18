import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import Modal from '../components/ui/Modal'

const vazio = { descricao: '', tipo: 'receita', valor: '' }

export default function Financeiro() {
  const { financeiro, setFinanceiro, adicionarLancamento, devedores, getCliente, pagarOrdem, resumoFinanceiro } = useApp()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [aba, setAba] = useState('lancamentos')

  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const lucro = resumoFinanceiro.receitas - resumoFinanceiro.despesas

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
          { label: 'Receitas', valor: fmt(resumoFinanceiro.receitas), icon: TrendingUp, cor: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Despesas', valor: fmt(resumoFinanceiro.despesas), icon: TrendingDown, cor: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Lucro Líquido', valor: fmt(lucro), icon: DollarSign, cor: lucro >= 0 ? 'text-primary-600' : 'text-red-600', bg: 'bg-primary-50' },
          { label: 'A Receber', valor: devedores.length + ' OS', icon: AlertCircle, cor: 'text-orange-500', bg: 'bg-orange-50' },
        ].map(({ label, valor, icon: Icon, cor, bg }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={18} className={cor} />
              </div>
            </div>
            <p className={`text-xl font-bold ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {['lancamentos', 'devedores'].map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${aba === a ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {a === 'lancamentos' ? 'Lançamentos' : `A Receber (${devedores.length})`}
          </button>
        ))}
      </div>

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
                    <p className="text-xs text-slate-400">{l.data}</p>
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
                    <p className="text-xs text-slate-400">{o.servico} • {o.data}</p>
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
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do lançamento" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) *</label>
              <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

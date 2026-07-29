import { useState, useEffect, useRef } from 'react'
import { Save, AlertTriangle, ShieldCheck, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CHECKLIST_PADRAO, itensDoChecklist } from '../utils/conferencia'
import gerarId from '../utils/id'

const DEFAULTS = {
  nome: 'Magayver Injecar',
  cnpj: '',
  telefone: '',
  endereco: '',
  email: '',
  responsavel: 'Magayver Torres',
}

export default function Configuracoes() {
  const { config, setConfig } = useApp()
  const [form, setForm] = useState(DEFAULTS)
  const [salvo, setSalvo] = useState(false)
  const inicializado = useRef(false)

  useEffect(() => {
    if (!inicializado.current && config && Object.keys(config).length > 0) {
      setForm(f => ({ ...f, ...config }))
      inicializado.current = true
    }
  }, [config])

  function salvar() {
    // Mescla em vez de substituir — o config guarda outras coisas além destes campos
    setConfig(c => ({ ...c, ...form }))
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Dados da Oficina</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Oficina</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
            <input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
              <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-0000" className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@oficina.com" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade" className={inp} />
          </div>
          <button onClick={salvar} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />
            {salvo ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      <ChecklistConferencia />

      <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100">
          <h2 className="font-semibold text-red-600">Zona de Perigo</h2>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600">
              Os dados do sistema agora são armazenados no banco de dados Supabase e não podem ser apagados por aqui.
              Para remover todos os dados, acesse diretamente o painel do Supabase.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Itens que o conferente marca antes de liberar o veículo para o cliente.
// O que já foi conferido guarda o texto do item, então editar aqui não altera
// nenhuma conferência passada.
function ChecklistConferencia() {
  const { config, setConfig } = useApp()
  const [itens, setItens] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const lista = itens ?? itensDoChecklist(config)
  const alterado = itens !== null

  function editar(id, label) {
    setItens(lista.map(i => i.id === id ? { ...i, label } : i))
  }

  function remover(id) {
    const item = lista.find(i => i.id === id)
    if (!confirm(`Remover "${item?.label}" do checklist?\n\nAs conferências já feitas continuam intactas.`)) return
    setItens(lista.filter(i => i.id !== id))
  }

  function adicionar() {
    setItens([...lista, { id: 'item-' + gerarId(), label: '' }])
  }

  function mover(idx, dir) {
    const destino = idx + dir
    if (destino < 0 || destino >= lista.length) return
    const copia = [...lista]
    ;[copia[idx], copia[destino]] = [copia[destino], copia[idx]]
    setItens(copia)
  }

  function restaurar() {
    if (!confirm('Voltar para a lista padrão? Suas alterações neste checklist serão descartadas.')) return
    setItens(CHECKLIST_PADRAO.map(i => ({ ...i })))
  }

  function salvar() {
    const limpos = lista
      .map(i => ({ id: i.id, label: i.label.trim() }))
      .filter(i => i.label)
    if (limpos.length === 0) {
      alert('O checklist precisa ter pelo menos um item.')
      return
    }
    setConfig(c => ({ ...c, checklistConferencia: limpos }))
    setItens(null)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <ShieldCheck size={17} className="text-cyan-500" />Checklist de conferência
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          O conferente marca estes itens antes de liberar o veículo. Nenhum item vem pré-marcado,
          e um item com problema impede a liberação.
        </p>
      </div>

      <div className="p-5 space-y-2">
        {lista.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-5 text-right tabular-nums flex-shrink-0">{idx + 1}</span>
            <input value={item.label} autoFocus={!item.label}
              onChange={e => editar(item.id, e.target.value)}
              placeholder="Descreva o que deve ser conferido..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-0.5 flex-shrink-0">
              <button onClick={() => mover(idx, -1)} disabled={idx === 0} aria-label="Mover para cima"
                className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronUp size={15} />
              </button>
              <button onClick={() => mover(idx, 1)} disabled={idx === lista.length - 1} aria-label="Mover para baixo"
                className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronDown size={15} />
              </button>
              <button onClick={() => remover(item.id)} aria-label="Remover item"
                className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        <button onClick={adicionar}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-500 py-2.5 rounded-lg text-sm font-medium hover:border-slate-300 hover:text-slate-700 transition-colors">
          <Plus size={15} /> Adicionar item
        </button>

        <div className="flex items-center gap-2 pt-2">
          <button onClick={salvar} disabled={!alterado}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />{salvo ? 'Salvo!' : 'Salvar checklist'}
          </button>
          <button onClick={restaurar}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <RotateCcw size={14} /> Lista padrão
          </button>
          {alterado && (
            <span className="text-xs text-amber-700 flex items-center gap-1 ml-auto">
              <AlertTriangle size={12} /> Não salvo
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

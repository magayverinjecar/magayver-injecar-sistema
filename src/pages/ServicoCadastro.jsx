import { useState } from 'react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import TelaCadastro from '../components/TelaCadastro'

const VAZIO = { nome: '', categoria: '', preco: '', tempo: '' }
const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'

export default function ServicoCadastro() {
  const { setServicos } = useApp()
  const [form, setForm] = useState({ ...VAZIO })
  const [erro, setErro] = useState('')

  const campo = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const sujo = JSON.stringify(form) !== JSON.stringify(VAZIO)

  function salvar() {
    if (!form.nome.trim()) { setErro('O nome do serviço é obrigatório.'); return false }
    // Maiúscula só ao salvar: em caps enquanto digita, o corretor do navegador
    // pula as palavras achando que é sigla.
    setServicos(prev => [...prev, {
      ...form,
      nome: form.nome.toUpperCase().trim(),
      categoria: (form.categoria || '').toUpperCase(),
      id: gerarId(),
    }])
  }

  return (
    <TelaCadastro
      titulo="Novo Serviço"
      subtitulo="Serviço sem preço vira uma parada no meio do orçamento para perguntar quanto é."
      voltarPara="/servicos"
      sujo={sujo}
      faltando={!form.nome.trim() ? 'nome' : ''}
      erro={erro}
      rotuloSalvar="Cadastrar serviço"
      onSalvar={salvar}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <label className={ROTULO}>Nome *</label>
          <input value={form.nome} onChange={campo('nome')} spellCheck lang="pt-BR"
            placeholder="EX: TROCA DE ÓLEO" className={`${INP} uppercase`} autoFocus />
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Categoria</label>
          <input value={form.categoria} onChange={campo('categoria')} spellCheck lang="pt-BR"
            placeholder="MANUTENÇÃO, FREIOS..." className={`${INP} uppercase`} />
        </div>
        <div>
          <label className={ROTULO}>Preço (R$)</label>
          <input value={form.preco} onChange={campo('preco')} placeholder="0,00" inputMode="decimal" className={INP} />
        </div>
        <div>
          <label className={ROTULO}>Tempo estimado</label>
          <input value={form.tempo} onChange={campo('tempo')} placeholder="1h30" className={INP} />
        </div>
      </div>
    </TelaCadastro>
  )
}

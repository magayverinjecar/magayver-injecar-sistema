import { useState } from 'react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import TelaCadastro from '../components/TelaCadastro'
import { ORIGENS_CLIENTE } from '../utils/origemCliente'

const VAZIO = { nome: '', telefone: '', email: '', origem: '' }
const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'

// Cadastro rápido de cliente, em tela.
//
// É o cadastro CURTO, para quem chega pela lista de clientes — nome, telefone,
// e-mail e o canal. A ficha completa (documento, endereço, CEP) vive na Nova
// Entrada, junto com o veículo, porque lá o cliente está na frente do balcão e
// os dois são preenchidos de uma vez.
export default function ClienteCadastro() {
  const { setClientes } = useApp()
  const [form, setForm] = useState({ ...VAZIO })
  const [erro, setErro] = useState('')

  const campo = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const sujo = JSON.stringify(form) !== JSON.stringify(VAZIO)

  function salvar() {
    if (!form.nome.trim()) { setErro('O nome do cliente é obrigatório.'); return false }
    setClientes(prev => [...prev, { ...form, nome: form.nome.trim(), id: gerarId() }])
  }

  return (
    <TelaCadastro
      titulo="Novo Cliente"
      subtitulo="A ficha completa (documento, endereço) é preenchida na Nova Entrada, junto com o veículo."
      voltarPara="/clientes"
      sujo={sujo}
      faltando={!form.nome.trim() ? 'nome' : ''}
      erro={erro}
      rotuloSalvar="Cadastrar cliente"
      onSalvar={salvar}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <label className={ROTULO}>Nome *</label>
          <input value={form.nome} onChange={campo('nome')} placeholder="Nome completo" className={INP} autoFocus />
        </div>
        <div>
          <label className={ROTULO}>Telefone</label>
          <input value={form.telefone} onChange={campo('telefone')} placeholder="(11) 99999-0000" inputMode="tel" className={INP} />
        </div>
        <div>
          <label className={ROTULO}>E-mail</label>
          <input value={form.email} onChange={campo('email')} placeholder="email@exemplo.com" type="email" inputMode="email" className={INP} />
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Como nos conheceu</label>
          <select value={form.origem} onChange={campo('origem')} className={INP}>
            <option value="">Não perguntado</option>
            {ORIGENS_CLIENTE.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="block text-[11px] text-slate-400 mt-0.5">
            Alimenta o relatório de canal no Financeiro.
          </span>
        </div>
      </div>
    </TelaCadastro>
  )
}

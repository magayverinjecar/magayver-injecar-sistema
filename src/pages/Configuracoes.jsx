import { useState, useEffect, useRef } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'

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
    setConfig(form)
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

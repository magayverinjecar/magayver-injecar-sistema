import { useState } from 'react'
import { Save, Trash2, AlertTriangle } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function Configuracoes() {
  const [oficina, setOficina] = useLocalStorage('config-oficina', {
    nome: 'Magayver Injecar',
    cnpj: '',
    telefone: '',
    endereco: '',
    email: '',
    responsavel: 'Magayver Torres',
  })
  const [salvo, setSalvo] = useState(false)

  function salvar() {
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  function limparDados() {
    if (confirm('Isso vai apagar TODOS os dados do sistema (clientes, OS, estoque, etc). Tem certeza?')) {
      const chaves = ['clientes', 'veiculos', 'ordens', 'estoque', 'financeiro', 'agenda', 'funcionarios', 'servicos', 'orcamentos', 'compras', 'fornecedores']
      chaves.forEach(k => localStorage.removeItem(k))
      alert('Dados apagados. Recarregue a página.')
      window.location.reload()
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Dados da Oficina</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Oficina</label>
            <input value={oficina.nome} onChange={e => setOficina(o => ({ ...o, nome: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
            <input value={oficina.responsavel} onChange={e => setOficina(o => ({ ...o, responsavel: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
              <input value={oficina.cnpj} onChange={e => setOficina(o => ({ ...o, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input value={oficina.telefone} onChange={e => setOficina(o => ({ ...o, telefone: e.target.value }))} placeholder="(11) 99999-0000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input value={oficina.email} onChange={e => setOficina(o => ({ ...o, email: e.target.value }))} placeholder="contato@oficina.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input value={oficina.endereco} onChange={e => setOficina(o => ({ ...o, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={salvar} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />
            {salvo ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Zona de perigo */}
      <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100">
          <h2 className="font-semibold text-red-600">Zona de Perigo</h2>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600">Apaga permanentemente todos os dados do sistema: clientes, veículos, ordens de serviço, estoque, financeiro e mais. Esta ação não pode ser desfeita.</p>
          </div>
          <button onClick={limparDados} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Trash2 size={15} />
            Apagar todos os dados
          </button>
        </div>
      </div>
    </div>
  )
}

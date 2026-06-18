import { useState } from 'react'
import { Plus, Phone, Wrench, Trash2, ClipboardList, Shield, Eye, EyeOff, Pencil, Check, DollarSign } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { MODELOS, useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'

const AVATAR_COR = {
  admin: 'bg-orange-100 text-orange-600',
  reparador: 'bg-blue-100 text-blue-600',
  recepcao: 'bg-green-100 text-green-600',
  personalizado: 'bg-purple-100 text-purple-600',
}

const GRUPOS_MENU = [
  {
    grupo: 'Principal',
    itens: [
      { id: 'dashboard', label: 'Início / Painel' },
      { id: 'agenda', label: 'Agendamento' },
      { id: 'assistente-financeiro', label: 'Assistente Financeiro' },
    ],
  },
  {
    grupo: 'Checklist',
    itens: [
      { id: 'checklist-novo', label: 'Nova Entrada' },
      { id: 'checklist-fotos', label: 'Fotos e Vistoria' },
      { id: 'checklist-diagnostico', label: 'Realizar Diagnóstico' },
      { id: 'checklist-gerenciar', label: 'Gerenciar Fichas' },
    ],
  },
  {
    grupo: 'Operacional',
    itens: [
      { id: 'ordens-servico', label: 'Ordens de Serviço' },
      { id: 'orcamentos', label: 'Orçamentos' },
      { id: 'clientes', label: 'Clientes' },
      { id: 'veiculos', label: 'Veículos' },
      { id: 'servicos', label: 'Serviços' },
      { id: 'funcionarios', label: 'Funcionários' },
      { id: 'produtividade', label: 'Produtividade' },
    ],
  },
  {
    grupo: 'Estoque & Compras',
    itens: [
      { id: 'estoque', label: 'Estoque' },
      { id: 'compras', label: 'Compras' },
      { id: 'insumos', label: 'Insumos' },
      { id: 'fornecedores', label: 'Fornecedores' },
    ],
  },
  {
    grupo: 'Financeiro',
    itens: [
      { id: 'caixa', label: 'Caixa' },
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'gastos', label: 'Gastos' },
    ],
  },
  {
    grupo: 'Sistema',
    itens: [
      { id: 'configuracoes', label: 'Configurações' },
    ],
  },
]

const PERMISSOES_ESPECIAIS = [
  { id: 'verPrecos', label: 'Ver preços e valores' },
  { id: 'verFinanceiro', label: 'Acessar relatórios financeiros' },
  { id: 'editarConfigs', label: 'Editar configurações do sistema' },
  { id: 'gerenciarFuncionarios', label: 'Gerenciar funcionários e permissões' },
]

const vazioForm = { nome: '', nomeFinanceiro: '', cargo: '', telefone: '', especialidade: '', pin: '', perfil: 'personalizado' }
const vazioPermissoes = { menus: ['dashboard'], verPrecos: false, verFinanceiro: false, editarConfigs: false, gerenciarFuncionarios: false }

export default function Funcionarios() {
  const { funcionarios, setFuncionarios, ordens } = useApp()
  const { refreshPermissoes } = useAuth()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(vazioForm)
  const [permissoes, setPermissoes] = useState(vazioPermissoes)
  const [mostrarPin, setMostrarPin] = useState(false)

  function abrirNovo() {
    setEditando(null)
    setForm(vazioForm)
    setPermissoes(vazioPermissoes)
    setMostrarPin(false)
    setModal(true)
  }

  function abrirEditar(f) {
    setEditando(f.id)
    setForm({
      nome: f.nome,
      nomeFinanceiro: f.nomeFinanceiro || '',
      cargo: f.cargo || '',
      telefone: f.telefone || '',
      especialidade: f.especialidade || '',
      pin: f.pin || '',
      perfil: f.perfil || 'personalizado',
    })
    setPermissoes(f.permissoes || vazioPermissoes)
    setMostrarPin(false)
    setModal(true)
  }

  function toggleMenu(id) {
    setPermissoes(p => ({
      ...p,
      menus: p.menus.includes(id) ? p.menus.filter(m => m !== id) : [...p.menus, id]
    }))
    setForm(f => ({ ...f, perfil: 'personalizado' }))
  }

  function toggleEspecial(id) {
    setPermissoes(p => ({ ...p, [id]: !p[id] }))
    setForm(f => ({ ...f, perfil: 'personalizado' }))
  }

  function salvar() {
    if (!form.nome.trim()) return
    if (form.pin && form.pin.length < 4) return alert('A senha deve ter no mínimo 4 caracteres.')
    const dados = { ...form, permissoes }
    if (editando !== null) {
      setFuncionarios(prev => prev.map(f => f.id === editando ? { ...f, ...dados } : f))
      // atualiza sessão em tempo real se for o próprio usuário logado
      refreshPermissoes({ id: editando, ...dados })
    } else {
      setFuncionarios(prev => [...prev, { ...dados, id: Date.now() }])
    }
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir funcionário?')) setFuncionarios(prev => prev.filter(f => f.id !== id))
  }

  function osDoFuncionario(id) {
    return ordens.filter(o => o.mecanicoId === id)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={abrirNovo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Funcionário
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {funcionarios.map(f => {
          const osAbertas = osDoFuncionario(f.id).filter(o => !['Concluída','Cancelada','Entregue'].includes(o.status))
          const osConcluidas = osDoFuncionario(f.id).filter(o => ['Concluída','Entregue'].includes(o.status))
          const perfilLabel = MODELOS[f.perfil]?.label || 'Personalizado'
          const avatarCor = AVATAR_COR[f.perfil] || 'bg-slate-100 text-slate-600'
          const menusCount = f.permissoes?.menus?.length || 0

          return (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${avatarCor}`}>
                    {f.nome[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{f.nome}</p>
                    {f.nomeFinanceiro && (
                      <p className="text-xs text-primary-500 flex items-center gap-1">
                        <DollarSign size={10} />{f.nomeFinanceiro}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{f.cargo || 'Funcionário'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(f)} className="p-1.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => excluir(f.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                  <Shield size={10} />{perfilLabel}
                </span>
                <span className="text-xs text-slate-400">{menusCount} tela(s)</span>
                {f.pin && <span className="text-xs text-green-500">• PIN ativo</span>}
              </div>

              <div className="space-y-1.5 text-sm mb-4">
                {f.telefone && <div className="flex items-center gap-2 text-slate-600"><Phone size={13} className="text-slate-400" />{f.telefone}</div>}
                {f.especialidade && <div className="flex items-center gap-2 text-slate-600"><Wrench size={13} className="text-slate-400" />{f.especialidade}</div>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <ClipboardList size={14} className="text-blue-400" />
                  <span className="text-slate-600">{osAbertas.length} abertas</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <ClipboardList size={14} className="text-green-400" />
                  <span className="text-slate-600">{osConcluidas.length} concluídas</span>
                </div>
              </div>
            </div>
          )
        })}
        {funcionarios.length === 0 && <p className="text-sm text-slate-400 py-4">Nenhum funcionário cadastrado.</p>}
      </div>

      {modal && (
        <Modal title={editando !== null ? 'Editar Funcionário' : 'Novo Funcionário'} onClose={() => setModal(false)}>
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

            {/* Dados básicos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome Financeiro
                  <span className="ml-1.5 text-xs font-normal text-slate-400">(aparece em documentos e relatórios)</span>
                </label>
                <input value={form.nomeFinanceiro} onChange={e => setForm(f => ({ ...f, nomeFinanceiro: e.target.value }))} placeholder="Ex: M. Torres, Magayver T." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                <input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Reparador, Auxiliar..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(41) 99999-0000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade</label>
                <input value={form.especialidade} onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} placeholder="Injeção, Freios..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PIN (4 dígitos)</label>
                <div className="relative">
                  <input type={mostrarPin ? 'text' : 'password'} value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="Mínimo 4 caracteres" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-9" />
                  <button type="button" onClick={() => setMostrarPin(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                    {mostrarPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Telas permitidas */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Telas que pode acessar</label>
              <div className="space-y-3">
                {GRUPOS_MENU.map(({ grupo, itens }) => (
                  <div key={grupo}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{grupo}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {itens.map(({ id, label }) => {
                        const ativo = permissoes.menus.includes(id)
                        return (
                          <button key={id} type="button" onClick={() => toggleMenu(id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all border ${ativo ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-primary-500' : 'bg-slate-200'}`}>
                              {ativo && <Check size={10} className="text-white" />}
                            </div>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões especiais */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Permissões especiais</label>
              <div className="space-y-2">
                {PERMISSOES_ESPECIAIS.map(({ id, label }) => {
                  const ativo = !!permissoes[id]
                  return (
                    <button key={id} type="button" onClick={() => toggleEspecial(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all border ${ativo ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-primary-500' : 'bg-slate-200'}`}>
                        {ativo && <Check size={11} className="text-white" />}
                      </div>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
              <button onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

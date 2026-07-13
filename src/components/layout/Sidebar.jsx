import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Car, CalendarDays, ClipboardList,
  Wrench, Package, DollarSign, ShoppingCart, UserCog, Settings,
  BarChart3, FileText, Truck, Factory, Droplets, Receipt, Brain,
  Plus, Camera, FolderOpen, ClipboardCheck, LayoutGrid
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const grupos = [
  {
    titulo: 'PRINCIPAL',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
      { to: '/patio', icon: LayoutGrid, label: 'Quadro do Pátio', permissao: 'patio' },
      { to: '/agenda', icon: CalendarDays, label: 'Agendamento' },
      { to: '/assistente-financeiro', icon: Brain, label: 'Assistente Financeiro' },
    ],
  },
  {
    titulo: 'CHECKLIST',
    items: [
      { to: '/checklist/novo', icon: Plus, label: 'Nova Entrada', permissao: 'checklist-novo' },
      { to: '/checklist/fotos', icon: Camera, label: 'Fotos e Vistoria', permissao: 'checklist-fotos' },
      { to: '/checklist/diagnostico', icon: ClipboardCheck, label: 'Realizar Diagnóstico', permissao: 'checklist-diagnostico' },
      { to: '/checklist/gerenciar', icon: FolderOpen, label: 'Gerenciar Fichas', permissao: 'checklist-gerenciar' },
    ],
  },
  {
    titulo: 'OPERACIONAL',
    items: [
      { to: '/ordens-servico', icon: ClipboardList, label: 'Ordens de Serviço' },
      { to: '/orcamentos', icon: FileText, label: 'Orçamentos' },
      { to: '/clientes', icon: Users, label: 'Clientes' },
      { to: '/veiculos', icon: Car, label: 'Veículos' },
      { to: '/servicos', icon: Wrench, label: 'Serviços' },
      { to: '/funcionarios', icon: UserCog, label: 'Funcionários' },
      { to: '/produtividade', icon: BarChart3, label: 'Produtividade' },
    ],
  },
  {
    titulo: 'ESTOQUE & COMPRAS',
    items: [
      { to: '/estoque', icon: Package, label: 'Estoque' },
      { to: '/compras', icon: Truck, label: 'Compras' },
      { to: '/insumos', icon: Droplets, label: 'Insumos' },
      { to: '/fornecedores', icon: Factory, label: 'Fornecedores' },
    ],
  },
  {
    titulo: 'FINANCEIRO',
    items: [
      { to: '/caixa', icon: ShoppingCart, label: 'Caixa' },
      { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
      { to: '/gastos', icon: Receipt, label: 'Gastos' },
    ],
  },
]

export default function Sidebar({ open, onClose }) {
  const { temPermissao } = useAuth()

  const gruposFiltrados = grupos.map(g => ({
    ...g,
    items: g.items.filter(item => {
      const perm = item.permissao || item.to.replace('/', '')
      return temPermissao(perm)
    })
  })).filter(g => g.items.length > 0)

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm
      transform transition-transform duration-200 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
      lg:relative lg:translate-x-0
    `}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <Wrench size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Magayver</p>
            <p className="text-xs text-primary-500 font-semibold leading-tight">Injecar</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {gruposFiltrados.map(({ titulo, items }) => (
          <div key={titulo} className="mb-4">
            <p className="px-3 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{titulo}</p>
            <ul className="space-y-0.5">
              {items.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`
                    }
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        <p className="text-xs text-slate-400">v1.0.0 • Magayver Injecar</p>
        <NavLink to="/configuracoes" onClick={onClose} title="Configurações">
          <Settings size={16} className="text-slate-400 hover:text-slate-600 transition-colors" />
        </NavLink>
      </div>
    </aside>
  )
}

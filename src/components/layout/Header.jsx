import { Bell, LogOut, Sun, Moon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

const titles = {
  '/dashboard': 'Início',
  '/agenda': 'Agendamento',
  '/assistente-financeiro': 'Assistente Financeiro',
  '/clientes': 'Clientes',
  '/veiculos': 'Veículos',
  '/ordens-servico': 'Ordens de Serviço',
  '/orcamentos': 'Orçamentos',
  '/servicos': 'Serviços',
  '/funcionarios': 'Funcionários',
  '/produtividade': 'Produtividade',
  '/estoque': 'Estoque',
  '/compras': 'Compras',
  '/insumos': 'Insumos',
  '/fornecedores': 'Fornecedores',
  '/financeiro': 'Financeiro',
  '/caixa': 'Caixa',
  '/gastos': 'Gastos',
  '/configuracoes': 'Configurações',
  '/checklist/novo': 'Nova Entrada',
  '/checklist/fotos': 'Fotos e Vistoria',
  '/checklist/diagnostico': 'Realizar Diagnóstico',
  '/checklist/gerenciar': 'Gerenciar / Editar Fichas',
}


const PERFIL_LABEL = { admin: 'Administrador', mecanico: 'Reparador', recepcao: 'Recepção' }
const PERFIL_COR = { admin: 'bg-orange-500', mecanico: 'bg-blue-500', recepcao: 'bg-green-500' }

export default function Header() {
  const { pathname } = useLocation()
  const { currentUser, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const title = titles[pathname]
    || (pathname.startsWith('/checklist/fotos/') ? 'Fotos e Vistoria' : null)
    || (pathname.startsWith('/checklist/diagnostico/') ? 'Realizar Diagnóstico' : null)
    || (pathname.startsWith('/checklist/') && pathname !== '/checklist/novo' ? 'Detalhe do Checklist' : null)
    || (pathname.startsWith('/ordens-servico/') ? 'Detalhe da OS' : null)
    || 'Magayver Injecar'

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        {/* Toggle dark/light */}
        <button
          onClick={toggle}
          title={dark ? 'Modo claro' : 'Modo escuro'}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${PERFIL_COR[currentUser?.perfil] || 'bg-primary-500'}`}>
            {currentUser?.nome?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="text-sm">
            <p className="font-medium text-slate-800 leading-tight">{currentUser?.nome?.split(' ')[0] || '—'}</p>
            <p className="text-xs text-slate-400 leading-tight">{PERFIL_LABEL[currentUser?.perfil] || '—'}</p>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sair"
          className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

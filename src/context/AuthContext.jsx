import { createContext, useContext, useState, useEffect } from 'react'

// Modelos de permissão para pré-preencher — admin pode alterar livremente
export const MODELOS = {
  admin: {
    label: 'Administrador',
    menus: ['patio','dashboard','agenda','checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar','assistente-financeiro','ordens-servico','orcamentos','clientes','veiculos','servicos','funcionarios','produtividade','estoque','compras','insumos','fornecedores','financeiro','caixa','gastos','configuracoes'],
    verPrecos: true,
    verFinanceiro: true,
    editarConfigs: true,
    gerenciarFuncionarios: true,
  },
  reparador: {
    label: 'Reparador',
    menus: ['patio','dashboard','agenda','checklist-novo','checklist-fotos','checklist-diagnostico','ordens-servico','clientes','veiculos','estoque','insumos','produtividade'],
    verPrecos: false,
    verFinanceiro: false,
    editarConfigs: false,
    gerenciarFuncionarios: false,
  },
  recepcao: {
    label: 'Recepção',
    menus: ['patio','dashboard','agenda','checklist-novo','checklist-gerenciar','assistente-financeiro','ordens-servico','orcamentos','clientes','veiculos','caixa'],
    verPrecos: true,
    verFinanceiro: false,
    editarConfigs: false,
    gerenciarFuncionarios: false,
  },
}

const AuthContext = createContext(null)

function loadUser() {
  try {
    const v = localStorage.getItem('auth-user')
    return v ? JSON.parse(v) : null
  } catch { return null }
}

// Migração automática: menus que devem existir para cada perfil
const MENUS_OBRIGATORIOS = {
  admin:     ['patio','checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar'],
  reparador: ['patio','checklist-novo','checklist-fotos','checklist-diagnostico'],
  recepcao:  ['patio','checklist-novo','checklist-gerenciar'],
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => loadUser())

  // Migração: garante que menus novos apareçam sem precisar refazer login
  useEffect(() => {
    if (!currentUser) return
    const obrig = MENUS_OBRIGATORIOS[currentUser.perfil] || []
    const menus = currentUser.permissoes?.menus || []
    const faltam = obrig.filter(m => !menus.includes(m))
    if (faltam.length === 0) return
    const atualizado = {
      ...currentUser,
      permissoes: { ...currentUser.permissoes, menus: [...faltam, ...menus] },
    }
    localStorage.setItem('auth-user', JSON.stringify(atualizado))
    setCurrentUser(atualizado)
  }, []) // roda só 1x ao montar

  function login(funcionario) {
    // Usa as permissões customizadas do próprio funcionário
    const permissoes = funcionario.permissoes || MODELOS.reparador
    const user = {
      id: funcionario.id,
      nome: funcionario.nome,
      perfil: funcionario.perfil || 'personalizado',
      permissoes,
    }
    localStorage.setItem('auth-user', JSON.stringify(user))
    setCurrentUser(user)
  }

  function logout() {
    localStorage.removeItem('auth-user')
    setCurrentUser(null)
  }

  function temPermissao(menu) {
    if (!currentUser) return false
    const menus = currentUser.permissoes?.menus || []
    if (menus.includes(menu)) return true
    // compatibilidade: 'checklist' (antigo) libera todos os sub-itens
    if (menu.startsWith('checklist-') && menus.includes('checklist')) return true
    return false
  }

  // Atualiza sessão em tempo real quando admin edita permissões do usuário logado
  function refreshPermissoes(funcionario) {
    if (!currentUser || currentUser.id !== funcionario.id) return
    const atualizado = {
      ...currentUser,
      nome: funcionario.nome,
      perfil: funcionario.perfil || 'personalizado',
      permissoes: funcionario.permissoes,
    }
    localStorage.setItem('auth-user', JSON.stringify(atualizado))
    setCurrentUser(atualizado)
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, temPermissao, refreshPermissoes, MODELOS }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

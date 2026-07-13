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
    if (!v) return null
    const u = JSON.parse(v)
    // Garante os menus universais (ex.: patio) já na 1ª renderização,
    // para a rota inicial redirecionar corretamente sem esperar a migração.
    return { ...u, permissoes: garantirMenus(u.perfil, u.permissoes) }
  } catch { return null }
}

// Menus liberados automaticamente para TODOS os perfis (inclusive 'personalizado')
const MENUS_UNIVERSAIS = ['patio']

// Migração automática: menus que devem existir para cada perfil
const MENUS_OBRIGATORIOS = {
  admin:     ['checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar'],
  reparador: ['checklist-novo','checklist-fotos','checklist-diagnostico'],
  recepcao:  ['checklist-novo','checklist-gerenciar'],
}

// Garante que os menus universais/obrigatórios existam nas permissões.
// Retorna o MESMO objeto se nada faltar (para comparação por identidade).
function garantirMenus(perfil, permissoes) {
  const menus = permissoes?.menus || []
  const obrig = [...new Set([...MENUS_UNIVERSAIS, ...(MENUS_OBRIGATORIOS[perfil] || [])])]
  const faltam = obrig.filter(m => !menus.includes(m))
  if (faltam.length === 0) return permissoes
  return { ...permissoes, menus: [...faltam, ...menus] }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => loadUser())

  // Migração: garante que menus novos apareçam sem precisar refazer login
  useEffect(() => {
    if (!currentUser) return
    const novasPerm = garantirMenus(currentUser.perfil, currentUser.permissoes)
    if (novasPerm === currentUser.permissoes) return
    const atualizado = { ...currentUser, permissoes: novasPerm }
    localStorage.setItem('auth-user', JSON.stringify(atualizado))
    setCurrentUser(atualizado)
  }, []) // roda só 1x ao montar

  function login(funcionario) {
    // Usa as permissões do funcionário + garante os menus universais (ex.: patio)
    const perfil = funcionario.perfil || 'personalizado'
    const permissoes = garantirMenus(perfil, funcionario.permissoes || MODELOS.reparador)
    const user = {
      id: funcionario.id,
      nome: funcionario.nome,
      perfil,
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
    const perfil = funcionario.perfil || 'personalizado'
    const atualizado = {
      ...currentUser,
      nome: funcionario.nome,
      perfil,
      permissoes: garantirMenus(perfil, funcionario.permissoes),
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

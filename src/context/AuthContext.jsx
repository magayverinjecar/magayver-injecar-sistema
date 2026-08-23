import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Modelos de permissão para pré-preencher — admin pode alterar livremente
export const MODELOS = {
  admin: {
    label: 'Administrador',
    menus: ['patio','patio-limpeza','conferir-os','dashboard','agenda','checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar','assistente-financeiro','ordens-servico','orcamentos','clientes','veiculos','servicos','funcionarios','produtividade','estoque','compras','insumos','fornecedores','financeiro','caixa','venda','gastos','configuracoes'],
    verPrecos: true,
    verFinanceiro: true,
    editarConfigs: true,
    gerenciarFuncionarios: true,
  },
  reparador: {
    label: 'Reparador',
    menus: ['patio','conferir-os','dashboard','agenda','checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar','ordens-servico','clientes','veiculos','estoque','insumos','produtividade'],
    verPrecos: false,
    verFinanceiro: false,
    editarConfigs: false,
    gerenciarFuncionarios: false,
  },
  recepcao: {
    label: 'Recepção',
    menus: ['patio','dashboard','agenda','checklist-novo','checklist-gerenciar','assistente-financeiro','ordens-servico','orcamentos','clientes','veiculos','caixa','venda'],
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
  admin:     ['patio-limpeza','conferir-os','checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar'],
  // O reparador confere o próprio serviço antes de liberar, então precisa de
  // conferir-os e do menu Meus Serviços (checklist-gerenciar).
  reparador: ['conferir-os','checklist-novo','checklist-fotos','checklist-diagnostico','checklist-gerenciar'],
  recepcao:  ['checklist-novo','checklist-gerenciar'],
}

// Menus que o fluxo de trabalho exige junto: quem já tem um deles precisa dos
// outros para conseguir concluir o serviço. Vale para qualquer perfil — a
// equipe toda usa 'personalizado', que não é coberto por MENUS_OBRIGATORIOS.
const MENUS_DEPENDENTES = [
  // 'venda' (venda de balcão) nasceu separada de 'caixa' para poder existir
  // vendedor que vende e não mexe no caixa. Mas a tela de venda já existia
  // trancada atrás de 'caixa', e a equipe inteira usa perfil 'personalizado' —
  // sem esta linha, no dia da publicação todo mundo que já vendia perderia a
  // tela sem entender por quê.
  //
  // O custo é só o caso inverso: não dá para ter 'caixa' sem 'venda'. Isso não
  // atrapalha ninguém — quem opera o caixa existe justamente para receber
  // venda. E o caso que interessa (vendedor com 'venda' e SEM 'caixa') funciona
  // normalmente, porque a dependência é de mão única.
  //
  // Quando a permissão de venda estiver preenchida na mão de quem deve ter,
  // esta linha pode sair e as duas ficam totalmente independentes.
  { se: 'caixa', entao: ['venda'] },
  // Quem diagnostica também executa o reparo (Meus Serviços) e confere antes de liberar
  { se: 'checklist-diagnostico', entao: ['checklist-gerenciar', 'conferir-os'] },
  // Quem mexe na OS precisa poder conferir para conseguir entregar o veículo
  { se: 'ordens-servico',        entao: ['conferir-os'] },
]

// Garante que os menus universais/obrigatórios existam nas permissões.
// Retorna o MESMO objeto se nada faltar (para comparação por identidade).
function garantirMenus(perfil, permissoes) {
  const menus = permissoes?.menus || []
  const dependentes = MENUS_DEPENDENTES
    .filter(r => menus.includes(r.se))
    .flatMap(r => r.entao)
  const obrig = [...new Set([
    ...MENUS_UNIVERSAIS,
    ...(MENUS_OBRIGATORIOS[perfil] || []),
    ...dependentes,
  ])]
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
    // `scope: 'local'` sai SO deste aparelho. O padrao do Supabase e 'global',
    // que derrubaria a pessoa em todos os aparelhos dela ao mesmo tempo: sair
    // do tablet do balcao apagaria a OS meio preenchida no celular dela no
    // fosso. Ela faz isso uma vez e nunca mais aperta Sair — que e o comeco do
    // login compartilhado.
    supabase.auth.signOut({ scope: 'local' }).catch(e => console.error('[logout]', e))
  }

  // Quem manda no arranque e a SESSAO DO SERVIDOR, nao o que ficou guardado no
  // aparelho. Sem isto, na manha seguinte a virada todo aparelho abriria direto
  // dentro do sistema — com os menus de sempre, sem sessao no banco, tudo
  // vazio e sem um botao obvio para chegar ao login.
  const [sessaoConferida, setSessaoConferida] = useState(false)
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      if (!data?.session) {
        // Usuario guardado sem sessao no servidor nao vale mais nada.
        try { localStorage.removeItem('auth-user') } catch { /* modo privado */ }
        setCurrentUser(null)
      }
      setSessaoConferida(true)
    }).catch(e => { console.error('[auth] falha ao conferir a sessao:', e); if (vivo) setSessaoConferida(true) })

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'SIGNED_OUT' || (!sessao && evento !== 'INITIAL_SESSION')) {
        try { localStorage.removeItem('auth-user') } catch { /* modo privado */ }
        setCurrentUser(null)
      }
    })
    return () => { vivo = false; sub?.subscription?.unsubscribe?.() }
  }, [])

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

  // Flags soltas nas permissões (não são menus, então temPermissao não as enxerga)
  const podeVerPrecos     = !!currentUser?.permissoes?.verPrecos
  const podeVerFinanceiro = !!currentUser?.permissoes?.verFinanceiro

  return (
    <AuthContext.Provider value={{ sessaoConferida,
      currentUser, login, logout, temPermissao, refreshPermissoes, MODELOS,
      podeVerPrecos, podeVerFinanceiro,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

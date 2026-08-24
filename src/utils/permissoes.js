// Catalogo de permissoes: quais telas existem para liberar, e as chaves soltas
// que nao sao tela (ver preco, ver financeiro).
//
// Vive aqui, e nao dentro da tela de Funcionarios, porque o cadastro virou tela
// propria (`pages/FuncionarioCadastro.jsx`) e as duas leem a mesma lista. Com a
// lista duplicada, liberar um menu novo em um lugar e esquecer o outro daria
// permissao que aparece no editor e nao vale, ou o contrario.

export const GRUPOS_MENU = [
  {
    grupo: 'Principal',
    itens: [
      { id: 'dashboard', label: 'Início / Painel' },
      { id: 'patio-limpeza', label: 'Limpeza do Pátio' },
      { id: 'conferir-os', label: 'Conferir e liberar veículo' },
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
      // Mesma posição do menu lateral: quem procura a permissão procura onde
      // viu a tela.
      { id: 'venda', label: 'Venda de Balcão' },
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
      { id: 'gestao', label: 'Gestão (leitura geral)' },
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

export const PERMISSOES_ESPECIAIS = [
  { id: 'verPrecos', label: 'Ver preços e valores' },
  { id: 'verFinanceiro', label: 'Acessar relatórios financeiros' },
  { id: 'editarConfigs', label: 'Editar configurações do sistema' },
  { id: 'gerenciarFuncionarios', label: 'Gerenciar funcionários e permissões' },
]

export const FUNCIONARIO_VAZIO = { nome: '', nomeFinanceiro: '', cargo: '', telefone: '', email: '', especialidade: '', pin: '', perfil: 'personalizado', ativo: true }
export const PERMISSOES_VAZIAS = { menus: ['dashboard'], verPrecos: false, verFinanceiro: false, editarConfigs: false, gerenciarFuncionarios: false }


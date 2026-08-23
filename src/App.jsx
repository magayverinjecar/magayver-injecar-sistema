import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import PinLogin from './pages/PinLogin'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Veiculos from './pages/Veiculos'
import Agenda from './pages/Agenda'
import OrdensServico from './pages/OrdensServico'
import OrdemDetalhe from './pages/OrdemDetalhe'
import Orcamentos from './pages/Orcamentos'
import Servicos from './pages/Servicos'
import Estoque from './pages/Estoque'
import EstoqueMovimentacoes from './pages/EstoqueMovimentacoes'
import PecaCadastro from './pages/PecaCadastro'
import FuncionarioCadastro from './pages/FuncionarioCadastro'
import ClienteCadastro from './pages/ClienteCadastro'
import ServicoCadastro from './pages/ServicoCadastro'
import VeiculoCadastro from './pages/VeiculoCadastro'
import OrdemCadastro from './pages/OrdemCadastro'
import OrdemEditar from './pages/OrdemEditar'
import CompraImportarXml from './pages/CompraImportarXml'
import Compras from './pages/Compras'
import CompraDetalhe from './pages/CompraDetalhe'
import Fornecedores from './pages/Fornecedores'
import Insumos from './pages/Insumos'
import Gastos from './pages/Gastos'
import Financeiro from './pages/Financeiro'
import Caixa from './pages/Caixa'
import NovaVenda from './pages/NovaVenda'
import CaixaHistorico from './pages/CaixaHistorico'
import Funcionarios from './pages/Funcionarios'
import Produtividade from './pages/Produtividade'
import Configuracoes from './pages/Configuracoes'
import AssistenteFinanceiro from './pages/AssistenteFinanceiro'
import NovaEntrada from './pages/NovaEntrada'
import ChecklistNovo from './pages/ChecklistNovo'
import ChecklistFotos from './pages/ChecklistFotos'
import ChecklistFotosDetalhe from './pages/ChecklistFotosDetalhe'
import ChecklistDiagnostico from './pages/ChecklistDiagnostico'
import ChecklistDiagnosticoDetalhe from './pages/ChecklistDiagnosticoDetalhe'
import ChecklistGerenciar from './pages/ChecklistGerenciar'
import ChecklistDetalhe from './pages/ChecklistDetalhe'
import ClienteAssinatura from './pages/ClienteAssinatura'
import MinhaSenha from './pages/MinhaSenha'
import VistoriaCliente from './pages/VistoriaCliente'
import PatioQuadro from './pages/PatioQuadro'
import PatioLimpeza from './pages/PatioLimpeza'
import Conferencia from './pages/Conferencia'
import OficinaDiagnostico from './pages/OficinaDiagnostico'
import OficinaDiagnosticoDetalhe from './pages/OficinaDiagnosticoDetalhe'
import OficinaFotos from './pages/OficinaFotos'
import VistoriaEntrada from './pages/VistoriaEntrada'
import FotosReparo from './pages/FotosReparo'
import MeusServicos from './pages/MeusServicos'

// Candidatas ordenadas por prioridade — primeira com permissão é o destino padrão
const ROTAS_CANDIDATAS = [
  ['/patio',                  'patio'],
  ['/dashboard',              'dashboard'],
  ['/oficina/meus-servicos',  'checklist-gerenciar'],
  ['/oficina/diagnostico',    'checklist-diagnostico'],
  ['/oficina/fotos',          'checklist-fotos'],
  ['/nova-entrada',           'checklist-novo'],
  ['/ordens-servico',         'ordens-servico'],
  ['/orcamentos',             'orcamentos'],
  ['/clientes',               'clientes'],
  ['/caixa',                  'caixa'],
  ['/financeiro',             'financeiro'],
  ['/estoque',                'estoque'],
]

// Redireciona para a primeira rota que o usuário tem acesso
function PrimeiraRota() {
  const { temPermissao } = useAuth()
  const destino = ROTAS_CANDIDATAS.find(([, p]) => temPermissao(p))
  return <Navigate to={destino?.[0] || '/checklist/novo'} replace />
}

// Guarda de rota: bloqueia se não tem permissão e redireciona para a primeira disponível
function Rota({ perm, children }) {
  const { temPermissao } = useAuth()
  if (perm && !temPermissao(perm)) return <PrimeiraRota />
  return children
}

function ProtectedLayout() {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <AppProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route path="/assinar/:id" element={<ClienteAssinatura />} />
        <Route path="/vistoria/:id" element={<VistoriaCliente />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<PrimeiraRota />} />
          <Route path="patio"               element={<Rota perm="patio"><PatioQuadro /></Rota>} />
          <Route path="patio/limpeza"       element={<Rota perm="patio-limpeza"><PatioLimpeza /></Rota>} />
          <Route path="conferencia/:id"     element={<Rota perm="conferir-os"><Conferencia /></Rota>} />
          {/* Área do reparador — mesmas permissões do antigo checklist, dados vindos das OS */}
          <Route path="oficina/meus-servicos" element={<Rota perm="checklist-gerenciar"><MeusServicos /></Rota>} />
          <Route path="oficina/diagnostico"      element={<Rota perm="checklist-diagnostico"><OficinaDiagnostico /></Rota>} />
          <Route path="oficina/diagnostico/:id"  element={<Rota perm="checklist-diagnostico"><OficinaDiagnosticoDetalhe /></Rota>} />
          <Route path="oficina/fotos"         element={<Rota perm="checklist-fotos"><OficinaFotos /></Rota>} />
          <Route path="oficina/vistoria/:id"  element={<Rota perm="checklist-fotos"><VistoriaEntrada /></Rota>} />
          <Route path="oficina/reparo/:id"    element={<Rota perm="checklist-fotos"><FotosReparo /></Rota>} />
          <Route path="dashboard"           element={<Rota perm="dashboard"><Dashboard /></Rota>} />
          <Route path="minha-senha" element={<MinhaSenha />} />
          <Route path="clientes"            element={<Rota perm="clientes"><Clientes /></Rota>} />
          <Route path="clientes/novo"       element={<Rota perm="clientes"><ClienteCadastro /></Rota>} />
          <Route path="veiculos"            element={<Rota perm="veiculos"><Veiculos /></Rota>} />
          <Route path="veiculos/novo"       element={<Rota perm="veiculos"><VeiculoCadastro /></Rota>} />
          <Route path="agenda"              element={<Rota perm="agenda"><Agenda /></Rota>} />
          <Route path="ordens-servico"      element={<Rota perm="ordens-servico"><OrdensServico /></Rota>} />
          <Route path="ordens-servico/nova" element={<Rota perm="ordens-servico"><OrdemCadastro /></Rota>} />
          <Route path="ordens-servico/:id/editar" element={<Rota perm="ordens-servico"><OrdemEditar /></Rota>} />
          <Route path="ordens-servico/:id"  element={<Rota perm="ordens-servico"><OrdemDetalhe /></Rota>} />
          <Route path="orcamentos"          element={<Rota perm="orcamentos"><Orcamentos /></Rota>} />
          <Route path="servicos"            element={<Rota perm="servicos"><Servicos /></Rota>} />
          <Route path="servicos/novo"       element={<Rota perm="servicos"><ServicoCadastro /></Rota>} />
          <Route path="estoque"             element={<Rota perm="estoque"><Estoque /></Rota>} />
          <Route path="estoque/movimentacoes" element={<Rota perm="estoque"><EstoqueMovimentacoes /></Rota>} />
          {/* Cadastro da peça em tela, não em popup: são 20 campos, e ficha
              grande é tela em todo o resto do sistema. "nova" vem antes de
              ":id" porque a rota literal tem de ganhar da variável. */}
          <Route path="estoque/peca/nova"     element={<Rota perm="estoque"><PecaCadastro /></Rota>} />
          <Route path="estoque/peca/:id"      element={<Rota perm="estoque"><PecaCadastro /></Rota>} />
          <Route path="compras"             element={<Rota perm="compras"><Compras /></Rota>} />
          <Route path="compras/importar"    element={<Rota perm="compras"><CompraImportarXml /></Rota>} />
          <Route path="compras/:id"         element={<Rota perm="compras"><CompraDetalhe /></Rota>} />
          <Route path="fornecedores"        element={<Rota perm="fornecedores"><Fornecedores /></Rota>} />
          <Route path="insumos"             element={<Rota perm="insumos"><Insumos /></Rota>} />
          <Route path="gastos"              element={<Rota perm="gastos"><Gastos /></Rota>} />
          <Route path="financeiro"          element={<Rota perm="financeiro"><Financeiro /></Rota>} />
          <Route path="caixa"               element={<Rota perm="caixa"><Caixa /></Rota>} />
          {/* Venda de balcão tem permissão PRÓPRIA, separada de 'caixa': dá
              para contratar vendedor que só vende peça no balcão, sem abrir o
              caixa nem ver o resto do sistema. */}
          <Route path="caixa/nova-venda"    element={<Rota perm="venda"><NovaVenda /></Rota>} />
          <Route path="caixa/historico"     element={<Rota perm="caixa"><CaixaHistorico /></Rota>} />
          <Route path="funcionarios"        element={<Rota perm="funcionarios"><Funcionarios /></Rota>} />
          {/* "novo" antes de ":id": a rota literal tem de ganhar da variavel. */}
          <Route path="funcionarios/novo"   element={<Rota perm="funcionarios"><FuncionarioCadastro /></Rota>} />
          <Route path="funcionarios/:id"    element={<Rota perm="funcionarios"><FuncionarioCadastro /></Rota>} />
          <Route path="produtividade"       element={<Rota perm="produtividade"><Produtividade /></Rota>} />
          <Route path="configuracoes"       element={<Rota perm="configuracoes"><Configuracoes /></Rota>} />
          <Route path="assistente-financeiro" element={<Rota perm="assistente-financeiro"><AssistenteFinanceiro /></Rota>} />
          <Route path="nova-entrada"         element={<Rota perm="checklist-novo"><NovaEntrada /></Rota>} />
          <Route path="checklist"           element={<Navigate to="/checklist/gerenciar" replace />} />
          <Route path="checklist/novo"      element={<Rota perm="checklist-novo"><ChecklistNovo /></Rota>} />
          <Route path="checklist/fotos"     element={<Rota perm="checklist-fotos"><ChecklistFotos /></Rota>} />
          <Route path="checklist/fotos/:id" element={<Rota perm="checklist-fotos"><ChecklistFotosDetalhe /></Rota>} />
          <Route path="checklist/diagnostico"     element={<Rota perm="checklist-diagnostico"><ChecklistDiagnostico /></Rota>} />
          <Route path="checklist/diagnostico/:id" element={<Rota perm="checklist-diagnostico"><ChecklistDiagnosticoDetalhe /></Rota>} />
          <Route path="checklist/gerenciar" element={<Rota perm="checklist-gerenciar"><ChecklistGerenciar /></Rota>} />
          {/* Estava sem trava: qualquer logado abria por URL e via os dois
              telefones do cliente. Mesma permissão da lista que leva até ela. */}
          <Route path="checklist/:id"       element={<Rota perm="checklist-gerenciar"><ChecklistDetalhe /></Rota>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AppProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

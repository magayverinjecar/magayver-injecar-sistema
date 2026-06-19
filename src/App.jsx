import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
import ChecklistNovo from './pages/ChecklistNovo'
import ChecklistFotos from './pages/ChecklistFotos'
import ChecklistFotosDetalhe from './pages/ChecklistFotosDetalhe'
import ChecklistDiagnostico from './pages/ChecklistDiagnostico'
import ChecklistDiagnosticoDetalhe from './pages/ChecklistDiagnosticoDetalhe'
import ChecklistGerenciar from './pages/ChecklistGerenciar'
import ChecklistDetalhe from './pages/ChecklistDetalhe'
import ClienteAssinatura from './pages/ClienteAssinatura'
import VistoriaCliente from './pages/VistoriaCliente'

// Candidatas ordenadas por prioridade — primeira com permissão é o destino padrão
const ROTAS_CANDIDATAS = [
  ['/dashboard',              'dashboard'],
  ['/checklist/novo',         'checklist-novo'],
  ['/checklist/gerenciar',    'checklist-gerenciar'],
  ['/checklist/diagnostico',  'checklist-diagnostico'],
  ['/checklist/fotos',        'checklist-fotos'],
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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route path="/assinar/:id" element={<ClienteAssinatura />} />
        <Route path="/vistoria/:id" element={<VistoriaCliente />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<PrimeiraRota />} />
          <Route path="dashboard"           element={<Rota perm="dashboard"><Dashboard /></Rota>} />
          <Route path="clientes"            element={<Rota perm="clientes"><Clientes /></Rota>} />
          <Route path="veiculos"            element={<Rota perm="veiculos"><Veiculos /></Rota>} />
          <Route path="agenda"              element={<Rota perm="agenda"><Agenda /></Rota>} />
          <Route path="ordens-servico"      element={<Rota perm="ordens-servico"><OrdensServico /></Rota>} />
          <Route path="ordens-servico/:id"  element={<Rota perm="ordens-servico"><OrdemDetalhe /></Rota>} />
          <Route path="orcamentos"          element={<Rota perm="orcamentos"><Orcamentos /></Rota>} />
          <Route path="servicos"            element={<Rota perm="servicos"><Servicos /></Rota>} />
          <Route path="estoque"             element={<Rota perm="estoque"><Estoque /></Rota>} />
          <Route path="compras"             element={<Rota perm="compras"><Compras /></Rota>} />
          <Route path="compras/:id"         element={<Rota perm="compras"><CompraDetalhe /></Rota>} />
          <Route path="fornecedores"        element={<Rota perm="fornecedores"><Fornecedores /></Rota>} />
          <Route path="insumos"             element={<Rota perm="insumos"><Insumos /></Rota>} />
          <Route path="gastos"              element={<Rota perm="gastos"><Gastos /></Rota>} />
          <Route path="financeiro"          element={<Rota perm="financeiro"><Financeiro /></Rota>} />
          <Route path="caixa"               element={<Rota perm="caixa"><Caixa /></Rota>} />
          <Route path="caixa/nova-venda"    element={<Rota perm="caixa"><NovaVenda /></Rota>} />
          <Route path="caixa/historico"     element={<Rota perm="caixa"><CaixaHistorico /></Rota>} />
          <Route path="funcionarios"        element={<Rota perm="funcionarios"><Funcionarios /></Rota>} />
          <Route path="produtividade"       element={<Rota perm="produtividade"><Produtividade /></Rota>} />
          <Route path="configuracoes"       element={<Rota perm="configuracoes"><Configuracoes /></Rota>} />
          <Route path="assistente-financeiro" element={<Rota perm="assistente-financeiro"><AssistenteFinanceiro /></Rota>} />
          <Route path="checklist"           element={<Navigate to="/checklist/gerenciar" replace />} />
          <Route path="checklist/novo"      element={<Rota perm="checklist-novo"><ChecklistNovo /></Rota>} />
          <Route path="checklist/fotos"     element={<Rota perm="checklist-fotos"><ChecklistFotos /></Rota>} />
          <Route path="checklist/fotos/:id" element={<Rota perm="checklist-fotos"><ChecklistFotosDetalhe /></Rota>} />
          <Route path="checklist/diagnostico"     element={<Rota perm="checklist-diagnostico"><ChecklistDiagnostico /></Rota>} />
          <Route path="checklist/diagnostico/:id" element={<Rota perm="checklist-diagnostico"><ChecklistDiagnosticoDetalhe /></Rota>} />
          <Route path="checklist/gerenciar" element={<Rota perm="checklist-gerenciar"><ChecklistGerenciar /></Rota>} />
          <Route path="checklist/:id"       element={<ChecklistDetalhe />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}

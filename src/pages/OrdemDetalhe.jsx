import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, Receipt, MessageCircle, FileText, Trash2, Plus, ChevronDown, X, Camera, Lock, ZoomIn, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Banknote, Smartphone, CreditCard, ArrowRightLeft, Wrench, Eye, Save, ImagePlus, PenTool, ClipboardList, Loader2, ThumbsUp, ThumbsDown, Copy, Check, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import gerarId from '../utils/id'
import { STATUS_OS, statusColor } from './OrdensServico'
import { imprimirOS } from '../utils/print'
import { nomeVeiculo } from '../utils/datas'
import { comprimirImagem } from '../utils/imagem'
import { uploadFoto } from '../supabase'
import {
  CATEGORIAS_FOTO, STATUS_INSP, normalizarInspecao,
  MOMENTO_ENTRADA, fotosDaEntrada, fotosDoReparo, linkVistoria,
} from '../utils/vistoria'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function pNum(v) { if (typeof v === 'number') return v; const s = (v || '0').toString(); if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0; return parseFloat(s) || 0 }
// Quantidade aceita vírgula ("1,5" litros de óleo) — Number() sozinho devolveria NaN
function parseQtd(v) { const n = pNum(v); return n > 0 ? n : 1 }

// Status em que o serviço está sendo executado — daqui o carro vai para
// conferência, nunca direto para "pronto para retirada".
const EM_EXECUCAO = ['Em Execução', 'Aguardando Peça', 'Aberta', 'Aprovada', 'Em Andamento', 'Aprovado']

const MODELOS_IMPRESSAO = [
  { id: 'termica80', nome: 'Térmica 80mm (cupom)', desc: 'Impressoras térmicas 80mm — fonte grande, alto contraste' },
  { id: 'termica58', nome: 'Térmica 58mm (cupom estreito)', desc: 'Impressoras térmicas 58mm — fonte compacta, sem bordas' },
  { id: 'a4det', nome: 'A4 Detalhado (completo)', desc: 'Folha A4 com cabeçalho, assinaturas e PIX' },
  { id: 'a4comp', nome: 'A4 Compacto (1 página)', desc: 'A4 enxuto — apenas dados essenciais' },
  { id: 'a5', nome: 'A5 Resumido (meia folha)', desc: 'Metade de A4 — economia de papel' },
]

const ABAS = ['Dados', 'Entrada', 'Diagnóstico', 'Orçamento', 'Fotos e Vistoria', 'Histórico']

const DIAGNOSTICO_ITENS = [
  { id: 'bateria',          label: 'Bateria',                    unidade: 'V' },
  { id: 'compressao',       label: 'Compressão Relativa',        unidade: '%' },
  { id: 'af_alcool',        label: 'Porcentagem de Álcool (AF)', unidade: '%' },
  { id: 'pressao_coletor',  label: 'Pressão do Coletor',         unidade: 'kPa' },
  { id: 'pressao_bomba',    label: 'Pressão / Vazão da Bomba',   unidade: 'bar' },
  { id: 'valvula_canister', label: 'Válvula do Canister',        unidade: '' },
  { id: 'entrada_ar',       label: 'Entrada de Ar Falsa',        unidade: '' },
  { id: 'ignicao',          label: 'Ignição nos Cilindros',      unidade: '' },
  { id: 'sonda_pre',        label: 'Sonda Pré Catalisador',      unidade: 'V' },
  { id: 'sonda_pos',        label: 'Sonda Pós Catalisador',      unidade: 'V' },
  { id: 'eficiencia_cat',   label: 'Eficiência Catalítica',      unidade: '%' },
  { id: 'sincronismo',      label: 'Sincronismo do Motor',       unidade: '' },
]

const STATUS_DIAG = {
  normal:   { label: 'Normal',   cls: 'bg-green-100 text-green-700 border-green-300' },
  atencao:  { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  problema: { label: 'Problema', cls: 'bg-red-100 text-red-700 border-red-300' },
}

export default function OrdemDetalhe() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const {
    ordens, getCliente, getVeiculo, getFuncionario, funcionarios, servicos, estoque,
    setClientes, setVeiculos,
    atualizarOrdem, adicionarItemOrdem, removerItemOrdem, editarItemOrdem, mudarStatusOrdem,
    excluirOrdem, subtotalOrdem, totalOrdem, caixaTurno, registrarVendaCaixa, pagarOrdem, reabrirOrdem,
    concluirOrdem, entregarOrdem, salvarDiagnostico, salvarVistoria,
    aprovarOrcamento, recusarOrcamento, fecharRecusa, concluirReparo, entregarSemCobrar,
  } = useApp()
  const { currentUser, temPermissao } = useAuth()

  const os = ordens.find(o => o.id === osId)
  const [aba, setAba] = useState('Dados')
  const [modalEditar, setModalEditar] = useState(false)
  const [modalCliente, setModalCliente] = useState(false)
  const [modalItem, setModalItem] = useState(false)
  const [menuImpressao, setMenuImpressao] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [pgtos, setPgtos] = useState([])
  const [modalReabrir, setModalReabrir] = useState(false)
  const [editandoItem, setEditandoItem] = useState(null)
  const [taxaPct, setTaxaPct] = useState('10')

  const [diagnosticoLocal, setDiagnosticoLocal] = useState(null)
  const [inspecaoLocal, setInspecaoLocal] = useState(null)
  const [fotosLocal, setFotosLocal] = useState(null)
  const [categoriaFoto, setCategoriaFoto] = useState('Frente')
  const [obsTecnicasLocal, setObsTecnicasLocal] = useState(null)
  const [salvandoDiag, setSalvandoDiag] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [descontoLocal, setDescontoLocal] = useState(null)
  const [obsOrcLocal, setObsOrcLocal] = useState(null)
  const [salvandoVistoria, setSalvandoVistoria] = useState(false)
  const [processandoAcao, setProcessandoAcao] = useState(false)
  const [linkAssinCopiado, setLinkAssinCopiado] = useState(false)
  const [modalRecusa, setModalRecusa] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [valorDiagnostico, setValorDiagnostico] = useState('')
  const [formaDiag, setFormaDiag] = useState('PIX')
  const inputFotoRef = useRef(null)

  // Rascunho em memória: enquanto qualquer um destes não for null, existe trabalho
  // digitado que ainda não foi para o banco. Fica antes do return de "OS não
  // encontrada" porque hook não pode ficar depois de saída antecipada.
  const diagPendente = diagnosticoLocal !== null || obsTecnicasLocal !== null
  const vistoriaPendente = inspecaoLocal !== null || fotosLocal !== null
  const temPendencia = diagPendente || vistoriaPendente

  // Fechar a aba ou recarregar com trabalho não salvo
  useEffect(() => {
    if (!temPendencia) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [temPendencia])

  if (!os) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">OS não encontrada.</p>
        <button onClick={() => navigate('/ordens-servico')} className="mt-3 text-primary-500 text-sm">Voltar para lista</button>
      </div>
    )
  }

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  const mecanico = os.mecanicoId ? getFuncionario(os.mecanicoId) : null
  const subtotal = subtotalOrdem(os)
  const descGeral = pNum(os.descontoGeral)
  const total = totalOrdem(os)

  function gerarOrcamento() {
    // leva os dados da OS para a tela de Orçamento
    navigate('/orcamentos', { state: { fromOS: {
      clienteId: os.clienteId, veiculoId: os.veiculoId, itens: os.itens,
      observacoes: os.observacoes || '', validade: os.validadeOrcamento || '',
    } } })
  }

  function whatsapp() {
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    const texto = `Olá ${cliente?.nome || ''}! Sobre a OS ${os.id} do veículo ${veiculo?.placa || ''}: status atual *${os.status}*. Total: ${fmt(total)}.`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  // Autorização do diagnóstico — o cliente assina pelo próprio celular
  function linkAssinatura() {
    return `${window.location.origin}/assinar/${encodeURIComponent(os.id)}`
  }

  function copiarLinkAssinatura() {
    navigator.clipboard.writeText(linkAssinatura()).then(() => {
      setLinkAssinCopiado(true)
      setTimeout(() => setLinkAssinCopiado(false), 2000)
    })
  }

  function enviarLinkAssinatura() {
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    const texto = `*Magayver Injecar*\nOlá ${cliente?.nome || ''}! Para darmos início ao diagnóstico do seu ${nomeVeiculo(veiculo, os)}${veiculo?.placa ? ` (${veiculo.placa})` : ''}, precisamos da sua autorização.\n\nAcesse o link e assine pelo celular:\n${linkAssinatura()}`
    const href = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(href, '_blank')
  }

  // Link único da vistoria: mostra ao cliente como o carro chegou e o serviço
  // executado, em blocos separados.
  function enviarFotosAoCliente() {
    const url = linkVistoria(os.id)
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    const temReparo = fotosReparoOS.length > 0
    const texto = temReparo
      ? `*Magayver Injecar*\nOlá ${cliente?.nome || ''}! Seguem as fotos do serviço executado no seu ${nomeVeiculo(veiculo, os)}${veiculo?.placa ? ` (${veiculo.placa})` : ''}, incluindo as peças substituídas.\n\nPara acessar, informe o número cadastrado:\n${url}`
      : `*Magayver Injecar*\nOlá ${cliente?.nome || ''}! Seguem as fotos e a vistoria do seu ${nomeVeiculo(veiculo, os)}${veiculo?.placa ? ` (${veiculo.placa})` : ''}.\n\nPara acessar, informe o número cadastrado:\n${url}`
    const href = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(href, '_blank')
  }

  function imprimir(modelo) {
    setMenuImpressao(false)
    imprimirOS(os, cliente, veiculo, mecanico, total, modelo)
  }

  // A aba mostra e edita as fotos de entrada; as do reparo têm tela própria e
  // aparecem aqui só para consulta.
  const todasFotosOS = fotosLocal ?? os.fotos ?? []
  const fotosOS = fotosDaEntrada(todasFotosOS)
  const fotosReparoOS = fotosDoReparo(todasFotosOS)
  // Completa com a lista padrão os itens que faltarem, preservando o que já foi marcado
  const vistoriaItens = inspecaoLocal ?? normalizarInspecao(os.inspecaoVisual)
  const diagItens = diagnosticoLocal ?? (os.diagnosticoItens?.length > 0 ? os.diagnosticoItens : DIAGNOSTICO_ITENS.map(i => ({ ...i, value: '', status: 'normal' })))
  const obsTecnicas = obsTecnicasLocal ?? os.observacoesTecnicas ?? ''

  function navegarFoto(direcao) {
    const idx = fotosOS.findIndex(f => f.id === fotoAmpliada.id)
    const novo = idx + direcao
    if (novo >= 0 && novo < fotosOS.length) setFotoAmpliada(fotosOS[novo])
  }

  function setValorDiag(itemId, field, value) {
    const updated = diagItens.map(d => d.id === itemId ? { ...d, [field]: value } : d)
    setDiagnosticoLocal(updated)
  }

  function setStatusInsp(itemId, status) {
    const updated = vistoriaItens.map(i => i.id === itemId ? { ...i, status } : i)
    setInspecaoLocal(updated)
  }

  async function adicionarFotoOS(e) {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (arquivos.length === 0) return
    setEnviandoFoto(true)
    const novas = []
    for (const arquivo of arquivos) {
      try {
        // Comprime e sobe para o Storage — guardar base64 no JSONB inchava a linha da OS
        const blob = await comprimirImagem(arquivo)
        const caminho = `fotos/ordens/${os.id}/${gerarId()}.jpg`
        const url = await uploadFoto(blob, caminho)
        novas.push({
          id: gerarId(), url, categoria: categoriaFoto,
          momento: MOMENTO_ENTRADA,
          timestamp: new Date().toLocaleString('pt-BR'),
        })
      } catch (err) {
        console.error('Erro ao enviar foto:', err)
        alert(`Não foi possível enviar "${arquivo.name}". Verifique sua conexão e tente novamente.`)
      }
    }
    // fotosLocal guarda o array COMPLETO — mexer só no subconjunto de entrada
    // apagaria as fotos do reparo ao salvar.
    if (novas.length > 0) setFotosLocal(prev => [...(prev ?? todasFotosOS), ...novas])
    setEnviandoFoto(false)
  }

  function removerFotoOS(fotoId) {
    setFotosLocal(prev => (prev ?? todasFotosOS).filter(f => f.id !== fotoId))
  }

  function salvarDiagLocal(novoStatus) {
    setSalvandoDiag(true)
    const agora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    salvarDiagnostico(os.id, {
      diagnosticoItens: diagItens,
      falhasScanner: os.falhasScanner,
      observacoesTecnicas: obsTecnicas,
      tecnicoId: currentUser?.id || null,
      tecnicoNome: currentUser?.nome || '',
      diagnosticadoEm: agora,
    })
    salvarVistoria(os.id, { inspecaoVisual: vistoriaItens, fotos: todasFotosOS })
    // Zera o rascunho local: o que estava aqui agora vive na OS
    setDiagnosticoLocal(null); setObsTecnicasLocal(null)
    setInspecaoLocal(null); setFotosLocal(null)
    if (novoStatus) mudarStatusOrdem(os.id, novoStatus)
    setTimeout(() => setSalvandoDiag(false), 600)
  }

  function salvarVistoriaLocal() {
    salvarVistoria(os.id, { inspecaoVisual: vistoriaItens, fotos: todasFotosOS })
    setInspecaoLocal(null); setFotosLocal(null)
    setSalvandoVistoria(true)
    setTimeout(() => setSalvandoVistoria(false), 2500)
  }

  function excluir() {
    // OS já entregue tem lançamento no caixa — exige uma confirmação a mais
    const finalizada = os.status === 'Entregue' || os.pago
    const aviso = finalizada
      ? `ATENÇÃO: a OS ${os.id} já foi paga/entregue.\n\nExcluir vai remover também o lançamento do financeiro e a venda do caixa, e devolver as peças ao estoque.\n\nConfirma a exclusão?`
      : `Excluir a OS ${os.id}? Esta ação não pode ser desfeita.`
    if (!confirm(aviso)) return
    if (finalizada && !confirm('Confirma novamente? Esta ação altera o fechamento do caixa.')) return
    excluirOrdem(os.id)
    navigate('/ordens-servico')
  }

  // Troca de status pelo dropdown — avisa quando a mudança dispara estorno
  function trocarStatus(novoStatus) {
    if (novoStatus === os.status) return
    const finalizada = ['Entregue', 'Concluída'].includes(os.status) || os.pago
    const voltaParaAtivo = !['Entregue', 'Concluída'].includes(novoStatus)
    if (finalizada && voltaParaAtivo) {
      const ok = confirm(
        `A OS está em "${os.status}".\n\nMudar para "${novoStatus}" vai ESTORNAR o pagamento: ` +
        `o lançamento do financeiro e a venda do caixa serão removidos.\n\nDeseja continuar?`
      )
      if (!ok) return
    }
    mudarStatusOrdem(os.id, novoStatus)
  }

  // Aumentar a quantidade de uma peça consome mais estoque — só o acréscimo precisa
  // caber no que sobrou, já que a quantidade atual do item já foi baixada.
  const erroEdicaoEstoque = (() => {
    if (!editandoItem || editandoItem.tipo !== 'peca' || !editandoItem.produtoId) return null
    const produto = estoque.find(p => p.id === Number(editandoItem.produtoId))
    if (!produto) return null
    const original = os.itens?.find(i => i.id === editandoItem.id)
    const acrescimo = parseQtd(editandoItem.quantidade) - parseQtd(original?.quantidade)
    const disp = Number(produto.estoque) || 0
    if (acrescimo > disp) return `Só há ${disp} unidade(s) em estoque para aumentar.`
    return null
  })()

  function salvarItemEditado() {
    if (erroEdicaoEstoque) return
    editarItemOrdem(os.id, editandoItem.id, {
      descricao: editandoItem.descricao,
      quantidade: parseQtd(editandoItem.quantidade),
      valorUnitario: editandoItem.valorUnitario,
      desconto: editandoItem.desconto,
      mecanicoId: editandoItem.tipo === 'servico' ? (editandoItem.mecanicoId || null) : null,
    })
    setEditandoItem(null)
  }

  const AVISO_PENDENCIA = 'Há alterações não salvas no diagnóstico ou na vistoria.\n\nSe sair agora, elas serão perdidas. Deseja sair mesmo assim?'

  function trocarAba(nova) {
    if (nova === aba) return
    const saindoDeAbaComRascunho =
      (aba === 'Diagnóstico' && diagPendente) ||
      (aba === 'Fotos e Vistoria' && vistoriaPendente)
    if (saindoDeAbaComRascunho && !confirm(AVISO_PENDENCIA)) return
    setAba(nova)
  }

  function voltarParaLista() {
    if (temPendencia && !confirm(AVISO_PENDENCIA)) return
    navigate('/ordens-servico')
  }

  function confirmarAprovacao() {
    if (!confirm(`Confirmar que o cliente aprovou o orçamento de ${fmt(total)}?\n\nO veículo fica liberado para o reparador iniciar o reparo.`)) return
    comProtecao(() => aprovarOrcamento(os.id))
  }

  function abrirRecusa() {
    setMotivoRecusa('')
    setValorDiagnostico('')
    setFormaDiag('PIX')
    setModalRecusa(true)
  }

  // Cliente recusou o reparo: o diagnóstico pode ou não ser cobrado, e fica
  // registrado qual foi a escolha e quem decidiu.
  function confirmarRecusa(cobrar) {
    if (cobrar && pNum(valorDiagnostico) <= 0) {
      alert('Informe o valor do diagnóstico para cobrar.')
      return
    }
    recusarOrcamento(os.id, motivoRecusa)
    fecharRecusa(os.id, {
      cobrar,
      valorDiagnostico: cobrar ? valorDiagnostico : 0,
      pagamentos: cobrar ? [{ forma: formaDiag, valor: String(pNum(valorDiagnostico)) }] : [],
      clienteNome: cliente?.nome || 'Cliente',
    })
    setModalRecusa(false)
  }

  // Ações que geram efeito financeiro não podem disparar duas vezes seguidas
  function comProtecao(fn) {
    if (processandoAcao) return
    setProcessandoAcao(true)
    try { fn() } finally { setTimeout(() => setProcessandoAcao(false), 1200) }
  }

  const osFinalizada = ['Entregue', 'Cancelada'].includes(os.status)

  // Cobrar não depende mais de a OS estar em "Concluída": com o cliente no
  // balcão, a recepção precisa fechar na hora. A "Rejeitada" tem o botão dela
  // ("Fechar recusa e entregar"), que cobra só o diagnóstico.
  const semConferencia = !os.conferencia?.aprovado
  // Mais recente primeiro. OS antiga pode ter só o registro único `conferencia`.
  const conferencias = (os.conferencias?.length ? [...os.conferencias].reverse()
    : os.conferencia ? [os.conferencia] : [])
  const podeCobrar = !osFinalizada && os.status !== 'Rejeitada' && !os.pago && total > 0

  const FORMAS_PGTO = [
    { label: 'PIX', icon: Smartphone },
    { label: 'Dinheiro', icon: Banknote },
    { label: 'Cartão Débito', icon: CreditCard },
    { label: 'Cartão Crédito', icon: CreditCard },
    { label: 'Transferência', icon: ArrowRightLeft },
    { label: 'Boleto', icon: FileText },
  ]

  function addPgto() {
    const soma = pgtos.reduce((s, p) => s + pNum(p.valor), 0)
    const restante = Math.max(0, total - soma)
    setPgtos(ps => [...ps, { id: gerarId(), forma: 'PIX', valor: restante.toFixed(2).replace('.', ','), recebimento: 'na_hora', parcelas: '1' }])
  }

  function removePgto(id) {
    setPgtos(ps => ps.filter(p => p.id !== id))
  }

  function updatePgto(id, field, value) {
    setPgtos(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function confirmarPagarEntregar(comImprimir) {
    const somaPgtos = pgtos.reduce((s, p) => s + pNum(p.valor), 0)
    if (Math.abs(somaPgtos - total) > 0.01) {
      alert(`A soma dos pagamentos (${fmt(somaPgtos)}) deve ser igual ao total da OS (${fmt(total)}).`)
      return
    }
    const pagFormatados = pgtos.map(p => {
      const isC = p.forma === 'Cartão Débito' || p.forma === 'Cartão Crédito'
      const pg = { forma: p.forma, valor: String(pNum(p.valor)) }
      if (isC) pg.recebimento = p.recebimento
      if (p.forma === 'Cartão Crédito' && Number(p.parcelas) > 1) pg.parcelas = Number(p.parcelas)
      return pg
    })
    entregarOrdem(os.id, pagFormatados, cliente?.nome || 'Cliente')
    setModalFinalizar(false)
    if (comImprimir) {
      // O `os` desta closure ainda é o de antes da entrega — o recibo sairia como
      // "Concluída" e não paga. Monta a versão entregue para imprimir.
      const osEntregue = {
        ...os,
        status: 'Entregue',
        pago: true,
        dataConclusao: os.dataConclusao || new Date().toLocaleDateString('pt-BR'),
        pagamentos: pagFormatados,
      }
      setTimeout(() => imprimirOS(osEntregue, cliente, veiculo, mecanico, total, 'a4det'), 300)
    }
  }

  // Grava no cadastro do cliente e do veículo. A OS guarda cópias do nome, do
  // modelo e da placa (para OS antiga e para o link do cliente): sem atualizar
  // essas cópias, a tela mostrava o dado corrigido e a nota impressa o antigo.
  function salvarClienteVeiculo(c, v) {
    if (os.clienteId != null) {
      setClientes(prev => prev.map(x => x.id === os.clienteId ? { ...x, ...c } : x))
    }
    if (os.veiculoId != null) {
      setVeiculos(prev => prev.map(x => x.id === os.veiculoId ? { ...x, ...v } : x))
    }
    const modeloCompleto = [v.marca, v.modelo].filter(Boolean).join(' ').trim()
    atualizarOrdem(os.id, {
      clienteNome: c.nome,
      clienteTelefone: c.telefone,
      veiculoModelo: modeloCompleto || v.modelo,
      veiculoPlaca: v.placa,
      combustivel: v.combustivel || os.combustivel,
      historico: [
        { id: gerarId(), texto: `Dados do cliente/veículo corrigidos por ${currentUser?.nome || 'usuário'}`, data: new Date().toLocaleString('pt-BR') },
        ...(os.historico || []),
      ],
    })
  }

  function confirmarReabrir() {
    reabrirOrdem(os.id)
    setModalReabrir(false)
  }

  function aplicarTaxaItem(item) {
    const pct = parseFloat(taxaPct) || 0
    if (!pct) return
    editarItemOrdem(os.id, item.id, { valorUnitario: (pNum(item.valorUnitario) * (1 + pct / 100)).toFixed(2).replace('.', ','), quantidade: item.quantidade })
  }

  function aplicarTaxaTodos() {
    const pct = parseFloat(taxaPct) || 0
    if (!pct || !os.itens?.length) return
    os.itens.forEach(item => {
      editarItemOrdem(os.id, item.id, { valorUnitario: (pNum(item.valorUnitario) * (1 + pct / 100)).toFixed(2).replace('.', ','), quantidade: item.quantidade })
    })
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <button onClick={voltarParaLista} aria-label="Voltar para a lista de OS" className="mt-1 text-slate-400 hover:text-slate-600"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">OS {os.id}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[os.status] || 'bg-slate-100 text-slate-600'}`}>{os.status}</span>
              {temPendencia && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  <AlertTriangle size={11} /> Não salvo
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{cliente?.nome || os.clienteNome || '—'} • {[veiculo?.placa || os.veiculoPlaca, nomeVeiculo(veiculo, os)].filter(x => x && x !== '—').join(' ') || '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap">
          <button onClick={() => setModalEditar(true)} disabled={osFinalizada}
            title={osFinalizada ? 'OS finalizada — reabra a OS para editar' : ''}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"><Pencil size={14} />Editar</button>
          <button onClick={() => imprimir('a4det')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap flex-shrink-0"><Printer size={14} />Nota de Serviço</button>
          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuImpressao(v => !v)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"><Receipt size={14} />Recibo<ChevronDown size={14} /></button>
            {menuImpressao && (
              <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuImpressao(false)} />
              <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Escolha o modelo de impressão</p>
                {MODELOS_IMPRESSAO.map(m => (
                  <button key={m.id} onClick={() => imprimir(m.id)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-50">
                    <p className="text-sm font-medium text-slate-700">{m.nome}</p>
                    <p className="text-xs text-slate-400">{m.desc}</p>
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
          <button onClick={whatsapp} className="flex items-center gap-1.5 border border-green-200 text-green-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors whitespace-nowrap flex-shrink-0"><MessageCircle size={14} />WhatsApp</button>
          {(fotosOS.length > 0 || fotosReparoOS.length > 0) && (
            <button onClick={enviarFotosAoCliente}
              title="Enviar ao cliente o link com as fotos do veículo"
              className="flex items-center gap-1.5 border border-cyan-200 text-cyan-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-cyan-50 transition-colors whitespace-nowrap flex-shrink-0">
              <Camera size={14} />Enviar fotos
            </button>
          )}
          <button onClick={gerarOrcamento} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap flex-shrink-0"><FileText size={14} />Gerar Orçamento</button>
          {os.status === 'Aguardando Aprovação' && (
            <>
              <button onClick={confirmarAprovacao} disabled={processandoAcao}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
                <ThumbsUp size={14} />Cliente aprovou
              </button>
              <button onClick={abrirRecusa} disabled={processandoAcao}
                className="flex items-center gap-1.5 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap flex-shrink-0">
                <ThumbsDown size={14} />Cliente recusou
              </button>
            </>
          )}
          {os.status === 'Rejeitada' && (
            <button onClick={abrirRecusa} disabled={processandoAcao}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <Banknote size={14} />Fechar recusa e entregar
            </button>
          )}
          {EM_EXECUCAO.includes(os.status) && (
            <button onClick={() => comProtecao(() => concluirReparo(os.id))} disabled={processandoAcao}
              title="O veículo vai para conferência antes de ser liberado"
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              {processandoAcao ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Reparo concluído
            </button>
          )}
          {os.status === 'Em Conferência' && (
            temPermissao('conferir-os') ? (
              <button onClick={() => navigate(`/conferencia/${encodeURIComponent(os.id)}`)}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
                <ClipboardList size={14} />Conferir veículo
              </button>
            ) : (
              <span className="text-xs text-slate-500 px-3 py-2 whitespace-nowrap">Aguardando conferência</span>
            )
          )}
          {podeCobrar && (
            <button onClick={() => { setPgtos([{ id: 1, forma: 'PIX', valor: total.toFixed(2).replace('.', ','), recebimento: 'na_hora', parcelas: '1' }]); setModalFinalizar(true) }} disabled={processandoAcao} className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <Banknote size={14} />Pagar e entregar
            </button>
          )}
          {/* OS que não tem como ser cobrada ficava sem saída para "Entregue":
              paga esconde o "Pagar e entregar" (cobraria de novo) e sem valor o
              modal nem abre — caso das fichas migradas, que vieram sem itens e
              sem a marca de pagas. Esta é a saída, sem tocar no caixa. */}
          {!osFinalizada && os.status !== 'Rejeitada' && !podeCobrar && (
            <button onClick={() => {
              const pergunta = os.pago
                ? 'Esta OS já está paga. Marcar como entregue SEM lançar nada no caixa?\n\nFica registrado no histórico que você liberou.'
                : 'Esta OS não tem valor lançado. Use se o veículo já foi pago e entregue no sistema antigo, ou se não há nada a cobrar.\n\nVira "Entregue" sem lançar nada no caixa, e fica registrado que você liberou. Confirmar?'
              if (!confirm(pergunta)) return
              comProtecao(() => entregarSemCobrar(os.id))
            }} disabled={processandoAcao}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <CheckCircle2 size={14} />{os.pago ? 'Entregar (já paga)' : 'Entregar sem cobrança'}
            </button>
          )}
          {os.status === 'Concluída' && (
            <button onClick={() => setModalReabrir(true)} disabled={processandoAcao} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <ArrowRightLeft size={14} />Reabrir OS
            </button>
          )}
          {os.status === 'Entregue' && (
            <button onClick={() => setModalReabrir(true)} disabled={processandoAcao} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <ArrowRightLeft size={14} />Reabrir OS
            </button>
          )}
          <button onClick={excluir} disabled={processandoAcao} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"><Trash2 size={14} />Excluir</button>
        </div>
      </div>

      {/* Alterar status */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Alterar Status:</label>
        <select value={os.status} onChange={e => trocarStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          {STATUS_OS.filter(s => s !== 'Concluída' && s !== 'Entregue' && s !== 'Cancelada').map(s => <option key={s}>{s}</option>)}
          {/* OS antigas têm status que saíram do fluxo ("Aberta", "Em Andamento").
              Sem esta linha o seletor exibia "Recepção" — um status que não era o
              real — e quem encostasse nele movia a OS sem perceber. */}
          {!STATUS_OS.includes(os.status) && <option>{os.status}</option>}
          {['Concluída', 'Entregue', 'Cancelada'].includes(os.status) && <option>{os.status}</option>}
        </select>
        {(os.pago || os.status === 'Entregue') && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
            <AlertTriangle size={12} /> OS paga — mudar o status estorna o caixa
          </span>
        )}
      </div>

      {/* Abas */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {ABAS.map(a => {
          const pendente = (a === 'Diagnóstico' && diagPendente) || (a === 'Fotos e Vistoria' && vistoriaPendente)
          return (
            <button key={a} onClick={() => trocarAba(a)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${aba === a ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {a}
              {/* Sem o contador ninguém descobria que a OS tinha foto — era
                  preciso abrir a aba e rolar até o fim para ver as do reparo. */}
              {a === 'Fotos e Vistoria' && todasFotosOS.length > 0 && (
                <span className="text-[10px] font-bold bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full">
                  {todasFotosOS.length}
                </span>
              )}
              {pendente && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Alterações não salvas" />}
            </button>
          )
        })}
      </div>

      {/* ===== DADOS ===== */}
      {aba === 'Dados' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Informações</h3>
            <Linha label="Data Entrada" valor={os.dataEntrada || os.data} />
            <Linha label="Data Conclusão" valor={os.dataConclusao || '—'} />
            <Linha label="KM Entrada" valor={os.kmEntrada || '—'} />
            <Linha label="Mecânico Responsável" valor={mecanico?.nome || '—'} />
            {os.descricaoProblema && <div className="pt-3 mt-1 border-t border-slate-50"><p className="text-xs text-slate-400 mb-1">Descrição do Problema</p><p className="text-sm text-slate-600">{os.descricaoProblema}</p></div>}
            {os.diagnostico && <div className="pt-3 mt-2 border-t border-slate-50"><p className="text-xs text-slate-400 mb-1">Diagnóstico</p><p className="text-sm text-slate-600">{os.diagnostico}</p></div>}
            {/* O que o reparador anotou só aparecia na aba Orçamento, longe de
                quem abre a OS para entender o que foi feito no carro. */}
            {os.observacoesTecnicas && (
              <div className="pt-3 mt-2 border-t border-slate-50">
                <p className="text-xs text-slate-400 mb-1">
                  Anotações do reparador{os.tecnicoNome ? ` — ${os.tecnicoNome}` : ''}
                </p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{os.observacoesTecnicas}</p>
              </div>
            )}
            {os.pecasNecessarias?.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-50">
                <p className="text-xs text-slate-400 mb-1">Peças que ele pediu</p>
                <ul className="text-sm text-slate-600 space-y-0.5">
                  {os.pecasNecessarias.map((p, i) => (
                    <li key={i}>• {p.quantidade || 1}x {p.nome || p.descricao || p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* A recepção coleta documento, endereço completo, 2º telefone, e-mail,
              motor e combustível — nada disso aparecia aqui, e não havia por onde
              corrigir quando alguém digitava errado na entrada. */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Cliente / Veículo</h3>
              <button onClick={() => setModalCliente(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
                <Pencil size={13} />Corrigir dados
              </button>
            </div>

            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Cliente</p>
            <Linha label="Nome" valor={cliente?.nome || os.clienteNome || '—'} />
            <Linha label="CPF / CNPJ" valor={cliente?.cpfCnpj || cliente?.cpf || '—'} />
            <Linha label="Telefone" valor={cliente?.telefone || '—'} />
            {cliente?.telefone2 && <Linha label="Telefone 2" valor={cliente.telefone2} />}
            <Linha label="E-mail" valor={cliente?.email || '—'} />
            <Linha label="Endereço" valor={[cliente?.endereco, cliente?.numero].filter(Boolean).join(', ') || '—'} />
            <Linha label="Bairro" valor={cliente?.bairro || '—'} />
            <Linha label="Cidade / UF" valor={cliente?.cidadeEstado || '—'} />
            <Linha label="CEP" valor={cliente?.cep || '—'} />

            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mt-4 mb-1 pt-3 border-t border-slate-50">Veículo</p>
            <Linha label="Placa" valor={veiculo?.placa || os.veiculoPlaca || '—'} />
            <Linha label="Marca / Modelo" valor={nomeVeiculo(veiculo, os)} />
            <Linha label="Ano" valor={veiculo?.ano || '—'} />
            <Linha label="Cor" valor={veiculo?.cor || '—'} />
            <Linha label="Motor" valor={veiculo?.motor || '—'} />
            <Linha label="Combustível" valor={veiculo?.combustivel || os.combustivel || '—'} />
            {os.ultimaRevisao && <Linha label="Última revisão" valor={os.ultimaRevisao} />}
            {os.numCondutores && <Linha label="Nº de condutores" valor={os.numCondutores} />}
          </div>

          {/* A conferência de entrega era gravada e nunca lida: não havia como
              saber quem liberou o carro, quando, nem o que foi checado. */}
          {conferencias.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 lg:col-span-2">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldCheck size={15} className="text-cyan-500" />Conferência de entrega
              </h3>
              <div className="space-y-4">
                {conferencias.map((c, i) => {
                  const problemas = (c.itens || []).filter(it => it.status === 'problema')
                  const ok = (c.itens || []).filter(it => it.status === 'ok').length
                  const na = (c.itens || []).filter(it => it.status === 'na').length
                  return (
                    <div key={c.conferidoEm + i} className={`rounded-xl border p-4 ${c.aprovado ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.aprovado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.aprovado ? 'Liberado para entrega' : 'Devolvido para reparo'}
                        </span>
                        <span className="text-sm text-slate-700 font-medium">{c.conferidoPorNome || '—'}</span>
                        <span className="text-xs text-slate-400">{c.conferidoEm}</span>
                        <span className="ml-auto text-xs text-slate-400">{ok} ok · {na} n/a · {problemas.length} problema(s)</span>
                      </div>
                      {problemas.length > 0 && (
                        <ul className="mb-2 space-y-1">
                          {problemas.map(p => (
                            <li key={p.id} className="text-sm text-red-700 flex gap-1.5">
                              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                              <span><strong>{p.label}:</strong> {p.nota || 'sem descrição'}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {(c.itens || []).filter(it => it.status !== 'problema').map(it => (
                          <span key={it.id} className={`text-xs px-2 py-0.5 rounded-full ${
                            it.status === 'ok' ? 'bg-white text-slate-600 border border-slate-200' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {it.status === 'ok' ? '✓' : '—'} {it.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ENTRADA ===== */}
      {aba === 'Entrada' && (
        <div className="space-y-4">
          {(os.relatoCliente || os.falhasScanner || (os.luzesPainel && os.luzesPainel.length > 0)) && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><ClipboardList size={15} className="text-blue-500" />Relato do Cliente</h3>
              <div className="space-y-3">
                {os.relatoCliente && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Queixa</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{os.relatoCliente}</p>
                  </div>
                )}
                {os.falhasScanner && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Falhas / Scanner</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3">{os.falhasScanner}</p>
                  </div>
                )}
                {os.luzesPainel && os.luzesPainel.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-medium mb-2">Luzes do Painel ({os.luzesPainel.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {os.luzesPainel.map(l => (
                        <span key={l} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Autorização do diagnóstico: comprovação interna de que o cliente
              assinou, com data e hora. Sem assinatura, mostra que está pendente
              em vez de simplesmente não aparecer. */}
          {os.assinatura ? (
            <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <PenTool size={15} className="text-green-500" />
                <h3 className="font-semibold text-slate-800">Assinatura do Cliente</h3>
                <span className="ml-auto text-xs text-green-700 font-medium flex items-center gap-1 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                  <CheckCircle2 size={12} />Assinado
                </span>
              </div>
              {/* Fundo branco por estilo direto: a classe bg-white é reescrita
                  para cinza-escuro no modo escuro, a mesma cor do traço da
                  assinatura — o desenho sumia. */}
              <img src={os.assinatura} alt="Assinatura do cliente"
                style={{ backgroundColor: '#ffffff' }}
                className="max-h-24 border border-slate-200 rounded-lg p-2" />
              <p className="text-xs text-slate-500 mt-2">
                {os.assinaturaTempo
                  ? `Autorização do diagnóstico assinada em ${new Date(os.assinaturaTempo).toLocaleString('pt-BR')}`
                  : 'Autorização do diagnóstico assinada (sem registro de horário)'}
                {cliente?.nome ? ` · ${cliente.nome}` : ''}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <PenTool size={15} className="text-amber-600" />
                <h3 className="font-semibold text-amber-900">Cliente ainda não assinou</h3>
              </div>
              <p className="text-sm text-amber-800">
                A autorização do diagnóstico não foi assinada. Sem ela não há registro de que
                o cliente foi informado de que o diagnóstico é cobrado.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={enviarLinkAssinatura}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                  <MessageCircle size={15} /> Enviar link para assinar
                </button>
                <button onClick={copiarLinkAssinatura}
                  className="flex items-center gap-2 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors">
                  {linkAssinCopiado ? <Check size={15} /> : <Copy size={15} />}
                  {linkAssinCopiado ? 'Copiado!' : 'Copiar link'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Dados da Entrada</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Linha label="Atendente" valor={os.atendente || '—'} />
              <Linha label="KM Entrada" valor={os.kmEntrada || '—'} />
              <Linha label="Combustível" valor={os.combustivel || '—'} />
              <Linha label="Nº Condutores" valor={os.numCondutores || '—'} />
              <Linha label="Última Revisão" valor={os.ultimaRevisao || '—'} />
              <Linha label="Data Entrada" valor={os.dataEntrada || os.data || '—'} />
            </div>
          </div>

          {!os.relatoCliente && !os.falhasScanner && (!os.luzesPainel || os.luzesPainel.length === 0) && !os.assinatura && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
              <ClipboardList size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-600">Nenhum dado de entrada registrado</p>
              <p className="text-sm text-slate-400 mt-1">Os dados de entrada são preenchidos na tela de Nova Entrada.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== DIAGNÓSTICO ===== */}
      {aba === 'Diagnóstico' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Wrench size={15} className="text-primary-500" />Diagnóstico Técnico
              </h3>
              {os.tecnicoNome && (
                <span className="text-xs text-blue-600 font-medium">{os.tecnicoNome} {os.diagnosticadoEm ? `· ${os.diagnosticadoEm}` : ''}</span>
              )}
            </div>
            <div className="space-y-3">
              {diagItens.map(item => (
                <div key={item.id} className="md:grid md:grid-cols-12 md:gap-3 md:items-center space-y-2 md:space-y-0 pb-3 md:pb-2 border-b border-slate-100 md:border-slate-50 last:border-0">
                  <div className="md:col-span-4">
                    <p className="text-sm font-medium text-slate-700">{item.label}</p>
                    {item.unidade && <p className="text-xs text-slate-400">{item.unidade}</p>}
                  </div>
                  <div className="md:col-span-4">
                    <input type="text" placeholder="Valor medido..."
                      aria-label={`Valor medido — ${item.label}`}
                      value={item.value || ''}
                      onChange={e => setValorDiag(item.id, 'value', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 md:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div className="md:col-span-4 flex gap-1.5">
                    {Object.entries(STATUS_DIAG).map(([key, { label, cls }]) => (
                      <button key={key}
                        onClick={() => setValorDiag(item.id, 'status', key)}
                        className={`flex-1 py-2 md:py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          item.status === key ? cls : 'border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Observações Técnicas</label>
                <textarea rows={3} value={obsTecnicas}
                  onChange={e => setObsTecnicasLocal(e.target.value)}
                  placeholder="Conclusão do diagnóstico, serviços recomendados, peças necessárias..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end">
            {diagPendente && (
              <span className="text-xs text-amber-700 font-medium flex items-center gap-1 mr-auto">
                <AlertTriangle size={13} /> Alterações ainda não salvas
              </span>
            )}
            <button onClick={() => salvarDiagLocal(null)} disabled={salvandoDiag}
              className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <Save size={15} /> {salvandoDiag ? 'Salvando...' : 'Salvar Progresso'}
            </button>
            {os.status === 'Em Diagnóstico' && (
              <button onClick={() => salvarDiagLocal('Aguardando Aprovação')}
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <FileText size={15} /> Enviar Orçamento
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== ORÇAMENTO ===== */}
      {aba === 'Orçamento' && (
        <div className="space-y-4">

        {/* Parecer do reparador — é a base para montar os itens abaixo */}
        {(os.observacoesTecnicas || os.pecasNecessarias?.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Wrench size={15} className="text-blue-600" />
              <h3 className="font-semibold text-blue-900 text-sm">O que o reparador concluiu</h3>
              {os.tecnicoNome && (
                <span className="text-xs text-blue-700 ml-auto">
                  {os.tecnicoNome}{os.diagnosticadoEm ? ` · ${os.diagnosticadoEm}` : ''}
                </span>
              )}
            </div>

            {os.observacoesTecnicas && (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{os.observacoesTecnicas}</p>
            )}

            {os.pecasNecessarias?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
                  Peças que ele pediu ({os.pecasNecessarias.length})
                </p>
                <ul className="space-y-1">
                  {os.pecasNecessarias.map(p => (
                    <li key={p.id} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="text-blue-400">•</span>
                      <span className="font-medium">{p.quantidade}x</span>
                      <span>{p.descricao}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-blue-700 mt-2">
                  Lance cada uma como item abaixo para entrar no valor e sair do estoque.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-slate-800">Itens / Orçamento</h3>
              <p className="text-sm text-slate-500">Total: {fmt(total)}{descGeral > 0 ? ` (desc. ${fmt(descGeral)})` : ''}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Acréscimo:</span>
                <input type="number" value={taxaPct} onChange={e => setTaxaPct(e.target.value)} min="0" max="100" step="0.5"
                  className="w-12 text-sm text-right focus:outline-none bg-transparent font-semibold text-amber-800" />
                <span className="text-sm font-semibold text-amber-700">%</span>
                <button onClick={aplicarTaxaTodos}
                  className="text-xs px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium transition-colors whitespace-nowrap">
                  Todos
                </button>
              </div>
              <button onClick={() => setModalItem(true)} disabled={osFinalizada}
                title={osFinalizada ? 'OS finalizada — reabra a OS para alterar os itens' : ''}
                className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Plus size={15} />Adicionar</button>
            </div>
          </div>
          {(!os.itens || os.itens.length === 0) ? (
            <p className="text-center text-sm text-slate-400 py-10">Nenhum item adicionado</p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-y border-slate-100 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 font-semibold">Item</th>
                  <th className="text-center py-2 font-semibold">Qtd</th>
                  <th className="text-right py-2 font-semibold">Valor Un.</th>
                  <th className="text-right py-2 font-semibold">Desc.</th>
                  <th className="text-right py-2 font-semibold">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {os.itens.map(it => (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <span className="text-sm text-slate-700">{it.descricao} </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${it.tipo === 'servico' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{it.tipo === 'servico' ? 'serviço' : 'peça'}</span>
                      {it.tipo === 'servico' && it.mecanicoId && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">{getFuncionario(it.mecanicoId)?.nome || ''}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center text-sm text-slate-600">{it.quantidade}</td>
                    <td className="py-2.5 text-right text-sm text-slate-600">{fmt(pNum(it.valorUnitario))}</td>
                    <td className="py-2.5 text-right text-sm text-slate-500">{pNum(it.desconto) > 0 ? fmt(pNum(it.desconto)) : '—'}</td>
                    <td className="py-2.5 text-right text-sm font-semibold text-slate-700">{fmt(pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto))}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => aplicarTaxaItem(it)} disabled={osFinalizada} aria-label={`Aplicar acréscimo de ${taxaPct}%`} title={`+${taxaPct}%`} className="p-1 rounded hover:bg-amber-50 text-slate-300 hover:text-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors">%</button>
                        <button onClick={() => setEditandoItem({ ...it, quantidade: String(it.quantidade), valorUnitario: String(it.valorUnitario), desconto: String(it.desconto || '0'), mecanicoId: it.mecanicoId || '' })} disabled={osFinalizada} aria-label="Editar item" className="p-1 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"><Pencil size={14} /></button>
                        <button onClick={() => { if (confirm(`Remover "${it.descricao}" da OS?`)) removerItemOrdem(os.id, it.id) }} disabled={osFinalizada} aria-label="Remover item" className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {descGeral > 0 && (
                  <tr className="border-t border-slate-100">
                    <td colSpan={4} className="py-2 text-right text-sm text-slate-500">Subtotal</td>
                    <td className="py-2 text-right text-sm text-slate-500">{fmt(subtotal)}</td>
                    <td></td>
                  </tr>
                )}
                <tr className={descGeral > 0 ? '' : 'border-t border-slate-100'}>
                  <td colSpan={4} className="py-2 text-right text-sm text-slate-600">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-slate-500">Desconto (R$)</span>
                      <input
                        type="text"
                        aria-label="Desconto geral em reais"
                        value={descontoLocal ?? os.descontoGeral ?? ''}
                        onChange={e => setDescontoLocal(e.target.value)}
                        onBlur={() => {
                          if (descontoLocal === null) return
                          // Desconto não pode passar do subtotal — evita total "zerado" enganoso
                          const valor = pNum(descontoLocal)
                          if (valor > subtotal) {
                            alert(`O desconto (${fmt(valor)}) é maior que o subtotal (${fmt(subtotal)}).`)
                            setDescontoLocal(null)
                            return
                          }
                          atualizarOrdem(os.id, { descontoGeral: descontoLocal })
                          setDescontoLocal(null)
                        }}
                        disabled={osFinalizada}
                        placeholder="0,00"
                        className="w-24 text-right text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  </td>
                  <td className="py-2 text-right text-sm text-red-500 font-medium">{descGeral > 0 ? `- ${fmt(descGeral)}` : ''}</td>
                  <td></td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td colSpan={4} className="py-3 text-right text-sm font-semibold text-slate-600">Total</td>
                  <td className="py-3 text-right font-bold text-slate-800">{fmt(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </div>

        {/* Observações e validade do orçamento — mesmos campos da tela de
            Orçamentos avulsa; saem na impressão. Salvam ao sair do campo. */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Observações e validade do orçamento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">Observações (saem na impressão)</span>
              <textarea rows={3}
                value={obsOrcLocal ?? os.observacoes ?? ''}
                onChange={e => setObsOrcLocal(e.target.value)}
                onBlur={() => {
                  if (obsOrcLocal === null || obsOrcLocal === (os.observacoes || '')) { setObsOrcLocal(null); return }
                  atualizarOrdem(os.id, { observacoes: obsOrcLocal })
                  setObsOrcLocal(null)
                }}
                disabled={osFinalizada}
                placeholder="Garantia, condições, prazo..."
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none disabled:bg-slate-50 disabled:text-slate-400" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Validade do orçamento</span>
              <select value={os.validadeOrcamento || ''}
                onChange={e => atualizarOrdem(os.id, { validadeOrcamento: e.target.value })}
                disabled={osFinalizada}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400">
                <option value="">Sem validade</option>
                <option>7 dias</option>
                <option>15 dias</option>
                <option>30 dias</option>
                <option>60 dias</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Sai na impressão enquanto a OS não for paga; some no recibo final.
              </p>
            </label>
          </div>
        </div>
        </div>
      )}

      {/* ===== FOTOS E VISTORIA ===== */}
      {aba === 'Fotos e Vistoria' && (
        <>
          {fotoAmpliada && (
            <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setFotoAmpliada(null)}>
              <button onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><X size={24} /></button>
              {fotosOS.findIndex(f => f.id === fotoAmpliada.id) > 0 && (
                <button onClick={e => { e.stopPropagation(); navegarFoto(-1) }} className="absolute left-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronLeft size={28} /></button>
              )}
              <img src={fotoAmpliada.url || fotoAmpliada.dataUrl} alt="Foto ampliada" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
              {fotosOS.findIndex(f => f.id === fotoAmpliada.id) < fotosOS.length - 1 && (
                <button onClick={e => { e.stopPropagation(); navegarFoto(1) }} className="absolute right-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronRight size={28} /></button>
              )}
              <div className="absolute bottom-4 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full flex items-center gap-2">
                <span className="font-medium">{fotoAmpliada.categoria}</span>
                <span>·</span>
                <span>{fotosOS.findIndex(f => f.id === fotoAmpliada.id) + 1} / {fotosOS.length}</span>
              </div>
            </div>
          )}

          {/* As fotos do reparo (peça velha e nova) são a prova do serviço e é o
              que se procura aqui — ficavam no fim, atrás da grade de entrada, e
              pareciam não existir. Quando há fotos de reparo, elas vêm primeiro. */}
          <div className="flex flex-col gap-4">
            <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 ${fotosReparoOS.length > 0 ? 'order-2' : 'order-1'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Camera size={15} className="text-cyan-500" />
                <h3 className="font-semibold text-slate-800">Fotos do Veículo</h3>
                <span className="text-xs text-slate-400">na entrada</span>
                <span className="ml-auto text-xs text-slate-400">{fotosOS.length} foto(s)</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <select value={categoriaFoto} onChange={e => setCategoriaFoto(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200">
                  {CATEGORIAS_FOTO.map(c => <option key={c}>{c}</option>)}
                </select>
                <button onClick={() => inputFotoRef.current?.click()} disabled={enviandoFoto}
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  {enviandoFoto
                    ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
                    : <><ImagePlus size={15} /> Adicionar Foto</>}
                </button>
                <input ref={inputFotoRef} type="file" accept="image/*" multiple
                  onChange={adicionarFotoOS} className="hidden" capture="environment" />
              </div>

              {fotosOS.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-center">
                  <Camera size={28} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">Nenhuma foto adicionada</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fotosOS.map(f => (
                    <div key={f.id}
                      className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in"
                      onClick={() => setFotoAmpliada(f)}>
                      <img src={f.url || f.dataUrl} alt={f.categoria} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none">{f.categoria}</div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2">
                        <ZoomIn size={22} className="text-white" />
                        <button
                          aria-label="Remover foto"
                          onClick={e => { e.stopPropagation(); if (confirm('Remover esta foto da vistoria?')) removerFotoOS(f.id) }}
                          className="p-1.5 bg-red-500 text-white rounded-lg self-end"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {fotosReparoOS.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border-2 border-orange-200 p-5 order-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Wrench size={15} className="text-orange-500" />
                  <h3 className="font-semibold text-slate-800">Fotos do reparo</h3>
                  <span className="text-xs text-slate-400">peça velha, peça nova, antes e depois</span>
                  <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">{fotosReparoOS.length} foto(s)</span>
                  <button onClick={() => navigate(`/oficina/reparo/${encodeURIComponent(os.id)}`)}
                    className="ml-auto text-xs text-orange-700 font-medium hover:underline">
                    Adicionar ou remover
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  O cliente vê estas fotos no link de "Enviar fotos", em um bloco separado das fotos de entrada.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fotosReparoOS.map(f => (
                    <div key={f.id} className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in"
                      onClick={() => setFotoAmpliada(f)}>
                      <img src={f.url || f.dataUrl} alt={f.categoria} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">{f.categoria}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 order-3">
              <div className="flex items-center gap-2 mb-4">
                <Eye size={15} className="text-slate-500" />
                <h3 className="font-semibold text-slate-800">Inspeção Visual</h3>
                <span className="ml-auto text-xs text-slate-400">
                  {vistoriaItens.filter(i => i.status).length}/{vistoriaItens.length} itens
                </span>
              </div>
              <div className="space-y-1">
                {vistoriaItens.map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {Object.entries(STATUS_INSP).map(([key, { label, cls }]) => (
                        <button key={key}
                          onClick={() => setStatusInsp(item.id, key)}
                          className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            item.status === key ? cls + ' border-transparent' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 order-4">
              {vistoriaPendente && (
                <span className="text-xs text-amber-700 font-medium flex items-center gap-1 mr-auto">
                  <AlertTriangle size={13} /> Alterações ainda não salvas
                </span>
              )}
              {salvandoVistoria && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Vistoria salva
                </span>
              )}
              <button onClick={salvarVistoriaLocal} disabled={enviandoFoto}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Save size={15} /> Salvar Vistoria
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== HISTÓRICO ===== */}
      {aba === 'Histórico' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Histórico</h3>
          {(!os.historico || os.historico.length === 0) ? (
            <p className="text-sm text-slate-400">Sem histórico</p>
          ) : (
            <div className="space-y-3">
              {os.historico.map(h => (
                <div key={h.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5"></div>
                  <div>
                    <p className="text-sm text-slate-700">{h.texto}</p>
                    <p className="text-xs text-slate-400">{h.data}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalEditar && <ModalEditar os={os} funcionarios={funcionarios} onClose={() => setModalEditar(false)} onSalvar={d => { atualizarOrdem(os.id, d); setModalEditar(false) }} />}
      {modalCliente && (
        <ModalEditarClienteVeiculo cliente={cliente} veiculo={veiculo} os={os}
          onClose={() => setModalCliente(false)}
          onSalvar={(c, v) => { salvarClienteVeiculo(c, v); setModalCliente(false) }} />
      )}
      {modalItem && <ModalAdicionarItem servicos={servicos} estoque={estoque} funcionarios={funcionarios} onClose={() => setModalItem(false)} onAdd={item => { adicionarItemOrdem(os.id, item); setModalItem(false) }} />}

      {/* Modal Finalizar OS */}
      {modalFinalizar && (() => {
        const somaPgtos = pgtos.reduce((s, p) => s + pNum(p.valor), 0)
        const restante = total - somaPgtos
        const valido = Math.abs(restante) < 0.01
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalFinalizar(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <h3 className="font-semibold text-slate-800">Pagar e Entregar — OS {os.id}</h3>
                <button onClick={() => setModalFinalizar(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
                  {descGeral > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Subtotal</span>
                        <span className="text-sm text-slate-500">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-red-400">Desconto</span>
                        <span className="text-sm text-red-500">- {fmt(descGeral)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Total da OS</span>
                    <span className="text-xl font-bold text-primary-600">{fmt(total)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Formas de Pagamento</label>
                    <button type="button" onClick={addPgto} className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700">
                      <Plus size={13} />Adicionar
                    </button>
                  </div>

                  {pgtos.map(pg => {
                    const isC = pg.forma === 'Cartão Débito' || pg.forma === 'Cartão Crédito'
                    return (
                      <div key={pg.id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <select value={pg.forma} onChange={e => updatePgto(pg.id, 'forma', e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                            {FORMAS_PGTO.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
                          </select>
                          <div className="flex items-center border border-slate-200 rounded-lg bg-white px-2">
                            <span className="text-xs text-slate-400">R$</span>
                            <input
                              type="text"
                              value={pg.valor}
                              onChange={e => updatePgto(pg.id, 'valor', e.target.value)}
                              className="w-24 py-2 text-sm font-medium text-right focus:outline-none bg-transparent"
                              placeholder="0,00"
                            />
                          </div>
                          {pgtos.length > 1 && (
                            <button type="button" onClick={() => removePgto(pg.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        {isC && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => updatePgto(pg.id, 'recebimento', 'na_hora')}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pg.recebimento === 'na_hora' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              Na hora
                            </button>
                            <button type="button" onClick={() => updatePgto(pg.id, 'recebimento', '1_dia_util')}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pg.recebimento === '1_dia_util' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              1 dia útil
                            </button>
                          </div>
                        )}

                        {pg.forma === 'Cartão Crédito' && (
                          <div className="space-y-1">
                            <div className="grid grid-cols-6 gap-1">
                              {['1','2','3','4','5','6','7','8','9','10','11','12'].map(p => (
                                <button key={p} type="button" onClick={() => updatePgto(pg.id, 'parcelas', p)}
                                  className={`py-1 rounded border text-xs font-medium transition-colors ${pg.parcelas === p ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                  {p}x
                                </button>
                              ))}
                            </div>
                            {Number(pg.parcelas) > 1 && (
                              <p className="text-xs text-slate-400 text-center">
                                {pg.parcelas}x de {fmt(pNum(pg.valor) / Number(pg.parcelas))}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {pgtos.length > 1 && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${valido ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    <span>{valido ? '✓ Valores conferem' : 'Restante a distribuir'}</span>
                    {!valido && <span>{fmt(Math.abs(restante))}</span>}
                  </div>
                )}

                {semConferencia && (
                  <div className="flex items-start gap-2 bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs px-3 py-2 rounded-lg">
                    <ClipboardList size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Este veículo não passou pela conferência. Pode entregar assim mesmo — vai ficar registrado no histórico que foi você quem liberou.</span>
                  </div>
                )}

                {/* Sem caixa aberto a venda era descartada em silêncio e só o
                    financeiro recebia o valor — o relatório do caixa nunca fechava. */}
                {!caixaTurno && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span><strong>Caixa fechado.</strong> Abra o caixa antes de receber, senão este valor não entra no relatório do turno.</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => confirmarPagarEntregar(false)} disabled={!valido || !caixaTurno}
                    className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Confirmar
                  </button>
                  <button type="button" onClick={() => confirmarPagarEntregar(true)} disabled={!valido || !caixaTurno}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                    <Printer size={15} />Confirmar e Imprimir
                  </button>
                </div>
                {!caixaTurno && (
                  <button type="button" onClick={() => navigate('/caixa')}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                    Abrir o caixa agora
                  </button>
                )}

                {/* OS fechada na versão antiga: o dinheiro já entrou lá. Cobrar de
                    novo aqui dobraria a receita do dia. */}
                <button type="button" onClick={() => {
                  if (!confirm('Usar só se este veículo JÁ FOI PAGO no sistema antigo.\n\nA OS vira "Entregue" sem lançar nada no caixa nem no financeiro, e fica registrado que você liberou. Confirmar?')) return
                  setModalFinalizar(false)
                  comProtecao(() => entregarSemCobrar(os.id))
                }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 pt-1">
                  Já foi paga no sistema antigo — entregar sem lançar no caixa
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Editar Item */}
      {editandoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditandoItem(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Editar Item</h3>
              <button onClick={() => setEditandoItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input value={editandoItem.descricao} onChange={e => setEditandoItem(i => ({ ...i, descricao: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input type="text" inputMode="decimal" value={editandoItem.quantidade} onChange={e => setEditandoItem(i => ({ ...i, quantidade: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${erroEdicaoEstoque ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unit.</label>
                  <input value={editandoItem.valorUnitario} onChange={e => setEditandoItem(i => ({ ...i, valorUnitario: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desconto</label>
                  <input value={editandoItem.desconto} onChange={e => setEditandoItem(i => ({ ...i, desconto: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              {editandoItem.tipo === 'servico' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reparador</label>
                  <select value={editandoItem.mecanicoId || ''} onChange={e => setEditandoItem(i => ({ ...i, mecanicoId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Sem reparador</option>
                    {funcionarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              )}
              {erroEdicaoEstoque && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  <AlertTriangle size={14} className="flex-shrink-0" /> {erroEdicaoEstoque}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditandoItem(null)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={salvarItemEditado} disabled={!!erroEdicaoEstoque}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recusa do cliente */}
      {modalRecusa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalRecusa(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Cliente recusou o orçamento</h3>
              <button onClick={() => setModalRecusa(false)} aria-label="Fechar" className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo (opcional)</label>
                <input value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
                  placeholder="Achou caro, vai fazer em outro lugar..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-1">O diagnóstico será cobrado?</p>
                <p className="text-xs text-slate-500 mb-3">
                  O cliente autorizou o diagnóstico na entrada, então ele costuma ser cobrado mesmo sem o reparo.
                  Fica registrado quem decidiu.
                </p>

                <div className="bg-slate-50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white px-2 flex-1">
                      <span className="text-xs text-slate-400">R$</span>
                      <input type="text" inputMode="decimal" value={valorDiagnostico}
                        onChange={e => setValorDiagnostico(e.target.value)} placeholder="0,00"
                        aria-label="Valor do diagnóstico"
                        className="w-full py-2 text-sm font-medium text-right focus:outline-none bg-transparent" />
                    </div>
                    <select value={formaDiag} onChange={e => setFormaDiag(e.target.value)}
                      aria-label="Forma de pagamento"
                      className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {FORMAS_PGTO.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => confirmarRecusa(true)} disabled={!caixaTurno}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                    <Banknote size={15} /> Cobrar diagnóstico e entregar
                  </button>
                </div>

                <button type="button" onClick={() => {
                  if (!confirm('Entregar o veículo sem cobrar o diagnóstico?\n\nVai ficar registrado que você liberou.')) return
                  confirmarRecusa(false)
                }}
                  className="w-full mt-2 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Liberar sem cobrar
                </button>
              </div>

              {!caixaTurno && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span><strong>Caixa fechado.</strong> Abra o caixa para cobrar o diagnóstico — "Liberar sem cobrar" continua disponível.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Reabrir OS */}
      {modalReabrir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalReabrir(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Reabrir OS {os.id}</h3>
              <button onClick={() => setModalReabrir(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">Atenção: estorno será feito</p>
                  <p className="text-xs mt-0.5 text-amber-700">O lançamento financeiro e a venda do caixa desta OS serão removidos. A OS voltará para <strong>Em Execução</strong>.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModalReabrir(false)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarReabrir}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Confirmar Reabertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Linha({ label, valor }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700 text-right">{valor}</span>
    </div>
  )
}

// Corrige o cadastro do cliente e do veículo sem sair da OS. Grava nas tabelas
// de origem, então a correção vale para todas as outras OS do mesmo cliente.
function ModalEditarClienteVeiculo({ cliente, veiculo, os, onClose, onSalvar }) {
  const [c, setC] = useState({
    nome: cliente?.nome || os.clienteNome || '', cpfCnpj: cliente?.cpfCnpj || cliente?.cpf || '',
    telefone: cliente?.telefone || '', telefone2: cliente?.telefone2 || '',
    email: cliente?.email || '', cep: cliente?.cep || '', endereco: cliente?.endereco || '',
    numero: cliente?.numero || '', bairro: cliente?.bairro || '', cidadeEstado: cliente?.cidadeEstado || '',
  })
  const [v, setV] = useState({
    placa: veiculo?.placa || os.veiculoPlaca || '', marca: veiculo?.marca || '',
    modelo: veiculo?.modelo || '', ano: veiculo?.ano || '', cor: veiculo?.cor || '',
    motor: veiculo?.motor || '', combustivel: veiculo?.combustivel || os.combustivel || '',
  })
  const campo = (label, valor, aoMudar, extra = {}) => (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input value={valor} onChange={e => aoMudar(e.target.value)} {...extra}
        className="w-full mt-0.5 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </label>
  )
  return (
    <ModalBase title="Corrigir dados do cliente e do veículo" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{campo('Nome completo', c.nome, x => setC({ ...c, nome: x }))}</div>
            {campo('CPF / CNPJ', c.cpfCnpj, x => setC({ ...c, cpfCnpj: x }))}
            {campo('Telefone', c.telefone, x => setC({ ...c, telefone: x }))}
            {campo('Telefone 2', c.telefone2, x => setC({ ...c, telefone2: x }))}
            {campo('CEP', c.cep, x => setC({ ...c, cep: x }))}
            <div className="col-span-2">{campo('E-mail', c.email, x => setC({ ...c, email: x }), { type: 'email' })}</div>
            <div className="col-span-2">{campo('Logradouro', c.endereco, x => setC({ ...c, endereco: x }))}</div>
            {campo('Número', c.numero, x => setC({ ...c, numero: x }))}
            {campo('Bairro', c.bairro, x => setC({ ...c, bairro: x }))}
            <div className="col-span-2">{campo('Cidade / UF', c.cidadeEstado, x => setC({ ...c, cidadeEstado: x }))}</div>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Veículo</p>
          <div className="grid grid-cols-2 gap-3">
            {campo('Placa', v.placa, x => setV({ ...v, placa: x.toUpperCase() }))}
            {campo('Marca', v.marca, x => setV({ ...v, marca: x }))}
            {campo('Modelo', v.modelo, x => setV({ ...v, modelo: x }))}
            {campo('Ano', v.ano, x => setV({ ...v, ano: x }))}
            {campo('Cor', v.cor, x => setV({ ...v, cor: x }))}
            {campo('Motor', v.motor, x => setV({ ...v, motor: x }))}
            <div className="col-span-2">{campo('Combustível', v.combustivel, x => setV({ ...v, combustivel: x }))}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          A correção vale para o cadastro, então aparece também nas outras OS deste cliente.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={() => onSalvar(c, v)} disabled={!c.nome.trim()}
            className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
            Salvar correção
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

function ModalBase({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function ModalEditar({ os, funcionarios, onClose, onSalvar }) {
  const [f, setF] = useState({
    kmEntrada: os.kmEntrada || '',
    mecanicoId: os.mecanicoId || '',
    dataEntrada: os.dataEntradaISO || '',
    dataConclusao: os.dataConclusaoISO || '',
    descricaoProblema: os.descricaoProblema || '',
    diagnostico: os.diagnostico || '',
    observacoes: os.observacoes || '',
    anotacoesInternas: os.anotacoesInternas || '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <ModalBase title={`Editar OS ${os.id}`} onClose={onClose}>
      <div className="space-y-3">
        <Campo label="KM de Entrada"><input value={f.kmEntrada} onChange={e => set('kmEntrada', e.target.value)} className="inp" /></Campo>
        <Campo label="Mecânico Responsável">
          <select value={f.mecanicoId} onChange={e => set('mecanicoId', e.target.value)} className="inp">
            <option value="">Nenhum</option>
            {funcionarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data de Entrada"><input type="datetime-local" value={f.dataEntrada} onChange={e => set('dataEntrada', e.target.value)} className="inp" /></Campo>
          <Campo label="Data de Conclusão"><input type="datetime-local" value={f.dataConclusao} onChange={e => set('dataConclusao', e.target.value)} className="inp" /></Campo>
        </div>
        <Campo label="Descrição do Problema"><textarea rows={2} value={f.descricaoProblema} onChange={e => set('descricaoProblema', e.target.value)} className="inp resize-none" /></Campo>
        <Campo label="Diagnóstico"><textarea rows={2} value={f.diagnostico} onChange={e => set('diagnostico', e.target.value)} className="inp resize-none" /></Campo>
        <Campo label="Observações"><textarea rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} className="inp resize-none" /></Campo>
        <Campo label={<span className="flex items-center gap-1"><Lock size={12} />Anotações internas <span className="text-slate-400 font-normal">(não saí impresso na OS)</span></span>}>
          <textarea rows={2} value={f.anotacoesInternas} onChange={e => set('anotacoesInternas', e.target.value)} placeholder="Ex: nº do pedido de peças, fornecedor, prazos internos..." className="inp resize-none" />
        </Campo>
        <button onClick={() => {
          const extra = {}
          if (f.dataEntrada) { extra.dataEntradaISO = f.dataEntrada; extra.dataEntrada = new Date(f.dataEntrada).toLocaleDateString('pt-BR') }
          if (f.dataConclusao) { extra.dataConclusaoISO = f.dataConclusao; extra.dataConclusao = new Date(f.dataConclusao).toLocaleDateString('pt-BR') }
          onSalvar({ ...f, mecanicoId: f.mecanicoId ? Number(f.mecanicoId) : null, ...extra })
        }} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Salvar</button>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #f97316}`}</style>
    </ModalBase>
  )
}

function Campo({ label, children }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>{children}</div>
}

function ModalAdicionarItem({ servicos, estoque, funcionarios, onClose, onAdd }) {
  const [modo, setModo] = useState('cadastrado') // 'cadastrado' | 'avulso'
  const [tipo, setTipo] = useState('servico')
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnitario, setValorUnitario] = useState('')
  const [desconto, setDesconto] = useState('0')
  const [mecanicoId, setMecanicoId] = useState('')

  const lista = tipo === 'servico'
    ? servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))
    : estoque.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(busca.toLowerCase()))

  function trocarModo(m) {
    setModo(m)
    setSelId('')
    setBusca('')
    setDescricao('')
    setValorUnitario('')
  }

  function selecionar(item) {
    setSelId(item.id)
    setDescricao(tipo === 'servico' ? item.nome : `${item.nome}${item.codigo ? ` (${item.codigo})` : ''}`)
    setValorUnitario(item.preco)
  }

  // Peça do estoque: quanto existe hoje. Serviço ou peça avulsa não tem limite.
  const produtoSel = tipo === 'peca' && selId !== ''
    ? estoque.find(p => p.id === selId)
    : null
  const disponivel = produtoSel ? Number(produtoSel.estoque) || 0 : null
  const qtdPedida = parseQtd(quantidade)
  const semEstoque = disponivel !== null && qtdPedida > disponivel
  const semValor = pNum(valorUnitario) <= 0

  function adicionar() {
    if (!descricao.trim() || semEstoque) return
    if (semValor && !confirm('Este item está sem valor. Adicionar mesmo assim por R$ 0,00?')) return
    onAdd({
      tipo,
      produtoId: tipo === 'peca' ? selId : null,
      servicoId: tipo === 'servico' ? selId : null,
      descricao: descricao.toUpperCase(),
      quantidade: qtdPedida,
      valorUnitario,
      desconto,
      mecanicoId: tipo === 'servico' && mecanicoId ? Number(mecanicoId) : null,
    })
  }

  return (
    <ModalBase title="Adicionar Item" onClose={onClose}>
      <div className="space-y-3">

        {/* Toggle Cadastrado / Avulso */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button type="button" onClick={() => trocarModo('cadastrado')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'cadastrado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Do Cadastro
          </button>
          <button type="button" onClick={() => trocarModo('avulso')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'avulso' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Avulso
          </button>
        </div>

        <Campo label="Tipo">
          <select value={tipo} onChange={e => { setTipo(e.target.value); setSelId(''); setBusca(''); setDescricao(''); setValorUnitario(''); setMecanicoId('') }} className="inp">
            <option value="servico">Serviço</option>
            <option value="peca">Peça</option>
          </select>
        </Campo>

        {modo === 'cadastrado' && (
          <Campo label={tipo === 'servico' ? 'Serviço cadastrado' : 'Produto do estoque'}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tipo === 'servico' ? 'Pesquisar serviço...' : 'Pesquisar produto...'} className="inp mb-1" />
            <div className="border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
              {lista.map(item => {
                const emEstoque = Number(item.estoque) || 0
                return (
                  <button key={item.id} onClick={() => selecionar(item)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${selId === item.id ? 'bg-primary-500 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <span className="truncate">{item.nome}{tipo === 'peca' && item.codigo ? ` (${item.codigo})` : ''}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {tipo === 'peca' && (
                        <span className={`text-xs ${selId === item.id ? 'text-white/80' : emEstoque > 0 ? 'text-slate-400' : 'text-red-500 font-medium'}`}>
                          {emEstoque > 0 ? `${emEstoque} un.` : 'sem estoque'}
                        </span>
                      )}
                      <span className={selId === item.id ? 'text-white' : 'text-slate-400'}>{fmt(pNum(item.preco))}</span>
                    </span>
                  </button>
                )
              })}
              {lista.length === 0 && <p className="text-xs text-slate-400 px-3 py-2">Nada encontrado.</p>}
            </div>
          </Campo>
        )}

        <Campo label="Descrição *"><input value={descricao} onChange={e => setDescricao(e.target.value)} spellCheck lang="pt-BR" placeholder={modo === 'avulso' ? 'DESCREVA O SERVIÇO OU PEÇA...' : ''} className="inp uppercase" /></Campo>
        {tipo === 'servico' && (
          <Campo label="Reparador">
            <select value={mecanicoId} onChange={e => setMecanicoId(e.target.value)} className="inp">
              <option value="">Sem reparador</option>
              {(funcionarios || []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Campo>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Campo label={disponivel !== null ? `Quantidade (${disponivel} disp.)` : 'Quantidade'}>
            <input type="text" inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)}
              className={`inp ${semEstoque ? 'inp-erro' : ''}`} />
          </Campo>
          <Campo label="Valor Unitário"><input value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} placeholder="0,00" className="inp" /></Campo>
          <Campo label="Desconto (R$)"><input value={desconto} onChange={e => setDesconto(e.target.value)} className="inp" /></Campo>
        </div>

        {semEstoque && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Estoque insuficiente: você pediu {qtdPedida} e existem {disponivel}.
              Registre a entrada em Compras ou lance a peça como <strong>Avulso</strong>.
            </span>
          </div>
        )}

        <button onClick={adicionar} disabled={!descricao.trim() || semEstoque}
          className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
          Adicionar
        </button>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #f97316}.inp-erro{border-color:#fca5a5;background:#fef2f2}`}</style>
    </ModalBase>
  )
}

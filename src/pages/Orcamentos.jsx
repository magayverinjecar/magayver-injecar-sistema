import { useState, useRef, useEffect } from 'react'
import { Plus, FileText, Eye, Copy, MessageCircle, Printer, ArrowRight, Trash2, X, List, Search, ChevronDown, Pencil } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { custoHoraDaOficina } from '../utils/capacidade'
import { nomeVeiculo } from '../utils/datas'
import gerarId from '../utils/id'
import { imprimirOrcamento } from '../utils/print'
import { parseValorBR } from '../utils/numero'
import PainelAdicionarItem from '../components/PainelAdicionarItem'
import SeletorKit from '../components/SeletorKit'
import { avisoDeFalta, pecaSemEstoque } from '../utils/kits'
import { pecaComCodigo } from '../utils/pecas'

const statusColor = {
  Pendente: 'bg-yellow-100 text-yellow-700',
  Aprovado: 'bg-green-100 text-green-700',
  Recusado: 'bg-red-100 text-red-700',
  Convertido: 'bg-blue-100 text-blue-700',
}

const VAZIO_CLIENTE = { clienteId: '', nome: '', telefone: '', veiculo: '', placa: '', km: '' }
const VAZIO_ITEM = { tipo: 'Serviço', refId: '', descricao: '', quantidade: '1', valorUnitario: '', desconto: '0' }

// Parser único em utils/numero.js — a cópia local lia "1.500" como 1,5.
const parseNum = parseValorBR
// Dentro da tabela o valor vai sem "R$": repetido em toda linha, o símbolo só
// empurra o número para longe da vírgula da linha de cima. O cabeçalho diz que
// aquela coluna é dinheiro.
const fmtValor = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Fora da tabela o símbolo continua: em texto solto, no WhatsApp e no total do
// rodapé o número aparece sozinho e precisa se apresentar.
const fmt = (v) => 'R$ ' + fmtValor(v)

export default function Orcamentos() {
  const navigate = useNavigate()
  const location = useLocation()
  const { orcamentos, setOrcamentos, clientes, veiculos, veiculosPorCliente, servicos, setServicos, estoque, setEstoque, movimentarEstoque, reservadoDe, getCliente, getVeiculo, novaOrdem, ordens, gastos, config } = useApp()
  // Piso para conferir o preço do serviço no orçamento — o mesmo da OS. Fica
  // `null` até os gastos fixos e a capacidade estarem preenchidos.
  const custoHoraOficina = custoHoraDaOficina({ gastos, config })

  const [aba, setAba] = useState('salvos')
  const [orcamentoEditandoId, setOrcamentoEditandoId] = useState(null)
  const [dados, setDados] = useState(VAZIO_CLIENTE)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [itens, setItens] = useState([])
  const [observacoes, setObservacoes] = useState('')
  const [validade, setValidade] = useState('7 dias')
  // O popup agora é só para EDITAR um item já lançado. Para lançar item novo
  // existe o painel embutido — o mesmo da tela da OS.
  const [modalItem, setModalItem] = useState(false)
  const [item, setItem] = useState(VAZIO_ITEM)
  const [itemEditandoId, setItemEditandoId] = useState(null)
  const [painelItem, setPainelItem] = useState(false)
  const [tipoPainel, setTipoPainel] = useState('servico') // acompanha o painel, para o cadastro rápido
  const [selecaoPainel, setSelecaoPainel] = useState(null) // item recém-cadastrado que o painel deve selecionar
  const [criarNovo, setCriarNovo] = useState(false)
  const [novoForm, setNovoForm] = useState({ nome: '', categoria: '', preco: '', tempo: '', codigo: '', precoCusto: '', estoque: '0', minimo: '0' })
  const [taxaPct, setTaxaPct] = useState('10')

  // Pré-preenche o formulário quando vem de uma OS via location.state.fromOS
  useEffect(() => {
    const fromOS = location.state?.fromOS
    if (!fromOS) return
    const { clienteId, veiculoId, itens: itensOS } = fromOS
    // A OS agora carrega observações e validade — chegam prontos aqui também
    if (fromOS.observacoes) setObservacoes(fromOS.observacoes)
    if (fromOS.validade) setValidade(fromOS.validade)
    const cli = clienteId ? clientes.find(c => c.id === Number(clienteId)) : null
    const veic = veiculoId ? veiculos.find(v => v.id === Number(veiculoId)) : null
    if (cli) {
      setDados({
        clienteId: String(cli.id),
        nome: cli.nome || '',
        telefone: cli.telefone || '',
        veiculo: veic ? `${veic.modelo} ${veic.ano || ''}`.trim() : '',
        placa: veic?.placa || '',
        km: veic?.km || '',
      })
      setBuscaCliente(cli.nome || '')
    }
    if (itensOS && itensOS.length > 0) {
      setItens(itensOS.map(i => ({
        ...i,
        tipo: i.tipo === 'servico' ? 'Serviço' : 'Peça',
        valorUnitario: String(i.valorUnitario ?? ''),
        quantidade: String(i.quantidade ?? '1'),
      })))
    }
    setAba('novo')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function editarOrcamento(orc) {
    setDados({
      clienteId: orc.clienteId ? String(orc.clienteId) : '',
      nome: orc.nome || '',
      telefone: orc.telefone || '',
      veiculo: orc.veiculo || '',
      placa: orc.placa || '',
      km: orc.km || '',
    })
    setBuscaCliente(orc.nome || '')
    setItens(orc.itens || [])
    setObservacoes(orc.observacoes || '')
    setValidade(orc.validade || '7 dias')
    setOrcamentoEditandoId(orc.id)
    setAba('novo')
  }

  const totalGeral = itens.reduce((s, it) => s + (parseNum(it.valorUnitario) * parseNum(it.quantidade) - parseNum(it.desconto)), 0)

  // Números do rodapé da lista. Separa o que está PENDENTE porque é o único
  // bolo em que ainda dá para mexer: é dinheiro parado esperando o cliente
  // responder. Aprovado, recusado e convertido já saíram da mesa. `Number(...)`
  // porque orçamento antigo pode ter gravado o total como texto.
  const totalSalvos = orcamentos.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const pendentes = orcamentos.filter(o => o.status === 'Pendente')
  const totalPendente = pendentes.reduce((s, o) => s + (Number(o.total) || 0), 0)

  const veiculosCliente = dados.clienteId ? veiculosPorCliente(Number(dados.clienteId)) : []

  // Clientes ordenados do mais recente + filtrados pela busca
  const clientesOrdenados = [...clientes].sort((a, b) => b.id - a.id)
  const clientesFiltrados = clientesOrdenados.filter(c =>
    !buscaCliente.trim() || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  function selecionarCliente(c) {
    const veics = veiculosPorCliente(Number(c.id))
    const v = veics[0]
    setDados({
      clienteId: String(c.id),
      nome: c?.nome || '',
      telefone: c?.telefone || '',
      veiculo: v ? `${v.modelo} ${v.ano || ''}`.trim() : '',
      placa: v?.placa || '',
      km: v?.km || '',
    })
    setBuscaCliente(c.nome)
    setDropdownAberto(false)
  }

  function limparCliente() {
    setDados(VAZIO_CLIENTE)
  }

  // --- itens ---
  function abrirEdicaoItem(it) {
    setItem({ ...it })
    setItemEditandoId(it.id)
    setModalItem(true)
  }

  function fecharEdicaoItem() {
    setModalItem(false)
    setItemEditandoId(null)
    setItem(VAZIO_ITEM)
  }

  // Vem do painel embutido, no formato da OS ('servico'/'peca'). O orçamento
  // guarda 'Serviço'/'Peça / Produto' — converter aqui evita mexer no que já
  // está gravado e no que a conversão em OS espera ler.
  function adicionarDoPainel(dados) {
    const ref = dados.servicoId ?? dados.produtoId
    const novo = {
      id: gerarId(),
      tipo: dados.tipo === 'servico' ? 'Serviço' : 'Peça / Produto',
      refId: ref !== null && ref !== undefined && ref !== '' ? String(ref) : '',
      descricao: dados.descricao.trim(),
      quantidade: String(dados.quantidade),
      valorUnitario: dados.valorUnitario,
      desconto: dados.desconto,
    }
    // Peça avulsa com custo digitado: o custo viaja junto para a OS não nascer
    // com margem incompleta.
    if (dados.custoUnitario) novo.custoUnitario = dados.custoUnitario
    setItens(prev => [...prev, novo])
  }

  // Kit: cada item entra pelo MESMO adicionarDoPainel, então a conversão de
  // tipo e o formato gravado continuam sendo os de sempre. O orçamento avulso
  // não mexe em estoque — a baixa só acontece quando ele vira OS.
  function aplicarKit({ itens: doKit, faltando }) {
    if (faltando.length && !confirm(avisoDeFalta(faltando))) return
    doKit.forEach(adicionarDoPainel)
  }

  function adicionarItem() {
    if (!item.descricao.trim()) return
    // Maiúscula só ao adicionar — em caps enquanto digita, o corretor do
    // navegador pula as palavras achando que é sigla.
    const pronto = { ...item, descricao: item.descricao.toUpperCase().trim() }
    if (itemEditandoId !== null) {
      setItens(prev => prev.map(i => i.id === itemEditandoId ? { ...pronto, id: itemEditandoId } : i))
      setItemEditandoId(null)
    } else {
      setItens(prev => [...prev, { ...pronto, id: gerarId() }])
    }
    setItem(VAZIO_ITEM)
    setModalItem(false)
  }
  function removerItem(id) {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  function aplicarTaxaItemOrc(id) {
    const pct = parseFloat(taxaPct) || 0
    if (!pct) return
    setItens(prev => prev.map(it => it.id === id
      ? { ...it, valorUnitario: (parseNum(it.valorUnitario) * (1 + pct / 100)).toFixed(2) }
      : it))
  }

  function aplicarTaxaTodosOrc() {
    const pct = parseFloat(taxaPct) || 0
    if (!pct) return
    setItens(prev => prev.map(it => ({
      ...it,
      valorUnitario: (parseNum(it.valorUnitario) * (1 + pct / 100)).toFixed(2),
    })))
  }

  // Cadastro rápido feito de dentro do painel: grava em Serviços/Estoque e
  // devolve o registro para o painel já selecionar.
  function salvarNovo() {
    if (!novoForm.nome.trim()) return
    // Mesma trava do cadastro de Estoque: codigo repetido divide o saldo em
    // duas linhas e nunca mais fecha com a prateleira.
    if (tipoPainel !== 'servico') {
      const jaExiste = pecaComCodigo(estoque, novoForm.codigo)
      if (jaExiste) {
        alert(`O código ${novoForm.codigo} já está cadastrado em:\n\n${jaExiste.nome}\n\nProcure essa peça na busca em vez de cadastrar de novo.`)
        return
      }
    }
    const id = gerarId()
    if (tipoPainel === 'servico') {
      const novo = { id, nome: novoForm.nome, categoria: novoForm.categoria || '', preco: novoForm.preco || '0', tempo: novoForm.tempo || '' }
      setServicos(prev => [...prev, novo])
      setSelecaoPainel(novo)
    } else {
      // A peça nasce com saldo zero e a quantidade entra por movimento de
      // "saldo inicial" — o extrato explica o saldo desde o primeiro dia.
      const qtdInicial = Number(novoForm.estoque) || 0
      const novo = { id, nome: novoForm.nome, codigo: novoForm.codigo || '', categoria: novoForm.categoria || '', precoCusto: novoForm.precoCusto || '', preco: novoForm.preco || '0', estoque: 0, minimo: Number(novoForm.minimo) || 0 }
      setEstoque(prev => [...prev, novo])
      if (qtdInicial !== 0) {
        movimentarEstoque({
          pecaId: id,
          qtd: qtdInicial,
          tipo: 'saldo_inicial',
          motivo: 'Cadastro rápido pelo orçamento',
          custoUnit: novo.precoCusto,
          criarSeFaltar: true,
        })
      }
      setSelecaoPainel({ ...novo, estoque: qtdInicial })
    }
    setNovoForm({ nome: '', categoria: '', preco: '', tempo: '', codigo: '', precoCusto: '', estoque: '0', minimo: '0' })
    setCriarNovo(false)
  }

  function novo() {
    setDados(VAZIO_CLIENTE)
    setBuscaCliente('')
    setItens([])
    setObservacoes('')
    setValidade('7 dias')
    setOrcamentoEditandoId(null)
    setAba('novo')
  }

  function salvar() {
    // aceita nome digitado na busca mesmo sem selecionar do dropdown
    const nomeCliente = dados.nome.trim() || buscaCliente.trim()
    if (!nomeCliente) { alert('Informe o nome do cliente.'); return }

    if (orcamentoEditandoId !== null) {
      // Atualiza orçamento existente
      setOrcamentos(prev => prev.map(o => o.id === orcamentoEditandoId ? {
        ...o,
        clienteId: dados.clienteId ? Number(dados.clienteId) : null,
        nome: nomeCliente,
        telefone: dados.telefone,
        veiculo: dados.veiculo,
        placa: dados.placa,
        km: dados.km,
        itens,
        observacoes,
        validade,
        total: totalGeral,
      } : o))
      setOrcamentoEditandoId(null)
    } else {
      // Cria novo orçamento
      const existentes = new Set(orcamentos.map(o => o.numero))
      let numero
      for (let i = 0; i < 20; i++) {
        const n = '#' + Math.floor(1000 + Math.random() * 9000)
        if (!existentes.has(n)) { numero = n; break }
      }
      if (!numero) {
        const nums = orcamentos.map(o => parseInt((o.numero || '').replace('#', '')) || 0)
        numero = '#' + ((Math.max(0, ...nums)) + 1)
      }
      const novo = {
        id: gerarId(),
        numero,
        clienteId: dados.clienteId ? Number(dados.clienteId) : null,
        nome: nomeCliente,
        telefone: dados.telefone,
        veiculo: dados.veiculo,
        placa: dados.placa,
        km: dados.km,
        itens,
        observacoes,
        validade,
        total: totalGeral,
        status: 'Pendente',
        data: new Date().toLocaleDateString('pt-BR'),
      }
      setOrcamentos(prev => [novo, ...prev])
    }

    setDados(VAZIO_CLIENTE)
    setBuscaCliente('')
    setItens([])
    setObservacoes('')
    setValidade('7 dias')
    setAba('salvos')
  }

  function mudarStatus(id, status) {
    setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  function excluir(id) {
    if (confirm('Excluir este orçamento?')) setOrcamentos(prev => prev.filter(o => o.id !== id))
  }

  function converterEmOS(orc) {
    // Converter duas vezes criava DUAS OS e baixava as peças em dobro — o botão
    // continuava vivo depois da conversão. Orçamento convertido aponta para a
    // OS que já existe em vez de fabricar outra.
    // A prova de conversão é o `osId` gravado, não só o status — o status
    // pode ser trocado à mão no dropdown da lista.
    if (orc.osId || orc.status === 'Convertido') {
      if (orc.osId && confirm(`Este orçamento já virou a OS ${orc.osId}.\n\nAbrir a OS existente?`)) {
        navigate(`/ordens-servico/${encodeURIComponent(orc.osId)}`)
      } else if (!orc.osId) {
        alert('Este orçamento já está marcado como convertido.')
      }
      return
    }
    // Orçamento que o cliente já aprovou não precisa de diagnóstico: a OS nasce
    // liberada e o carro cai direto na lista do reparador como "Iniciar reparo".
    const jaAprovado = orc.status === 'Aprovado'
    const pergunta = jaAprovado
      ? 'Converter em Ordem de Serviço?\n\nEste orçamento está aprovado — a OS já entra liberada para o reparador iniciar o reparo.'
      : 'Converter este orçamento em Ordem de Serviço?'
    if (!confirm(pergunta)) return

    // tenta encontrar o veículo pelo clienteId + placa
    const veiculosDoCliente = orc.clienteId ? veiculosPorCliente(Number(orc.clienteId)) : []
    const veiculo = orc.placa
      ? veiculosDoCliente.find(v => v.placa === orc.placa) || veiculos.find(v => v.placa === orc.placa)
      : veiculosDoCliente[0] || null

    // transfere os itens do orçamento para o formato da OS
    const itensOS = (orc.itens || []).map(i => ({
      id: gerarId(),
      tipo: i.tipo === 'Serviço' ? 'servico' : 'peca',
      produtoId: i.tipo !== 'Serviço' && i.tipo !== 'servico' ? Number(i.refId) || null : null,
      servicoId: i.tipo === 'Serviço' || i.tipo === 'servico' ? Number(i.refId) || null : null,
      descricao: i.descricao,
      quantidade: Number(i.quantidade) || 1,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto || '0',
      // Custo de peça avulsa digitado no orçamento viaja junto: sem ele a OS
      // nasceria com margem incompleta.
      ...(i.custoUnitario ? { custoUnitario: i.custoUnitario } : {}),
    }))

    // Estoque: a OS nasce 'Recepção' (peças RESERVADAS) ou 'Aprovado' (peças
    // BAIXADAS) — a regra em setOrdens decide pelo status; nada a montar aqui.

    const osId = novaOrdem({
      clienteId: orc.clienteId ? Number(orc.clienteId) : null,
      veiculoId: veiculo?.id || null,
      descricaoProblema: orc.observacoes || `Convertido do Orçamento ${orc.numero}`,
      status: jaAprovado ? 'Aprovado' : 'Recepção',
      aprovadoEm: jaAprovado ? Date.now() : null,
      textoCriacao: jaAprovado
        ? `OS criada do orçamento ${orc.numero} — cliente já havia aprovado`
        : `OS criada do orçamento ${orc.numero}`,
      itens: itensOS,
      orcamentoId: orc.id,
      orcamentoNumero: orc.numero,
    })
    // `novaOrdem` devolve null quando se recusa a numerar: leitura
    // incompleta numeraria por cima de uma OS que ja existe.
    if (!osId) return
    // Guarda o vínculo nos dois sentidos para dar rastreabilidade
    setOrcamentos(prev => prev.map(o => o.id === orc.id
      ? { ...o, status: 'Convertido', osId, convertidoEm: new Date().toLocaleString('pt-BR') }
      : o))
    navigate(`/ordens-servico/${encodeURIComponent(osId)}`)
  }

  function enviarWhatsapp() {
    const linhas = itens.map(i => `• ${i.descricao} (${i.quantidade}x) - ${fmt(parseNum(i.valorUnitario) * parseNum(i.quantidade) - parseNum(i.desconto))}`).join('\n')
    const texto = `*Orçamento - Magayver Injecar*\n\nCliente: ${dados.nome}\nVeículo: ${dados.veiculo} ${dados.placa}\n\n${linhas}\n\n*Total: ${fmt(totalGeral)}*\nValidade: ${validade}`
    const tel = dados.telefone.replace(/\D/g, '')
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Orçamentos</h2>
          <p className="text-sm text-slate-500">Crie, salve e envie orçamentos. Converta em OS quando aprovado.</p>
        </div>
        <button onClick={novo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Orçamento
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setAba('salvos')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'salvos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <List size={14} />Orçamentos Salvos
        </button>
        <button onClick={novo} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'novo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Plus size={14} />Novo
        </button>
      </div>

      {/* === ABA SALVOS === */}
      {aba === 'salvos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {orcamentos.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-16">Nenhum orçamento salvo ainda.</p>
          ) : (<>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
                  {/* Quantos itens o orçamento tem só se sabia abrindo. É o que
                      diz de cara se aquela linha é uma troca de óleo ou uma
                      revisão de vinte itens — e no computador sobra largura. */}
                  <th className="hidden lg:table-cell text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Itens</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orcamentos.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{o.numero}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{o.nome}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{o.veiculo} {o.placa && `(${o.placa})`}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-right text-sm text-slate-500 tabular-nums">
                      {o.itens?.length || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700 tabular-nums">{fmtValor(o.total)}</td>
                    <td className="px-5 py-3.5">
                      <select value={o.status} onChange={e => mudarStatus(o.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${statusColor[o.status]}`}>
                        <option>Pendente</option>
                        <option>Aprovado</option>
                        <option>Recusado</option>
                        <option>Convertido</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{o.data}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button title="Editar" onClick={() => editarOrcamento(o)} className="p-1.5 rounded hover:bg-yellow-50 hover:text-yellow-500 transition-colors"><Pencil size={15} /></button>
                        <button title="Imprimir" onClick={() => {
                          const cli = o.clienteId ? getCliente(Number(o.clienteId)) : { nome: o.nome, telefone: o.telefone }
                          const veicsOrc = o.clienteId ? veiculosPorCliente(Number(o.clienteId)) : []
                          const veic = veicsOrc.find(v => v.placa === o.placa) || veicsOrc[0] || null
                          imprimirOrcamento(o, cli, veic)
                        }} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-600 transition-colors"><Printer size={15} /></button>
                        <button title={(o.osId || o.status === 'Convertido') ? 'Já convertido — abre a OS' : 'Converter em OS'} onClick={() => converterEmOS(o)} className={`p-1.5 rounded transition-colors ${(o.osId || o.status === 'Convertido') ? 'text-slate-200 hover:bg-slate-50 hover:text-slate-400' : 'hover:bg-blue-50 hover:text-blue-500'}`}><ArrowRight size={15} /></button>
                        <button title="Excluir" onClick={() => excluir(o.id)} className="p-1.5 rounded hover:bg-red-50 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Rodapé de sistema: o dono queria abrir a tela e já saber quanto
                mandou de orçamento e quanto ainda está na mão do cliente, sem
                somar linha por linha nem abrir relatório. */}
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              <span>
                {orcamentos.length} {orcamentos.length === 1 ? 'orçamento' : 'orçamentos'}
                {pendentes.length > 0 && (
                  <span className="ml-2 text-yellow-700">· {pendentes.length} aguardando resposta</span>
                )}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                <span>Pendente: <strong className="font-medium">{fmt(totalPendente)}</strong></span>
                <span>Total: <strong className="font-medium">{fmt(totalSalvos)}</strong></span>
              </span>
            </div>
          </>)}
        </div>
      )}

      {/* === ABA NOVO === */}
      {aba === 'novo' && (
        <div className="space-y-4">
          {/* Dados do Cliente / Veículo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800">Dados do Cliente / Veículo</h3>
            <p className="text-xs text-slate-400 mb-4">Selecione um cliente cadastrado ou preencha manualmente</p>

            <div className="mb-4 relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Selecionar Cliente Cadastrado</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={buscaCliente}
                  onChange={e => { setBuscaCliente(e.target.value); setDropdownAberto(true); limparCliente() }}
                  onFocus={() => setDropdownAberto(true)}
                  onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {dropdownAberto && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum cliente encontrado</p>
                  ) : (
                    clientesFiltrados.map((c, idx) => (
                      <button key={c.id} onMouseDown={() => selecionarCliente(c)}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                          {c.telefone && <p className="text-xs text-slate-400">{c.telefone}</p>}
                        </div>
                        {idx === 0 && <span className="text-[10px] bg-primary-50 text-primary-500 font-bold px-1.5 py-0.5 rounded flex-shrink-0">Recente</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {dados.clienteId && (
                <p className="text-xs text-green-600 mt-1">✓ Cliente selecionado</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cliente</label>
                <input value={dados.nome} onChange={e => setDados(d => ({ ...d, nome: e.target.value }))} placeholder="Nome" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone (WhatsApp)</label>
                <input value={dados.telefone} onChange={e => setDados(d => ({ ...d, telefone: e.target.value }))} placeholder="(11) 99999-9999" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Veículo</label>
                <input value={dados.veiculo} onChange={e => setDados(d => ({ ...d, veiculo: e.target.value }))} placeholder="Ex: Gol 2020" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                <input value={dados.placa} onChange={e => setDados(d => ({ ...d, placa: e.target.value }))} placeholder="ABC-1234" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="mt-3 max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">KM Atual</label>
              <input value={dados.km} onChange={e => setDados(d => ({ ...d, km: e.target.value }))} placeholder="Ex: 45.000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* Itens do Orçamento */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">Itens do Orçamento</h3>
                <p className="text-xs text-slate-400">Serviços e peças</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Acréscimo:</span>
                  <input type="number" value={taxaPct} onChange={e => setTaxaPct(e.target.value)} min="0" max="100" step="0.5"
                    className="w-12 text-sm text-right focus:outline-none bg-transparent font-semibold text-amber-800" />
                  <span className="text-sm font-semibold text-amber-700">%</span>
                  <button onClick={aplicarTaxaTodosOrc}
                    className="text-xs px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium transition-colors whitespace-nowrap">
                    Todos
                  </button>
                </div>
                <SeletorKit onAplicar={aplicarKit} titulo="Lança de uma vez as peças e a mão de obra do kit" />
                <button onClick={() => setPainelItem(v => !v)} aria-expanded={painelItem}
                  className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Plus size={15} />Adicionar item
                </button>
              </div>
            </div>

            {/* Painel embutido — mesmo componente da tela da OS */}
            {painelItem && (
              <div className="mb-4">
                <PainelAdicionarItem
                  servicos={servicos}
                  estoque={estoque}
                  reservadoDe={reservadoDe}
                  mostrarReparador={false}
                  ordens={ordens}
                  modeloAtual={dados.veiculo}
                  custoHora={custoHoraOficina}
                  getModeloDaOS={o => nomeVeiculo(getVeiculo(o.veiculoId), o)}
                  esconderLista={criarNovo}
                  selecaoExterna={selecaoPainel}
                  onTrocarTipo={t => { setTipoPainel(t); setCriarNovo(false); setSelecaoPainel(null) }}
                  onTrocarModo={() => { setCriarNovo(false); setSelecaoPainel(null) }}
                  acaoCadastro={
                    <button type="button" onClick={() => { setCriarNovo(v => !v); setNovoForm({ nome: '', categoria: '', preco: '', tempo: '', codigo: '', precoCusto: '', estoque: '0', minimo: '0' }) }}
                      className="text-xs text-primary-500 hover:text-primary-700 font-medium">
                      {criarNovo ? '− Fechar' : '+ Criar novo'}
                    </button>
                  }
                  formularioNovo={criarNovo && (
                    tipoPainel === 'servico' ? (
                      <div className="mt-1.5 border border-blue-200 rounded-xl p-3 bg-blue-50 space-y-2">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Novo Serviço</p>
                        <input value={novoForm.nome} onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do serviço *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        <input value={novoForm.categoria} onChange={e => setNovoForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Categoria (Ex: Manutenção)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={novoForm.preco} onChange={e => setNovoForm(f => ({ ...f, preco: e.target.value }))} placeholder="Preço (R$)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          <input value={novoForm.tempo} onChange={e => setNovoForm(f => ({ ...f, tempo: e.target.value }))} placeholder="Tempo (Ex: 1h30)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <button type="button" onClick={salvarNovo} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium transition-colors">Salvar e selecionar</button>
                      </div>
                    ) : (
                      <div className="mt-1.5 border border-orange-200 rounded-xl p-3 bg-orange-50 space-y-2">
                        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Nova Peça / Produto</p>
                        <input value={novoForm.nome} onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da peça *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={novoForm.codigo} onChange={e => setNovoForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Código / Referência" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          <input value={novoForm.categoria} onChange={e => setNovoForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Categoria" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={novoForm.precoCusto} onChange={e => setNovoForm(f => ({ ...f, precoCusto: e.target.value }))} placeholder="Preço de custo (R$)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          <input value={novoForm.preco} onChange={e => setNovoForm(f => ({ ...f, preco: e.target.value }))} placeholder="Preço de venda (R$)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Qtd. inicial</label>
                            <input type="number" value={novoForm.estoque} onChange={e => setNovoForm(f => ({ ...f, estoque: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Qtd. mínima</label>
                            <input type="number" value={novoForm.minimo} onChange={e => setNovoForm(f => ({ ...f, minimo: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          </div>
                        </div>
                        <button type="button" onClick={salvarNovo} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg text-sm font-medium transition-colors">Salvar e selecionar</button>
                      </div>
                    )
                  )}
                  onFechar={() => { setPainelItem(false); setCriarNovo(false) }}
                  onAdd={adicionarDoPainel}
                />
              </div>
            )}

            {itens.length === 0 ? (
              <div className="text-center py-10">
                <FileText size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum item adicionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {itens.map(it => {
                  const subtotal = parseNum(it.valorUnitario) * parseNum(it.quantidade) - parseNum(it.desconto)
                  // Peça com a prateleira zerada em vermelho: o orçamento pode
                  // ser mandado com peça que ainda vai ser comprada, mas nunca
                  // sem o dono saber. Vale para item de kit e item lançado à mão.
                  const zerada = it.tipo !== 'Serviço' && pecaSemEstoque(estoque, it.refId)
                  return (
                    <div key={it.id} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${zerada ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${it.tipo === 'Serviço' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{it.tipo}</span>
                        <div>
                          <p className={`text-sm font-medium ${zerada ? 'text-red-700' : 'text-slate-800'}`}>
                            {it.descricao}
                            {zerada && (
                              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 font-medium whitespace-nowrap">sem estoque</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{it.quantidade}x {fmt(parseNum(it.valorUnitario))}{parseNum(it.desconto) > 0 && ` · desc. ${fmt(parseNum(it.desconto))}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{fmt(subtotal)}</span>
                        <button onClick={() => aplicarTaxaItemOrc(it.id)} title={`+${taxaPct}%`} className="p-1 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-600 text-xs font-bold transition-colors">%</button>
                        <button onClick={() => abrirEdicaoItem(it)} className="p-1 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => removerItem(it.id)} className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Total:</span>
                  <span className="text-lg font-bold text-primary-600">{fmt(totalGeral)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Observações + Validade */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Garantia, condições, prazo..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Validade</label>
                <select value={validade} onChange={e => setValidade(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>7 dias</option>
                  <option>15 dias</option>
                  <option>30 dias</option>
                  <option>60 dias</option>
                </select>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={salvar} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <FileText size={15} />{orcamentoEditandoId !== null ? 'Salvar Alterações' : 'Salvar Orçamento'}
            </button>
            <button onClick={enviarWhatsapp} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <MessageCircle size={15} />Enviar Orçamento via WhatsApp
            </button>
            <button onClick={() => {
              const cli = dados.clienteId ? getCliente(Number(dados.clienteId)) : { nome: dados.nome || buscaCliente, telefone: dados.telefone }
              const veicsOrc = dados.clienteId ? veiculosPorCliente(Number(dados.clienteId)) : []
              const veic = veicsOrc.find(v => v.placa === dados.placa) || veicsOrc[0] || null
              imprimirOrcamento({ id: 'Prévia', itens, observacoes, validade }, cli, veic)
            }} className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              <Printer size={15} />Imprimir
            </button>
          </div>
        </div>
      )}

      {/* === MODAL EDITAR ITEM ===
          Lançar item novo é no painel embutido; este popup só corrige um item
          que já está na lista, igual à tela da OS. */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={fecharEdicaoItem} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Editar Item</h3>
              <button onClick={fecharEdicaoItem} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select value={item.tipo} onChange={e => setItem(() => ({ ...VAZIO_ITEM, tipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="Serviço">🔧 Serviço</option>
                  <option value="Peça / Produto">⚙️ Peça / Produto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input value={item.descricao} onChange={e => setItem(it => ({ ...it, descricao: e.target.value }))}
                  spellCheck lang="pt-BR"
                  placeholder="DESCRIÇÃO"
                  className="w-full uppercase border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input type="number" value={item.quantidade} onChange={e => setItem(it => ({ ...it, quantidade: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário (R$)</label>
                  <input value={item.valorUnitario} onChange={e => setItem(it => ({ ...it, valorUnitario: e.target.value }))}
                    placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (R$)</label>
                  <input value={item.desconto} onChange={e => setItem(it => ({ ...it, desconto: e.target.value }))}
                    placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <button onClick={adicionarItem} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

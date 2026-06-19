import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const AppContext = createContext(null)

// Converte linha do Supabase { id, data } → objeto do app
// IDs numéricos são convertidos de volta para number
function row2item(row) {
  const numId = Number(row.id)
  const id = Number.isFinite(numId) && String(numId) === row.id ? numId : row.id
  return { id, ...row.data }
}

// Converte objeto do app → linha do Supabase { id: text, data }
function item2row(item) {
  const { id, ...data } = item
  return { id: String(id), data }
}

// Carrega tabela inteira
async function loadTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('id, data').order('id', { ascending: false })
  if (error) { console.error(`Erro ao carregar ${tableName}:`, error); return [] }
  return (data || []).map(row2item)
}

// Aplica diff entre prev e next na tabela Supabase
async function supabaseDiff(tableName, prev, next) {
  const prevMap = new Map(prev.map(i => [String(i.id), i]))
  const nextMap = new Map(next.map(i => [String(i.id), i]))

  const toUpsert = []
  for (const [id, item] of nextMap) {
    if (!prevMap.has(id) || JSON.stringify(prevMap.get(id)) !== JSON.stringify(item)) {
      toUpsert.push(item2row(item))
    }
  }
  if (toUpsert.length > 0) {
    const { error } = await supabase.from(tableName).upsert(toUpsert)
    if (error) console.error(`Erro ao upsert em ${tableName}:`, error)
  }

  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      const { error } = await supabase.from(tableName).delete().eq('id', id)
      if (error) console.error(`Erro ao deletar de ${tableName}:`, error)
    }
  }
}

export function AppProvider({ children }) {
  const [carregando, setCarregando] = useState(true)

  const [clientes, _setClientes] = useState([])
  const [veiculos, _setVeiculos] = useState([])
  const [ordens, _setOrdens] = useState([])
  const [estoque, _setEstoque] = useState([])
  const [financeiro, _setFinanceiro] = useState([])
  const [agenda, _setAgenda] = useState([])
  const [funcionarios, _setFuncionarios] = useState([])
  const [servicos, _setServicos] = useState([])
  const [checklists, _setChecklists] = useState([])
  const [orcamentos, _setOrcamentos] = useState([])
  const [compras, _setCompras] = useState([])
  const [fornecedores, _setFornecedores] = useState([])
  const [caixaTurno, _setCaixaTurno] = useState(null)
  const [caixaHistorico, _setCaixaHistorico] = useState([])

  // Refs mantêm o valor atual para uso síncrono dentro dos setters
  const r = useRef({
    clientes: [], veiculos: [], ordens: [], estoque: [], financeiro: [],
    agenda: [], funcionarios: [], servicos: [], checklists: [], orcamentos: [],
    compras: [], fornecedores: [], caixaHistorico: [], caixaTurno: null,
  })

  // Carrega todos os dados ao montar
  useEffect(() => {
    async function init() {
      const [
        clientesData, veiculosData, ordensData, estoqueData, financeiroData,
        agendaData, funcionariosData, servicosData, checklistsData, orcamentosData,
        comprasData, fornecedoresData, caixaHistoricoData,
      ] = await Promise.all([
        loadTable('clientes'), loadTable('veiculos'), loadTable('ordens'),
        loadTable('estoque'), loadTable('financeiro'), loadTable('agenda'),
        loadTable('funcionarios'), loadTable('servicos'), loadTable('checklists'),
        loadTable('orcamentos'), loadTable('compras'), loadTable('fornecedores'),
        loadTable('caixa_historico'),
      ])

      r.current.clientes      = clientesData
      r.current.veiculos      = veiculosData
      r.current.ordens        = ordensData
      r.current.estoque       = estoqueData
      r.current.financeiro    = financeiroData
      r.current.agenda        = agendaData
      r.current.funcionarios  = funcionariosData
      r.current.servicos      = servicosData
      r.current.checklists    = checklistsData
      r.current.orcamentos    = orcamentosData
      r.current.compras       = comprasData
      r.current.fornecedores  = fornecedoresData
      r.current.caixaHistorico = caixaHistoricoData

      _setClientes(clientesData)
      _setVeiculos(veiculosData)
      _setOrdens(ordensData)
      _setEstoque(estoqueData)
      _setFinanceiro(financeiroData)
      _setAgenda(agendaData)
      _setFuncionarios(funcionariosData)
      _setServicos(servicosData)
      _setChecklists(checklistsData)
      _setOrcamentos(orcamentosData)
      _setCompras(comprasData)
      _setFornecedores(fornecedoresData)
      _setCaixaHistorico(caixaHistoricoData)

      // caixa_turno: sempre 1 linha com id fixo 'caixa-turno'
      const { data: turnoRows, error: turnoErr } = await supabase
        .from('caixa_turno').select('id, data').eq('id', 'caixa-turno')
      if (turnoErr) console.error('[caixa_turno] Erro ao carregar:', turnoErr)
      const turno = turnoRows?.[0] ? { id: 'caixa-turno', ...turnoRows[0].data } : null
      r.current.caixaTurno = turno
      _setCaixaTurno(turno)
      setCarregando(false)
    }
    init().catch(e => { console.error(e); setCarregando(false) })
  }, [])

  // Factory de setter com atualização otimista + persistência Supabase
  function makeSet(tableName, refKey, setter) {
    return (valOrFn) => {
      const prev = r.current[refKey]
      const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
      r.current[refKey] = next
      setter(next)
      supabaseDiff(tableName, prev, next).catch(console.error)
    }
  }

  const setClientes     = makeSet('clientes',        'clientes',      _setClientes)
  const setVeiculos     = makeSet('veiculos',         'veiculos',      _setVeiculos)
  const setOrdens       = makeSet('ordens',           'ordens',        _setOrdens)
  const setEstoque      = makeSet('estoque',          'estoque',       _setEstoque)
  const setFinanceiro   = makeSet('financeiro',       'financeiro',    _setFinanceiro)
  const setAgenda       = makeSet('agenda',           'agenda',        _setAgenda)
  const setFuncionarios = makeSet('funcionarios',     'funcionarios',  _setFuncionarios)
  const setServicos     = makeSet('servicos',         'servicos',      _setServicos)
  const setOrcamentos   = makeSet('orcamentos',       'orcamentos',    _setOrcamentos)
  const setChecklists   = makeSet('checklists',       'checklists',    _setChecklists)
  const setCompras      = makeSet('compras',          'compras',       _setCompras)
  const setFornecedores = makeSet('fornecedores',     'fornecedores',  _setFornecedores)
  const setCaixaHistorico = makeSet('caixa_historico','caixaHistorico',_setCaixaHistorico)

  function setCaixaTurno(valOrFn) {
    const prev = r.current.caixaTurno
    const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
    r.current.caixaTurno = next
    _setCaixaTurno(next)
    if (next === null) {
      supabase.from('caixa_turno').delete().eq('id', 'caixa-turno')
        .then(({ error }) => { if (error) console.error('[caixa_turno] Erro ao deletar:', error) })
    } else {
      const { id: _id, ...data } = next
      supabase.from('caixa_turno').upsert({ id: 'caixa-turno', data })
        .then(({ error }) => { if (error) console.error('[caixa_turno] Erro ao salvar:', error) })
    }
  }

  // --- HELPERS ---
  function gerarNumeroOS() { return '#' + Math.floor(10000 + Math.random() * 89999) }
  function gerarNumeroChecklist() { return 'CK-' + Math.floor(1000 + Math.random() * 8999) }
  function carimboData() {
    return new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function totalOrdem(o) {
    if (o.itens && o.itens.length > 0) {
      return o.itens.reduce((s, i) => {
        const unitario = parseFloat((i.valorUnitario || '0').toString().replace(',', '.'))
        const qtd = Number(i.quantidade) || 1
        const desconto = parseFloat((i.desconto || '0').toString().replace(',', '.'))
        return s + (unitario * qtd - desconto)
      }, 0)
    }
    return parseFloat((o.valor || '0').toString().replace(',', '.')) || 0
  }

  // --- ORDENS DE SERVIÇO ---
  function novaOrdem(dados) {
    const id = gerarNumeroOS()
    const hoje = new Date().toLocaleDateString('pt-BR')
    const nova = {
      id,
      clienteId: dados.clienteId ?? null,
      veiculoId: dados.veiculoId ?? null,
      kmEntrada: dados.kmEntrada || '',
      mecanicoId: dados.mecanicoId ?? null,
      descricaoProblema: dados.descricaoProblema || dados.servico || '',
      diagnostico: dados.diagnostico || '',
      observacoes: dados.observacoes || '',
      anotacoesInternas: dados.anotacoesInternas || '',
      dataEntrada: hoje,
      data: hoje,
      dataConclusao: '',
      status: dados.status || 'Aberta',
      itens: dados.itens || [],
      pecas: dados.pecas || [],
      fotos: [],
      historico: [{ id: Date.now(), texto: 'OS criada', data: carimboData() }],
      pago: false,
    }
    if (nova.pecas && nova.pecas.length > 0) {
      setEstoque(prev => prev.map(item => {
        const usada = nova.pecas.find(p => p.estoqueId === item.id)
        if (usada) return { ...item, estoque: Math.max(0, Number(item.estoque) - Number(usada.qtd)) }
        return item
      }))
    }
    setOrdens(prev => [nova, ...prev])
    return id
  }

  function atualizarOrdem(id, dados) {
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, ...dados } : o))
  }

  function adicionarItemOrdem(id, item) {
    const novo = { ...item, id: Date.now() + Math.random() }
    if (item.tipo === 'peca' && item.produtoId) {
      setEstoque(prev => prev.map(p => p.id === Number(item.produtoId)
        ? { ...p, estoque: Math.max(0, Number(p.estoque) - (Number(item.quantidade) || 1)) } : p))
    }
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, itens: [...(o.itens || []), novo] } : o))
  }

  function removerItemOrdem(id, itemId) {
    setOrdens(prev => prev.map(o => {
      if (o.id !== id) return o
      const item = (o.itens || []).find(i => i.id === itemId)
      if (item && item.tipo === 'peca' && item.produtoId) {
        setEstoque(ep => ep.map(p => p.id === Number(item.produtoId)
          ? { ...p, estoque: Number(p.estoque) + (Number(item.quantidade) || 1) } : p))
      }
      return { ...o, itens: (o.itens || []).filter(i => i.id !== itemId) }
    }))
  }

  function mudarStatusOrdem(id, novoStatus) {
    const lista = r.current.ordens
    const o = lista.find(x => x.id === id)
    if (!o) return
    const historico = [{ id: Date.now(), texto: `Status alterado para "${novoStatus}"`, data: carimboData() }, ...(o.historico || [])]
    let extra = {}
    if (novoStatus === 'Concluída') {
      const hoje = new Date().toLocaleDateString('pt-BR')
      extra.dataConclusao = o.dataConclusao || hoje
      const cliente = r.current.clientes.find(c => c.id === o.clienteId)
      const total = totalOrdem(o)
      setFinanceiro(fp => {
        if (fp.find(f => f.osId === id)) return fp
        return [{ id: Date.now(), data: hoje, descricao: `${id} - ${cliente?.nome || 'Cliente'}`, tipo: 'receita', valor: total.toFixed(2).replace('.', ','), osId: id }, ...fp]
      })
    }
    setOrdens(prev => prev.map(x => x.id === id ? { ...x, status: novoStatus, historico, ...extra } : x))
  }

  function adicionarFotoOrdem(id, url) {
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, fotos: [...(o.fotos || []), { id: Date.now() + Math.random(), url }] } : o))
  }

  function removerFotoOrdem(id, fotoId) {
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, fotos: (o.fotos || []).filter(f => f.id !== fotoId) } : o))
  }

  function excluirOrdem(id) {
    setFinanceiro(fp => fp.filter(f => f.osId !== id))
    setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.osId !== id) } : t)
    setOrdens(prev => prev.filter(o => o.id !== id))
  }

  function pagarOrdem(osId) {
    setOrdens(prev => prev.map(o => o.id === osId ? { ...o, pago: true } : o))
  }

  function reabrirOrdem(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    const historico = [{ id: Date.now(), texto: 'OS reaberta (estorno)', data: carimboData() }, ...(o.historico || [])]
    // Desfaz pagamento e status
    setOrdens(prev => prev.map(x => x.id === osId ? { ...x, status: 'Em Andamento', pago: false, historico } : x))
    // Remove receita do financeiro gerada ao concluir
    setFinanceiro(fp => fp.filter(f => f.osId !== osId))
    // Remove venda do caixa (estorno)
    setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.osId !== osId) } : t)
  }

  // --- FINANCEIRO ---
  function adicionarLancamento(lancamento) {
    const hoje = new Date().toLocaleDateString('pt-BR')
    setFinanceiro(prev => [{ ...lancamento, id: Date.now(), data: hoje }, ...prev])
  }

  // --- COMPRAS ---
  function criarCompra() {
    const id = Date.now()
    const numero = '#' + Math.floor(400 + Math.random() * 600)
    const nova = {
      id, numero, fornecedorId: '', fornecedorNome: '',
      status: 'Rascunho', observacoes: '', itens: [], total: 0,
      recebida: false, parcelas: [],
      data: new Date().toLocaleDateString('pt-BR'),
    }
    setCompras(prev => [nova, ...prev])
    return id
  }

  function atualizarCompra(id, dados) {
    setCompras(prev => prev.map(c => c.id === id ? { ...c, ...dados } : c))
  }

  function receberCompra(id) {
    const compra = r.current.compras.find(c => c.id === id)
    if (!compra || compra.recebida) return

    // Atualiza quantidade dos itens já cadastrados no estoque
    setEstoque(prev => prev.map(item => {
      const entrada = compra.itens.find(i => Number(i.produtoId) === item.id)
      if (entrada) return { ...item, estoque: Number(item.estoque) + Number(entrada.quantidade) }
      return item
    }))

    // Cadastra novas peças no estoque (itens marcados com cadastrarNova)
    const novasEntradas = compra.itens.filter(i => i.cadastrarNova && i.novoItemDados?.nome)
    if (novasEntradas.length > 0) {
      setEstoque(prev => [
        ...prev,
        ...novasEntradas.map(i => ({
          id: Date.now() + Math.random(),
          nome: i.novoItemDados.nome,
          codigo: i.novoItemDados.codigo || '',
          categoria: i.novoItemDados.categoria || '',
          precoCusto: i.valorUnitario || '0',
          preco: i.novoItemDados.precoVenda || '0',
          minimo: Number(i.novoItemDados.minimo) || 0,
          estoque: Number(i.quantidade),
        })),
      ])
    }

    const parcelas = compra.parcelas || []
    if (parcelas.length > 0) {
      parcelas.forEach((p, idx) => {
        adicionarLancamento({
          descricao: `Compra ${compra.numero} - ${compra.fornecedorNome || 'Fornecedor'} (${idx + 1}/${parcelas.length})`,
          tipo: 'despesa',
          valor: parseFloat((p.valor || '0').toString().replace(',', '.')).toFixed(2).replace('.', ','),
          vencimento: p.vencimento || '',
          compraId: id,
        })
      })
    } else {
      adicionarLancamento({
        descricao: `Compra ${compra.numero} - ${compra.fornecedorNome || 'Fornecedor'}`,
        tipo: 'despesa',
        valor: compra.total.toFixed(2).replace('.', ','),
        vencimento: '',
        compraId: id,
      })
    }
    atualizarCompra(id, { recebida: true, status: 'Recebida' })
  }

  function excluirCompra(id) {
    setFinanceiro(fp => fp.filter(f => f.compraId !== id))
    setCompras(prev => prev.filter(c => c.id !== id))
  }

  // --- CAIXA ---
  function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }
  function horaAgora() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

  function abrirCaixa(saldoInicial, operador) {
    setCaixaTurno({
      id: 'caixa-turno',
      operador: operador || 'Magayver Torres',
      dataAbertura: new Date().toLocaleDateString('pt-BR'),
      horaAbertura: horaAgora(),
      saldoInicial: pNum(saldoInicial),
      aberto: true,
      vendas: [],
      movimentos: [],
    })
  }

  function registrarVendaCaixa(venda) {
    const recebido = (venda.pagamentos || [])
      .filter(p => p.forma !== 'Pagar Depois')
      .reduce((s, p) => s + (pNum(p.valor) - pNum(p.taxa)), 0)
    const pago = recebido >= venda.total - 0.001
    const numero = '#' + Math.floor(3000 + Math.random() * 7000)
    const novaVenda = { ...venda, id: Date.now(), numero, status: pago ? 'Paga' : 'Pendente', recebido, hora: horaAgora() }

    setCaixaTurno(t => t ? { ...t, vendas: [novaVenda, ...t.vendas] } : t)

    setEstoque(prev => prev.map(item => {
      const usada = (venda.itens || []).find(i => i.tipo === 'peca' && Number(i.produtoId) === item.id)
      if (usada) return { ...item, estoque: Math.max(0, Number(item.estoque) - Number(usada.qtd || 1)) }
      return item
    }))

    if (recebido > 0) {
      adicionarLancamento({
        descricao: `Venda ${numero} - ${venda.clienteNome || 'Cliente'}`,
        tipo: 'receita',
        valor: recebido.toFixed(2).replace('.', ','),
        vendaId: novaVenda.id,
        caixa: true,
      })
    }
    return numero
  }

  function registrarSangria(valor, motivo) {
    setCaixaTurno(t => t ? { ...t, movimentos: [{ id: Date.now(), tipo: 'sangria', valor: pNum(valor), motivo, hora: horaAgora() }, ...t.movimentos] } : t)
  }

  function registrarReforco(valor, motivo) {
    setCaixaTurno(t => t ? { ...t, movimentos: [{ id: Date.now(), tipo: 'reforco', valor: pNum(valor), motivo, hora: horaAgora() }, ...t.movimentos] } : t)
  }

  function fecharCaixa(contagem, justificativa, saldoEsperado, totalContado) {
    if (!r.current.caixaTurno) return
    const fechado = {
      ...r.current.caixaTurno,
      id: Date.now(), // ID único para cada entrada de histórico
      aberto: false,
      dataFechamento: new Date().toLocaleDateString('pt-BR'),
      horaFechamento: horaAgora(),
      contagem,
      justificativa,
      saldoEsperado,
      saldoFinal: totalContado,
      divergencia: totalContado - saldoEsperado,
    }
    setCaixaHistorico(h => [fechado, ...h])
    setCaixaTurno(null)
  }

  // --- DADOS DERIVADOS ---
  const devedores = ordens.filter(o => o.status === 'Concluída' && !o.pago)

  function pValor(v) {
    if (typeof v === 'number') return v
    return parseFloat((v || '0').toString().replace(',', '.')) || 0
  }

  const resumoFinanceiro = {
    receitas: financeiro.filter(f => f.tipo === 'receita').reduce((s, f) => s + pValor(f.valor), 0),
    despesas: financeiro.filter(f => f.tipo === 'despesa').reduce((s, f) => s + pValor(f.valor), 0),
  }

  const estoqueAlerta = estoque.filter(i => Number(i.estoque) <= Number(i.minimo))

  const getCliente = (id) => clientes.find(c => c.id === id)
  const getVeiculo = (id) => veiculos.find(v => v.id === id)
  const getFuncionario = (id) => funcionarios.find(f => f.id === id)
  const veiculosPorCliente = (clienteId) => veiculos.filter(v => v.clienteId === clienteId)
  const ordensPorCliente = (clienteId) => ordens.filter(o => o.clienteId === clienteId)
  const ordensPorVeiculo = (veiculoId) => ordens.filter(o => o.veiculoId === veiculoId)

  return (
    <AppContext.Provider value={{
      clientes, setClientes,
      veiculos, setVeiculos,
      ordens, setOrdens, novaOrdem, pagarOrdem, reabrirOrdem,
      atualizarOrdem, adicionarItemOrdem, removerItemOrdem, mudarStatusOrdem,
      adicionarFotoOrdem, removerFotoOrdem, excluirOrdem, totalOrdem,
      estoque, setEstoque,
      financeiro, setFinanceiro, adicionarLancamento,
      agenda, setAgenda,
      funcionarios, setFuncionarios,
      servicos, setServicos,
      orcamentos, setOrcamentos,
      compras, setCompras, criarCompra, atualizarCompra, receberCompra, excluirCompra,
      fornecedores, setFornecedores,
      caixaTurno, caixaHistorico, abrirCaixa, registrarVendaCaixa,
      registrarSangria, registrarReforco, fecharCaixa, setCaixaTurno,
      devedores, resumoFinanceiro, estoqueAlerta,
      getCliente, getVeiculo, getFuncionario,
      checklists, setChecklists, gerarNumeroChecklist,
      veiculosPorCliente, ordensPorCliente, ordensPorVeiculo,
      carregando,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider')
  return ctx
}

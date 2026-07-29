import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuth } from './AuthContext'
import gerarId from '../utils/id'

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

// Rascunhos gravados pelo fluxo de Nova Entrada (para gerar o link de assinatura)
// não são OS reais — ficam fora do estado do app para não poluir quadro e relatórios.
function ehRascunho(o) {
  return o?.rascunho === true || String(o?.id || '').startsWith('DRAFT-')
}

// Carrega tabela inteira — retorna null em caso de erro para que o chamador
// possa distinguir "tabela vazia" (array []) de "falha de rede" (null).
async function loadTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('id, data').order('id', { ascending: false })
  if (error) { console.error(`Erro ao carregar ${tableName}:`, error); return null }
  const itens = (data || []).map(row2item)
  return tableName === 'ordens' ? itens.filter(o => !ehRascunho(o)) : itens
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
  const { currentUser } = useAuth()
  const [carregando, setCarregando] = useState(true)
  // Saúde da conexão — o Modo TV depende disso para não exibir dados velhos calado
  const [realtimeOk, setRealtimeOk] = useState(false)
  const [ultimaSync, setUltimaSync] = useState(Date.now())

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
  const [config, _setConfig] = useState({})

  // Refs mantêm o valor atual para uso síncrono dentro dos setters
  const r = useRef({
    clientes: [], veiculos: [], ordens: [], estoque: [], financeiro: [],
    agenda: [], funcionarios: [], servicos: [], checklists: [], orcamentos: [],
    compras: [], fornecedores: [], caixaHistorico: [], caixaTurno: null, config: {},
  })

  // ─── Controle de gravação (evita o "eco" do Realtime) ────────────────────────
  // Quando este cliente grava, o Supabase reenvia o mesmo evento de volta. Sem
  // controle, isso recarrega a tabela inteira e pode sobrescrever alterações locais
  // que ainda não terminaram de salvar (race condition). Aqui contamos as gravações
  // em andamento e ADIAMOS o recarregamento até todas terminarem.
  const pendingWrites = useRef({})   // { [tabela]: nº de gravações em andamento }
  const reloadPendente = useRef({})  // { [tabela]: true } → recarregar quando terminarem

  // Aplica dados recarregados no estado (ref + setState) por tabela
  const aplicarTabela = {
    clientes:        (d) => { r.current.clientes       = d; _setClientes(d) },
    veiculos:        (d) => { r.current.veiculos        = d; _setVeiculos(d) },
    ordens:          (d) => { r.current.ordens          = d; _setOrdens(d) },
    estoque:         (d) => { r.current.estoque         = d; _setEstoque(d) },
    financeiro:      (d) => { r.current.financeiro      = d; _setFinanceiro(d) },
    agenda:          (d) => { r.current.agenda          = d; _setAgenda(d) },
    funcionarios:    (d) => { r.current.funcionarios    = d; _setFuncionarios(d) },
    servicos:        (d) => { r.current.servicos        = d; _setServicos(d) },
    checklists:      (d) => { r.current.checklists      = d; _setChecklists(d) },
    orcamentos:      (d) => { r.current.orcamentos      = d; _setOrcamentos(d) },
    compras:         (d) => { r.current.compras         = d; _setCompras(d) },
    fornecedores:    (d) => { r.current.fornecedores    = d; _setFornecedores(d) },
    caixa_historico: (d) => { r.current.caixaHistorico  = d; _setCaixaHistorico(d) },
  }

  // Recarrega uma tabela do Supabase — MAS só se não houver gravação local em
  // andamento. Se houver, marca para recarregar depois (não sobrescreve estado local).
  async function recarregarTabela(table) {
    if (pendingWrites.current[table] > 0) { reloadPendente.current[table] = true; return }
    if (table === 'caixa_turno') {
      const { data } = await supabase.from('caixa_turno').select('id, data').eq('id', 'caixa-turno')
      const turno = data?.[0] ? { id: 'caixa-turno', ...data[0].data } : null
      r.current.caixaTurno = turno; _setCaixaTurno(turno)
      return
    }
    if (table === 'configuracoes') {
      const { data } = await supabase.from('configuracoes').select('id, data').eq('id', 'config-oficina')
      const configData = data?.[0]?.data || {}
      r.current.config = configData; _setConfig(configData)
      try { localStorage.setItem('config-oficina', JSON.stringify(configData)) } catch {}
      return
    }
    const data = await loadTable(table)
    if (data === null) return
    aplicarTabela[table]?.(data)
    setUltimaSync(Date.now())
  }

  // Releitura sob demanda — o Modo TV usa como rede de segurança caso o Realtime caia.
  // Devolve true se conseguiu falar com o servidor.
  async function sincronizarOrdens() {
    const data = await loadTable('ordens')
    if (data === null) return false
    if (pendingWrites.current['ordens'] > 0) return true
    aplicarTabela.ordens(data)
    setUltimaSync(Date.now())
    return true
  }

  function marcarGravando(table) {
    pendingWrites.current[table] = (pendingWrites.current[table] || 0) + 1
  }
  function fimGravando(table) {
    pendingWrites.current[table] = Math.max(0, (pendingWrites.current[table] || 0) - 1)
    // Última gravação terminou e havia um recarregamento adiado → executa agora
    if (pendingWrites.current[table] === 0 && reloadPendente.current[table]) {
      reloadPendente.current[table] = false
      recarregarTabela(table)
    }
  }

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

      r.current.clientes      = clientesData || []
      r.current.veiculos      = veiculosData || []
      r.current.ordens        = ordensData || []
      r.current.estoque       = estoqueData || []
      r.current.financeiro    = financeiroData || []
      r.current.agenda        = agendaData || []
      r.current.funcionarios  = funcionariosData || []
      r.current.servicos      = servicosData || []
      r.current.checklists    = checklistsData || []
      r.current.orcamentos    = orcamentosData || []
      r.current.compras       = comprasData || []
      r.current.fornecedores  = fornecedoresData || []
      r.current.caixaHistorico = caixaHistoricoData || []

      _setClientes(r.current.clientes)
      _setVeiculos(r.current.veiculos)
      _setOrdens(r.current.ordens)
      _setEstoque(r.current.estoque)
      _setFinanceiro(r.current.financeiro)
      _setAgenda(r.current.agenda)
      _setFuncionarios(r.current.funcionarios)
      _setServicos(r.current.servicos)
      _setChecklists(r.current.checklists)
      _setOrcamentos(r.current.orcamentos)
      _setCompras(r.current.compras)
      _setFornecedores(r.current.fornecedores)
      _setCaixaHistorico(r.current.caixaHistorico)

      // Migração Opção C: incorpora dados de checklists existentes nas OS (roda 1x)
      if (!localStorage.getItem('migracao-opcao-c-done') && checklistsData?.length) {
        const ordensMap = new Map((ordensData || []).map(o => [String(o.id), o]))
        const idsMigrados = new Set()
        const novasOrdens = []
        // ficha.id → id da OS criada, para gravar o vínculo de volta e evitar
        // que a ficha continue "órfã" e gere uma segunda OS depois
        const vinculos = new Map()
        for (const ck of checklistsData) {
          const camposMigrar = {
            luzesPainel: ck.luzesPainel || [],
            relatoCliente: ck.relatoCliente || '',
            assinatura: ck.assinatura || '',
            assinaturaTempo: ck.assinaturaTempo || null,
            atendente: ck.atendente || '',
            ultimaRevisao: ck.ultimaRevisao || '',
            numCondutores: ck.numCondutores || '',
            combustivel: ck.combustivel || '',
            inspecaoVisual: ck.inspecaoVisual || [],
            diagnosticoItens: ck.diagnostico || [],
            falhasScanner: ck.falhasScanner || '',
            observacoesTecnicas: ck.observacoesTecnicas || '',
            tecnicoId: ck.tecnicoId || null,
            tecnicoNome: ck.tecnicoNome || '',
            diagnosticadoEm: ck.diagnosticadoEm || '',
            fotos: ck.fotos || [],
          }
          if (ck.osId && ordensMap.has(String(ck.osId))) {
            // Cenário A: checklist COM OS vinculada — copiar campos para a OS.
            // Cria um objeto novo (sem mutar o original) para que o diff detecte a mudança.
            const os = ordensMap.get(String(ck.osId))
            const patch = {}
            Object.entries(camposMigrar).forEach(([k, v]) => {
              const vazio = !os[k] || (Array.isArray(os[k]) && os[k].length === 0)
              if (v && vazio) patch[k] = v
            })
            if (Object.keys(patch).length > 0) {
              ordensMap.set(String(ck.osId), { ...os, ...patch })
              idsMigrados.add(String(ck.osId))
            }
          } else if (!ck.osId) {
            // Cenário B/C: checklist SEM OS — criar nova OS
            const statusMap = { 'Aguardando diagnóstico': 'Recepção', 'Em diagnóstico': 'Em Diagnóstico', 'Diagnóstico concluído': 'Aguardando Aprovação' }
            const novoStatus = statusMap[ck.status] || 'Recepção'
            vinculos.set(ck.id, 'MIG-' + ck.id)
            novasOrdens.push({
              id: 'MIG-' + ck.id,
              clienteId: ck.clienteId,
              veiculoId: ck.veiculoId,
              clienteNome: ck.clienteNome || '',
              veiculoPlaca: ck.veiculoPlaca || '',
              veiculoModelo: ck.veiculoModelo || '',
              kmEntrada: ck.kmEntrada || '',
              descricaoProblema: ck.relatoCliente || '',
              status: novoStatus,
              data: ck.criadoEm || new Date().toLocaleDateString('pt-BR'),
              dataEntrada: ck.criadoEm || new Date().toLocaleDateString('pt-BR'),
              etapaEm: Date.now(),
              itens: [],
              historico: [{ id: gerarId(), texto: 'OS criada via migração do checklist ' + ck.id, data: new Date().toLocaleString('pt-BR') }],
              ...camposMigrar,
            })
          }
        }
        if (novasOrdens.length > 0 || idsMigrados.size > 0) {
          const ordensAtualizadas = [...(ordensData || []).map(o => ordensMap.get(String(o.id)) || o), ...novasOrdens]
          r.current.ordens = ordensAtualizadas
          _setOrdens(ordensAtualizadas)
          marcarGravando('ordens')
          supabaseDiff('ordens', ordensData || [], ordensAtualizadas)
            .catch(console.error)
            .finally(() => fimGravando('ordens'))
        }
        // Fecha o vínculo nos dois sentidos: sem o osId na ficha, ela continua
        // parecendo órfã e um clique em "Abrir OS" criaria uma segunda OS.
        if (vinculos.size > 0) {
          const checklistsAtualizados = checklistsData.map(c =>
            vinculos.has(c.id) ? { ...c, osId: vinculos.get(c.id), migradoEm: Date.now() } : c
          )
          r.current.checklists = checklistsAtualizados
          _setChecklists(checklistsAtualizados)
          marcarGravando('checklists')
          supabaseDiff('checklists', checklistsData, checklistsAtualizados)
            .catch(console.error)
            .finally(() => fimGravando('checklists'))
        }
        localStorage.setItem('migracao-opcao-c-done', '1')
      }

      // Libera UI imediatamente — dados principais já estão prontos
      setCarregando(false)

      // caixa_turno e configuracoes carregam em segundo plano sem bloquear a UI
      try {
        const { data: turnoRows, error: turnoErr } = await supabase
          .from('caixa_turno').select('id, data').eq('id', 'caixa-turno')
        if (turnoErr) console.error('[caixa_turno] Erro ao carregar:', turnoErr)
        else {
          const turno = turnoRows?.[0] ? { id: 'caixa-turno', ...turnoRows[0].data } : null
          r.current.caixaTurno = turno
          _setCaixaTurno(turno)
        }
      } catch (e) { console.error('[caixa_turno] Erro:', e) }

      try {
        const { data: configRows, error: configErr } = await supabase
          .from('configuracoes').select('id, data').eq('id', 'config-oficina')
        if (configErr) console.error('[configuracoes] Erro ao carregar:', configErr)
        else {
          const configData = configRows?.[0]?.data || {}
          r.current.config = configData
          _setConfig(configData)
          try { localStorage.setItem('config-oficina', JSON.stringify(configData)) } catch {}
        }
      } catch (e) { console.error('[configuracoes] Erro:', e) }
    }
    init().catch(e => { console.error(e); setCarregando(false) })
  }, [])

  // Sincronização em tempo real via Supabase Realtime.
  // Cada evento passa por recarregarTabela(), que ignora o "eco" das nossas próprias
  // gravações enquanto elas estão em andamento (evita sobrescrever estado local).
  useEffect(() => {
    const ch = supabase.channel('app-realtime')

    for (const table of Object.keys(aplicarTabela)) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        recarregarTabela(table)
      })
    }

    // caixa_turno e configuracoes: linhas únicas com id fixo (tratadas dentro de recarregarTabela)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'caixa_turno' }, () => {
      recarregarTabela('caixa_turno')
    })
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => {
      recarregarTabela('configuracoes')
    })

    ch.subscribe((status) => {
      setRealtimeOk(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') setUltimaSync(Date.now())
    })

    return () => { supabase.removeChannel(ch) }
  }, [])

  // Factory de setter com atualização otimista + persistência Supabase
  function makeSet(tableName, refKey, setter) {
    return (valOrFn) => {
      const prev = r.current[refKey]
      const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
      r.current[refKey] = next
      setter(next)
      marcarGravando(tableName)
      supabaseDiff(tableName, prev, next)
        .catch(console.error)
        .finally(() => fimGravando(tableName))
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
    marcarGravando('caixa_turno')
    const done = () => fimGravando('caixa_turno')
    if (next === null) {
      supabase.from('caixa_turno').delete().eq('id', 'caixa-turno')
        .then(({ error }) => { if (error) console.error('[caixa_turno] Erro ao deletar:', error) })
        .finally(done)
    } else {
      const { id: _id, ...data } = next
      supabase.from('caixa_turno').upsert({ id: 'caixa-turno', data })
        .then(({ error }) => { if (error) console.error('[caixa_turno] Erro ao salvar:', error) })
        .finally(done)
    }
  }

  function setConfig(valOrFn) {
    const prev = r.current.config
    const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
    r.current.config = next
    _setConfig(next)
    try { localStorage.setItem('config-oficina', JSON.stringify(next)) } catch {}
    marcarGravando('configuracoes')
    supabase.from('configuracoes').upsert({ id: 'config-oficina', data: next })
      .then(({ error }) => { if (error) console.error('[configuracoes] Erro ao salvar:', error) })
      .finally(() => fimGravando('configuracoes'))
  }

  // --- HELPERS ---
  function gerarNumeroOS() {
    const existentes = new Set(r.current.ordens.map(o => o.id))
    for (let i = 0; i < 20; i++) {
      const n = '#' + Math.floor(10000 + Math.random() * 89999)
      if (!existentes.has(n)) return n
    }
    const nums = r.current.ordens.map(o => parseInt((o.id || '').replace('#', '')) || 0)
    return '#' + ((Math.max(0, ...nums)) + 1)
  }
  function gerarNumeroChecklist() {
    const existentes = new Set(r.current.checklists.map(c => c.numero))
    for (let i = 0; i < 20; i++) {
      const n = 'CK-' + Math.floor(1000 + Math.random() * 8999)
      if (!existentes.has(n)) return n
    }
    const nums = r.current.checklists.map(c => parseInt((c.numero || '').replace('CK-', '')) || 0)
    return 'CK-' + ((Math.max(0, ...nums)) + 1)
  }
  function carimboData() {
    return new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Todo evento de histórico passa por aqui, para que sempre fique registrado
  // QUEM fez a ação — sem isso não há como auditar exclusão, estorno ou reabertura.
  function evento(texto, extra = {}) {
    return {
      id: gerarId(),
      texto,
      data: carimboData(),
      quandoMs: Date.now(),
      autorId: currentUser?.id ?? null,
      autorNome: currentUser?.nome || '',
      ...extra,
    }
  }

  // Aplica mudanças numa OS já registrando o histórico. Devolve a OS anterior
  // (ou null se não achou) para quem precisar do estado antes da mudança.
  function mudarOrdem(osId, dados, textoHistorico, extraEvento) {
    const anterior = r.current.ordens.find(x => x.id === osId)
    if (!anterior) return null
    const historico = textoHistorico
      ? [evento(textoHistorico, extraEvento), ...(anterior.historico || [])]
      : anterior.historico
    setOrdens(prev => prev.map(x => x.id === osId ? { ...x, ...dados, historico } : x))
    return anterior
  }

  const FLUXO = {
    RECEPCAO: 'Recepção',
    DIAGNOSTICO: 'Em Diagnóstico',
    APROVACAO: 'Aguardando Aprovação',
    REJEITADA: 'Rejeitada',
    APROVADO: 'Aprovado',
    PECA: 'Aguardando Peça',
    EXECUCAO: 'Em Execução',
    CONFERENCIA: 'Em Conferência',
    CONCLUIDA: 'Concluída',
    ENTREGUE: 'Entregue',
    CANCELADA: 'Cancelada',
  }

  function parseBR(v) {
    if (typeof v === 'number') return v
    const s = (v || '0').toString()
    if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    return parseFloat(s) || 0
  }

  function subtotalOrdem(o) {
    if (o.itens && o.itens.length > 0) {
      return o.itens.reduce((s, i) => {
        const unitario = parseBR(i.valorUnitario)
        const qtd = parseBR(i.quantidade) || 1
        const desconto = parseBR(i.desconto)
        return s + (unitario * qtd - desconto)
      }, 0)
    }
    return parseBR(o.valor)
  }

  function totalOrdem(o) {
    const sub = subtotalOrdem(o)
    const dg = parseBR(o.descontoGeral)
    return Math.max(0, sub - dg)
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
      status: dados.status || 'Recepção',
      itens: dados.itens || [],
      pecas: dados.pecas || [],
      fotos: dados.fotos || [],
      historico: [evento('OS criada')],
      pago: false,
      etapaEm: Date.now(),
      // Campos de entrada/vistoria (absorvidos do antigo checklist)
      luzesPainel: dados.luzesPainel || [],
      relatoCliente: dados.relatoCliente || '',
      assinatura: dados.assinatura || '',
      assinaturaTempo: dados.assinaturaTempo || null,
      atendente: dados.atendente || '',
      ultimaRevisao: dados.ultimaRevisao || '',
      numCondutores: dados.numCondutores || '',
      combustivel: dados.combustivel || '',
      inspecaoVisual: dados.inspecaoVisual || [],
      // Campos de diagnóstico
      diagnosticoItens: dados.diagnosticoItens || [],
      falhasScanner: dados.falhasScanner || '',
      observacoesTecnicas: dados.observacoesTecnicas || '',
      // Peças que o reparador identificou como necessárias — vira base do orçamento
      pecasNecessarias: dados.pecasNecessarias || [],
      tecnicoId: dados.tecnicoId ?? null,
      tecnicoNome: dados.tecnicoNome || '',
      diagnosticadoEm: dados.diagnosticadoEm || '',
      // Rastreabilidade quando a OS nasce de um orçamento avulso
      orcamentoId: dados.orcamentoId ?? null,
      orcamentoNumero: dados.orcamentoNumero || '',
      // Retorno em garantia: aponta para a OS que originou o retorno
      garantiaDeOsId: dados.garantiaDeOsId ?? null,
      retornosGarantia: [],
      // Quem está com o carro nesta etapa (muda a cada etapa do fluxo)
      responsavelId: dados.responsavelId ?? null,
      responsavelNome: dados.responsavelNome || '',
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

  // Antes de criar uma OS a partir de uma ficha antiga, é preciso descobrir se
  // ela já não virou OS — a migração criou 'MIG-<id>' e, em instalações onde ela
  // rodou antes desta correção, a ficha ficou sem o vínculo de volta.
  function encontrarOSDaFicha(ck) {
    if (!ck) return null
    if (ck.osId) {
      const direta = r.current.ordens.find(o => String(o.id) === String(ck.osId))
      if (direta) return direta.id
    }
    const migrada = r.current.ordens.find(o => String(o.id) === 'MIG-' + ck.id)
    if (migrada) return migrada.id
    // Última checagem: OS ativa do mesmo veículo, que seria duplicata na prática
    if (ck.veiculoId) {
      const ativa = r.current.ordens.find(o =>
        o.veiculoId === ck.veiculoId &&
        !['Entregue', 'Cancelada'].includes(o.status) &&
        !o.retirado
      )
      if (ativa) return ativa.id
    }
    return null
  }

  function adicionarItemOrdem(id, item) {
    const novo = { ...item, id: gerarId() }
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

  function editarItemOrdem(osId, itemId, dados) {
    setOrdens(prev => prev.map(o => {
      if (o.id !== osId) return o
      const antigo = (o.itens || []).find(i => i.id === itemId)
      if (antigo && antigo.tipo === 'peca' && antigo.produtoId) {
        const novoProdutoId = dados.produtoId ?? antigo.produtoId
        const antigoProdId = Number(antigo.produtoId)
        const novoProdId = Number(novoProdutoId)
        if (antigoProdId !== novoProdId) {
          setEstoque(ep => ep.map(p => {
            if (p.id === antigoProdId) return { ...p, estoque: Number(p.estoque) + (Number(antigo.quantidade) || 1) }
            if (p.id === novoProdId) return { ...p, estoque: Math.max(0, Number(p.estoque) - (Number(dados.quantidade) || 1)) }
            return p
          }))
        } else {
          const diff = (Number(dados.quantidade) || 1) - (Number(antigo.quantidade) || 1)
          if (diff !== 0) {
            setEstoque(ep => ep.map(p => p.id === antigoProdId
              ? { ...p, estoque: Math.max(0, Number(p.estoque) - diff) } : p))
          }
        }
      }
      return { ...o, itens: (o.itens || []).map(i => i.id === itemId ? { ...i, ...dados } : i) }
    }))
  }

  // Status a partir dos quais sair exige estorno do financeiro/caixa
  const STATUS_FINALIZADOS = ['Entregue', 'Concluída']

  function mudarStatusOrdem(id, novoStatus) {
    const lista = r.current.ordens
    const o = lista.find(x => x.id === id)
    if (!o) return
    if (o.status === novoStatus) return

    // Sair de um status finalizado (ou de OS já paga) reverte o financeiro —
    // impede que o dropdown burle o fluxo de "Reabrir OS".
    const saindoDeFinalizado = STATUS_FINALIZADOS.includes(o.status) || o.pago
    const voltandoParaAtivo = !STATUS_FINALIZADOS.includes(novoStatus) && novoStatus !== 'Cancelada'
    const precisaEstorno = saindoDeFinalizado && (voltandoParaAtivo || novoStatus === 'Cancelada')

    const eventos = []
    if (precisaEstorno) eventos.push(evento('Estorno automático (saída de status finalizado)'))
    eventos.push(evento(`Status alterado para "${novoStatus}"`))
    const historico = [...eventos, ...(o.historico || [])]

    let extra = {}
    if (novoStatus === 'Concluída') {
      const hoje = new Date().toLocaleDateString('pt-BR')
      extra.dataConclusao = o.dataConclusao || hoje
    }
    if (precisaEstorno) {
      extra.pago = false
      extra.dataConclusao = ''
    }

    setOrdens(prev => prev.map(x => x.id === id ? { ...x, status: novoStatus, historico, etapaEm: Date.now(), ...extra } : x))

    if (precisaEstorno) {
      setFinanceiro(fp => fp.filter(f => f.osId !== id))
      setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.osId !== id) } : t)
    }
  }

  function adicionarFotoOrdem(id, url) {
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, fotos: [...(o.fotos || []), { id: gerarId(), url }] } : o))
  }

  function removerFotoOrdem(id, fotoId) {
    setOrdens(prev => prev.map(o => o.id === id ? { ...o, fotos: (o.fotos || []).filter(f => f.id !== fotoId) } : o))
  }

  function excluirOrdem(id) {
    const o = r.current.ordens.find(x => x.id === id)
    if (o) {
      const pecas = (o.itens || []).filter(i => i.tipo === 'peca' && i.produtoId)
      if (pecas.length > 0) {
        setEstoque(prev => prev.map(item => {
          const usada = pecas.find(p => Number(p.produtoId) === item.id)
          if (usada) return { ...item, estoque: Number(item.estoque) + (Number(usada.quantidade) || 1) }
          return item
        }))
      }
    }
    setFinanceiro(fp => fp.filter(f => f.osId !== id))
    setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.osId !== id) } : t)
    setOrdens(prev => prev.filter(o => o.id !== id))
  }

  function pagarOrdem(osId, pagamentos, clienteNome) {
    if (pagamentos) return entregarOrdem(osId, pagamentos, clienteNome)
    setOrdens(prev => prev.map(o => o.id === osId ? { ...o, pago: true } : o))
  }

  function reabrirOrdem(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    const historico = [evento('OS reaberta (estorno)'), ...(o.historico || [])]
    setOrdens(prev => prev.map(x => x.id === osId ? { ...x, status: 'Em Execução', pago: false, dataConclusao: '', historico, etapaEm: Date.now() } : x))
    setFinanceiro(fp => fp.filter(f => f.osId !== osId))
    setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.osId !== osId) } : t)
  }

  function concluirOrdem(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    if (o.status === 'Entregue' || o.status === 'Cancelada' || o.status === 'Concluída') return
    const hoje = new Date().toLocaleDateString('pt-BR')
    const historico = [evento('Serviço concluído — aguardando retirada'), ...(o.historico || [])]
    setOrdens(prev => prev.map(x => x.id === osId ? { ...x, status: 'Concluída', dataConclusao: hoje, historico, etapaEm: Date.now() } : x))
  }

  function entregarOrdem(osId, pagamentos, clienteNome) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    if (o.status === 'Entregue') return   // evita duplo-clique gerando venda duplicada no caixa
    const historico = [evento('Veículo entregue e pago'), ...(o.historico || [])]
    // Guarda como o cliente pagou na própria OS: a venda do caixa some quando o
    // turno está fechado, e sem isto o recibo reimpresso depois sai sem pagamento.
    setOrdens(prev => prev.map(x => x.id === osId ? {
      ...x,
      status: 'Entregue',
      pago: true,
      pagamentos: pagamentos || [],
      dataEntrega: new Date().toLocaleDateString('pt-BR'),
      historico,
      etapaEm: Date.now(),
    } : x))
    const total = totalOrdem(o)
    registrarVendaCaixa({
      osId,
      clienteNome: clienteNome || '',
      itens: o.itens || [],
      total,
      pagamentos: pagamentos || [],
    })
  }

  function salvarDiagnostico(osId, dados) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    const historico = [evento('Diagnóstico atualizado'), ...(o.historico || [])]
    setOrdens(prev => prev.map(x => x.id === osId ? {
      ...x,
      diagnosticoItens: dados.diagnosticoItens ?? x.diagnosticoItens,
      falhasScanner: dados.falhasScanner ?? x.falhasScanner,
      observacoesTecnicas: dados.observacoesTecnicas ?? x.observacoesTecnicas,
      pecasNecessarias: dados.pecasNecessarias ?? x.pecasNecessarias,
      tecnicoId: dados.tecnicoId ?? x.tecnicoId,
      tecnicoNome: dados.tecnicoNome ?? x.tecnicoNome,
      diagnosticadoEm: dados.diagnosticadoEm ?? x.diagnosticadoEm,
      diagnostico: dados.diagnostico ?? x.diagnostico,
      historico,
    } : x))
  }

  // ─── FLUXO DO PÁTIO ────────────────────────────────────────────────────────
  // Cada função abaixo é disparada por uma ação real de alguém na oficina.
  // O status do quadro é consequência do trabalho, não uma tarefa separada.

  function iniciarDiagnostico(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status === FLUXO.DIAGNOSTICO) return
    mudarOrdem(osId, {
      status: FLUXO.DIAGNOSTICO,
      etapaEm: Date.now(),
      responsavelId: currentUser?.id ?? null,
      responsavelNome: currentUser?.nome || '',
      diagnosticoIniciadoEm: Date.now(),
    }, `Diagnóstico iniciado por ${currentUser?.nome || 'usuário'}`)
  }

  function finalizarDiagnostico(osId, dados) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    mudarOrdem(osId, {
      ...dados,
      status: FLUXO.APROVACAO,
      etapaEm: Date.now(),
      tecnicoId: currentUser?.id ?? null,
      tecnicoNome: currentUser?.nome || '',
      diagnosticadoEm: carimboData(),
    }, 'Diagnóstico finalizado — aguardando aprovação do cliente')
  }

  function aprovarOrcamento(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    mudarOrdem(osId, {
      status: FLUXO.APROVADO,
      etapaEm: Date.now(),
      aprovadoEm: Date.now(),
      // Liberado para qualquer reparador pegar
      responsavelId: null,
      responsavelNome: '',
    }, 'Cliente aprovou o orçamento')
  }

  function recusarOrcamento(osId, motivo) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    mudarOrdem(osId, {
      status: FLUXO.REJEITADA,
      etapaEm: Date.now(),
      motivoRecusa: motivo || '',
    }, `Cliente recusou o orçamento${motivo ? ` — ${motivo}` : ''}`)
  }

  // Saída da recusa: o diagnóstico pode ou não ser cobrado, e fica registrado
  // qual foi a escolha e quem decidiu.
  function fecharRecusa(osId, { cobrar, pagamentos, valorDiagnostico, clienteNome }) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status === FLUXO.ENTREGUE) return
    const texto = cobrar
      ? `Diagnóstico cobrado e veículo entregue (orçamento recusado)`
      : `Veículo entregue sem cobrança do diagnóstico (liberado por ${currentUser?.nome || 'usuário'})`
    mudarOrdem(osId, {
      status: FLUXO.ENTREGUE,
      pago: !!cobrar,
      diagnosticoCobrado: !!cobrar,
      dataConclusao: o.dataConclusao || new Date().toLocaleDateString('pt-BR'),
      etapaEm: Date.now(),
    }, texto)
    if (cobrar && parseBR(valorDiagnostico) > 0) {
      registrarVendaCaixa({
        osId,
        clienteNome: clienteNome || '',
        itens: [],
        total: parseBR(valorDiagnostico),
        pagamentos: pagamentos || [],
      })
    }
  }

  function iniciarReparo(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status === FLUXO.EXECUCAO) return
    mudarOrdem(osId, {
      status: FLUXO.EXECUCAO,
      etapaEm: Date.now(),
      responsavelId: currentUser?.id ?? null,
      responsavelNome: currentUser?.nome || '',
      reparoIniciadoEm: o.reparoIniciadoEm || Date.now(),
    }, `Reparo iniciado por ${currentUser?.nome || 'usuário'}`)
  }

  function marcarAguardandoPeca(osId, motivo) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status === FLUXO.PECA) return
    mudarOrdem(osId, {
      status: FLUXO.PECA,
      etapaEm: Date.now(),
      // Guarda de onde veio para saber a quem devolver quando a peça chegar
      pecaVoltarPara: o.status === FLUXO.EXECUCAO ? FLUXO.EXECUCAO : FLUXO.APROVADO,
      motivoPeca: motivo || '',
    }, `Aguardando peça${motivo ? ` — ${motivo}` : ''}`)
  }

  function pecaChegou(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status !== FLUXO.PECA) return
    // Se alguém já estava com o carro, volta para essa pessoa; senão fica livre.
    const volta = o.pecaVoltarPara === FLUXO.EXECUCAO && o.responsavelId
      ? FLUXO.EXECUCAO
      : FLUXO.APROVADO
    mudarOrdem(osId, {
      status: volta,
      etapaEm: Date.now(),
      pecaVoltarPara: null,
      motivoPeca: '',
    }, 'Peça recebida — serviço liberado')
  }

  function concluirReparo(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status === FLUXO.CONFERENCIA) return
    mudarOrdem(osId, {
      status: FLUXO.CONFERENCIA,
      etapaEm: Date.now(),
      reparoConcluidoEm: Date.now(),
      reparadorNome: currentUser?.nome || o.responsavelNome || '',
    }, `Reparo concluído por ${currentUser?.nome || 'usuário'} — aguardando conferência`)
  }

  // A conferência guarda o TEXTO dos itens, não referências: editar a lista em
  // Configurações depois não pode alterar o que já foi conferido.
  function liberarConferencia(osId, itensConferidos) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    const registro = {
      itens: itensConferidos || [],
      conferidoPorId: currentUser?.id ?? null,
      conferidoPorNome: currentUser?.nome || '',
      conferidoEm: carimboData(),
      aprovado: true,
    }
    mudarOrdem(osId, {
      status: FLUXO.CONCLUIDA,
      etapaEm: Date.now(),
      dataConclusao: o.dataConclusao || new Date().toLocaleDateString('pt-BR'),
      conferencia: registro,
      conferencias: [...(o.conferencias || []), registro],
    }, `Conferência aprovada por ${currentUser?.nome || 'usuário'} — liberado para entrega`)
  }

  function reprovarConferencia(osId, itensConferidos) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    const reprovados = (itensConferidos || []).filter(i => i.status === 'problema')
    const registro = {
      itens: itensConferidos || [],
      conferidoPorId: currentUser?.id ?? null,
      conferidoPorNome: currentUser?.nome || '',
      conferidoEm: carimboData(),
      aprovado: false,
    }
    const resumo = reprovados.map(i => i.label).join(', ')
    mudarOrdem(osId, {
      status: FLUXO.EXECUCAO,
      etapaEm: Date.now(),
      conferencia: registro,
      conferencias: [...(o.conferencias || []), registro],
    }, `Conferência reprovada por ${currentUser?.nome || 'usuário'}${resumo ? ` — ${resumo}` : ''}`)
  }

  // Retorno em garantia: OS nova ligada à original, sem cobrança. O financeiro
  // da OS original permanece intacto — o dinheiro entrou de forma legítima.
  function criarOSGarantia(osOriginalId, descricao) {
    const orig = r.current.ordens.find(x => x.id === osOriginalId)
    if (!orig) return null
    const novoId = novaOrdem({
      clienteId: orig.clienteId,
      veiculoId: orig.veiculoId,
      kmEntrada: '',
      descricaoProblema: descricao || `Retorno em garantia da OS ${osOriginalId}`,
      relatoCliente: descricao || '',
      status: FLUXO.RECEPCAO,
      garantiaDeOsId: osOriginalId,
      atendente: currentUser?.nome || '',
    })
    mudarOrdem(osOriginalId, {
      retornosGarantia: [...(orig.retornosGarantia || []), novoId],
    }, `Retorno em garantia aberto: OS ${novoId}`)
    return novoId
  }

  function salvarVistoria(osId, dados) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    const historico = [evento('Vistoria atualizada'), ...(o.historico || [])]
    setOrdens(prev => prev.map(x => x.id === osId ? {
      ...x,
      inspecaoVisual: dados.inspecaoVisual ?? x.inspecaoVisual,
      fotos: dados.fotos ?? x.fotos,
      historico,
    } : x))
  }

  // --- FINANCEIRO ---
  function adicionarLancamento(lancamento) {
    const hoje = new Date().toLocaleDateString('pt-BR')
    setFinanceiro(prev => [{ ...lancamento, id: gerarId(), data: hoje }, ...prev])
  }

  // --- COMPRAS ---
  function criarCompra() {
    const id = gerarId()
    const existentes = new Set(r.current.compras.map(c => c.numero))
    let numero
    for (let i = 0; i < 20; i++) {
      const n = '#' + Math.floor(400 + Math.random() * 600)
      if (!existentes.has(n)) { numero = n; break }
    }
    if (!numero) {
      const nums = r.current.compras.map(c => parseInt((c.numero || '').replace('#', '')) || 0)
      numero = '#' + ((Math.max(0, ...nums)) + 1)
    }
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
          id: gerarId(),
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
          valor: parseBR(p.valor).toFixed(2).replace('.', ','),
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
  function pNum(v) { return parseBR(v) }
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
      .reduce((s, p) => s + pNum(p.valor), 0)
    const pago = recebido >= venda.total - 0.001
    const vendasExistentes = new Set((caixaTurno?.vendas || []).map(v => v.numero))
    let numero
    for (let i = 0; i < 20; i++) {
      const n = '#' + Math.floor(3000 + Math.random() * 7000)
      if (!vendasExistentes.has(n)) { numero = n; break }
    }
    if (!numero) {
      const nums = (caixaTurno?.vendas || []).map(v => parseInt((v.numero || '').replace('#', '')) || 0)
      numero = '#' + ((Math.max(0, ...nums)) + 1)
    }
    const novaVenda = { ...venda, id: gerarId(), numero, status: pago ? 'Paga' : 'Pendente', recebido, hora: horaAgora() }

    setCaixaTurno(t => t ? { ...t, vendas: [novaVenda, ...t.vendas] } : t)

    if (recebido > 0) {
      const lanc = {
        descricao: `Venda ${numero} - ${venda.clienteNome || 'Cliente'}`,
        tipo: 'receita',
        valor: recebido.toFixed(2).replace('.', ','),
        vendaId: novaVenda.id,
        caixa: true,
      }
      if (venda.osId) lanc.osId = venda.osId
      adicionarLancamento(lanc)
    }
    return numero
  }

  function registrarSangria(valor, motivo, forma = 'Dinheiro') {
    setCaixaTurno(t => t ? { ...t, movimentos: [{ id: gerarId(), tipo: 'sangria', valor: pNum(valor), motivo, forma, hora: horaAgora() }, ...t.movimentos] } : t)
  }

  function registrarReforco(valor, motivo, forma = 'Dinheiro') {
    setCaixaTurno(t => t ? { ...t, movimentos: [{ id: gerarId(), tipo: 'reforco', valor: pNum(valor), motivo, forma, hora: horaAgora() }, ...t.movimentos] } : t)
  }

  function fecharCaixa(contagem, justificativa, saldoEsperado, totalContado) {
    if (!r.current.caixaTurno) return
    const fechado = {
      ...r.current.caixaTurno,
      id: gerarId(),
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

  function pValor(v) { return parseBR(v) }

  const resumoFinanceiro = {
    receitas: financeiro.filter(f => f.tipo === 'receita' && !f.pendente).reduce((s, f) => s + pValor(f.valor), 0),
    despesas: financeiro.filter(f => f.tipo === 'despesa' && !f.pendente).reduce((s, f) => s + pValor(f.valor), 0),
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
      ordens, setOrdens, novaOrdem, pagarOrdem, reabrirOrdem, concluirOrdem, entregarOrdem,
      atualizarOrdem, adicionarItemOrdem, removerItemOrdem, editarItemOrdem, mudarStatusOrdem,
      adicionarFotoOrdem, removerFotoOrdem, excluirOrdem, subtotalOrdem, totalOrdem,
      salvarDiagnostico, salvarVistoria, encontrarOSDaFicha,
      // Fluxo do pátio — o status é consequência destas ações
      FLUXO,
      iniciarDiagnostico, finalizarDiagnostico,
      aprovarOrcamento, recusarOrcamento, fecharRecusa,
      iniciarReparo, marcarAguardandoPeca, pecaChegou, concluirReparo,
      liberarConferencia, reprovarConferencia, criarOSGarantia,
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
      config, setConfig,
      carregando,
      realtimeOk, ultimaSync, sincronizarOrdens,
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

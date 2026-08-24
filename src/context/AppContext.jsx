import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../supabase'
import { useAuth } from './AuthContext'
import { enriquecerPagamento, enriquecerPagamentos, somarPagamentos } from '../utils/cartao'
import { listaAReceber, diasEmAberto } from '../utils/receber'
import { parseDataBR } from '../utils/datas'
import { parseValorBR } from '../utils/numero'
import { intervaloDe, periodoAnteriorDe, resumirFinanceiro } from '../utils/periodo'
import gerarId from '../utils/id'
import { novoIdMovimento, idMovimentoDeterministico } from '../utils/movimentos'
import { aplicarRegraNasOrdens, derivarMovimentosDaOS, reservasPorPeca } from '../utils/reserva'
import { bloqueioDeConclusao } from '../utils/reparador'
import {
  enfileirar as enfileirarPendencia,
  listar as listarPendencias,
  remover as removerPendencia,
  dedupPendencias,
} from '../utils/filaGravacao'

const AppContext = createContext(null)

// As telas abertas pelo CLIENTE nao carregam o sistema.
//
// `/assinar/:id` e `/vistoria/:id` ficam dentro do mesmo provedor que o resto do
// app — e o provedor le as 17 tabelas ao abrir. Resultado, medido no navegador:
// o celular de todo cliente que abriu um link de assinatura baixou a carteira de
// clientes com CPF e endereco, o financeiro, o historico de caixa, os gastos E a
// tabela de funcionarios com os PINs em texto puro.
//
// Essas duas telas hoje falam so com as funcoes `os_do_cliente` e `assinar_os`,
// entao nao precisam de nada disto. Nao carregar e a correcao — e ela vale
// mesmo depois do RLS, porque baixar 17 tabelas no celular do cliente seria
// desperdicio de qualquer jeito.
const ROTAS_DO_CLIENTE = ['/assinar/', '/vistoria/']
function ehTelaDoCliente() {
  try { return ROTAS_DO_CLIENTE.some(r => window.location.pathname.startsWith(r)) }
  catch { return false }
}

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

// ── Realtime cirúrgico ────────────────────────────────────────────────────────
// O aviso do banco já traz a linha que mudou. Antes o app jogava isso fora e
// rebaixava a tabela INTEIRA (ordens = ~3 MB) em todos os aparelhos a cada
// gravação de qualquer pessoa — foi o que estourou a cota de tráfego. Aplica
// só a linha; qualquer coisa fora do esperado devolve { fallback: true } e o
// chamador recarrega a tabela como sempre fez.
// Exportada para teste — função pura.
export function aplicarEventoNaLista(lista, payload, tabela) {
  const atual = Array.isArray(lista) ? lista : []
  const tipo = payload?.eventType
  if (tipo === 'DELETE') {
    const id = payload?.old?.id
    if (id == null) return { fallback: true }
    const nova = atual.filter(x => String(x.id) !== String(id))
    return { mudou: nova.length !== atual.length, lista: nova }
  }
  if (tipo === 'INSERT' || tipo === 'UPDATE') {
    const linha = payload?.new
    // Linha muito grande pode chegar sem o corpo — recarrega em vez de adivinhar
    if (!linha || linha.id == null || typeof linha.data !== 'object' || linha.data === null) return { fallback: true }
    const item = row2item({ id: linha.id, data: linha.data })
    if (tabela === 'ordens' && ehRascunho(item)) {
      // Rascunho de link não entra no estado; se uma linha real virou rascunho, sai
      const nova = atual.filter(x => String(x.id) !== String(item.id))
      return { mudou: nova.length !== atual.length, lista: nova }
    }
    const existe = atual.some(x => String(x.id) === String(item.id))
    const nova = existe
      ? atual.map(x => String(x.id) === String(item.id) ? item : x)
      : [item, ...atual]
    return { mudou: true, lista: nova }
  }
  return { fallback: true }
}

// Carrega tabela inteira — retorna null em caso de erro para que o chamador
// possa distinguir "tabela vazia" (array []) de "falha de rede" (null).
async function loadTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('id, data').order('id', { ascending: false })
  if (error) { console.error(`Erro ao carregar ${tableName}:`, error); return null }
  const itens = (data || []).map(row2item)
  return tableName === 'ordens' ? itens.filter(o => !ehRascunho(o)) : itens
}

// ── Mescla de OS: gravar sem apagar o trabalho dos outros ────────────────────
// O upsert grava a linha inteira ("a OS é esta foto"). Se outro navegador
// gravou primeiro, a foto local está velha e a gravação cega apagaria o item
// dele — era assim que peças sumiam do orçamento. Antes de gravar, o app relê
// a linha no banco e junta os dois lados.
// Exportadas para teste — são funções puras.

// União de arrays com id (itens, fotos, histórico): sobrevive o que o remoto
// tem + o que ESTE navegador adicionou/editou; o que este navegador removeu
// sai; o que OUTRO removeu não é ressuscitado.
export function unirPorId(remoto, prevLoc, nextLoc) {
  const rem = remoto || [], pv = prevLoc || [], nx = nextLoc || []
  const prevMap = new Map(pv.map(x => [String(x?.id), x]))
  const prevIds = new Set(prevMap.keys())
  const nextMap = new Map(nx.map(x => [String(x?.id), x]))
  const saida = []
  const noRemoto = new Set()
  for (const it of rem) {
    const k = String(it?.id)
    noRemoto.add(k)
    if (prevIds.has(k) && !nextMap.has(k)) continue        // este navegador removeu
    // A versão local só vence se ESTE navegador mexeu no item (prev ≠ next).
    // Antes ela vencia sempre que o item existisse aqui — e uma foto atrasada
    // apagava, sem querer, a marca de estoque (estoqueBaixado) que outro
    // aparelho acabara de gravar no mesmo item.
    if (nextMap.has(k)) {
      const loc = nextMap.get(k), ant = prevMap.get(k)
      const mudouAqui = !ant || JSON.stringify(ant) !== JSON.stringify(loc)
      saida.push(mudouAqui ? loc : it)
    } else {
      saida.push(it)                                       // intacto aqui: vale o remoto
    }
  }
  for (const it of nx) {
    const k = String(it?.id)
    if (noRemoto.has(k)) continue
    if (prevIds.has(k)) continue                           // outro removeu — não ressuscita
    saida.push(it)                                         // acréscimo deste navegador
  }
  return saida
}

// Campos simples: vale o valor de quem mexeu. Se ESTE navegador alterou o
// campo (prev ≠ next), o valor dele vai; senão fica o que está no banco.
export function mesclarOrdem(prevRow, nextRow, remotoData) {
  const prev = prevRow || {}, next = nextRow || {}, rem = remotoData || {}
  const saida = { ...rem }
  for (const k of new Set([...Object.keys(next), ...Object.keys(prev)])) {
    if (k === 'id' || k === 'itens' || k === 'fotos' || k === 'historico') continue
    const mudouAqui = JSON.stringify(prev[k]) !== JSON.stringify(next[k])
    if (mudouAqui || !(k in rem)) saida[k] = next[k]
  }
  saida.itens = unirPorId(rem.itens, prev.itens, next.itens)
  saida.fotos = unirPorId(rem.fotos, prev.fotos, next.fotos)
  saida.historico = unirPorId(rem.historico, prev.historico, next.historico)
    .sort((a, b) => (b.quandoMs || 0) - (a.quandoMs || 0))
  return saida
}

// Mescla de PEÇA: o cadastro (nome, preço, mínimo...) vale o deste navegador,
// mas o SALDO é do banco. Desde o kardex, todo saldo muda por soma no servidor
// (registrar_movimentos); a foto local pode estar atrasada, então gravar a
// linha inteira por cima restauraria saldo velho — exatamente o defeito que o
// kardex existe para matar. Pura e exportada para teste.
export function mesclarPeca(nextRow, remotoData) {
  const { id, ...data } = nextRow || {}
  const saida = { ...data }
  // Linha sem a chave no banco (cadastro legado) conta como saldo zero — é o
  // que o trigger estoque_protege_saldo faz do lado de lá; o app espelha para
  // nunca gravar um saldo que o banco vai descartar.
  if (remotoData) saida.estoque = remotoData.estoque !== undefined ? remotoData.estoque : 0
  return saida
}

export function AppProvider({ children }) {
  const { currentUser } = useAuth()
  // Na tela do cliente nao ha o que carregar — ja nasce pronto.
  const [carregando, setCarregando] = useState(!ehTelaDoCliente())
  // O turno de caixa carrega DEPOIS de `carregando` virar false (vem em segundo
  // plano para não travar a tela). Quem depende dele precisa saber a diferença
  // entre "ainda não chegou" e "não existe turno aberto".
  const [caixaCarregado, setCaixaCarregado] = useState(false)
  // Mesma ideia do `caixaCarregado`, para a tela de login: so vira true quando a
  // leitura de funcionarios REALMENTE voltou do servidor. `carregando` nao serve
  // — ele e desligado no fim do init mesmo quando a leitura falhou, e a tela de
  // PIN usa "lista vazia" para oferecer o acesso admin sem senha.
  const [funcionariosCarregados, setFuncionariosCarregados] = useState(false)
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
  const [gastos, _setGastos] = useState([])
  const [insumos, _setInsumos] = useState([])
  const [config, _setConfig] = useState({})

  // Refs mantêm o valor atual para uso síncrono dentro dos setters
  const r = useRef({
    clientes: [], veiculos: [], ordens: [], estoque: [], financeiro: [],
    agenda: [], funcionarios: [], servicos: [], checklists: [], orcamentos: [],
    compras: [], fornecedores: [], caixaHistorico: [], caixaTurno: null, config: {},
    gastos: [], insumos: [],
  })

  // ─── Controle de gravação (evita o "eco" do Realtime) ────────────────────────
  // Quando este cliente grava, o Supabase reenvia o mesmo evento de volta. Sem
  // controle, isso recarrega a tabela inteira e pode sobrescrever alterações locais
  // que ainda não terminaram de salvar (race condition). Aqui contamos as gravações
  // em andamento e ADIAMOS o recarregamento até todas terminarem.
  const pendingWrites = useRef({})   // { [tabela]: nº de gravações em andamento }
  const reloadPendente = useRef({})  // { [tabela]: true } → recarregar quando terminarem
  const eventosAdiados = useRef({})  // { [tabela]: [payloads] } chegados durante gravação local

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
    gastos:          (d) => { r.current.gastos          = d; _setGastos(d) },
    insumos:         (d) => { r.current.insumos         = d; _setInsumos(d) },
  }

  // Nome da tabela → chave do estado em r.current (para o realtime cirúrgico ler)
  const refDaTabela = {
    clientes: 'clientes', veiculos: 'veiculos', ordens: 'ordens', estoque: 'estoque',
    financeiro: 'financeiro', agenda: 'agenda', funcionarios: 'funcionarios',
    servicos: 'servicos', checklists: 'checklists', orcamentos: 'orcamentos',
    compras: 'compras', fornecedores: 'fornecedores', caixa_historico: 'caixaHistorico',
    gastos: 'gastos', insumos: 'insumos',
  }

  // Evento do realtime: aplica só a linha alterada. Durante gravação local o
  // evento vai para a fila e é aplicado ao terminar — o eco da própria gravação
  // traz a linha já mesclada do banco, então o estado local converge sem
  // precisar rebaixar a tabela inteira (era isso que custava ~3 MB por evento).
  function receberEvento(table, payload) {
    if (pendingWrites.current[table] > 0) {
      const fila = eventosAdiados.current[table] || (eventosAdiados.current[table] = [])
      fila.push(payload)
      if (fila.length > 30) { fila.length = 0; reloadPendente.current[table] = true }
      return
    }
    aplicarEventoAgora(table, payload)
  }

  function aplicarEventoAgora(table, payload) {
    const ref = refDaTabela[table]
    if (!ref) { recarregarTabela(table); return }
    const resultado = aplicarEventoNaLista(r.current[ref], payload, table)
    if (resultado.fallback) { recarregarTabela(table); return }
    if (resultado.mudou) aplicarTabela[table](resultado.lista)
    marcarSync()
  }

  // Recarrega uma tabela do Supabase — MAS só se não houver gravação local em
  // andamento. Se houver, marca para recarregar depois (não sobrescreve estado local).
  async function recarregarTabela(table) {
    if (pendingWrites.current[table] > 0) { reloadPendente.current[table] = true; return }
    if (table === 'caixa_turno') {
      const { data, error } = await supabase.from('caixa_turno').select('id, data').eq('id', 'caixa-turno')
      // Falha de rede não é "não há turno". Zerar aqui fazia a tela oferecer
      // "Abrir Caixa" no meio do expediente — e o turno novo sobrescrevia o do
      // dia. Na dúvida, mantém o que já estava na tela.
      if (error) { console.error('[caixa_turno] Erro ao recarregar:', error); return }
      const turno = data?.[0] ? { id: 'caixa-turno', ...data[0].data } : null
      r.current.caixaTurno = turno; _setCaixaTurno(turno)
      return
    }
    if (table === 'configuracoes') {
      const { data, error } = await supabase.from('configuracoes').select('id, data').eq('id', 'config-oficina')
      // Mesmo motivo: config vazia apagaria as maquininhas da tela de venda.
      if (error) { console.error('[configuracoes] Erro ao recarregar:', error); return }
      // Linha ausente para uma config que JA existia nao e "config apagada": e
      // leitura incompleta. Aplicar o vazio tiraria o cabecalho e o CNPJ do
      // orcamento impresso na frente do cliente, e as maquininhas da tela de
      // venda — e `print.js` le a copia local, entao o estrago sai no papel.
      if (!data?.[0]?.data && Object.keys(r.current.config || {}).length > 0) {
        console.error('[configuracoes] servidor devolveu vazio para uma config que existe — ignorando')
        setLeituraSuspeita(true)
        return
      }
      const configData = data?.[0]?.data || {}
      r.current.config = configData; _setConfig(configData)
      try { localStorage.setItem('config-oficina', JSON.stringify(configData)) } catch {}
      return
    }
    const data = await loadTable(table)
    if (data === null) return
    if (tabelaVazioSuspeito(table, data)) return
    aplicarTabela[table]?.(data)
    marcarSync()
  }

  // "Lista vazia" e "leitura bloqueada" chegam IDENTICAS aqui: quando uma
  // politica do banco esconde as linhas, o Postgres nao devolve erro — devolve
  // lista vazia, como se a tabela estivesse zerada. Sem esta guarda, o dia em
  // que o RLS entrar em cena com a politica errada o app apagaria a oficina
  // inteira da tela e trataria isso como a verdade. Pior: `gerarNumeroOS`
  // voltaria a contar do #1 e colidiria com OS existentes e invisiveis.
  //
  // Nenhuma dessas tabelas vai de N linhas para zero na operacao normal —
  // ninguem apaga todos os clientes de uma vez. Entao zero vindo depois de ter
  // dado é sintoma, nao dado. Na duvida, mantem o que ja estava na tela.
  function tabelaVazioSuspeito(table, data) {
    if (data.length > 0) return false
    const atual = r.current[refDaTabela[table]]
    if (!Array.isArray(atual) || atual.length === 0) return false
    console.error(`[${table}] o servidor devolveu lista VAZIA para uma tabela que tinha ${atual.length} linhas — ignorando para nao apagar a tela`)
    setLeituraSuspeita(true)
    return true
  }

  // Releitura sob demanda — o Modo TV usa como rede de segurança caso o Realtime caia.
  // Devolve true se conseguiu falar com o servidor.
  async function sincronizarOrdens() {
    const data = await loadTable('ordens')
    if (data === null) return false
    if (pendingWrites.current['ordens'] > 0) return true
    if (tabelaVazioSuspeito('ordens', data)) return false
    aplicarTabela.ordens(data)
    marcarSync()
    return true
  }

  function marcarGravando(table) {
    pendingWrites.current[table] = (pendingWrites.current[table] || 0) + 1
  }
  function fimGravando(table) {
    pendingWrites.current[table] = Math.max(0, (pendingWrites.current[table] || 0) - 1)
    if (pendingWrites.current[table] > 0) return
    // Última gravação terminou: aplica os eventos que chegaram no meio (inclui
    // o eco da própria gravação, já mesclado pelo banco)…
    const fila = eventosAdiados.current[table]
    if (fila && fila.length > 0) {
      for (const p of fila.splice(0)) aplicarEventoAgora(table, p)
    }
    // …e, se algo pediu recarga completa, ela corrige qualquer resto
    if (reloadPendente.current[table]) {
      reloadPendente.current[table] = false
      recarregarTabela(table)
    }
  }

  // ── Gravação: mescla + retentativa + fila de falhas ────────────────────────
  const [gravacaoPendente, setGravacaoPendente] = useState(0)
  const [falhaDePermissao, setFalhaDePermissao] = useState(false)
  const [pendenciaAntiga, setPendenciaAntiga] = useState(false)
  const [leituraSuspeita, setLeituraSuspeita] = useState(false)
  const filaFalhas = useRef([])      // gravações que falharam mesmo após retentativas
  const drenandoFila = useRef(false)
  const filasEscrita = useRef({})    // serializa as gravações por tabela
  const ultimaSyncRef = useRef(Date.now())
  const jaConectou = useRef(false)

  function marcarSync() {
    ultimaSyncRef.current = Date.now()
    setUltimaSync(Date.now())
  }

  // `error: null` NÃO quer dizer que gravou.
  //
  // O Postgres trata recusa por permissão de duas formas opostas: INSERT que
  // viola a política levanta erro 42501, mas UPDATE e DELETE cuja linha a
  // política esconde afetam ZERO linhas e voltam limpos, sem erro nenhum. Um
  // SELECT filtrado, idem: devolve lista vazia como se a tabela estivesse
  // vazia. Enquanto o banco está sem RLS isso não acontece, mas o dia em que
  // ligarmos, o sistema inteiro passaria a registrar sucesso em gravação que
  // não existiu — e a tela continuaria mostrando o dado como salvo.
  //
  // A defesa é encadear `.select('id')`: o Postgres garante que linha devolvida
  // por RETURNING nunca é silenciosamente descartada — ou ela volta, ou é erro.
  // Então contar o que voltou é a única confirmação confiável de que gravou.
  const MOTIVO = { OK: 'ok', PERMISSAO: 'permissao', REDE: 'rede', PARCIAL: 'parcial', PERMANENTE: 'permanente' }

  // Depois deste tempo a pendência para de ser reenviada sozinha: reenviar a
  // foto de ontem por cima do trabalho de hoje é pior do que perdê-la.
  const LIMITE_REENVIO_MS = 6 * 60 * 60 * 1000
  // A fila em memória também precisa de teto: sem drenagem (rede morta, aba em
  // segundo plano) ela cresce carregando o conteúdo inteiro de cada linha.
  const TETO_FILA_MEMORIA = 500
  // Erros que retentativa NUNCA conserta. Sem esta lista eles ficavam morando
  // na fila para sempre, retentados a cada 30s, com a tarja vermelha eterna
  // mandando "verifique a internet" para um problema que não é de internet.
  // PGRST205/42P01 (tabela inexistente ou fora do cache de schema) entram aqui, e
  // não em "recusa de permissão": a mensagem ao operador é outra — não é que o
  // servidor negou, é que o sistema está apontando para algo que não existe.
  // Confirmado no navegador: tabela inexistente devolve `PGRST205`.
  const ERROS_PERMANENTES = ['23505', '22P02', '23503', '23502', '21000', '22001', 'PGRST205', '42P01', 'PGRST204']

  function guardarConfigLocal(cfg) {
    try { localStorage.setItem('config-oficina', JSON.stringify(cfg)) } catch { /* cota cheia: o cache é dispensável */ }
  }

  // Recusa de permissão não melhora tentando de novo: as 3 tentativas só
  // atrasam o aviso ao operador em ~2s e escondem o diagnóstico verdadeiro.
  //
  // A forma do erro foi conferida no navegador, contra o banco real: o objeto
  // que o supabase-js devolve tem SOMENTE `code`, `details`, `hint` e `message`
  // — não existe `error.status`. Testar status era código morto que nunca
  // disparava. Vale sempre olhar o `code`.
  function ehRecusaDePermissao(error) {
    if (!error) return false
    // 42501 = violação de política (RLS) ou privilégio insuficiente.
    // PGRST301/302 = JWT expirado ou requisição sem autenticação válida.
    if (['42501', 'PGRST301', 'PGRST302'].includes(error.code)) return true
    // Rede de segurança: se a mensagem fala em RLS, é recusa, seja qual for o código.
    return typeof error.message === 'string' && error.message.toLowerCase().includes('row-level security')
  }

  async function gravarComRetry(tabela, rows) {
    let ultimo = null
    for (let t = 0; t < 3; t++) {
      try {
        const { data, error } = await supabase.from(tabela).upsert(rows).select('id')
        if (error) {
          ultimo = error
          if (ehRecusaDePermissao(error)) {
            console.error(`[${tabela}] upsert recusado por permissão:`, error)
            return { ok: false, motivo: MOTIVO.PERMISSAO, erro: error }
          }
          if (ERROS_PERMANENTES.includes(error.code)) {
            console.error(`[${tabela}] upsert com erro permanente (${error.code}) — não adianta retentar:`, error)
            return { ok: false, motivo: MOTIVO.PERMANENTE, erro: error }
          }
        } else if ((data?.length ?? 0) < rows.length) {
          // Sem erro e com menos linhas do que mandamos: recusa silenciosa.
          console.error(`[${tabela}] upsert gravou ${data?.length ?? 0} de ${rows.length} linhas`)
          return { ok: false, motivo: MOTIVO.PARCIAL, erro: null }
        } else {
          return { ok: true, motivo: MOTIVO.OK }
        }
      } catch (e) { ultimo = e }
      if (t < 2) await new Promise(r => setTimeout(r, 700 * (t + 1)))
    }
    console.error(`[${tabela}] upsert falhou após 3 tentativas:`, ultimo)
    return { ok: false, motivo: MOTIVO.REDE, erro: ultimo }
  }

  // Envia movimentos de kardex para a função `registrar_movimentos` do banco,
  // que grava extrato + saldo numa transação só. Retentar é SEGURO: cada
  // movimento carrega um uuid e o banco ignora id repetido sem somar de novo.
  async function enviarMovimentos(rows) {
    let ultimo = null
    for (let t = 0; t < 3; t++) {
      try {
        const { data, error } = await supabase.rpc('registrar_movimentos', { movs: rows })
        if (error) {
          ultimo = error
          if (ehRecusaDePermissao(error)) {
            console.error('[estoque_mov] movimento recusado por permissão:', error)
            return { ok: false, motivo: MOTIVO.PERMISSAO, erro: error }
          }
          if (ERROS_PERMANENTES.includes(error.code)) {
            console.error(`[estoque_mov] movimento com erro permanente (${error.code}):`, error)
            return { ok: false, motivo: MOTIVO.PERMANENTE, erro: error }
          }
        } else {
          // A função responde por item. Item rejeitado ('movimento incompleto')
          // ou peça que já não existe ('pecaAusente') não melhora com reenvio —
          // fica registrado no console para não sumir em silêncio.
          const resultados = Array.isArray(data?.resultados) ? data.resultados : []
          for (const it of resultados) {
            if (it && it.ok === false) console.error('[estoque_mov] movimento rejeitado pelo banco:', it)
            else if (it && it.pecaAusente) console.warn('[estoque_mov] movimento registrado para peça que não existe mais (saldo não alterado):', it)
          }
          return { ok: true, motivo: MOTIVO.OK, resposta: data }
        }
      } catch (e) { ultimo = e }
      if (t < 2) await new Promise(r => setTimeout(r, 700 * (t + 1)))
    }
    console.error('[estoque_mov] movimento falhou após 3 tentativas:', ultimo)
    return { ok: false, motivo: MOTIVO.REDE, erro: ultimo }
  }

  // Pendência VELHA de estoque não pode reenviar a foto do saldo: entre a falha
  // e o reenvio, o kardex pode ter movimentado a peça no servidor. Relê cada
  // linha e mantém o saldo do banco (mesma regra do mesclarPeca).
  async function remesclarRowsEstoque(rows) {
    const saida = []
    for (const row of rows) {
      const resp = await supabase.from('estoque').select('data').eq('id', String(row.id)).maybeSingle()
      if (resp.error) throw resp.error
      const rem = resp.data?.data
      // Linha existe: saldo do banco. Linha não existe: saldo zero — o saldo
      // dela chega pelo movimento que está na mesma fila (ou já chegou, e aí a
      // linha existiria). A foto local pode trazer o delta já aplicado na tela.
      const data = rem
        ? { ...row.data, estoque: rem.estoque !== undefined ? rem.estoque : 0 }
        : { ...row.data, estoque: 0 }
      saida.push({ id: String(row.id), data })
    }
    return saida
  }

  async function apagarComRetry(tabela, id) {
    let ultimo = null
    for (let t = 0; t < 3; t++) {
      try {
        const { data, error } = await supabase.from(tabela).delete().eq('id', id).select('id')
        if (error) {
          ultimo = error
          if (ehRecusaDePermissao(error)) {
            console.error(`[${tabela}] delete recusado por permissão:`, error)
            return { ok: false, motivo: MOTIVO.PERMISSAO, erro: error }
          }
        } else if ((data?.length ?? 0) > 0) {
          return { ok: true, motivo: MOTIVO.OK }
        } else {
          // Zero linhas apagadas é ambíguo: ou outro aparelho já apagou (e o
          // estado desejado já vale), ou a política escondeu a linha e ela
          // continua lá. Só uma releitura distingue os dois casos.
          const { data: ainda, error: erroLeitura } = await supabase
            .from(tabela).select('id').eq('id', id).maybeSingle()
          if (erroLeitura) { ultimo = erroLeitura }
          else if (!ainda) return { ok: true, motivo: MOTIVO.OK }
          else {
            console.error(`[${tabela}] delete não apagou a linha ${id} e ela continua no banco`)
            return { ok: false, motivo: MOTIVO.PERMISSAO, erro: null }
          }
        }
      } catch (e) { ultimo = e }
      if (t < 2) await new Promise(r => setTimeout(r, 700 * (t + 1)))
    }
    console.error(`[${tabela}] delete falhou após 3 tentativas:`, ultimo)
    return { ok: false, motivo: MOTIVO.REDE, erro: ultimo }
  }

  // O aviso na tela dizia sempre "verifique a internet". Quando a causa é
  // permissão, isso manda a oficina reiniciar o roteador atrás de um problema
  // que está no banco — por isso a pendência agora carrega o motivo.
  function registrarFalha(pendencia) {
    const p = {
      motivo: MOTIVO.REDE,
      ...pendencia,
      // `filaGravacao` decide o que enviar pelo `tipo`; sem ele, uma exclusão
      // pendente seria lida como gravação sem linhas e descartada em silêncio.
      // Tipo explícito (ex.: 'movimento' do kardex) vence a derivação.
      tipo: pendencia.tipo || (pendencia.delId != null ? 'apagar' : 'gravar'),
      criadoEm: Date.now(),
    }
    filaFalhas.current.push(p)
    // Teto na fila de memória: com a rede morta e a drenagem parada, ela crescia
    // sem limite carregando o conteúdo inteiro de cada linha. O disco já tinha
    // teto; a memória não tinha nenhum.
    if (filaFalhas.current.length > TETO_FILA_MEMORIA) {
      filaFalhas.current = filaFalhas.current.slice(-TETO_FILA_MEMORIA)
    }
    setGravacaoPendente(filaFalhas.current.length)
    if (p.motivo === MOTIVO.PERMISSAO || p.motivo === MOTIVO.PARCIAL) {
      setFalhaDePermissao(true)
    }
    // Espelha em disco. Antes a fila vivia só neste useRef: fechar a aba —
    // que é exatamente o que se faz ao fim do expediente — apagava para sempre
    // tudo que ainda não tinha chegado ao banco.
    //
    // `caixa_turno` fica de FORA de propósito. É linha única e o pendente dela
    // é destrutivo: um "apagar caixa-turno" que ficou de ontem, reenviado hoje
    // de manhã, apagaria o turno NOVO com as vendas do dia — justamente o
    // desastre que a guarda de `next === null && prev === null` impede. Em
    // memória ela continua sendo retentada durante a sessão, que é onde a
    // retentativa faz sentido.
    if (p.tabela !== 'caixa_turno') enfileirarPendencia(p)
  }

  async function tentarFila() {
    if (drenandoFila.current) return
    drenandoFila.current = true
    try {
      // Junta o que está na memória com o que sobreviveu em disco de uma sessão
      // anterior, e deduplica por LINHA — não por pendência. A diferença não é
      // acadêmica: uma pendência com as linhas [A,B] e outra só com [A] têm
      // conjuntos diferentes, então uma chave feita com os ids grudados deixaria
      // as duas passarem, e o A velho voltaria por cima do A novo.
      const daMemoria = filaFalhas.current.splice(0)
      const doDisco = await listarPendencias()
      const todas = dedupPendencias([...doDisco, ...daMemoria])

      // Pendência velha NÃO é reenviada às cegas.
      //
      // Persistir a fila em disco criou um risco que não existia quando ela
      // morria com a aba: a foto de uma OS tirada ontem às 18h, reenviada hoje
      // às 8h, sobe crua por cima do que a recepção gravou de manhã — e este
      // caminho passa por fora da mescla de OS, então o trabalho novo some sem
      // erro nenhum na tela. Depois de um limite, a pendência para de ser
      // reenviada sozinha e passa a ser problema visível, para uma pessoa
      // decidir. Perder trabalho de ontem é ruim; apagar o de hoje é pior.
      const agora = Date.now()
      const pendentes = []
      for (const p of todas) {
        // Erro permanente (chave duplicada, tipo inválido, payload grande
        // demais) não melhora na centésima tentativa — só mantém a tarja acesa
        // para sempre e ocupa vaga contra o teto da fila.
        // O limite de idade existe para FOTO (gravar a linha inteira por cima de
        // dado mais novo). Movimento de kardex é delta com uuid: reenviar a
        // qualquer hora é seguro — o banco soma uma vez só. Aposentar uma baixa
        // de sexta na segunda deixaria o saldo errado para sempre.
        const ehFoto = p.tipo !== 'movimento'
        const paraDeTentar = p.motivo === MOTIVO.PERMANENTE ||
                             (ehFoto && agora - (p.criadoEm || 0) > LIMITE_REENVIO_MS)
        if (paraDeTentar) filaFalhas.current.push(p)
        else pendentes.push(p)
      }

      for (const p of pendentes) {
        let ok = true
        if (p.tipo === 'apagar') {
          for (const id of p.ids) {
            const res = await apagarComRetry(p.tabela, id)
            if (!res.ok) { ok = false; p.motivo = res.motivo }
          }
        } else if (p.tipo === 'movimento') {
          // Kardex: vai para a função do banco, nunca para upsert — o uuid de
          // cada movimento garante que reenviar não soma o saldo duas vezes.
          const res = await enviarMovimentos(p.rows)
          if (!res.ok) { ok = false; p.motivo = res.motivo }
          else aplicarSaldoDoServidor(res.resposta)
        } else if (p.tabela === 'estoque') {
          // Foto de peça reenviada depois não pode restaurar saldo velho por
          // cima do que o kardex já somou no servidor: relê e mantém o saldo
          // do banco. Se a releitura falhar, adia — nunca grava às cegas.
          try {
            const rows = await remesclarRowsEstoque(p.rows)
            const res = await gravarComRetry(p.tabela, rows)
            if (!res.ok) { ok = false; p.motivo = res.motivo }
          } catch (e) {
            console.error('[estoque] releitura para reenvio falhou — pendência adiada:', e)
            ok = false
            p.motivo = MOTIVO.REDE
          }
        } else {
          const res = await gravarComRetry(p.tabela, p.rows)
          if (!res.ok) { ok = false; p.motivo = res.motivo }
        }
        if (ok) {
          // O `criadoEm` é a trava: se a mesma linha falhou de novo enquanto
          // esta ia para o banco, a versão nova fica e não é apagada junto.
          await removerPendencia(p.id, p.criadoEm)
          // A config só vira verdade para a impressão depois de o servidor
          // aceitar — e `print.js` lê justamente esta cópia local. Sem esta
          // linha, uma config reenviada pela fila subia para o banco e o papel
          // continuava saindo com o texto velho até alguém recarregar a página.
          if (p.tabela === 'configuracoes' && p.rows?.[0]?.data) guardarConfigLocal(p.rows[0].data)
        } else {
          filaFalhas.current.push(p)
        }
      }
      setGravacaoPendente(filaFalhas.current.length)
      // Derivado do que REALMENTE ficou na fila, e não de uma variável do laço:
      // uma pendência registrada no meio da drenagem não entra em `pendentes`,
      // e zerar a bandeira por causa dela fazia a tarja voltar a dizer
      // "verifique a internet" para uma recusa do servidor.
      setFalhaDePermissao(filaFalhas.current.some(p => p.motivo === MOTIVO.PERMISSAO || p.motivo === MOTIVO.PARCIAL))
      setPendenciaAntiga(filaFalhas.current.some(p =>
        p.motivo === MOTIVO.PERMANENTE || (p.tipo !== 'movimento' && agora - (p.criadoEm || 0) > LIMITE_REENVIO_MS)))
    } finally {
      drenandoFila.current = false
    }
  }

  // Duas gravações rápidas do MESMO navegador não podem correr em paralelo:
  // a segunda releria o banco antes de a primeira terminar e a mescla
  // descartaria o que a primeira acabou de adicionar.
  function encadearEscrita(tabela, tarefa) {
    const anterior = filasEscrita.current[tabela] || Promise.resolve()
    const proxima = anterior.then(tarefa, tarefa)
    filasEscrita.current[tabela] = proxima.catch(() => {})
    return proxima
  }

  function supabaseDiff(tableName, prev, next) {
    return encadearEscrita(tableName, () => executarDiff(tableName, prev, next))
  }

  async function executarDiff(tableName, prev, next) {
    const resultado = { ok: true }
    const prevMap = new Map(prev.map(i => [String(i.id), i]))
    const nextMap = new Map(next.map(i => [String(i.id), i]))

    const paraGravar = []
    for (const [id, item] of nextMap) {
      if (!prevMap.has(id) || JSON.stringify(prevMap.get(id)) !== JSON.stringify(item)) {
        paraGravar.push(item)
      }
    }
    if (paraGravar.length > 0) {
      let rows
      if (tableName === 'ordens' || tableName === 'estoque') {
        // Relê a linha atual e mescla: o que outro navegador gravou nesse meio
        // tempo sobrevive junto com o que este navegador está gravando agora.
        // Para 'estoque' a regra é mais curta: o cadastro vale o local, mas o
        // SALDO é sempre o do banco — desde o kardex, saldo só muda por soma
        // no servidor, nunca por foto (mesclarPeca).
        rows = []
        for (const item of paraGravar) {
          const id = String(item.id)
          // O `error` desta releitura era DESCARTADO e o catch estava vazio.
          // Consequencia: se a leitura falhasse, o codigo caia calado na foto
          // local e a gravacao apagava o que outro aparelho tinha acabado de
          // fazer — exatamente o que a mescla existe para impedir. Ela nao pode
          // falhar em silencio: sem poder mesclar, e melhor nao gravar e deixar
          // a fila tentar de novo quando der para ler.
          let rem = null
          let erroLeitura
          try {
            const resp = await supabase.from(tableName).select('data').eq('id', id).maybeSingle()
            rem = resp.data
            erroLeitura = resp.error
          } catch (e) { erroLeitura = e }

          if (erroLeitura) {
            console.error(`[${tableName}] nao consegui reler a linha ${id} para mesclar — gravacao adiada para nao apagar o trabalho de outro aparelho:`, erroLeitura)
            registrarFalha({ tabela: tableName, rows: [item2row(item)], motivo: MOTIVO.REDE })
            resultado.ok = false
            continue
          }
          if (rem?.data) {
            if (tableName === 'ordens') {
              // A regra de estoque rodou sobre a foto LOCAL. A linha que vai
              // ao banco é a MESCLA — pode trazer status aprovado por outro
              // aparelho junto com um item que só este aparelho conhece.
              // Reaplica a regra sobre (banco → mescla): o que faltar baixar
              // sai aqui mesmo; o que já saiu tem chave igual e o banco ignora.
              let mesclada = mesclarOrdem(prevMap.get(id), item, rem.data)
              const custoDe = (produtoId) => r.current.estoque.find(p => String(p.id) === String(produtoId))?.precoCusto
              const { osDepois, movimentos } = derivarMovimentosDaOS({ id: item.id, ...rem.data }, { id: item.id, ...mesclada }, custoDe)
              if (movimentos.length > 0) {
                movimentarEstoque(movimentos)
                const { id: _id, ...semId } = osDepois
                mesclada = semId
              }
              rows.push({ id, data: mesclada })
            } else {
              rows.push({ id, data: mesclarPeca(item, rem.data) })
            }
          } else if (tableName === 'estoque') {
            // Peça NOVA no banco nasce com saldo zero, sempre: todo saldo
            // legítimo chega por movimento (saldo_inicial, entrada_compra).
            // A foto local pode já carregar o delta aplicado na tela — gravá-lo
            // aqui e somá-lo de novo pelo movimento contaria em dobro.
            const linha = item2row(item)
            rows.push({ id, data: { ...linha.data, estoque: 0 } })
          } else {
            rows.push(item2row(item))
          }
        }
      } else {
        rows = paraGravar.map(item2row)
      }
      // `rows` pode ter ficado vazio se todas as OS foram adiadas por falha de
      // leitura acima — nao ha o que gravar, e um upsert vazio so gastaria rede.
      if (rows.length > 0) {
        // Nome `res`, nao `r`: `r` e o useRef que guarda o estado inteiro do
        // app. Sombrear ele aqui e uma armadilha para quem mexer nesse bloco.
        const res = await gravarComRetry(tableName, rows)
        if (!res.ok) registrarFalha({ tabela: tableName, rows, motivo: res.motivo })
        resultado.ok = resultado.ok && res.ok
      }
    }

    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        const res = await apagarComRetry(tableName, id)
        if (!res.ok) registrarFalha({ tabela: tableName, delId: id, motivo: res.motivo })
        resultado.ok = resultado.ok && res.ok
      }
    }
    // Quem chamou precisa poder saber se gravou — sem isto, operação crítica
    // (fechar caixa, entregar OS) não tem como esperar confirmação.
    return resultado
  }

  // Tela que passou tempo em segundo plano (celular no bolso) fica congelada no
  // passado: o realtime não reenvia o que se perdeu. Ao acordar ou reconectar,
  // esvazia a fila de falhas e relê tudo.
  async function ressincronizar() {
    await tentarFila()
    const tabelas = [...Object.keys(aplicarTabela), 'caixa_turno', 'configuracoes']
    for (const t of tabelas) {
      try { await recarregarTabela(t) } catch (e) { console.error(`[ressync ${t}]`, e) }
    }
  }

  // Sobe para o banco o que ficou preso no localStorage deste aparelho.
  //
  // Roda uma vez só, e só quando a tabela está vazia: se dois celulares tivessem
  // listas diferentes e ambos subissem, o custo fixo apareceria dobrado. O
  // primeiro que abrir leva os dados dele; os outros passam a ler do banco.
  function migrarDoNavegador(tabela, dadosDoBanco, setter, exemplosParaIgnorar) {
    const marca = `migracao-${tabela}-supabase`
    if (localStorage.getItem(marca)) return
    if (dadosDoBanco === null) return            // falha de rede: tenta na próxima vez
    if ((dadosDoBanco || []).length > 0) { localStorage.setItem(marca, '1'); return }

    let locais
    try { locais = JSON.parse(localStorage.getItem(tabela) || '[]') } catch { locais = [] }
    if (!Array.isArray(locais)) locais = []

    // Descarta os dados de exemplo que vinham no código — mas só se ainda
    // estiverem intactos. Se o valor foi editado, virou custo real da oficina e
    // sobe junto: filtrar só pelo nome jogaria fora o aluguel de verdade.
    const paraSubir = locais.filter(item => {
      const nome = String(item?.descricao || item?.nome || '').trim()
      if (!nome) return false
      const exemplo = exemplosParaIgnorar.find(e => e.nome === nome)
      if (!exemplo) return true
      return String(item?.valor ?? item?.custo ?? '').trim() !== exemplo.valor
    })
    if (paraSubir.length === 0) { localStorage.setItem(marca, '1'); return }

    // Id derivado do CONTEÚDO, não de `gerarId()`.
    //
    // Amanhã de manhã a recepção, o celular e o tablet abrem o sistema quase ao
    // mesmo tempo. Os três leem a tabela vazia antes de qualquer um ter subido, e
    // os três migram. Com id sorteado, o mesmo aluguel viraria três linhas e o
    // custo fixo triplicaria — silenciosamente, contaminando ponto de equilíbrio,
    // custo da hora e DRE. Com id do conteúdo, o segundo aparelho grava por cima
    // do primeiro: a lista converge em vez de acumular.
    //
    // Valores diferentes para o mesmo nome continuam virando linhas distintas —
    // aí são dois cadastros divergentes de verdade, e quem decide é o dono.
    const chaveDoItem = (item) => {
      const nome = String(item?.descricao || item?.nome || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      const valor = String(item?.valor ?? item?.custo ?? '').trim().replace(/[^0-9,.]/g, '')
      return `mig-${nome}-${valor}`
    }
    const normalizados = paraSubir.map(item => ({ ...item, id: chaveDoItem(item) }))
    r.current[tabela] = normalizados
    setter(normalizados)
    marcarGravando(tabela)
    // A marca NÃO é gravada aqui de propósito. `supabaseDiff` resolve mesmo
    // quando o upsert falha (a falha vai para a fila em memória, que se perde ao
    // fechar a aba) — gravar a marca aqui queimava a única chance de migrar e o
    // custo fixo ficava preso no navegador para sempre. Na próxima abertura,
    // se os dados chegaram, a tabela vem preenchida e a marca é gravada no
    // caminho de cima; se não chegaram, tenta de novo.
    supabaseDiff(tabela, [], normalizados)
      .catch(e => console.error(`[migração ${tabela}]`, e))
      .finally(() => fimGravando(tabela))
  }

  // Carrega os dados DEPOIS de alguem entrar — nunca antes.
  //
  // Isto era um vazamento pela porta da frente: o provedor carregava as 17
  // tabelas ao montar, e ele monta na tela de LOGIN. Medido no site publicado:
  // abrir o endereco da oficina, sem digitar nada, baixava clientes com CPF,
  // financeiro, caixa e a tabela de funcionarios. Qualquer pessoa, so por
  // conhecer o endereco.
  //
  // Carregar so com usuario tambem e o que a tranca do banco vai exigir: sem
  // sessao, a leitura volta vazia, e lista vazia neste sistema tem efeito ruim.
  const jaCarregou = useRef(false)
  useEffect(() => {
    // Tela do cliente: nao le nada e nao assina realtime.
    if (ehTelaDoCliente()) return
    if (!currentUser) return
    // Trocar de usuario nao recarrega: seriam ~30s de espera a cada troca de
    // mao no tablet, e a equipe passaria a deixar um so logado o dia todo.
    if (jaCarregou.current) return
    jaCarregou.current = true

    async function init() {
      const [
        clientesData, veiculosData, ordensData, estoqueData, financeiroData,
        agendaData, funcionariosData, servicosData, checklistsData, orcamentosData,
        comprasData, fornecedoresData, caixaHistoricoData, gastosData, insumosData,
      ] = await Promise.all([
        loadTable('clientes'), loadTable('veiculos'), loadTable('ordens'),
        loadTable('estoque'), loadTable('financeiro'), loadTable('agenda'),
        loadTable('funcionarios'), loadTable('servicos'), loadTable('checklists'),
        loadTable('orcamentos'), loadTable('compras'), loadTable('fornecedores'),
        loadTable('caixa_historico'), loadTable('gastos'), loadTable('insumos'),
      ])

      r.current.clientes      = clientesData || []
      r.current.veiculos      = veiculosData || []
      r.current.ordens        = ordensData || []
      r.current.estoque       = estoqueData || []
      r.current.financeiro    = financeiroData || []
      r.current.agenda        = agendaData || []
      r.current.funcionarios  = funcionariosData || []
      // `loadTable` devolve null so em FALHA (lista vazia vem como []). Marcar
      // aqui e o que separa "nao ha funcionarios" de "nao consegui ler".
      if (funcionariosData !== null) setFuncionariosCarregados(true)
      r.current.servicos      = servicosData || []
      r.current.checklists    = checklistsData || []
      r.current.orcamentos    = orcamentosData || []
      r.current.compras       = comprasData || []
      r.current.fornecedores  = fornecedoresData || []
      r.current.caixaHistorico = caixaHistoricoData || []
      r.current.gastos        = gastosData || []
      r.current.insumos       = insumosData || []

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
      _setGastos(r.current.gastos)
      _setInsumos(r.current.insumos)

      // Resgate único do que ficou preso no localStorage deste aparelho. Só sobe
      // se a tabela no banco estiver vazia — senão duplicaria em cada celular
      // que abrisse o sistema. Os dados de exemplo que vinham no código
      // ("Terreno", "Água da empresa", "Sabão") não sobem: eram teste, não custo.
      migrarDoNavegador('gastos', gastosData, _setGastos,
        [{ nome: 'Terreno', valor: '4.000,00' }, { nome: 'Água da empresa', valor: '110,00' }])
      migrarDoNavegador('insumos', insumosData, _setInsumos,
        [{ nome: 'Sabão', valor: '10,00' }])

      // Migração Opção C: incorpora dados de checklists existentes nas OS (roda 1x)
      if (!localStorage.getItem('migracao-opcao-c-done') && checklistsData?.length) {
        const promessasMigracao = []
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
          promessasMigracao.push(
            supabaseDiff('ordens', ordensData || [], ordensAtualizadas)
              .catch(e => { console.error(e); return { ok: false } })
              .finally(() => fimGravando('ordens'))
          )
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
          promessasMigracao.push(
            supabaseDiff('checklists', checklistsData, checklistsAtualizados)
              .catch(e => { console.error(e); return { ok: false } })
              .finally(() => fimGravando('checklists'))
          )
        }
        // A marca so e gravada se as gravacoes confirmaram. Antes ela era
        // escrita incondicionalmente e sem esperar por elas: se a migracao
        // falhasse, ela se dava por concluida e NUNCA MAIS rodava — perda
        // irreversivel das OS criadas a partir das fichas e do vinculo entre
        // elas. E roda uma vez so, na primeira abertura apos a mudanca.
        const resMigracao = await Promise.all(promessasMigracao)
        if (resMigracao.every(x => x?.ok !== false)) {
          localStorage.setItem('migracao-opcao-c-done', '1')
        } else {
          console.error('[migracao opcao C] nao confirmada pelo servidor — sera tentada de novo na proxima abertura')
        }
      }

      // Libera UI imediatamente — dados principais já estão prontos
      setCarregando(false)

      // caixa_turno e configuracoes carregam em segundo plano sem bloquear a UI.
      //
      // Se a leitura do turno FALHAR, `caixaCarregado` continua false de
      // propósito. Marcar "carregado" com turno nulo faz a tela do Caixa
      // oferecer o botão "Abrir Caixa" no meio do expediente — e um clique ali
      // sobrescreve o turno real, com as vendas do dia inteiro. Ficar em
      // "Carregando…" atrapalha; abrir um turno por cima destrói o dia.
      let turnoOk = false
      try {
        const { data: turnoRows, error: turnoErr } = await supabase
          .from('caixa_turno').select('id, data').eq('id', 'caixa-turno')
        if (turnoErr) console.error('[caixa_turno] Erro ao carregar:', turnoErr)
        else {
          const turno = turnoRows?.[0] ? { id: 'caixa-turno', ...turnoRows[0].data } : null
          r.current.caixaTurno = turno
          _setCaixaTurno(turno)
          turnoOk = true
        }
      } catch (e) { console.error('[caixa_turno] Erro:', e) }
      if (turnoOk) setCaixaCarregado(true)
      else {
        // Tenta de novo em segundo plano até conseguir — sem isso a tela ficaria
        // presa em "Carregando…" para sempre depois de um piscar de internet.
        const retentar = async () => {
          try {
            const { data, error } = await supabase.from('caixa_turno').select('id, data').eq('id', 'caixa-turno')
            if (error) return false
            const turno = data?.[0] ? { id: 'caixa-turno', ...data[0].data } : null
            r.current.caixaTurno = turno
            _setCaixaTurno(turno)
            setCaixaCarregado(true)
            return true
          } catch { return false }
        }
        for (let t = 0; t < 5; t++) {
          await new Promise(res => setTimeout(res, 2000 * (t + 1)))
          if (await retentar()) break
        }
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // Sincronização em tempo real via Supabase Realtime.
  // O evento traz a linha alterada e só ela é aplicada (realtime cirúrgico) —
  // rebaixar a tabela inteira a cada evento foi o que estourou a cota de
  // tráfego. Eventos durante gravação local vão para a fila (ver receberEvento).
  useEffect(() => {
    // Tela do cliente nao assina realtime: seria manter um socket aberto no
    // celular dele recebendo evento de OS, caixa e estoque da oficina inteira.
    if (ehTelaDoCliente()) return

    const ch = supabase.channel('app-realtime')

    for (const table of Object.keys(aplicarTabela)) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        receberEvento(table, payload)
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
      if (status === 'SUBSCRIBED') {
        marcarSync()
        // Reconexão (não a primeira): os eventos perdidos durante a queda não
        // são reenviados — sem reler tudo, a tela seguiria congelada no passado.
        if (jaConectou.current) ressincronizar()
        jaConectou.current = true
      }
    })

    return () => { supabase.removeChannel(ch) }
  }, [])

  // Ao abrir o app, traz do disco o que ficou pendente da sessão anterior.
  //
  // Sem isto o arquivo de fila persistida não servia para nada: os três
  // gatilhos de `tentarFila` (timer de 30s, aba voltando ao foco, reconexão do
  // realtime) são todos condicionados à fila EM MEMÓRIA, que no boot está
  // vazia. Resultado: sexta-feira fecha com 6 OS pendentes, segunda o app abre
  // com a tarja apagada e nada é reenviado.
  //
  // Quem faz isso e a propria drenagem, e nao uma copia da logica aqui. A
  // primeira versao lia o disco e fazia `filaFalhas.current = ...` — uma
  // ATRIBUICAO sobre uma foto tirada antes. Rodando junto com o "acordar" (que
  // dispara quase no mesmo instante da abertura), ela sobrescrevia o resultado
  // da drenagem em curso: as marcas de motivo recem-calculadas eram apagadas e
  // o aviso na tela ficava um ciclo atrasado. Pior: pendencia ja enviada e
  // removida do disco ressuscitava daquela foto e era enviada de novo.
  //
  // `tentarFila` ja le o disco, mescla com a memoria, respeita o limite de
  // idade, acende a tarja e tem trava contra execucao concorrente.
  useEffect(() => {
    tentarFila()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Acordou (aba voltou do segundo plano / internet voltou) → esvazia a fila de
  // falhas e, se está sem sincronizar há mais de 30s, relê tudo antes que
  // alguém grave por cima com uma tela velha.
  useEffect(() => {
    const aoAcordar = () => {
      if (document.visibilityState === 'hidden') return
      const dessincronizado = Date.now() - ultimaSyncRef.current > 30000
      if (!dessincronizado && filaFalhas.current.length === 0) return
      ressincronizar()
    }
    document.addEventListener('visibilitychange', aoAcordar)
    window.addEventListener('online', aoAcordar)
    const timer = setInterval(() => { if (filaFalhas.current.length > 0) tentarFila() }, 30000)
    return () => {
      document.removeEventListener('visibilitychange', aoAcordar)
      window.removeEventListener('online', aoAcordar)
      clearInterval(timer)
    }
  }, [])

  // Factory de setter com atualização otimista + persistência Supabase
  function makeSet(tableName, refKey, setter) {
    return (valOrFn) => {
      const prev = r.current[refKey]
      const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
      r.current[refKey] = next
      setter(next)
      marcarGravando(tableName)
      // Devolve a promessa da gravação. A maioria dos chamadores ignora — a
      // tela continua otimista, como sempre foi. Mas operação crítica (fechar
      // caixa, entregar OS, baixar peça) agora TEM como esperar a confirmação
      // do banco em vez de acreditar no próprio otimismo.
      return supabaseDiff(tableName, prev, next)
        .catch(e => { console.error(e); return { ok: false, motivo: MOTIVO.REDE } })
        .finally(() => fimGravando(tableName))
    }
  }

  const setClientes     = makeSet('clientes',        'clientes',      _setClientes)
  const setVeiculos     = makeSet('veiculos',         'veiculos',      _setVeiculos)
  // setOrdens NÃO é um makeSet comum: toda escrita de OS passa pela regra de
  // estoque (utils/reserva.js) — peça em OS antes da aprovação fica reservada,
  // OS aprovada baixa, cancelar/excluir/recusar devolve o que foi baixado. A
  // regra compara a OS antes e depois, carimba as marcas nos itens e dispara
  // os movimentos; não existe mais baixa/estorno escrito à mão em função
  // nenhuma. A promessa devolvida é a da OS; a do estoque vai em `.estoque`.
  const setOrdensBruto  = makeSet('ordens',           'ordens',        _setOrdens)
  function setOrdens(valOrFn) {
    const prev = r.current.ordens
    const next0 = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
    const custoDe = (produtoId) => r.current.estoque.find(p => String(p.id) === String(produtoId))?.precoCusto
    const { next: next1, movimentos } = aplicarRegraNasOrdens(prev, next0, custoDe)
    // Deixa no histórico da OS o que a regra fez com as peças — o extrato do
    // estoque tem o detalhe; aqui é o resumo, do lado de quem abre a OS.
    let next = next1
    if (movimentos.length > 0) {
      const porOS = new Map()
      for (const m of movimentos) {
        const k = String(m.origem?.id)
        const acc = porOS.get(k) || { baixas: 0, estornos: 0, motivo: m.motivo }
        if (m.tipo === 'saida_os') acc.baixas++
        else acc.estornos++
        porOS.set(k, acc)
      }
      next = next1.map(o => {
        const acc = porOS.get(String(o.id))
        if (!acc) return o
        const partes = []
        if (acc.baixas) partes.push(`${acc.baixas} ${acc.baixas === 1 ? 'peça baixada' : 'peças baixadas'} do estoque`)
        if (acc.estornos) partes.push(`${acc.estornos} ${acc.estornos === 1 ? 'peça devolvida' : 'peças devolvidas'} ao estoque`)
        const texto = partes.join(' e ') + (acc.motivo ? ` — ${acc.motivo}` : '')
        return { ...o, historico: [evento(texto), ...(o.historico || [])] }
      })
    }
    const p = setOrdensBruto(next)
    p.estoque = movimentos.length > 0 ? movimentarEstoque(movimentos) : Promise.resolve({ ok: true, vazio: true })
    return p
  }
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
  const setGastos       = makeSet('gastos',           'gastos',        _setGastos)
  const setInsumos      = makeSet('insumos',          'insumos',       _setInsumos)

  // ── KARDEX: a porta única de movimentação de estoque ────────────────────────
  //
  // TODA mudança de saldo passa por aqui. Nada mais escreve `estoque` de peça
  // por setEstoque — o setter continua existindo para o CADASTRO (nome, preço,
  // mínimo...), e a mescla (mesclarPeca) garante que ele nunca leva o saldo.
  //
  // O caminho é deliberadamente diferente do motor de diff:
  // 1. o saldo muda por SOMA no servidor (função registrar_movimentos), nunca
  //    por foto — dois aparelhos ao mesmo tempo somam os dois;
  // 2. cada movimento vira uma linha de extrato que só INSERE, nunca apaga;
  // 3. o uuid do movimento torna o reenvio da fila inofensivo: o banco
  //    reconhece o id e não soma de novo.
  //
  // Aceita um movimento ou uma lista:
  //   { pecaId, qtd (com sinal: entrada +, saída −), tipo, motivo?, origem?,
  //     custoUnit?, criarSeFaltar?, chave? }
  // `chave` (lista de partes) torna o id DETERMINÍSTICO: a mesma ação feita
  // em dois aparelhos gera o mesmo uuid e o banco conta uma vez só. Sem chave,
  // o id é aleatório (ajuste manual, edição de quantidade).
  // Devolve { ok, ... } aguardável — quem é crítico espera, quem não é segue.

  // Efeito imediato na tela: soma o delta no estado local. O servidor é quem
  // soma DE VERDADE; quando ele responde, o saldo dele vence (ver abaixo).
  // Sem trava em zero: saldo negativo é um AVISO de que a prateleira e o
  // sistema divergem — esconder atrás do zero é o que corrompia.
  function aplicarDeltaLocal(rows) {
    const delta = new Map()
    for (const m of rows) delta.set(m.peca_id, (delta.get(m.peca_id) || 0) + m.qtd)
    const atual = r.current.estoque
    let mudou = false
    const next = atual.map(p => {
      const d = delta.get(String(p.id))
      if (!d) return p
      mudou = true
      return { ...p, estoque: (Number(p.estoque) || 0) + d }
    })
    if (mudou) {
      r.current.estoque = next
      _setEstoque(next)
    }
  }

  // Deltas deste aparelho ainda sem resposta do servidor, por peça. Quando o
  // servidor devolve o saldo de um lote, o saldo local vira
  // "saldo do servidor + o que ainda está em voo" — assim a tela converge
  // mesmo se o eco do realtime se perder, sem pisar num movimento posterior.
  const deltasEmVoo = useRef(new Map())

  function somarEmVoo(rows, sinal) {
    for (const m of rows) {
      const k = m.peca_id
      const v = (deltasEmVoo.current.get(k) || 0) + sinal * m.qtd
      if (v === 0) deltasEmVoo.current.delete(k)
      else deltasEmVoo.current.set(k, v)
    }
  }

  function aplicarSaldoDoServidor(resposta) {
    const resultados = Array.isArray(resposta?.resultados) ? resposta.resultados : []
    const saldoPorPeca = new Map()
    for (const m of resultados) {
      if (m && m.ok && typeof m.saldo === 'number' && Number.isFinite(m.saldo)) saldoPorPeca.set(String(m.peca_id), m.saldo)
    }
    if (saldoPorPeca.size === 0) return
    let mudou = false
    const next = r.current.estoque.map(p => {
      const k = String(p.id)
      if (!saldoPorPeca.has(k)) return p
      const alvo = saldoPorPeca.get(k) + (deltasEmVoo.current.get(k) || 0)
      if (Number(p.estoque) === alvo) return p
      mudou = true
      return { ...p, estoque: alvo }
    })
    if (mudou) {
      r.current.estoque = next
      _setEstoque(next)
    }
  }

  function movimentarEstoque(movOuLista) {
    const lista = Array.isArray(movOuLista) ? movOuLista : [movOuLista]
    const rows = []
    for (const m of lista) {
      const qtd = Number(m.qtd)
      if (m.pecaId == null || m.pecaId === '' || !Number.isFinite(qtd) || qtd === 0) continue
      const custo = parseValorBR(m.custoUnit)
      rows.push({
        id: Array.isArray(m.chave) && m.chave.length > 0
          ? idMovimentoDeterministico(...m.chave, String(m.pecaId))
          : novoIdMovimento(),
        peca_id: String(m.pecaId),
        qtd,
        tipo: m.tipo || 'ajuste',
        motivo: m.motivo || '',
        origem_tipo: m.origem?.tipo || '',
        origem_id: m.origem?.id != null ? String(m.origem.id) : '',
        custo_unit: custo > 0 ? custo : null,
        autor_id: currentUser?.id != null ? String(currentUser.id) : '',
        autor_nome: currentUser?.nome || '',
        // Só o cadastro de peça nova usa: se o movimento chegar ao banco antes
        // da linha da peça, a linha nasce com o saldo e o cadastro completa depois.
        ...(m.criarSeFaltar ? { criar_se_faltar: true } : {}),
      })
    }
    if (rows.length === 0) return Promise.resolve({ ok: true, vazio: true })

    aplicarDeltaLocal(rows)
    somarEmVoo(rows, +1)

    // marcarGravando segura o eco do realtime enquanto a soma viaja — sem isso
    // um evento antigo de 'estoque' poderia pisar no delta recém-aplicado.
    marcarGravando('estoque')
    // Na MESMA fila do diff de 'estoque' (encadearEscrita): o cadastro da
    // peça gravado neste aparelho e o movimento dela nunca se cruzam — o
    // upsert do cadastro vai primeiro, o movimento depois. O trigger do
    // banco protege o saldo entre aparelhos; a fila protege dentro deste.
    return encadearEscrita('estoque', () => enviarMovimentos(rows))
      .then(res => {
        somarEmVoo(rows, -1)
        if (!res.ok) {
          registrarFalha({ tabela: 'estoque_mov', tipo: 'movimento', rows, motivo: res.motivo })
        } else {
          aplicarSaldoDoServidor(res.resposta)
        }
        return res
      })
      .catch(e => {
        somarEmVoo(rows, -1)
        console.error('[kardex] falha inesperada ao movimentar estoque:', e)
        registrarFalha({ tabela: 'estoque_mov', tipo: 'movimento', rows, motivo: MOTIVO.REDE })
        return { ok: false, motivo: MOTIVO.REDE }
      })
      .finally(() => fimGravando('estoque'))
  }

  function setCaixaTurno(valOrFn) {
    const prev = r.current.caixaTurno
    const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn

    // Quase todo chamador usa a forma `t => t ? {...t, ...} : t`, que devolve
    // null quando não há turno local. Sem esta guarda, esse null caía no ramo do
    // DELETE e apagava do banco o turno aberto de verdade — com as vendas do dia
    // inteiro, para todos os aparelhos, sem erro nenhum na tela. Bastava o
    // estado local estar null por uma falha de rede momentânea.
    //
    // Só apaga quando havia um turno e alguém pediu explicitamente para encerrar.
    if (next === null && prev === null) return

    r.current.caixaTurno = next
    _setCaixaTurno(next)
    marcarGravando('caixa_turno')
    const done = () => fimGravando('caixa_turno')
    // Passa pelo mesmo funil das outras tabelas: sem isto, o turno era a única
    // gravação sem retentativa e sem detecção de recusa silenciosa — logo a
    // mais frágil justamente na tabela que guarda o dinheiro do dia.
    // Devolve a promessa, como os setters criados por `makeSet`. Sem isto,
    // `await setCaixaTurno(...)` recebia undefined e quem esperasse confirmação
    // concluiria "falhou" numa gravação que tinha dado certo.
    if (next === null) {
      return apagarComRetry('caixa_turno', 'caixa-turno')
        .then(res => { if (!res.ok) registrarFalha({ tabela: 'caixa_turno', delId: 'caixa-turno', motivo: res.motivo }); return res })
        .finally(done)
    }
    const { id: _id, ...data } = next
    const rows = [{ id: 'caixa-turno', data }]
    return gravarComRetry('caixa_turno', rows)
      .then(res => { if (!res.ok) registrarFalha({ tabela: 'caixa_turno', rows, motivo: res.motivo }); return res })
      .finally(done)
  }

  function setConfig(valOrFn) {
    const prev = r.current.config
    const next = valOrFn instanceof Function ? valOrFn(prev) : valOrFn
    r.current.config = next
    _setConfig(next)
    marcarGravando('configuracoes')
    // Este era o pior setter do arquivo: sem retentativa, sem fila e sem aviso
    // — só um console.error. Uma taxa de maquininha recusada pelo banco ficava
    // valendo no aparelho, e `print.js` lê esta config para imprimir: o recibo
    // saía com um valor que o servidor nunca aceitou.
    //
    // O localStorage agora só é escrito DEPOIS da confirmação. Assim a tela
    // segue otimista (igual ao resto do sistema) e avisada pela tarja, mas
    // recarregar a página volta para a última config que o banco realmente tem.
    return gravarComRetry('configuracoes', [{ id: 'config-oficina', data: next }])
      .then(res => {
        if (res.ok) guardarConfigLocal(next)
        else registrarFalha({ tabela: 'configuracoes', rows: [{ id: 'config-oficina', data: next }], motivo: res.motivo })
        return res
      })
      .finally(() => fimGravando('configuracoes'))
  }

  // --- HELPERS ---
  // Sequencial a partir do maior número existente: a próxima OS é sempre a
  // anterior + 1. Os números antigos eram sorteados e ninguém conseguia saber
  // qual OS veio antes de qual só de olhar o número.
  // Marca d'agua do maior numero de OS ja visto neste aparelho.
  //
  // A numeracao sai do MAIOR numero da lista em memoria. Se a lista vier vazia
  // — e ela vem vazia quando uma politica do banco esconde a tabela, sem erro
  // nenhum — o calculo daria #1, e a OS nova seria gravada POR CIMA da OS #1
  // de verdade, levando junto as pecas e o historico do carro antigo. Depois a
  // #2, a #3. Sem uma linha de erro na tela.
  //
  // Guardar a marca no proprio aparelho resolve independente do MOTIVO de a
  // lista estar curta: se o que esta em memoria daria um numero menor do que
  // um que ja existiu, a leitura nao e confiavel e nao se numera nada.
  const CHAVE_MARCA_OS = 'maior-numero-os'

  function lerMarcaOS() {
    try { return Number(localStorage.getItem(CHAVE_MARCA_OS)) || 0 } catch { return 0 }
  }

  function gerarNumeroOS() {
    let max = 0
    for (const o of r.current.ordens) {
      const m = String(o.id || '').match(/^#(\d+)$/)
      if (m) max = Math.max(max, Number(m[1]))
    }
    const marca = lerMarcaOS()
    if (max < marca) {
      console.error(`[gerarNumeroOS] a lista em memoria daria #${max + 1}, mas este aparelho ja viu #${marca}. Leitura incompleta — recusando numerar.`)
      throw new Error('LEITURA_INCOMPLETA')
    }
    if (max > marca) { try { localStorage.setItem(CHAVE_MARCA_OS, String(max)) } catch { /* cota cheia */ } }

    let n = max + 1
    const existentes = new Set(r.current.ordens.map(o => String(o.id)))
    while (existentes.has('#' + n)) n++
    return '#' + n
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

  // Leitura de valor em português — uma implementação só, em utils/numero.js.
  // Cada tela tinha a própria cópia desta função, e a versão antiga lia "1.500"
  // como 1,5: o mesmo valor gravado valia mil e quinhentos numa tela e um e
  // cinquenta na outra.
  const parseBR = parseValorBR

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
    // Recusar a abrir OS e MUITO melhor que abrir com numero repetido: numero
    // repetido grava por cima de uma OS existente e ninguem descobre.
    let id
    try {
      id = gerarNumeroOS()
    } catch {
      alert('Nao consegui abrir a OS agora.\n\nO sistema nao conseguiu ler a lista completa de ordens de servico, e abrir assim criaria uma OS por cima de outra que ja existe.\n\nRecarregue a pagina e tente de novo. Se continuar, avise o responsavel pelo sistema.')
      return null
    }
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
      // Preenchido quando a OS já nasce aprovada (veio de um orçamento fechado)
      aprovadoEm: dados.aprovadoEm ?? null,
      itens: dados.itens || [],
      fotos: dados.fotos || [],
      historico: [evento(dados.textoCriacao || 'OS criada')],
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
    // O estoque é consequência do estado da OS (utils/reserva.js): OS nascida
    // em 'Recepção' com peças RESERVA; nascida 'Aprovado' (orçamento já
    // fechado) BAIXA. A regra roda dentro de setOrdens — nada a fazer aqui.
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

  // Lança o item na OS e, se for peça, baixa do estoque.
  //
  // A ORDEM aqui importa e mudou. Antes a peça saía do estoque primeiro e a OS
  // era gravada depois, cada uma numa tabela e sem ninguém conferir: se a
  // gravação da OS falhasse, a peça já tinha saído da prateleira e não estava
  // em OS nenhuma — some do estoque e ninguém cobra. É a dor nº 1 que a
  // pesquisa de mercado encontrou em oficina.
  //
  // Agora a OS grava primeiro e a baixa vai JUNTO com o item: se a OS não
  // confirmar na hora, os dois ficam na fila e sobem juntos (o id do movimento
  // é determinístico por OS + item, então reenviar nunca baixa duas vezes).
  // Pular a baixa quando a OS falhava deixava item cobrado sem saída no
  // estoque — e um estorno depois devolvia o que nunca saiu. O caso que sobra
  // é raro e visível: OS recusada de vez pelo banco (erro permanente, tarja
  // acesa) com a baixa feita — revisão humana, como toda pendência permanente.
  async function adicionarItemOrdem(id, item) {
    const novo = { ...item, id: gerarId() }
    let produto = null
    if (item.tipo === 'peca' && item.produtoId) {
      // Congela o custo da peça NESTE momento. O preço de custo do estoque muda
      // com o tempo; sem congelar, reajustar uma peça hoje reescreveria a margem
      // de todas as OS antigas que a usaram — o resultado de meses fechados
      // mudava sozinho.
      produto = r.current.estoque.find(p => String(p.id) === String(item.produtoId))
      const custo = parseBR(produto?.precoCusto)
      if (custo > 0) novo.custoUnitario = produto.precoCusto
    }

    // Reservar ou baixar é decisão da regra em setOrdens (depende do status
    // da OS): antes da aprovação o item só reserva; OS aprovada baixa na hora.
    const pOS = setOrdens(prev => prev.map(o => o.id === id ? { ...o, itens: [...(o.itens || []), novo] } : o))
    const resOS = await pOS
    const resEstoque = await pOS.estoque
    if (!resOS?.ok) {
      console.error('[adicionarItemOrdem] item nao confirmado na OS — ficou na fila junto com a baixa', resOS)
      return { ok: false, etapa: 'os' }
    }
    if (!resEstoque?.ok) {
      console.error('[adicionarItemOrdem] item lancado na OS, mas a baixa do estoque nao confirmou', resEstoque)
      return { ok: false, etapa: 'estoque' }
    }
    return { ok: true }
  }

  // Lança vários itens de uma vez (kit): UMA gravação da OS e UM registro no
  // histórico, em vez de um por item. Mesmo congelamento de custo do caminho
  // unitário; reservar ou baixar continua sendo decisão da regra em setOrdens.
  function adicionarItensOrdem(id, itens) {
    const novos = (itens || []).map(item => {
      const novo = { ...item, id: gerarId() }
      if (item.tipo === 'peca' && item.produtoId) {
        const produto = r.current.estoque.find(p => String(p.id) === String(item.produtoId))
        const custo = parseBR(produto?.precoCusto)
        if (custo > 0) novo.custoUnitario = produto.precoCusto
      }
      return novo
    })
    if (novos.length === 0) return Promise.resolve({ ok: true })
    return setOrdens(prev => prev.map(o => o.id === id ? { ...o, itens: [...(o.itens || []), ...novos] } : o))
  }

  // JUNTAR PEÇAS DUPLICADAS.
  //
  // O cadastro nunca bloqueou código repetido, então a mesma peça virou vários
  // cadastros e o saldo real ficou espalhado. Juntar não é apagar: as OS, o
  // extrato e os kits antigos apontam para o id de cada uma. Aqui o saldo das
  // perdedoras é transferido para a vencedora POR MOVIMENTO (o extrato conta a
  // história) e elas ficam INATIVAS apontando para a vencedora — somem da
  // busca e do lançamento, mas nada do passado quebra.
  function juntarPecas(idVencedora, idsPerdedoras) {
    const vencedora = r.current.estoque.find(p => String(p.id) === String(idVencedora))
    if (!vencedora) return Promise.resolve({ ok: false, motivo: 'peça que fica não encontrada' })
    const perdedoras = (idsPerdedoras || [])
      .map(id => r.current.estoque.find(p => String(p.id) === String(id)))
      .filter(p => p && String(p.id) !== String(idVencedora))
    if (perdedoras.length === 0) return Promise.resolve({ ok: false, motivo: 'nenhuma peça a juntar' })

    const movs = []
    for (const p of perdedoras) {
      const saldo = Number(p.estoque) || 0
      if (saldo === 0) continue
      movs.push({
        pecaId: p.id, qtd: -saldo, tipo: 'fusao',
        motivo: `Saldo transferido para ${vencedora.nome}`,
        chave: ['fusao_saida', p.id, idVencedora],
      })
      movs.push({
        pecaId: idVencedora, qtd: saldo, tipo: 'fusao',
        motivo: `Recebido de ${p.nome}${p.codigo ? ` (${p.codigo})` : ''}`,
        custoUnit: p.precoCusto,
        chave: ['fusao_entrada', idVencedora, p.id],
      })
    }

    // Custo médio ponderado da fusão: o custo da vencedora passa a valer pelo
    // conjunto, senão o CMV pularia por causa de uma linha que sumiu da vista.
    const saldoV = Number(vencedora.estoque) || 0
    const custoV = parseBR(vencedora.precoCusto)
    let somaValor = saldoV * (custoV > 0 ? custoV : 0)
    let somaQtd = custoV > 0 ? saldoV : 0
    for (const p of perdedoras) {
      const c = parseBR(p.precoCusto)
      const q = Number(p.estoque) || 0
      if (c > 0 && q > 0) { somaValor += c * q; somaQtd += q }
    }
    const custoNovo = somaQtd > 0 ? somaValor / somaQtd : null

    const idsPerd = new Set(perdedoras.map(p => String(p.id)))
    setEstoque(prev => prev.map(p => {
      if (idsPerd.has(String(p.id))) {
        return { ...p, ativo: false, fundidaEm: idVencedora, fundidaQuando: Date.now() }
      }
      if (String(p.id) === String(idVencedora)) {
        return custoNovo != null ? { ...p, precoCusto: custoNovo.toFixed(2).replace('.', ',') } : p
      }
      return p
    }))

    return movs.length > 0 ? movimentarEstoque(movs) : Promise.resolve({ ok: true, vazio: true })
  }

  function removerItemOrdem(id, itemId) {
    // Se o item estava baixado, a regra em setOrdens devolve ao saldo; se só
    // reservado, a reserva some com ele.
    setOrdens(prev => prev.map(x => x.id === id
      ? { ...x, itens: (x.itens || []).filter(i => i.id !== itemId) } : x))
  }

  function editarItemOrdem(osId, itemId, dados) {
    // Quantidade ou peça trocada num item já baixado movimenta só a diferença;
    // em item reservado não movimenta nada. Tudo derivado pela regra em setOrdens.
    setOrdens(prev => prev.map(x => x.id === osId
      ? { ...x, itens: (x.itens || []).map(i => i.id === itemId ? { ...i, ...dados } : i) } : x))
  }

  const STATUS_FINALIZADOS = ['Entregue', 'Concluída']

  // Fechar OS com serviço sem reparador é o buraco que deixou 23 OS e R$ 24 mil
  // órfãos. A guarda mora AQUI, no contexto, e não nas telas: são quatro portas
  // diferentes para o mesmo destino (o dropdown, o botão de concluir, a entrega
  // cobrando e a entrega sem cobrar), e uma delas ia ficar de fora.
  //
  // Só morde na entrada de "Concluída"/"Entregue" — ver utils/reparador.js.
  function barradoPorFaltarReparador(o, novoStatus) {
    const bloqueio = bloqueioDeConclusao(o, novoStatus)
    if (!bloqueio) return false
    alert(bloqueio.texto)
    return true
  }

  function mudarStatusOrdem(id, novoStatus) {
    const lista = r.current.ordens
    const o = lista.find(x => x.id === id)
    if (!o) return
    if (o.status === novoStatus) return
    if (barradoPorFaltarReparador(o, novoStatus)) return

    // Sair de um status finalizado (ou de OS já paga) reverte o financeiro —
    // impede que o dropdown burle o fluxo de "Reabrir OS".
    const saindoDeFinalizado = STATUS_FINALIZADOS.includes(o.status) || o.pago
    const voltandoParaAtivo = !STATUS_FINALIZADOS.includes(novoStatus) && novoStatus !== 'Cancelada'
    const precisaEstorno = saindoDeFinalizado && (voltandoParaAtivo || novoStatus === 'Cancelada')

    // Estoque: NÃO se decide aqui. A regra em setOrdens olha o status antes e
    // depois e reserva/baixa/devolve por item (utils/reserva.js) — vale para o
    // dropdown, para o Pátio e para qualquer outro caminho.
    const eventos = []
    if (precisaEstorno) eventos.push(evento('Estorno automático (saída de status finalizado)'))
    eventos.push(evento(`Status alterado para "${novoStatus}"`))
    const historico = [...eventos, ...(o.historico || [])]

    let extra = {}
    // "Entregue" tambem finaliza a OS, e antes so "Concluída" carimbava a data.
    // Quem mudava o status direto para Entregue — o caminho normal de quem
    // entrega o carro sem passar por Concluída — fechava a OS SEM data de
    // conclusao. Sao 24 OS assim na base, 11 delas de um mes so.
    //
    // O estrago: produtividade do reparador, DRE, ponto de equilibrio e a tela
    // de Gestao caem todos na data de ENTRADA quando a conclusao falta. Carro
    // que entrou em junho e saiu em julho contava em junho — mes errado, e
    // ninguem tinha como perceber.
    if (['Concluída', 'Entregue'].includes(novoStatus)) {
      const hoje = new Date().toLocaleDateString('pt-BR')
      extra.dataConclusao = o.dataConclusao || hoje
    }
    if (precisaEstorno) {
      extra.pago = false
      extra.dataConclusao = ''
    }
    // Sair de "Entregue"/"Concluída" reativa as peças: limpa a marca de
    // liberação (pecasLiberadas, ou estoqueEstornado do bloco 01), senão a
    // regra continuaria tratando-as como liberadas.
    if ((o.pecasLiberadas || o.estoqueEstornado) && !['Entregue', 'Concluída'].includes(novoStatus)) {
      extra.pecasLiberadas = false
      extra.estoqueEstornado = false
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
    // As peças que estavam baixadas voltam ao saldo pela regra em setOrdens
    // (OS presente antes, ausente depois); as só reservadas somem sem movimento.
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
    // Reabrir põe a OS em execução: a regra em setOrdens baixa de novo o que
    // tinha sido devolvido (recusa) e mantém o que já estava baixado.
    const historico = [evento('OS reaberta (estorno)'), ...(o.historico || [])]
    setOrdens(prev => prev.map(x => x.id === osId ? { ...x, status: 'Em Execução', pago: false, dataConclusao: '', historico, etapaEm: Date.now(), ...((x.pecasLiberadas || x.estoqueEstornado) ? { pecasLiberadas: false, estoqueEstornado: false } : {}) } : x))
    setFinanceiro(fp => fp.filter(f => f.osId !== osId))
    setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.osId !== osId) } : t)
  }

  function concluirOrdem(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return
    if (o.status === 'Entregue' || o.status === 'Cancelada' || o.status === 'Concluída') return
    if (barradoPorFaltarReparador(o, 'Concluída')) return
    const hoje = new Date().toLocaleDateString('pt-BR')
    const historico = [evento('Serviço concluído — aguardando retirada'), ...(o.historico || [])]
    setOrdens(prev => prev.map(x => x.id === osId ? { ...x, status: 'Concluída', dataConclusao: hoje, historico, etapaEm: Date.now() } : x))
  }

  async function entregarOrdem(osId, pagamentos, clienteNome) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o) return { ok: false, motivo: 'os-nao-encontrada' }
    if (o.status === 'Entregue') return { ok: true }   // evita duplo-clique gerando venda duplicada no caixa
    // Esta devolve resultado em vez de só alertar, para a tela de cobrança não
    // seguir para o caixa achando que entregou.
    if (barradoPorFaltarReparador(o, 'Entregue')) return { ok: false, motivo: 'servico-sem-reparador' }
    // A recepção pode cobrar sem esperar a conferência (cliente no balcão), mas
    // isso não passa em branco: fica escrito quem liberou o carro sem conferir.
    const semConferencia = !o.conferencia?.aprovado
    const historico = [
      evento('Veículo entregue e pago'),
      ...(semConferencia ? [evento(`Entregue sem passar pela conferência — liberado por ${currentUser?.nome || 'usuário'}`)] : []),
      ...(o.historico || []),
    ]
    // Enriquece ANTES de gravar na OS. A conta da taxa acontecia só dentro de
    // `registrarVendaCaixa`, e o resultado ficava na venda do turno: a OS
    // guardava o pagamento cru, com `taxa` ausente. Efeito colateral duplo — a
    // margem da OS aparecia maior do que é (não descontava a maquininha) e o
    // aviso "cartão sem taxa calculada" saía em TODA OS paga no cartão, mesmo
    // com a máquina cadastrada certinho.
    const pagamentosEnriquecidos = enriquecerPagamentos(
      (pagamentos || []).filter(p => p.forma !== 'Pagar Depois'),
      r.current.config,
    )
    const aPrazoOS = (pagamentos || []).filter(p => p.forma === 'Pagar Depois')
    const pagamentosDaOS = [...pagamentosEnriquecidos, ...aPrazoOS]

    // Guarda como o cliente pagou na própria OS: a venda do caixa some quando o
    // turno está fechado, e sem isto o recibo reimpresso depois sai sem pagamento.
    // Entregar e cobrar mexe em tres tabelas (ordens, caixa_turno, financeiro) e
    // nao ha transacao entre elas. Esperar a OS confirmar antes de registrar a
    // venda evita o pior par: receita lancada no caixa para uma OS que o banco
    // nunca marcou como paga — dinheiro no relatorio sem OS correspondente, e
    // o carro saindo do patio.
    const resOS = await setOrdens(prev => prev.map(x => x.id === osId ? {
      ...x,
      status: 'Entregue',
      pago: true,
      pagamentos: pagamentosDaOS,
      dataEntrega: new Date().toLocaleDateString('pt-BR'),
      historico,
      etapaEm: Date.now(),
    } : x))
    if (!resOS?.ok) {
      console.error('[entregarOrdem] OS nao confirmada pelo servidor — venda NAO registrada no caixa', resOS)
      return { ok: false, motivo: 'os-nao-gravou' }
    }
    const total = totalOrdem(o)
    registrarVendaCaixa({
      osId,
      // Sem o nome aqui a receita entrava no financeiro como "Venda #X - Cliente"
      clienteNome: clienteNome || o.clienteNome || '',
      itens: o.itens || [],
      total,
      pagamentos: pagamentos || [],
    })
    return { ok: true }
  }

  // Saída para OS que já foi paga (no sistema antigo ou aqui): marca como
  // entregue SEM passar pelo caixa — entregarOrdem lançaria a venda de novo e
  // o dinheiro entraria em dobro. Não mexe em financeiro nem em estoque.
  function entregarSemCobrar(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.status === 'Entregue') return
    if (barradoPorFaltarReparador(o, 'Entregue')) return
    const hoje = new Date().toLocaleDateString('pt-BR')
    // As fichas migradas vieram sem itens e sem a marca de pagas — o dinheiro
    // ficou só no sistema antigo. O motivo certo vai para o histórico.
    const motivo = o.pago ? 'OS já estava paga' : 'sem valor a cobrar no sistema'
    mudarOrdem(osId, {
      status: 'Entregue',
      pago: true,
      dataEntrega: hoje,
      dataConclusao: o.dataConclusao || hoje,
      etapaEm: Date.now(),
    }, `Entregue sem lançamento no caixa — ${motivo} (liberado por ${currentUser?.nome || 'usuário'})`)
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

  // Carro que já está em diagnóstico ou execução mas sem responsável — as fichas
  // que vieram da migração ficaram assim e nenhuma tela conseguia tocar nelas,
  // porque iniciarDiagnostico/iniciarReparo desistem quando o status já é aquele.
  // Aqui só assume o dono, sem mexer na etapa em que o carro está.
  function assumirServico(osId) {
    const o = r.current.ordens.find(x => x.id === osId)
    if (!o || o.responsavelId != null) return
    mudarOrdem(osId, {
      responsavelId: currentUser?.id ?? null,
      responsavelNome: currentUser?.nome || '',
    }, `${currentUser?.nome || 'Usuário'} assumiu o veículo`)
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
    // As peças desta OS não foram usadas: `pecasLiberadas` diz à regra em
    // setOrdens que, apesar de "Entregue", nada fica baixado — o que estava
    // baixado volta ao saldo, o que estava reservado é liberado.
    mudarOrdem(osId, {
      status: FLUXO.ENTREGUE,
      pago: !!cobrar,
      diagnosticoCobrado: !!cobrar,
      dataConclusao: o.dataConclusao || new Date().toLocaleDateString('pt-BR'),
      etapaEm: Date.now(),
      pecasLiberadas: true,
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
    // A data informada tem prioridade. Sem isso, uma taxa recalculada depois
    // entrava com a data de hoje em vez da data da venda, e o custo de agosto
    // aparecia em setembro nos relatórios por período.
    setFinanceiro(prev => [{ ...lancamento, id: gerarId(), data: lancamento.data || hoje }, ...prev])
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

    // CUSTO MÉDIO PONDERADO: receber compra atualiza o custo da peça já
    // cadastrada — antes não atualizava, e margem e CMV seguiam com o custo de
    // meses atrás. A conta é a do mercado: (saldo × custo antigo + entrada ×
    // custo pago) ÷ (saldo + entrada), sobre o saldo ANTES da entrada. Sem
    // saldo ou sem custo antigo, o custo da compra vira o custo da peça.
    //
    // ANTES da entrada, de propósito: movimentarEstoque soma o saldo local na
    // hora, e ler o saldo depois faria a conta com a peça já dentro do estoque.
    const custoNovoPorPeca = new Map()
    for (const i of compra.itens) {
      if (!i.produtoId || i.cadastrarNova) continue
      const qtd = parseBR(i.quantidade) || 0
      const custoCompra = parseBR(i.valorUnitario)
      if (qtd <= 0 || custoCompra <= 0) continue
      const k = String(i.produtoId)
      const peca = r.current.estoque.find(p => String(p.id) === k)
      if (!peca) continue
      const jaContado = custoNovoPorPeca.get(k)
      const saldoBase = jaContado ? jaContado.saldo : (Number(peca.estoque) || 0)
      const custoBase = jaContado ? jaContado.custo : parseBR(peca.precoCusto)
      const saldoFinal = saldoBase + qtd
      const custo = (custoBase > 0 && saldoBase > 0)
        ? ((saldoBase * custoBase) + (qtd * custoCompra)) / saldoFinal
        : custoCompra
      custoNovoPorPeca.set(k, { saldo: saldoFinal, custo })
    }
    if (custoNovoPorPeca.size > 0) {
      setEstoque(prev => prev.map(p => {
        const novo = custoNovoPorPeca.get(String(p.id))
        if (!novo) return p
        return { ...p, precoCusto: novo.custo.toFixed(2).replace('.', ',') }
      }))
    }

    // Entrada dos itens já cadastrados: um movimento POR LINHA da compra — a
    // mesma peça em duas linhas entra duas vezes (o find antigo via só a
    // primeira, e o dinheiro da segunda virava despesa sem peça).
    // Chave por (compra, posição do item): dois caixas confirmando o mesmo
    // recebimento geram os mesmos ids e a entrada conta uma vez só.
    movimentarEstoque(compra.itens
      .map((i, idx) => ({ i, idx }))
      .filter(({ i }) => i.produtoId && !i.cadastrarNova)
      .map(({ i, idx }) => ({
        pecaId: i.produtoId,
        qtd: parseBR(i.quantidade) || 0,
        tipo: 'entrada_compra',
        origem: { tipo: 'compra', id },
        custoUnit: i.valorUnitario,
        // Id do item da compra (CompraDetalhe dá gerarId a cada linha); índice só
        // para compra antiga sem id — dois caixas recebendo a mesma compra com
        // listas defasadas geram o mesmo uuid por item, não por posição.
        chave: ['entrada_compra', id, i.id ?? idx],
      })))

    // Cadastra novas peças no estoque (itens marcados com cadastrarNova).
    // A peça nasce com saldo ZERO e a quantidade entra por movimento — assim o
    // extrato explica o saldo desde o primeiro dia. O id criado fica gravado
    // no item da compra (novoProdutoId) para o estorno achar a peça se a
    // compra for excluída.
    const novasEntradas = compra.itens.filter(i => i.cadastrarNova && i.novoItemDados?.nome)
    const idPorItem = new Map()
    if (novasEntradas.length > 0) {
      for (const i of novasEntradas) idPorItem.set(i, gerarId())
      setEstoque(prev => [
        ...prev,
        ...novasEntradas.map(i => ({
          id: idPorItem.get(i),
          nome: i.novoItemDados.nome,
          codigo: i.novoItemDados.codigo || '',
          categoria: i.novoItemDados.categoria || '',
          precoCusto: i.valorUnitario || '0',
          preco: i.novoItemDados.precoVenda || '0',
          minimo: Number(i.novoItemDados.minimo) || 0,
          estoque: 0,
          // O que veio do XML da nota: NCM, CEST, origem, codigo de barras e
          // unidade. Antes eram descartados aqui — a peca nascia sem nada
          // fiscal, e alguem teria de digitar NCM a mao depois, que e
          // exatamente o que ninguem faz. Copiados um a um, e nao por espalhar
          // o objeto inteiro, para o cadastro nao herdar campo de controle da
          // importacao.
          ean: i.novoItemDados.ean || '',
          ncm: i.novoItemDados.ncm || '',
          cest: i.novoItemDados.cest || '',
          origem: i.novoItemDados.origem || '0',
          unidade: i.novoItemDados.unidade || 'UN',
          codigoFabricante: i.novoItemDados.codigoFabricante || '',
          fornecedorId: compra.fornecedorId || '',
          ativo: true,
        })),
      ])
      movimentarEstoque(novasEntradas.map(i => ({
        pecaId: idPorItem.get(i),
        qtd: parseBR(i.quantidade) || 0,
        tipo: 'entrada_compra',
        origem: { tipo: 'compra', id },
        custoUnit: i.valorUnitario,
        // Se o movimento chegar ao banco antes da linha da peça, a linha nasce
        // com o saldo e o cadastro completa em seguida (mesclarPeca preserva).
        criarSeFaltar: true,
        // Sem chave determinística: a peça nova tem id próprio deste aparelho
        // (gerarId); dois recebimentos simultâneos criariam duas peças, não
        // uma entrada dobrada — problema de cadastro, não de kardex.
      })))
    }

    const parcelas = compra.parcelas || []
    if (parcelas.length > 0) {
      parcelas.forEach((p, idx) => {
        adicionarLancamento({
          descricao: `Compra ${compra.numero} - ${compra.fornecedorNome || 'Fornecedor'} (${idx + 1}/${parcelas.length})`,
          tipo: 'despesa',
          categoria: 'Compra de peças',
          valor: parseBR(p.valor).toFixed(2).replace('.', ','),
          vencimento: p.vencimento || '',
          compraId: id,
          // Amarra o lançamento à parcela: sem isto, dar baixa não tinha como
          // achar a despesa já existente e criava uma segunda — a compra
          // parcelada aparecia no resultado pelo dobro do que custou.
          parcelaId: p.id,
        })
      })
    } else {
      adicionarLancamento({
        descricao: `Compra ${compra.numero} - ${compra.fornecedorNome || 'Fornecedor'}`,
        tipo: 'despesa',
        categoria: 'Compra de peças',
        valor: compra.total.toFixed(2).replace('.', ','),
        vencimento: '',
        compraId: id,
      })
    }
    atualizarCompra(id, {
      recebida: true,
      status: 'Recebida',
      // Vínculo item da compra → peça criada: sem ele, excluir a compra não
      // teria como estornar a entrada das peças que nasceram aqui.
      ...(idPorItem.size > 0
        ? { itens: compra.itens.map(i => idPorItem.has(i) ? { ...i, novoProdutoId: idPorItem.get(i) } : i) }
        : {}),
    })
  }

  function excluirCompra(id) {
    // Compra recebida pôs peça no estoque; excluir a compra estorna essa
    // entrada. Antes o saldo ficava inflado para sempre — sumia a dívida,
    // ficava a peça fantasma.
    const compra = r.current.compras.find(c => c.id === id)
    if (compra?.recebida) {
      const movs = []
      for (const i of compra.itens || []) {
        const qtd = parseBR(i.quantidade) || 0
        const pecaId = i.produtoId || i.novoProdutoId
        if (!qtd || !pecaId) continue
        movs.push({
          pecaId,
          qtd: -qtd,
          tipo: 'estorno_compra',
          motivo: `Compra ${compra.numero || ''} excluída`.trim(),
          origem: { tipo: 'compra', id },
          chave: ['estorno_compra', id, i.id ?? (compra.itens || []).indexOf(i)],
        })
      }
      if (movs.length > 0) movimentarEstoque(movs)
    }
    setFinanceiro(fp => fp.filter(f => f.compraId !== id))
    setCompras(prev => prev.filter(c => c.id !== id))
  }

  // --- CAIXA ---
  function pNum(v) { return parseBR(v) }
  function horaAgora() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

  // Abrir caixa RELE o banco antes de criar turno novo.
  //
  // O turno e linha unica: abrir por cima de um turno existente apaga as vendas
  // e os movimentos do dia, sem erro e sem historico. E o estado local pode
  // dizer "nao ha turno" por dois motivos opostos — nao ha mesmo, ou a leitura
  // veio vazia (que e o que uma politica de banco devolve). Perguntar ao
  // servidor na hora e o unico jeito de separar os dois.
  async function abrirCaixa(saldoInicial, operador) {
    const { data, error } = await supabase.from('caixa_turno').select('data').eq('id', 'caixa-turno').maybeSingle()
    if (error) {
      console.error('[abrirCaixa] nao consegui conferir se ja existe turno aberto:', error)
      alert('Nao consegui falar com o servidor para conferir se o caixa ja esta aberto.\n\nNao vou abrir as cegas, para nao apagar o turno do dia. Verifique a internet e tente de novo.')
      return { ok: false }
    }
    if (data?.data) {
      console.error('[abrirCaixa] ja existe turno aberto no servidor — recusando abrir por cima')
      alert('Ja existe um caixa aberto no servidor.\n\nA tela estava desatualizada. Recarregue a pagina para ver o turno que ja esta aberto.')
      return { ok: false, jaAberto: true }
    }

    setCaixaTurno({
      id: 'caixa-turno',
      // Sem o nome de quem abriu, todo caixa da oficina ficava registrado como
      // 'Magayver Torres' — o rastro nao era ausente, era falso.
      operador: operador || currentUser?.nome || 'Nao identificado',
      dataAbertura: new Date().toLocaleDateString('pt-BR'),
      horaAbertura: horaAgora(),
      saldoInicial: pNum(saldoInicial),
      aberto: true,
      vendas: [],
      movimentos: [],
    })
    return { ok: true }
  }

  function registrarVendaCaixa(venda) {
    // Cada pagamento passa a carregar quanto custou de taxa e quanto sobrou.
    // O cliente pagou o bruto (é o faturamento); a adquirente ficou com a taxa;
    // só o líquido virou saldo. Antes o bruto entrava como se fosse tudo isso.
    const pagamentos = enriquecerPagamentos(
      (venda.pagamentos || []).filter(p => p.forma !== 'Pagar Depois'),
      r.current.config,
    )
    const aPrazo = (venda.pagamentos || []).filter(p => p.forma === 'Pagar Depois')

    const totais = somarPagamentos(pagamentos)
    const recebido = totais.bruto
    const pago = recebido >= venda.total - 0.001
    const vendasExistentes = new Set((r.current.caixaTurno?.vendas || []).map(v => v.numero))
    let numero
    for (let i = 0; i < 20; i++) {
      const n = '#' + Math.floor(3000 + Math.random() * 7000)
      if (!vendasExistentes.has(n)) { numero = n; break }
    }
    if (!numero) {
      const nums = (r.current.caixaTurno?.vendas || []).map(v => parseInt((v.numero || '').replace('#', '')) || 0)
      numero = '#' + ((Math.max(0, ...nums)) + 1)
    }
    const novaVenda = {
      ...venda,
      pagamentos: [...pagamentos, ...aPrazo],
      id: gerarId(), numero,
      status: pago ? 'Paga' : 'Pendente',
      recebido,
      taxaTotal: totais.taxa,
      recebidoLiquido: totais.liquido,
      hora: horaAgora(),
    }

    setCaixaTurno(t => t ? { ...t, vendas: [novaVenda, ...t.vendas] } : t)

    if (recebido > 0) {
      const lanc = {
        descricao: `Venda ${numero} - ${venda.clienteNome || 'Cliente'}`,
        tipo: 'receita',
        valor: recebido.toFixed(2).replace('.', ','),
        vendaId: novaVenda.id,
        caixa: true,
        // Sem isto não dá para responder quanto entrou em PIX, dinheiro ou cartão
        formasPagamento: pagamentos.map(p => p.forma),
        liquido: totais.liquido,
      }
      if (venda.osId) lanc.osId = venda.osId
      // Marca a dívida que este dinheiro está quitando, para o "A Receber"
      // saber que aquela venda antiga já foi (parcial ou totalmente) paga.
      if (venda.quitacaoDe != null) lanc.quitacaoDe = venda.quitacaoDe
      adicionarLancamento(lanc)
      lancarTaxasCartao(pagamentos, { vendaId: novaVenda.id, osId: venda.osId, numero })
    }
    return numero
  }

  // A taxa da maquininha é despesa como qualquer outra — e precisa sair
  // identificada por máquina para se poder somar quanto cada uma custou no mês
  // e ter com o que negociar. Um lançamento por máquina dentro da venda: quase
  // sempre uma linha só, sem inchar o extrato.
  function lancarTaxasCartao(pagamentos, { vendaId, osId, numero, data }) {
    const porMaquina = new Map()
    for (const p of pagamentos) {
      if (!(p.taxa > 0)) continue
      const chave = String(p.maquinaId)
      const atual = porMaquina.get(chave)
        || { maquinaId: p.maquinaId, maquinaNome: p.maquinaNome, taxa: 0, base: 0, detalhes: [] }
      atual.taxa = Math.round((atual.taxa + p.taxa) * 100) / 100
      atual.base = Math.round((atual.base + p.bruto) * 100) / 100
      // Guardar COMO passou (débito, à vista, 6x) é o que permite depois
      // perguntar "quanto isto teria custado na outra máquina?". Só o valor
      // total da taxa não responde: cada modalidade tem preço diferente.
      atual.detalhes.push({ modalidade: p.modalidade, parcelas: p.parcelas, bruto: p.bruto, taxa: p.taxa })
      porMaquina.set(chave, atual)
    }
    for (const m of porMaquina.values()) {
      // Se já existe taxa lançada para esta venda nesta máquina, não lança de
      // novo. Sem isso, um reprocessamento que gravasse o financeiro mas
      // falhasse ao gravar o turno deixava `taxaPendente` no banco — e o
      // próximo clique em "Recalcular taxas" duplicava a despesa. Vale também
      // para dois aparelhos rodando o recálculo.
      const jaLancada = r.current.financeiro.some(f =>
        f.taxaCartao &&
        String(f.vendaId) === String(vendaId) &&
        String(f.maquinaId) === String(m.maquinaId)
      )
      if (jaLancada) continue

      const lanc = {
        descricao: `Taxa de cartão — Venda ${numero}${m.maquinaNome ? ` (${m.maquinaNome})` : ''}`,
        tipo: 'despesa',
        categoria: 'Taxa de cartão',
        taxaCartao: true,
        valor: m.taxa.toFixed(2).replace('.', ','),
        baseCalculo: m.base,
        detalhes: m.detalhes,
        maquinaId: m.maquinaId,
        maquinaNome: m.maquinaNome,
        vendaId,
      }
      // Taxa recalculada depois pertence ao mês da VENDA, não ao de hoje.
      if (data) lanc.data = data
      // Mesmo osId da receita: o estorno da OS já limpa por osId e leva a taxa junto.
      if (osId) lanc.osId = osId
      adicionarLancamento(lanc)
    }
  }

  // Vendas registradas antes de a taxa da máquina estar cadastrada entraram pelo
  // valor cheio, marcadas com taxaPendente. Como o pagamento guardou máquina,
  // modalidade, parcelas e bruto, dá para refazer a conta depois — em vez de
  // perder o custo daquelas vendas para sempre.
  //
  // Só recalcula o que tem máquina identificada: adivinhar em qual maquininha
  // passou seria inventar despesa.
  function reprocessarTaxasPendentes() {
    const cfg = r.current.config
    const resultado = { pagamentos: 0, taxa: 0, semMaquina: 0 }

    function reprocessarVenda(venda, dataDoTurno) {
      const ts = parseDataBR(dataDoTurno)
      const dataVenda = ts ? new Date(ts) : new Date()
      let mudou = false
      const novosDetalhes = []
      const pagamentos = (venda.pagamentos || []).map(p => {
        if (!p.taxaPendente) return p
        if (!p.maquinaId) { resultado.semMaquina++; return p }
        // A data da venda vai junto: sem ela o `creditoEm` era recalculado como
        // se a venda fosse de hoje, e uma venda de março passava a dizer que o
        // dinheiro cai hoje.
        const recalc = enriquecerPagamento(p, cfg, dataVenda)
        if (!(recalc.taxa > 0)) return p          // taxa ainda não cadastrada
        mudou = true
        resultado.pagamentos++
        resultado.taxa = Math.round((resultado.taxa + recalc.taxa) * 100) / 100
        novosDetalhes.push(recalc)
        return recalc
      })
      if (!mudou) return null
      const totais = somarPagamentos(pagamentos.filter(p => p.forma !== 'Pagar Depois'))
      return {
        venda: { ...venda, pagamentos, taxaTotal: totais.taxa, recebidoLiquido: totais.liquido },
        novosDetalhes,
      }
    }

    // Turno aberto
    const turno = r.current.caixaTurno
    if (turno) {
      let alterou = false
      const vendas = (turno.vendas || []).map(v => {
        const res = reprocessarVenda(v, turno.dataAbertura)
        if (!res) return v
        alterou = true
        lancarTaxasCartao(res.novosDetalhes, { vendaId: v.id, osId: v.osId, numero: v.numero, data: turno.dataAbertura })
        return res.venda
      })
      if (alterou) setCaixaTurno(t => (t ? { ...t, vendas } : t))
    }

    // Turnos já fechados — o custo daquele dia também precisa ficar certo
    let alterouHistorico = false
    const historico = (r.current.caixaHistorico || []).map(t => {
      let alterou = false
      const vendas = (t.vendas || []).map(v => {
        const res = reprocessarVenda(v, t.dataAbertura)
        if (!res) return v
        alterou = true
        lancarTaxasCartao(res.novosDetalhes, { vendaId: v.id, osId: v.osId, numero: v.numero, data: t.dataAbertura })
        return res.venda
      })
      if (!alterou) return t
      alterouHistorico = true
      return { ...t, vendas }
    })
    if (alterouHistorico) setCaixaHistorico(historico)

    return resultado
  }

  // Excluir a venda tirava ela só do turno: a receita continuava no Financeiro e
  // o faturamento do mês seguia contando um dinheiro que ninguém mais via. Com a
  // taxa lançada junto, sobrariam duas linhas órfãs em vez de uma.
  function excluirVendaCaixa(vendaId) {
    // Venda de BALCÃO devolve as peças ao saldo — elas saíram por esta venda e
    // a venda deixou de existir. Venda nascida de OS não devolve nada: as peças
    // pertencem à OS, que continua entregue (excluir essa venda é um problema
    // financeiro, não de prateleira).
    const venda = (r.current.caixaTurno?.vendas || []).find(v => v.id === vendaId)
    if (venda && !venda.osId) {
      const pecas = (venda.itens || []).filter(i => i.tipo === 'peca' && i.produtoId)
      if (pecas.length > 0) {
        movimentarEstoque(pecas.map(p => ({
          pecaId: p.produtoId,
          qtd: pNum(p.qtd) || 1,
          tipo: 'estorno_venda',
          motivo: 'Venda excluída',
          origem: { tipo: 'venda', id: venda.numero || vendaId },
          chave: ['estorno_venda', vendaId, p.id],
        })))
      }
    }
    setCaixaTurno(t => t ? { ...t, vendas: (t.vendas || []).filter(v => v.id !== vendaId) } : t)
    setFinanceiro(fp => fp.filter(f => f.vendaId !== vendaId))
  }

  function registrarSangria(valor, motivo, forma = 'Dinheiro') {
    setCaixaTurno(t => t ? { ...t, movimentos: [{ id: gerarId(), tipo: 'sangria', valor: pNum(valor), motivo, forma, hora: horaAgora() }, ...t.movimentos] } : t)
  }

  function registrarReforco(valor, motivo, forma = 'Dinheiro') {
    setCaixaTurno(t => t ? { ...t, movimentos: [{ id: gerarId(), tipo: 'reforco', valor: pNum(valor), motivo, forma, hora: horaAgora() }, ...t.movimentos] } : t)
  }

  // Chave estável e única do fechamento de um turno. Turno sem data/hora de
  // abertura (registro antigo) cai no id gerado — pior para retentativa, mas
  // nunca sobrescreve outro fechamento, que é o erro que não se pode cometer.
  function idDoFechamento(turno) {
    const marca = `${turno?.dataAbertura || ''}-${turno?.horaAbertura || ''}`.replace(/[^0-9]/g, '')
    return marca.length >= 8 ? `fech-${marca}` : `fech-${gerarId()}`
  }

  // `extra` traz a conferência separada de gaveta e banco. Fica opcional para
  // que turnos fechados antes desta mudança continuem legíveis no histórico:
  // lá `saldoEsperado`/`saldoFinal` somavam todas as formas juntas.
  async function fecharCaixa(contagem, justificativa, saldoEsperado, totalContado, extra = {}) {
    if (!r.current.caixaTurno) return { ok: false, motivo: 'sem-turno' }
    const fechado = {
      ...r.current.caixaTurno,
      // Id DERIVADO do turno, não `gerarId()`. Se a primeira tentativa falhar e
      // ficar na fila, a segunda tentativa gerava um id novo — e quando a fila
      // subisse depois, o mesmo turno virava DOIS fechamentos no histórico, com
      // faturamento e taxas contados em dobro. Derivado, o reenvio vira upsert
      // da mesma linha.
      //
      // ⚠️ Derivado da ABERTURA, e não de `caixaTurno.id`: o turno NÃO tem id
      // próprio — `recarregarTabela` o monta como `{ id: 'caixa-turno', ... }`,
      // uma constante. Usar esse id fazia todo fechamento nascer com a mesma
      // chave e o de hoje gravar POR CIMA do de ontem, apagando o histórico.
      // Data + hora de abertura é único por turno (não se abrem dois caixas no
      // mesmo minuto) e estável entre retentativas, que é o que se precisa.
      id: idDoFechamento(r.current.caixaTurno),
      aberto: false,
      dataFechamento: new Date().toLocaleDateString('pt-BR'),
      horaFechamento: horaAgora(),
      contagem,
      justificativa,
      // A partir daqui estes três se referem só ao DINHEIRO em espécie — é o
      // único valor que alguém conta de fato, e por isso o único que pode
      // divergir de verdade.
      saldoEsperado,
      saldoFinal: totalContado,
      divergencia: totalContado - saldoEsperado,
      fechadoPorId: currentUser?.id ?? null,
      fechadoPorNome: currentUser?.nome || '',
      ...extra,
    }
    // O turno só é apagado DEPOIS que o histórico estiver gravado de verdade.
    //
    // Antes as duas coisas disparavam juntas, em tabelas diferentes: se o
    // upsert do histórico falhasse, o DELETE do turno acontecia mesmo assim e o
    // dia inteiro passava a existir só na fila de falhas em memória — que morre
    // quando a pessoa fecha o navegador. E fechar o caixa é exatamente a última
    // coisa que se faz antes de fechar o navegador.
    // A checagem antiga perguntava a `r.current.caixaHistorico` se o histórico
    // tinha sido salvo — mas a linha acima acabara de escrever nesse mesmo
    // espelho local, de forma síncrona. Ou seja: perguntava ao próprio otimismo
    // e a resposta era sempre "sim". O alerta de proteção nunca disparava, e o
    // turno era apagado com o histórico do dia possivelmente não gravado.
    //
    // Agora quem responde é o banco.
    const res = await setCaixaHistorico(h => [fechado, ...h])
    if (!res?.ok) {
      console.error('[fecharCaixa] histórico não confirmado pelo servidor — turno preservado', res)
      alert('O fechamento NÃO foi gravado no servidor.\n\nO turno continua aberto de propósito, para o dia não se perder. Confira o aviso no topo da tela e feche o caixa de novo.')
      return { ok: false }
    }
    // Esperar TAMBÉM o apagamento do turno. Sem isto a função respondia "ok"
    // com metade da operação por confirmar: se o DELETE falhasse, o modal
    // fechava dizendo "dia fechado" e o turno voltava aberto na próxima
    // releitura — o dia existindo fechado e aberto ao mesmo tempo.
    const resTurno = await setCaixaTurno(null)
    if (!resTurno?.ok) {
      console.error('[fecharCaixa] histórico gravado, mas o turno não foi encerrado no servidor', resTurno)
      alert('O fechamento foi gravado, mas o turno NÃO foi encerrado no servidor.\n\nNão abra um novo caixa: confira o aviso no topo da tela e chame o responsável pelo sistema.')
      return { ok: false, motivo: 'turno-nao-encerrado' }
    }
    return { ok: true }
  }

  // Cliente voltou e pagou o que ficou devendo numa venda de balcão.
  //
  // O dinheiro entra no caixa de HOJE (é hoje que ele está na gaveta), como uma
  // venda de quitação apontando para a dívida original. A venda antiga não é
  // reescrita: turno fechado é registro histórico, e mexer nele mudaria o
  // fechamento daquele dia.
  function registrarQuitacaoVenda(item, pagamentos) {
    if (!item || !r.current.caixaTurno) return null
    return registrarVendaCaixa({
      clienteId: item.clienteId ?? null,
      clienteNome: item.clienteNome || 'Cliente',
      itens: [{ id: gerarId(), tipo: 'servico', nome: `Quitação da venda ${item.numero}`, preco: item.saldo, qtd: '1', desc: '0' }],
      total: item.saldo,
      pagamentos: pagamentos || [],
      quitacaoDe: item.id,
      // De propósito SEM `osId`. Os estornos de OS apagam lançamentos filtrando
      // por osId; se a quitação carregasse o osId, reabrir a OS meses depois
      // apagaria um recebimento que aconteceu de verdade — a dívida voltava
      // inteira e o dinheiro sumia do turno em que entrou. O vínculo com a
      // dívida original é o `quitacaoDe`, que é o que importa aqui.
      observacoes: `Recebimento de dívida em aberto da venda ${item.numero}`,
    })
  }

  // --- DADOS DERIVADOS ---
  const devedores = ordens.filter(o => o.status === 'Concluída' && !o.pago)

  // Tudo que a oficina tem a receber: OS concluída não paga + venda de balcão
  // com saldo em aberto, inclusive de turnos já fechados. Antes só a primeira
  // metade aparecia, e a venda "pago sexta" sumia na virada do turno.
  // Memoizado: varre todos os turnos × vendas e, para cada dívida, o financeiro
  // inteiro. Sem isso rodava a cada render do provider — inclusive a cada tecla
  // digitada numa tela que grava — e travava o tablet com meses de histórico.
  const aReceber = useMemo(
    () => listaAReceber({ ordens, totalOrdem, caixaTurno, caixaHistorico, financeiro }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordens, caixaTurno, caixaHistorico, financeiro],
  )

  // Resumo do financeiro.
  //
  // `receitas`/`despesas` continuam sendo o acumulado de sempre para não quebrar
  // quem já lê esse formato, mas o número que interessa no dia a dia é o do mês:
  // acumulado desde o primeiro dia da oficina só cresce e não responde se este
  // mês está melhor que o passado. `mes`/`mesAnterior` vêm prontos para isso —
  // o `mesAnterior` é recortado no mesmo dia do mês (dia 1 a 10 contra 1 a 10),
  // senão dez dias apareceriam como queda contra um mês inteiro.
  //
  // Memoizado porque varre o financeiro inteiro três vezes e antes rodava a cada
  // render do provider, inclusive a cada tecla digitada numa tela que grava.
  const resumoFinanceiro = useMemo(() => {
    const total = resumirFinanceiro(financeiro, intervaloDe('tudo'))
    const mes = resumirFinanceiro(financeiro, intervaloDe('mes'))
    const mesAnterior = resumirFinanceiro(financeiro, periodoAnteriorDe('mes'))
    return { receitas: total.receitas, despesas: total.despesas, total, mes, mesAnterior }
  }, [financeiro])

  const estoqueAlerta = estoque.filter(i => Number(i.estoque) <= Number(i.minimo))

  // Reservas: peças comprometidas em OS ainda não aprovadas (derivado das OS,
  // nunca gravado — reserva não é movimento). Mapa String(pecaId) → quantidade.
  // `disponivelDe` é o que dá para prometer: saldo físico menos o reservado.
  const reservas = useMemo(() => reservasPorPeca(ordens), [ordens])
  const reservadoDe = (pecaId) => reservas.get(String(pecaId)) || 0
  const disponivelDe = (pecaId) => {
    const p = estoque.find(e => String(e.id) === String(pecaId))
    if (!p) return null
    return (Number(p.estoque) || 0) - reservadoDe(pecaId)
  }

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
      ordens, setOrdens, novaOrdem, pagarOrdem, reabrirOrdem, concluirOrdem, entregarOrdem, entregarSemCobrar,
      atualizarOrdem, adicionarItemOrdem, adicionarItensOrdem, removerItemOrdem, editarItemOrdem, mudarStatusOrdem,
      adicionarFotoOrdem, removerFotoOrdem, excluirOrdem, subtotalOrdem, totalOrdem,
      salvarDiagnostico, salvarVistoria, encontrarOSDaFicha,
      // Fluxo do pátio — o status é consequência destas ações
      FLUXO,
      iniciarDiagnostico, finalizarDiagnostico, assumirServico,
      aprovarOrcamento, recusarOrcamento, fecharRecusa,
      iniciarReparo, marcarAguardandoPeca, pecaChegou, concluirReparo,
      liberarConferencia, reprovarConferencia, criarOSGarantia,
      estoque, setEstoque, movimentarEstoque, reservas, reservadoDe, disponivelDe, juntarPecas,
      financeiro, setFinanceiro, adicionarLancamento,
      agenda, setAgenda,
      funcionarios, setFuncionarios,
      servicos, setServicos,
      orcamentos, setOrcamentos,
      compras, setCompras, criarCompra, atualizarCompra, receberCompra, excluirCompra,
      fornecedores, setFornecedores,
      gastos, setGastos, insumos, setInsumos,
      caixaTurno, caixaHistorico, abrirCaixa, registrarVendaCaixa, excluirVendaCaixa,
      reprocessarTaxasPendentes,
      registrarSangria, registrarReforco, fecharCaixa, setCaixaTurno,
      devedores, aReceber, registrarQuitacaoVenda, diasEmAberto,
      resumoFinanceiro, estoqueAlerta,
      getCliente, getVeiculo, getFuncionario,
      checklists, setChecklists, gerarNumeroChecklist,
      veiculosPorCliente, ordensPorCliente, ordensPorVeiculo,
      config, setConfig,
      carregando, caixaCarregado, funcionariosCarregados,
      realtimeOk, ultimaSync, sincronizarOrdens,
    }}>
      {/* Falha de gravação não pode ser silenciosa: antes, o erro ia só para o
          console e a pessoa fechava a tela achando que estava salvo. */}
      {/* Leitura que voltou vazia para uma tabela que tinha dados. Fica ACIMA do
          aviso de gravacao porque, se o app esta cego para o que existe, tudo
          que for lancado por cima disso nasce errado. */}
      {leituraSuspeita && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-black text-sm font-semibold text-center py-2.5 px-4 shadow-lg">
          ⚠ O servidor devolveu uma lista VAZIA para dados que existem. A tela pode estar incompleta —
          NAO lance nada agora e avise o responsavel pelo sistema. Recarregue a pagina para tentar de novo.
        </div>
      )}
      {gravacaoPendente > 0 && !leituraSuspeita && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-red-600 text-white text-sm font-semibold text-center py-2.5 px-4 shadow-lg">
          ⚠ {gravacaoPendente === 1 ? 'Uma alteração ainda NÃO foi salva' : `${gravacaoPendente} alterações ainda NÃO foram salvas`} no servidor
          {/* Mandar verificar a internet quando o servidor RECUSOU a gravação faz
              a oficina reiniciar o roteador atrás de um problema que não está lá. */}
          {falhaDePermissao
            ? ' — o servidor recusou a gravação. NÃO é problema de internet: avise o responsável pelo sistema antes de continuar lançando.'
            : pendenciaAntiga
              // Parou de tentar sozinho de propósito: reenviar a foto de ontem
              // por cima do trabalho de hoje apagaria o trabalho de hoje.
              ? ' — e parei de tentar sozinho, porque são antigas e reenviá-las agora poderia apagar o trabalho de hoje. Avise o responsável pelo sistema.'
              : ' — verifique a internet. Vou tentar de novo sozinho; não feche esta tela.'}
        </div>
      )}
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider')
  return ctx
}

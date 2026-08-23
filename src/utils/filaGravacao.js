// Fila de gravações pendentes que sobrevive a fechar a aba.
//
// Até aqui a fila de falhas vivia num useRef do AppContext. Fechar a aba, o
// navegador cair ou o celular matar a página apagava tudo que ainda não tinha
// chegado ao Supabase — e o aviso vermelho "não feche esta tela" era a única
// defesa. Um turno inteiro de oficina podia existir só na RAM de um Chrome.
//
// Guarda em IndexedDB e não em localStorage: localStorage é síncrono (trava a
// tela justo na hora de salvar uma OS grande), tem teto de ~5MB e só aceita
// string. Sem biblioteca — IndexedDB puro, o projeto não tem idb nem dexie.
//
// Nenhuma função daqui lança para quem chama. Falhar ao enfileirar não pode
// derrubar o salvamento: quando o IndexedDB não está disponível (aba anônima,
// quota estourada, permissão negada) a fila cai para memória, que é pior que
// disco e infinitamente melhor que um erro no meio da gravação.
//
// A lógica de decisão (dedup, ordem, teto) é pura e recebe o tempo por
// parâmetro, para poder ser testada fora do navegador.

const NOME_BANCO = 'injecar-fila-gravacao'
const NOME_STORE = 'pendencias'
const VERSAO = 1

// Teto de segurança: fila cheia é sintoma de queda longa, não de uso normal.
// Melhor perder o mais velho — que quase sempre já foi sobrescrito por uma
// versão mais nova da mesma linha — do que encher o disco do tablet.
export const TETO_PADRAO = 500

// Em aba anônima (e no Safari com armazenamento bloqueado) o open pode não
// responder nunca — nem sucesso, nem erro. Sem prazo, todo salvamento ficaria
// pendurado esperando um evento que não vem.
const PRAZO_ABERTURA = 3000

// ── Lógica pura ───────────────────────────────────────────────────────────

function idDaLinha(row) {
  const id = row?.id
  return id != null && id !== '' ? String(id) : ''
}

// Chave de deduplicação de UMA linha. O tipo entra na chave de propósito:
// gravar a linha X e apagar a linha X são duas pendências diferentes e não
// podem se anular — quem apagou depois de gravar quer as duas coisas, nessa
// ordem. É por isso que `listar` devolve em ordem de criação.
function chaveDaLinha(tabela, tipo, id) {
  return `${tabela}:${tipo}:${id}`
}

// Põe a pendência no formato canônico e gera o id. Pura: o `agora` entra por
// parâmetro. Devolve null quando não há nada aproveitável — quem chama trata
// isso como "ignorada", nunca como erro.
export function normalizarPendencia(p, agora) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null

  const tabela = typeof p.tabela === 'string' ? p.tabela.trim() : ''
  if (!tabela) return null

  // 'movimento' é o kardex: linhas que vão para a função registrar_movimentos,
  // não para um upsert. Rebaixá-lo para 'gravar' inseriria o extrato SEM somar
  // o saldo — por isso o tipo sobrevive à normalização.
  const tipo = p.tipo === 'apagar' ? 'apagar' : (p.tipo === 'movimento' ? 'movimento' : 'gravar')

  // `delId` é o formato da fila antiga em memória (uma linha por pendência).
  // Aceitar os dois evita perder o que já estava na fila na hora da migração.
  const brutos = p.ids != null ? p.ids : (p.delId != null ? [p.delId] : [])
  const ids = (Array.isArray(brutos) ? brutos : [brutos])
    .filter(id => id != null && id !== '')
    .map(String)

  const rows = (Array.isArray(p.rows) ? p.rows : []).filter(r => r && typeof r === 'object')

  // Pendência de gravar/movimento sem linha, ou de apagar sem id, não tem o
  // que enviar. 'movimento' carrega rows como 'gravar' — testar ids aqui
  // descartava toda baixa de estoque que falhasse, e apagava a tarja junto.
  const precisaRows = tipo !== 'apagar'
  if (precisaRows ? rows.length === 0 : ids.length === 0) return null

  const criadoEm = Number.isFinite(p.criadoEm)
    ? p.criadoEm
    : (Number.isFinite(agora) ? agora : 0)

  // Linha sem id não dá para identificar: recebe um apelido preso ao instante
  // da falha, para não colidir com outra pendência igualmente sem id.
  const semId = `sem-id-${criadoEm}`
  const chave = tipo === 'apagar'
    ? ids.join('|')
    : rows.map(r => idDaLinha(r) || semId).join('|')

  return {
    // Campos que o AppContext carrega junto (ex.: `motivo`) sobrevivem.
    ...p,
    id: `${tabela}:${tipo}:${chave}`,
    tabela,
    tipo,
    rows,
    ids,
    criadoEm,
    tentativas: Number.isFinite(p.tentativas) ? p.tentativas : 0,
    ultimoErro: p.ultimoErro != null ? String(p.ultimoErro) : null,
  }
}

// Deduplica por (tabela, tipo, id da linha) mantendo SEMPRE a versão mais nova,
// e devolve em ordem de criação.
//
// Isto é o coração do arquivo e vem de um problema real: a fila guarda a foto
// da linha tirada no instante da falha. Se a mesma OS falhou três vezes com
// conteúdos diferentes, reenviar as três em ordem faz a foto velha sobrescrever
// a nova — e a mescla de OS não protege aqui, porque este caminho passa por
// fora dela. A dedup antiga (AppContext) usava os ids das linhas grudados como
// chave, então uma pendência [A,B] e outra [A] tinham chaves diferentes e as
// duas sobreviviam: o A velho voltava por cima do A novo. Aqui a conta é por
// linha, e não por pendência.
export function dedupPendencias(lista) {
  if (!Array.isArray(lista)) return []

  // Entrada torta (registro truncado, objeto de outra versão do app) é
  // descartada uma a uma — nunca derruba a fila inteira.
  const validas = []
  for (const p of lista) {
    const n = normalizarPendencia(p, p?.criadoEm)
    if (n) validas.push(n)
  }

  // Sem `criadoEm` a pendência vai para o começo: perde a disputa contra quem
  // tem hora marcada, em vez de ressuscitar por cima de dado mais novo.
  const ordenadas = validas.sort((a, b) => a.criadoEm - b.criadoEm)

  // Percorre do mais novo para o mais velho: a primeira vez que uma linha
  // aparece é a versão que fica; as anteriores caem fora.
  const vistas = new Set()
  const mantidas = []
  for (let i = ordenadas.length - 1; i >= 0; i--) {
    const p = ordenadas[i]
    if (p.tipo === 'apagar') {
      const ids = p.ids.filter(id => {
        const chave = chaveDaLinha(p.tabela, 'apagar', id)
        if (vistas.has(chave)) return false
        vistas.add(chave)
        return true
      })
      if (ids.length > 0) mantidas.push({ ...p, ids })
    } else {
      const rows = p.rows.filter(r => {
        const id = idDaLinha(r)
        // Linha sem id não é deduplicável; some perder uma gravação é pior que
        // reenviar duas vezes, ela fica.
        if (!id) return true
        // O tipo real entra na chave: 'movimento' (kardex) e 'gravar' da mesma
        // tabela nunca se anulam entre si.
        const chave = chaveDaLinha(p.tabela, p.tipo, id)
        if (vistas.has(chave)) return false
        vistas.add(chave)
        return true
      })
      if (rows.length > 0) mantidas.push({ ...p, rows })
    }
  }

  return mantidas.reverse()
}

// Corta pelo teto, descartando as MAIS ANTIGAS e mantendo a ordem de criação.
// Pura de propósito: quem chama é que decide avisar sobre o descarte.
export function aplicarTeto(lista, max) {
  if (!Array.isArray(lista)) return []
  const teto = Number.isFinite(max) && max > 0 ? Math.floor(max) : TETO_PADRAO
  if (lista.length <= teto) return lista.slice()
  const ordenadas = lista.slice().sort((a, b) => (a?.criadoEm || 0) - (b?.criadoEm || 0))
  return ordenadas.slice(ordenadas.length - teto)
}

// ── Acesso ao IndexedDB (e o plano B em memória) ──────────────────────────

let promessaBanco = null
let modoMemoria = false        // já sabemos que o IndexedDB não vai servir
const memoria = new Map()      // id -> pendência; ordem de inserção = ordem de criação

function abrirBanco() {
  if (modoMemoria) return Promise.resolve(null)
  if (promessaBanco) return promessaBanco

  promessaBanco = new Promise(resolve => {
    // Só ler `indexedDB` já lança em alguns navegadores com cookies bloqueados.
    let idb
    try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null } catch { idb = null }
    if (!idb) { modoMemoria = true; resolve(null); return }

    let respondido = false
    const responder = db => {
      if (respondido) return
      respondido = true
      if (!db) modoMemoria = true
      resolve(db)
    }

    const prazo = setTimeout(() => {
      console.warn('[filaGravacao] IndexedDB não respondeu a tempo; a fila desta sessão fica na memória')
      responder(null)
    }, PRAZO_ABERTURA)

    let req
    try {
      req = idb.open(NOME_BANCO, VERSAO)
    } catch (e) {
      clearTimeout(prazo)
      console.warn('[filaGravacao] IndexedDB recusou abrir:', e)
      responder(null)
      return
    }

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(NOME_STORE)) db.createObjectStore(NOME_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      clearTimeout(prazo)
      const db = req.result
      // Outra aba pediu versão nova: solta o banco para não travá-la.
      db.onversionchange = () => { try { db.close() } catch { /* já fechado */ } ; promessaBanco = null }
      db.onclose = () => { promessaBanco = null }
      // Se o prazo já tinha estourado, o banco ainda serve para as próximas
      // gravações — o que foi para a memória continua visível em `listar`.
      if (respondido) { modoMemoria = false; promessaBanco = Promise.resolve(db); return }
      responder(db)
    }
    req.onerror = () => {
      clearTimeout(prazo)
      console.warn('[filaGravacao] IndexedDB indisponível:', req.error)
      responder(null)
    }
    req.onblocked = () => { clearTimeout(prazo); responder(null) }
  })

  return promessaBanco
}

// Roda uma transação e só resolve no `oncomplete` — antes disso o dado ainda
// não está firme no disco, e prometer gravação que pode abortar depois é
// exatamente o tipo de mentira que este arquivo existe para acabar.
function executar(db, modo, tarefa) {
  return new Promise((resolve, reject) => {
    let resultado
    let tx
    try { tx = db.transaction(NOME_STORE, modo) } catch (e) { reject(e); return }
    tx.oncomplete = () => resolve(resultado)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    try {
      tarefa(tx.objectStore(NOME_STORE), v => { resultado = v })
    } catch (e) {
      try { tx.abort() } catch { /* a transação já pode ter morrido sozinha */ }
      reject(e)
    }
  })
}

// Lê tudo do store. Sem índice por `criadoEm` de propósito: registro sem esse
// campo ficaria fora de um índice e nunca mais seria lido nem apagado. A ordem
// vem da função pura, que é quem manda nela.
function lerTudo(store, definir) {
  const req = store.getAll()
  req.onsuccess = () => definir(Array.isArray(req.result) ? req.result : [])
}

function guardarNaMemoria(nova) {
  const compactada = aplicarTeto(dedupPendencias([...memoria.values(), nova]), TETO_PADRAO)
  memoria.clear()
  for (const p of compactada) memoria.set(p.id, p)
  return nova
}

// ── API ───────────────────────────────────────────────────────────────────

// Grava (ou atualiza) uma pendência e devolve ela com o id gerado.
// Devolve null só quando não havia nada para enfileirar.
export async function enfileirar(pendencia) {
  // Único lugar que olha o relógio: a lógica de decisão recebe tudo pronto.
  const nova = normalizarPendencia(pendencia, Date.now())
  if (!nova) {
    console.warn('[filaGravacao] pendência sem tabela ou sem conteúdo, ignorada:', pendencia)
    return null
  }

  try {
    const db = await abrirBanco()
    if (!db) return guardarNaMemoria(nova)

    // Ler e escrever na MESMA transação readwrite: o IndexedDB serializa
    // transações de escrita no mesmo store, então dois salvamentos simultâneos
    // não se atropelam no meio do ler-decidir-gravar.
    await executar(db, 'readwrite', (store, definir) => {
      lerTudo(store, antigas => {
        const deduplicada = dedupPendencias([...antigas, nova])
        const compactada = aplicarTeto(deduplicada, TETO_PADRAO)
        if (compactada.length < deduplicada.length) {
          console.warn(`[filaGravacao] fila passou de ${TETO_PADRAO}: ${deduplicada.length - compactada.length} pendência(s) mais antiga(s) descartada(s)`)
        }

        const porId = new Map(compactada.map(p => [p.id, p]))
        for (const velha of antigas) {
          const atual = porId.get(velha.id)
          if (!atual) { store.delete(velha.id); continue }
          // A dedup só tira linha, nunca muda o conteúdo delas: se a contagem
          // mudou, esta pendência encolheu e precisa ser regravada.
          const mudou = atual.rows.length !== (velha.rows?.length || 0) ||
                        atual.ids.length !== (velha.ids?.length || 0)
          if (mudou) store.put(atual)
        }
        // A nova só entra se sobreviveu à dedup. Não sobreviver significa que o
        // que já estava na fila é mais novo que ela — e aí é ele que vale.
        const minha = porId.get(nova.id)
        if (minha) store.put(minha)
        definir(true)
      })
    })
    return nova
  } catch (e) {
    console.warn('[filaGravacao] IndexedDB recusou a gravação; esta pendência fica na memória:', e)
    return guardarNaMemoria(nova)
  }
}

// Todas as pendências, em ordem de criação — a ordem em que devem ser
// reenviadas, para que um "apagar" não seja aplicado antes do "gravar" que
// veio antes dele.
export async function listar() {
  let doBanco = []
  try {
    const db = await abrirBanco()
    if (db) doBanco = await executar(db, 'readonly', lerTudo)
  } catch (e) {
    console.warn('[filaGravacao] não consegui ler a fila do IndexedDB:', e)
  }
  // A memória entra junto: se o IndexedDB falhou no meio do turno, parte da
  // fila ficou de um lado e parte do outro, e quem drena precisa ver as duas.
  return dedupPendencias([...(doBanco || []), ...memoria.values()])
}

// Remove uma pendência — normalmente depois de ela ter sido enviada com
// sucesso. `criadoEmEnviado` é opcional e serve de trava: enquanto a pendência
// era enviada, a mesma linha pode ter falhado de novo e entrado na fila por
// cima; apagar às cegas jogaria fora a versão mais nova, que nunca chegou ao
// banco.
export async function remover(id, criadoEmEnviado) {
  const chave = id != null ? String(id) : ''
  if (!chave) return false

  const podeApagar = registro =>
    !registro || !Number.isFinite(criadoEmEnviado) || !(registro.criadoEm > criadoEmEnviado)

  if (podeApagar(memoria.get(chave))) memoria.delete(chave)

  try {
    const db = await abrirBanco()
    if (!db) return true
    await executar(db, 'readwrite', store => {
      if (!Number.isFinite(criadoEmEnviado)) { store.delete(chave); return }
      const req = store.get(chave)
      req.onsuccess = () => { if (podeApagar(req.result)) store.delete(chave) }
    })
    return true
  } catch (e) {
    console.warn('[filaGravacao] não consegui remover a pendência', chave, e)
    return false
  }
}

// Quantas pendências há — é o número do aviso vermelho na tela. Usa o `count`
// do store porque `enfileirar` já deixa o banco deduplicado; se algum registro
// velho de outra versão do app escapar, o aviso erra para mais, nunca para
// menos.
export async function contar() {
  try {
    const db = await abrirBanco()
    if (!db) return memoria.size
    const n = await executar(db, 'readonly', (store, definir) => {
      const req = store.count()
      req.onsuccess = () => definir(req.result || 0)
    })
    return (n || 0) + memoria.size
  } catch (e) {
    console.warn('[filaGravacao] não consegui contar a fila:', e)
    return memoria.size
  }
}

// Esvazia a fila. Uso administrativo/teste — apaga trabalho que não chegou ao
// banco, então não deve ser chamado no fluxo normal do app.
export async function limpar() {
  memoria.clear()
  try {
    const db = await abrirBanco()
    if (!db) return true
    await executar(db, 'readwrite', store => { store.clear() })
    return true
  } catch (e) {
    console.warn('[filaGravacao] não consegui limpar a fila:', e)
    return false
  }
}

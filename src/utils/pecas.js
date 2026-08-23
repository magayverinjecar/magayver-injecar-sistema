// Identidade da peça: como comparar código e nome sem tropeçar em detalhe de
// digitação, e como descobrir que duas linhas do cadastro são a mesma peça.
//
// Por que existe: o cadastro nunca bloqueou código repetido, e o resultado são
// 83 códigos duplicados em 543 peças — sete cadastros da mesma vela, cinco do
// mesmo filtro de cabine, "RESERVATORIO" e "RESERVATÓRIO" como peças
// diferentes. O saldo real fica espalhado, o mínimo dispara errado e, quando
// a entrada por XML chegar, ela casaria com uma base já bagunçada.
//
// Tudo aqui é puro: recebe dados, devolve dados.

// Chave de comparação: minúscula, sem acento, sem espaço, sem hífen, barra ou
// ponto. "FLU/DS/280FU3", "flu ds 280fu3" e "FLU-DS-280FU3" viram a mesma
// coisa; "RESERVATÓRIO" e "RESERVATORIO" também.
export function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // tira acentos
    .toLowerCase()
    .replace(/[\s\-/.,_]/g, '')
    .trim()
}

// Códigos que identificam a peça. Hoje é um só (`codigo`); o cadastro completo
// vai acrescentar código do fabricante, EAN e o código de cada fornecedor —
// esta função é o ponto único que todos vão usar.
export function codigosDaPeca(peca) {
  const lista = [peca?.codigo, ...(Array.isArray(peca?.codigos) ? peca.codigos.map(c => c?.valor ?? c) : [])]
  const vistos = new Set()
  const saida = []
  for (const c of lista) {
    const k = normalizar(c)
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    saida.push(k)
  }
  return saida
}

// Peça ativa? Peça desativada continua no histórico e no extrato, mas some da
// busca e do lançamento. Sem a marca, é ativa (todo o cadastro de hoje).
export function pecaAtiva(peca) {
  return peca?.ativo !== false
}

// Procura no cadastro quem já usa este código. Ignora a própria peça (edição)
// e as inativas por padrão.
export function pecaComCodigo(estoque, codigo, { ignorarId = null, incluirInativas = false } = {}) {
  const k = normalizar(codigo)
  if (!k) return null
  return (estoque || []).find(p => {
    if (ignorarId != null && String(p.id) === String(ignorarId)) return false
    if (!incluirInativas && !pecaAtiva(p)) return false
    return codigosDaPeca(p).includes(k)
  }) || null
}

// Grupos de peças que são provavelmente a mesma coisa, para a ferramenta de
// juntar. Critério: mesmo código normalizado. Devolve só os grupos com 2+.
//
// `semelhanca` mede o quanto os nomes batem dentro do grupo, para a tela poder
// separar "idênticos" (junta sem medo) de "parecidos" (o dono confere).
export function gruposDuplicados(estoque) {
  const porCodigo = new Map()
  for (const p of estoque || []) {
    for (const k of codigosDaPeca(p)) {
      if (!porCodigo.has(k)) porCodigo.set(k, [])
      porCodigo.get(k).push(p)
      break   // agrupa pelo código principal; alternativos entram no bloco 04
    }
  }
  const grupos = []
  for (const [codigo, pecas] of porCodigo) {
    if (pecas.length < 2) continue
    const nomes = new Set(pecas.map(p => normalizar(p.nome)))
    grupos.push({
      codigo,
      codigoOriginal: pecas[0].codigo,
      pecas,
      nomesIguais: nomes.size === 1,
      // Saldo somado é o que a fusão vai deixar na peça vencedora.
      saldoTotal: pecas.reduce((s, p) => s + (Number(p.estoque) || 0), 0),
    })
  }
  // Mais peças no grupo primeiro: são as que mais atrapalham.
  return grupos.sort((a, b) => b.pecas.length - a.pecas.length)
}

// Qual peça do grupo deve ficar, por padrão: a que tem mais saldo; empate, a
// de nome mais completo; empate ainda, a mais antiga (id menor).
export function sugerirVencedora(pecas) {
  return [...(pecas || [])].sort((a, b) => {
    const sa = Number(a.estoque) || 0, sb = Number(b.estoque) || 0
    if (sb !== sa) return sb - sa
    const na = (a.nome || '').length, nb = (b.nome || '').length
    if (nb !== na) return nb - na
    return Number(a.id) - Number(b.id)
  })[0] || null
}

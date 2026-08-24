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

// Os códigos pelos quais a peça pode ser PROCURADA.
//
// SEPARADO DE `codigosDaPeca` DE PROPÓSITO — não junte os dois.
//
// `codigosDaPeca` responde "qual é a identidade desta peça?" e é o que impede
// cadastrar código repetido e o que casa o item da nota fiscal. Se o código do
// fabricante entrasse lá, uma peça nova poderia ser RECUSADA porque o código
// interno dela é igual ao código-de-fabricante de outra — coisas diferentes,
// tratadas como a mesma. Identidade tem de ser estreita.
//
// Busca é o contrário: quanto mais caminhos levarem à peça certa, melhor. Aqui
// entra tudo que está escrito na embalagem ou na nota.
export function codigosDeBusca(peca) {
  const lista = [
    peca?.codigo,
    peca?.codigoFabricante,   // o código original (GM, VW, Bosch...)
    peca?.ean,                // o código de barras
    ...(Array.isArray(peca?.codigos) ? peca.codigos.map(c => c?.valor ?? c) : []),
  ]
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

// Sem acento e minúsculo, mas SEM tirar espaço — para o nome. `normalizar`
// gruda tudo, o que é certo para código e errado para texto: quem digita
// "filtro ar" não acharia "FILTRO DE AR" se o espaço sumisse dos dois lados.
function texto(valor) {
  return String(valor ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
}

// Esta peça atende a busca?
//
// Ponto único usado pelo Estoque, pelo painel de itens da OS/orçamento, pela
// Venda Balcão e pelas Movimentações — antes cada tela tinha a própria cópia
// com `nome OU codigo`, e o código do fabricante não era achado em lugar
// nenhum, mesmo estando cadastrado e vindo preenchido do XML da nota.
//
// NOME casa por pedaço do texto; CÓDIGO casa normalizado, então "9334-2049",
// "9334 2049" e "93342049" acham a mesma peça — que é como o código aparece na
// embalagem, na nota e na cabeça de quem digita.
export function casaBusca(peca, termo) {
  const t = texto(termo)
  if (!t) return true
  if (texto(peca?.nome).includes(t)) return true
  const k = normalizar(termo)
  if (!k) return false
  return codigosDeBusca(peca).some(c => c.includes(k))
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

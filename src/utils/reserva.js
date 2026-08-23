// Reserva e baixa de peça derivadas do ESTADO da OS (bloco 02 do estoque).
//
// A regra, inteira:
//   - peça lançada numa OS ANTES da aprovação fica RESERVADA: aparece como
//     comprometida, mas não sai do saldo;
//   - quando a OS passa para um status de trabalho (Aprovado em diante), cada
//     peça reservada é BAIXADA — um movimento de kardex por item;
//   - cancelar, excluir, recusar ou voltar para antes da aprovação DEVOLVE só
//     o que foi baixado; reserva some sem movimento, porque nunca saiu.
//
// Não existe "função de baixar" nem "função de estornar" espalhada pelo app:
// toda escrita de OS passa por `setOrdens`, que chama `derivarMovimentosDaOS`
// com a OS antes e depois. A verdade fica gravada NO ITEM (`estoqueBaixado`,
// `baixaN`), não na OS — é o que permite dois aparelhos, mescla e reenvio da
// fila convergirem sem contar duas vezes.
//
// Tudo aqui é puro: recebe dados, devolve dados. Sem React, sem Supabase.

// Status em que a peça fica só RESERVADA. O resto (Aprovado, Aguardando Peça,
// Em Execução, Em Conferência, Concluída, Entregue e os legados Aberta /
// Aprovada / Em Andamento) conta como "em uso": peça baixada. Status
// desconhecido também cai em "em uso" — é o comportamento antigo, o mais seguro.
export const STATUS_RESERVA = [
  'Recepção',
  'Em Diagnóstico',
  'Aguardando Aprovação',
  'Rejeitada',
  // legados que ainda podem existir em OS antigas
  'Diagnóstico',
  'Diagnóstico concluído',
]

// Status em que a peça nem reserva nem baixa: OS morta.
export const STATUS_SEM_PECA = ['Cancelada']

// Item SEM marca booleana é item do app antigo: foi baixado no lançamento
// (regra antiga). Não existe barreira de tempo — a regra carimba a marca em
// todo item que passa por ela, então "sem marca" só sobra no legado.

export function ehPecaDeEstoque(item) {
  return !!item && item.tipo === 'peca' && item.produtoId != null && item.produtoId !== ''
}

export function qtdDoItem(item) {
  return Number(item?.quantidade) || 1
}

export const STATUS_FINAL = ['Entregue', 'Concluída']

// Nesta OS, as peças devem estar baixadas (true) ou só reservadas (false)?
export function deveEstarBaixado(os) {
  if (!os) return false
  if (STATUS_SEM_PECA.includes(os.status)) return false
  if (STATUS_RESERVA.includes(os.status)) return false
  // OS que terminou SEM usar as peças (orçamento recusado e entregue, carro
  // retirado sem o serviço): fecharRecusa e o Pátio marcam `pecasLiberadas`.
  // `estoqueEstornado` é a marca equivalente que o bloco 01 deixou nas OS
  // recusadas antes desta regra existir.
  if ((os.pecasLiberadas || os.estoqueEstornado) && STATUS_FINAL.includes(os.status)) return false
  return true
}

// Item legado (criado pelo app antigo, sem marca)? Ele foi baixado no
// lançamento — uma baixa já aconteceu, estornada ou não.
function ehLegado(item) {
  return !!item && typeof item.estoqueBaixado !== 'boolean'
}

// Quantas baixas este item já teve. Conta para a chave determinística: a
// próxima baixa usa n+1, e nunca colide com a anterior. Item legado conta 1
// mesmo quando já foi estornado (bloco 01) — senão a re-baixa repetiria a
// chave da baixa original e o banco a ignoraria.
export function baixasDoItem(item) {
  if (!item) return 0
  const n = Number(item.baixaN)
  if (Number.isFinite(n) && n > 0) return n
  return ehLegado(item) ? 1 : 0
}

// O item está baixado hoje? Lê a marca; sem marca, aplica a regra de legado:
// baixou no lançamento, a menos que a OS inteira tenha sido estornada (marca
// do bloco 01) ou já esteja morta (cancelada antes de o kardex existir — nessa
// ninguém mexeu no saldo, e uma edição qualquer não pode "devolver" peça).
export function itemBaixado(item, os) {
  if (!item) return false
  if (typeof item.estoqueBaixado === 'boolean') return item.estoqueBaixado
  if (os?.estoqueEstornado) return false
  if (STATUS_SEM_PECA.includes(os?.status)) return false
  return true
}

// Quantas unidades de cada peça estão RESERVADAS (comprometidas em OS antes
// da aprovação, ainda não baixadas). Mapa String(pecaId) → quantidade.
export function reservasPorPeca(ordens) {
  const mapa = new Map()
  for (const os of ordens || []) {
    // Só OS em status de reserva seguram peça. Recusada-e-entregue não: as
    // peças voltaram à prateleira e a OS acabou.
    if (!os || !STATUS_RESERVA.includes(os.status)) continue
    for (const it of os.itens || []) {
      if (!ehPecaDeEstoque(it) || itemBaixado(it, os)) continue
      const k = String(it.produtoId)
      mapa.set(k, (mapa.get(k) || 0) + qtdDoItem(it))
    }
  }
  return mapa
}

// Chave determinística do movimento: a mesma ação em dois aparelhos gera o
// mesmo uuid e o banco conta uma vez. A primeira baixa de um item usa a MESMA
// chave que o app antigo usava ao lançar ('saida_os' + OS + item) — assim um
// aparelho ainda no código velho e um no novo não baixam em dobro.
function chaveBaixa(osId, item, n) {
  return n <= 1 ? ['saida_os', osId, item.id] : ['saida_os', osId, item.id, n]
}
function chaveEstorno(osId, item, n, sufixo) {
  return sufixo ? ['estorno_os', osId, item.id, n, sufixo] : ['estorno_os', osId, item.id, n]
}

// O coração: dada a OS antes (`prevOS`, pode ser null = OS nova) e depois
// (`nextOS`, pode ser null = OS excluída), devolve os movimentos de kardex a
// disparar e a OS depois com as marcas atualizadas nos itens.
//
// `custoDe(produtoId)` devolve o custo unitário para carimbar nas saídas.
export function derivarMovimentosDaOS(prevOS, nextOS, custoDe = () => undefined) {
  const osId = (nextOS || prevOS)?.id
  const movimentos = []
  const prevItens = new Map((prevOS?.itens || []).map(i => [String(i.id), i]))
  const pos = deveEstarBaixado(nextOS)

  // Motivo legível para o extrato, pelo que mudou na OS.
  const motivoEstorno = !nextOS
    ? 'OS excluída'
    : nextOS.status === 'Cancelada'
      ? 'OS cancelada'
      : (nextOS.pecasLiberadas && !prevOS?.pecasLiberadas)
        ? 'Orçamento recusado — peça de volta à prateleira'
        : (prevOS && prevOS.status === nextOS.status)
          ? 'Sem aprovação: peça volta ao saldo como reservada'
          : 'OS voltou para antes da aprovação'
  const motivoBaixa = !prevOS
    ? (pos ? 'OS criada já aprovada' : '')
    : (!deveEstarBaixado(prevOS) && (prevOS.status !== nextOS?.status || (prevOS.pecasLiberadas && !nextOS?.pecasLiberadas)))
      ? (prevOS.status === 'Cancelada' || prevOS.pecasLiberadas || prevOS.estoqueEstornado
          ? 'OS reativada'
          : STATUS_FINAL.includes(nextOS?.status) ? 'OS finalizada sem passar pela aprovação' : 'OS aprovada')
      : 'Peça lançada em OS já aprovada'

  let mudouAlgumItem = false
  const itensDepois = (nextOS?.itens || []).map(item => {
    if (!ehPecaDeEstoque(item)) return item
    const antes = prevItens.get(String(item.id))
    const eraBaixado = antes ? itemBaixado(antes, prevOS) : false
    const n = antes ? baixasDoItem(antes) : 0
    const mesmaPeca = antes ? String(antes.produtoId) === String(item.produtoId) : true

    if (eraBaixado && !pos) {
      movimentos.push({
        pecaId: antes.produtoId, qtd: qtdDoItem(antes), tipo: 'estorno_os',
        motivo: motivoEstorno, origem: { tipo: 'os', id: osId },
        chave: chaveEstorno(osId, antes, n),
      })
      mudouAlgumItem = true
      return { ...item, estoqueBaixado: false, baixaN: n }
    }
    if (!eraBaixado && pos) {
      movimentos.push({
        pecaId: item.produtoId, qtd: -qtdDoItem(item), tipo: 'saida_os',
        motivo: motivoBaixa, origem: { tipo: 'os', id: osId },
        custoUnit: custoDe(item.produtoId),
        chave: chaveBaixa(osId, item, n + 1),
      })
      mudouAlgumItem = true
      return { ...item, estoqueBaixado: true, baixaN: n + 1 }
    }
    if (eraBaixado && pos) {
      // Continua baixado: só a peça trocada ou a quantidade alterada movimentam.
      if (!mesmaPeca) {
        movimentos.push({
          pecaId: antes.produtoId, qtd: qtdDoItem(antes), tipo: 'estorno_os',
          motivo: 'Peça trocada no item', origem: { tipo: 'os', id: osId },
          chave: chaveEstorno(osId, antes, n, 'troca'),
        })
        movimentos.push({
          pecaId: item.produtoId, qtd: -qtdDoItem(item), tipo: 'saida_os',
          motivo: 'Peça trocada no item', origem: { tipo: 'os', id: osId },
          custoUnit: custoDe(item.produtoId),
          chave: chaveBaixa(osId, item, n + 1),
        })
        mudouAlgumItem = true
        return { ...item, estoqueBaixado: true, baixaN: n + 1 }
      }
      const diff = qtdDoItem(item) - qtdDoItem(antes)
      if (diff !== 0) {
        // Cada ajuste ganha um número próprio (`ajusteN`): 1→2, 2→1, 1→2 de
        // novo são três movimentos, não dois — a chave nunca se repete. Os
        // números vão numa parte só, separados por ':', para n=1/ajuste=12 não
        // virar a mesma string de n=11/ajuste=2.
        const ajusteN = (Number(antes.ajusteN) || 0) + 1
        movimentos.push({
          pecaId: item.produtoId, qtd: -diff, tipo: diff > 0 ? 'saida_os' : 'estorno_os',
          motivo: diff > 0 ? 'Quantidade aumentada no item' : 'Quantidade reduzida no item',
          origem: { tipo: 'os', id: osId },
          custoUnit: diff > 0 ? custoDe(item.produtoId) : undefined,
          chave: ['ajuste_os', osId, item.id, `${n}:${ajusteN}`],
        })
        mudouAlgumItem = true
        return { ...item, estoqueBaixado: true, baixaN: n, ajusteN }
      }
      // Carimba a marca explícita em item legado (sem marca), uma vez.
      if (typeof item.estoqueBaixado !== 'boolean') { mudouAlgumItem = true; return { ...item, estoqueBaixado: true, baixaN: n } }
      return item
    }
    // !eraBaixado && !pos: só reservado — nada sai; deixa a marca explícita.
    if (typeof item.estoqueBaixado !== 'boolean') { mudouAlgumItem = true; return { ...item, estoqueBaixado: false, baixaN: n } }
    return item
  })

  // Itens que sumiram (removidos, ou OS inteira excluída): devolve o que estava baixado.
  const nextIds = new Set((nextOS?.itens || []).map(i => String(i.id)))
  for (const [id, antes] of prevItens) {
    if (nextIds.has(id) || !ehPecaDeEstoque(antes)) continue
    if (!itemBaixado(antes, prevOS)) continue
    const n = baixasDoItem(antes)
    movimentos.push({
      pecaId: antes.produtoId, qtd: qtdDoItem(antes), tipo: 'estorno_os',
      motivo: nextOS ? 'Item removido da OS' : 'OS excluída',
      origem: { tipo: 'os', id: osId },
      chave: chaveEstorno(osId, antes, n, nextOS ? 'removido' : 'excluida'),
    })
  }

  const osDepois = nextOS && mudouAlgumItem ? { ...nextOS, itens: itensDepois } : nextOS
  return { osDepois, movimentos }
}

// Aplica a regra à lista inteira de OS (prev → next), como o setter recebe.
// Devolve a lista `next` com as marcas e todos os movimentos a disparar.
export function aplicarRegraNasOrdens(prev, next, custoDe) {
  const prevMap = new Map((prev || []).map(o => [String(o.id), o]))
  const movimentos = []
  let mudou = false
  const saida = (next || []).map(o => {
    const antes = prevMap.get(String(o.id))
    if (antes === o) return o                       // OS não tocada nesta escrita
    const { osDepois, movimentos: m } = derivarMovimentosDaOS(antes || null, o, custoDe)
    if (m.length) movimentos.push(...m)
    if (osDepois !== o) mudou = true
    return osDepois
  })
  const nextIds = new Set((next || []).map(o => String(o.id)))
  for (const [id, antes] of prevMap) {
    if (nextIds.has(id)) continue
    const { movimentos: m } = derivarMovimentosDaOS(antes, null, custoDe)
    if (m.length) movimentos.push(...m)
  }
  return { next: mudou ? saida : next, movimentos }
}

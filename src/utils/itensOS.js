// Separar mão de obra de peça, na OS e no orçamento.
//
// POR QUE ISTO EXISTE
// O dono precisa olhar uma OS e enxergar quanto é serviço e quanto é peça —
// hoje as duas coisas ficam misturadas na mesma lista, na ordem em que foram
// lançadas, e para somar a mão de obra é preciso ler item por item.
//
// A ARMADILHA QUE ESTA FUNÇÃO EXISTE PARA EVITAR:
//
// As duas telas gravam o tipo com nomes DIFERENTES.
//
//   Ordem de serviço ....... tipo: 'servico'  |  'peca'
//   Orçamento .............. tipo: 'Serviço'  |  'Peça / Produto'
//
// Maiúscula, acento e sufixo. Uma verificação `tipo === 'servico'` funciona
// perfeitamente na OS e classifica TODO o orçamento como peça — sem erro, sem
// aviso, só um total de mão de obra zerado que ninguém desconfia. Por isso a
// comparação aqui é feita sobre o texto normalizado, e por isso há teste para
// as duas grafias.
//
// Item antigo, sem `tipo`: vale o vínculo com o estoque, o mesmo critério que
// `ehPeca` usa em margem.js para o CMV. Se um item conta como peça no custo,
// tem de contar como peça aqui.
//
// Funções puras — sem React, testáveis em Node.

import { parseValorBR, cent } from './numero.js'

function tipoNormalizado(item) {
  return String(item?.tipo ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase()
}

export function ehServicoDoItem(item) {
  if (!item) return false
  const t = tipoNormalizado(item)
  if (t.startsWith('servico')) return true
  if (t.startsWith('peca') || t.startsWith('produto')) return false
  // Sem tipo declarado: quem tem vínculo com o estoque é peça.
  return item.produtoId == null && item.estoqueId == null
}

// Quanto este item soma.
//
// A conta é a MESMA de `subtotalOrdem` no AppContext, incluindo o `|| 1` da
// quantidade. Não pode divergir nem em um centavo: se divergir, a soma dos dois
// blocos não bate com o total da OS e a tela passa a se contradizer sozinha.
export function totalDoItem(item) {
  const unitario = parseValorBR(item?.valorUnitario)
  const qtd = parseValorBR(item?.quantidade) || 1
  const desconto = parseValorBR(item?.desconto)
  return unitario * qtd - desconto
}

// Os itens em dois grupos, com o subtotal de cada um.
//
// A ORDEM DENTRO DE CADA GRUPO É PRESERVADA: quem lançou reconhece a própria
// sequência. Reordenar por valor ou por nome faria a pessoa procurar de novo o
// item que acabou de digitar.
export function separarItens(itens) {
  const servicos = []
  const pecas = []
  for (const item of itens || []) {
    if (!item) continue
    ;(ehServicoDoItem(item) ? servicos : pecas).push(item)
  }
  const somar = (lista) => cent(lista.reduce((s, i) => s + totalDoItem(i), 0))
  const totalServicos = somar(servicos)
  const totalPecas = somar(pecas)
  return {
    servicos,
    pecas,
    totalServicos,
    totalPecas,
    // O subtotal ANTES do desconto geral. O desconto geral é aplicado sobre o
    // total, não sobre um dos grupos — por isso a tela precisa mostrar os dois
    // subtotais, depois o desconto, depois o total. Um número que não fecha sem
    // explicação faz a pessoa desconfiar do sistema inteiro.
    subtotal: cent(totalServicos + totalPecas),
  }
}

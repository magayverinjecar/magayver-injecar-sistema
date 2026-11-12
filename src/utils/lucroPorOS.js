// Lucro por OS: quanto cada serviço deixou, separando peça e mão de obra, e
// quanto do dinheiro que entrou é do FORNECEDOR.
//
// Por que existe (pedido do dono, 12/11/2026): o cartão tem antecipação e o
// dinheiro cai na hora, mas a peça foi comprada faturada para 30 dias. Sem
// separar, o dinheiro do boleto parece lucro até o boleto vencer.
//
// A conta é a MESMA da tela da OS ("Quanto sobrou deste serviço",
// utils/margem.js → margemDaOrdem) — esta tela só junta as OS do período:
//   - custo das peças = o custo congelado em cada item (o "separar p/
//     fornecedor");
//   - lucro nas peças = o que o cliente pagou nas peças − o custo delas;
//   - mão de obra = o que o cliente pagou nos serviços, inteiro. O salário é
//     fixo e entra no mês (DRE), não em cada OS — ver metodo de margem.js;
//   - sobrou = valor da OS − custo das peças − taxa do cartão.
//
// QUAIS OS e QUANDO (decidido com o dono): as OS PAGAS, pelo DIA DO
// PAGAMENTO (`dataEntrega`, gravada ao cobrar e entregar) — é o dia em que o
// dinheiro entrou. Orçamento RECUSADO não entra, mesmo fechado como
// "Entregue": nada dele foi feito (`pecasLiberadas`, ou `estoqueEstornado` nas
// antigas). OS cancelada não entra.
// Funções puras, testáveis em Node.

import { parseValorBR, cent } from './numero.js'
import { parseDataBR } from './datas.js'
import { dentroDoPeriodo, intervaloDe } from './periodo.js'
import { margemDaOrdem, ehPeca, custoDaPeca, valorDoItem } from './margem.js'

// Os botões de data da tela. O dono não lembra número de OS nem placa: ele
// quer "as de hoje", "as desta semana". Começa em "Hoje".
export const PERIODOS_RAPIDOS = [
  { chave: 'hoje',     label: 'Hoje' },
  { chave: 'ontem',    label: 'Ontem' },
  { chave: 'semana',   label: 'Esta semana' },
  { chave: 'mes',      label: 'Este mês' },
  { chave: 'anterior', label: 'Mês passado' },
  { chave: 'custom',   label: 'Escolher datas' },
]

// O intervalo de cada botão. Mês, mês passado e datas escolhidas usam a mesma
// conta do Financeiro (utils/periodo); hoje, ontem e semana são daqui. A
// semana começa na segunda. `agora` só existe para os testes.
export function intervaloRapido(chave, { de, ate, agora } = {}) {
  const hoje = agora instanceof Date ? agora : new Date()
  const y = hoje.getFullYear(), m = hoje.getMonth(), d = hoje.getDate()
  const ini = (dia) => new Date(y, m, dia).getTime()
  const fim = (dia) => new Date(y, m, dia, 23, 59, 59, 999).getTime()
  if (chave === 'hoje') return { de: ini(d), ate: fim(d), rotulo: 'hoje' }
  if (chave === 'ontem') return { de: ini(d - 1), ate: fim(d - 1), rotulo: 'ontem' }
  if (chave === 'semana') {
    const desdeSegunda = (hoje.getDay() + 6) % 7
    return { de: ini(d - desdeSegunda), ate: fim(d), rotulo: 'esta semana' }
  }
  return intervaloDe(chave, { de, ate, agora: hoje })
}

// O dia do pagamento. As OS antigas, sem `dataEntrega`, caem na conclusão e,
// em último caso, na entrada — melhor aparecer num mês provável que sumir.
export function dataDoPagamento(os) {
  return os?.dataEntrega || os?.dataConclusao || os?.data || os?.dataEntrada || ''
}

// A OS entra no lucro por OS?
export function entraNoLucroPorOS(os) {
  if (!os || os.status === 'Cancelada') return false
  if (os.pecasLiberadas || os.estoqueEstornado) return false
  return os.status === 'Entregue' || os.pago === true
}

// Uma linha do relatório.
export function lucroDaOS(os, { estoque, totalOrdem }) {
  const m = margemDaOrdem(os, { estoque, totalOrdem })
  const aPrazo = cent((os?.pagamentos || [])
    .filter(p => p?.forma === 'Pagar Depois')
    .reduce((s, p) => s + parseValorBR(p?.valor), 0))
  // O desconto dado no fechamento não é de nenhum item: sai separado, para
  // peça + mão de obra − taxa − desconto fechar com o "sobrou".
  const descontoGeral = cent(Math.max(0, m.receitaPecas + m.receitaServicos - m.receita))
  return {
    id: os.id,
    numero: os.numero || '',
    data: dataDoPagamento(os),
    valor: m.receita,
    aPrazo,
    custoPecas: m.custoPecas,
    lucroPecas: cent(m.receitaPecas - m.custoPecas),
    maoDeObra: m.receitaServicos,
    taxaCartao: m.taxaCartao,
    descontoGeral,
    sobrou: m.margem,
    // Lacunas que deixam o número maior do que é (mesmos sinais da tela da OS).
    pecasSemCusto: m.pecasSemCusto,
    taxaPendente: m.taxaPendente,
    semItens: m.semItens,
    completa: m.completa,
  }
}

// O relatório do período: as linhas (pagamento mais recente primeiro) e os
// totais dos cartões do topo.
export function lucroPorOS(ordens, intervalo, { estoque, totalOrdem }) {
  const linhas = (ordens || [])
    .filter(entraNoLucroPorOS)
    .filter(o => dentroDoPeriodo(dataDoPagamento(o), intervalo))
    .map(o => lucroDaOS(o, { estoque, totalOrdem }))
    .sort((a, b) => (parseDataBR(b.data) || 0) - (parseDataBR(a.data) || 0))

  return { linhas, totais: totaisDe(linhas) }
}

// Os totais dos cartões do topo para um conjunto de linhas — o período
// inteiro, ou só as OS que a pessoa filtrou na busca.
export function totaisDe(linhas) {
  const soma = (campo) => cent((linhas || []).reduce((s, l) => s + l[campo], 0))
  const valor = soma('valor')
  const aPrazo = soma('aPrazo')
  return {
    valor,
    aPrazo,
    recebido: cent(valor - aPrazo),
    custoPecas: soma('custoPecas'),
    lucroPecas: soma('lucroPecas'),
    maoDeObra: soma('maoDeObra'),
    taxaCartao: soma('taxaCartao'),
    descontoGeral: soma('descontoGeral'),
    sobrou: soma('sobrou'),
    comLacuna: (linhas || []).filter(l => !l.completa).length,
    comPecaSemCusto: (linhas || []).filter(l => l.pecasSemCusto > 0).length,
  }
}

// O detalhe de UMA OS: cada peça com o custo (o que é do fornecedor), a venda
// e o lucro; cada serviço com o valor. Mesmas regras de custo e de valor da
// conta da OS (margem.js), para o detalhe somar exatamente a linha de cima.
// Peça sem custo lançado vem com `custo: null` — não vira zero, que faria o
// lucro parecer maior sem aviso.
export function detalheDaOS(os, { estoque }) {
  const pecas = []
  const servicos = []
  for (const item of os?.itens || []) {
    const venda = valorDoItem(item)
    if (ehPeca(item)) {
      const qtd = parseValorBR(item.quantidade) || 1
      const unit = custoDaPeca(item, estoque)
      const custo = unit == null ? null : cent(unit * qtd)
      pecas.push({
        id: item.id,
        descricao: item.descricao || '',
        quantidade: qtd,
        custoUnit: unit,
        custo,
        venda,
        lucro: custo == null ? null : cent(venda - custo),
        avulsa: item.produtoId == null || item.produtoId === '',
      })
    } else {
      servicos.push({ id: item.id, descricao: item.descricao || '', quantidade: parseValorBR(item.quantidade) || 1, valor: venda })
    }
  }
  return { pecas, servicos }
}

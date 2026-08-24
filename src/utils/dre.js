// DRE gerencial da oficina — em CUSTEIO VARIÁVEL, não por absorção.
//
// DECISÃO DE MÉTODO — leia antes de mexer.
//
// Esta oficina paga SALÁRIO FIXO. O mecânico custa o mesmo tendo levado 2 ou 8
// horas no carro, e não existe hora apontada por OS. Ratear esse custo dentro de
// cada serviço daria um número preciso e errado. Por isso o DRE segue a mesma
// separação que `margem.js` já faz:
//
//   • custo DIRETO (peça, taxa de cartão) sai da receita → margem de contribuição
//   • custo FIXO (aluguel, energia, salário) entra UMA vez, no nível do período
//
// E a RETIRADA do sócio aparece DEPOIS do resultado, separada. Retirada não é
// custo da oficina — é distribuição do que ela lucrou. Misturá-la nas despesas é
// o erro que mais confunde resultado em oficina pequena: o mês fecha "no
// vermelho" porque o dono tirou dinheiro, quando na verdade ele tirou justamente
// porque tinha o que tirar.
//
// ── DE ONDE VEM CADA NÚMERO (e por que não há dupla contagem) ────────────────
//
// O risco central desta conta é somar a mesma coisa duas vezes: o `financeiro`
// já guarda a receita das vendas E a taxa de cartão como despesa; as OS guardam
// a receita de novo; os `gastos` pagos viram despesa no `financeiro` também.
// Cada linha aqui lê de UMA fonte só, e as fontes são conjuntos disjuntos de
// registros:
//
//   Receita bruta   ← `financeiro`, lançamentos tipo 'receita'
//   Taxa de cartão  ← `financeiro`, despesas marcadas `taxaCartao: true`
//   CMV (peças)     ← itens das OS (não existe no `financeiro`)
//   Custo fixo      ← `gastos` tipo "Fixo" (não é lido do `financeiro`)
//   Retirada        ← `gastos` reconhecidos como retirada/pró-labore
//
// O total de despesas do `financeiro` NÃO é usado em lugar nenhum do resultado —
// é lá que a dupla contagem moraria, porque ele já contém a taxa, o espelho dos
// gastos pagos e a compra de peças. Ele entra só no bloco de conferência
// (`conferencia`), para o que ficou de fora aparecer em vez de sumir.
//
// POR QUE A RECEITA VEM DO FINANCEIRO, E NÃO DAS OS:
//   1. A oficina vende no balcão também. Receita só de OS deixaria essas vendas
//      de fora do topo do DRE — faturamento menor do que o real.
//   2. O `financeiro` registra no momento em que o dinheiro entrou, que é o mesmo
//      momento em que a taxa de cartão foi lançada. As duas linhas de cima do
//      DRE ficam no mesmo regime.
//   3. É a mesma fonte do card "Receitas" da tela. Um DRE que contradiz o card
//      logo acima dele não é usado por ninguém.
//
// O QUE ISSO IMPLICA — e está sinalizado na tela:
//   O CMV vem das OS, então ele cobre só a parcela da receita que veio de OS.
//   Venda de balcão entra no faturamento mas o custo das peças dela não é
//   apurado em lugar nenhum do sistema (o item de balcão não congela custo).
//   Por isso `receitaSemOS` é devolvido: quanto maior ele for, mais otimista
//   está a margem de contribuição. Isso é dito, não escondido.
//
// Funções puras — sem React, sem estado, testáveis em Node.

import { parseValorBR, cent } from './numero.js'
import { dentroDoPeriodo, resumirFinanceiro } from './periodo.js'
import { margemDoPeriodo, custoFixoMensal, mesesDoIntervalo, ehRetirada, ehFinanceiro, ehCustoDeOperacao, somarAbaixoDaLinha } from './margem.js'

// ── OS que viraram resultado no período ──────────────────────────────────────
// Mesma regra do Ponto de Equilíbrio, de propósito: as duas telas ficam no mesmo
// período e no mesmo conjunto de OS, senão uma desmente a outra.
//
// Orçamento aberto e carro em execução não entram — não há margem realizada até
// o serviço estar concluído. A data é a da CONCLUSÃO: é quando o serviço deixou
// de ser trabalho em curso e virou resultado. O fallback para `data`/`dataEntrada`
// serve só às OS antigas migradas, que não têm conclusão gravada.
export function ordensConcluidasNoPeriodo(ordens, intervalo) {
  return (ordens || []).filter(o => {
    if (!['Concluída', 'Entregue'].includes(o?.status)) return false
    const quando = o.dataConclusao || o.data || o.dataEntrada || ''
    return dentroDoPeriodo(quando, intervalo)
  })
}

// Participação de cada linha sobre o faturamento (análise vertical).
// Sem faturamento não existe percentual — devolve null em vez de 0, que na tela
// seria lido como "0% do faturamento" e não como "não dá para calcular".
function participacao(valor, receitaBruta) {
  if (!(receitaBruta > 0)) return null
  return Math.round((valor / receitaBruta) * 10000) / 100
}

// ── O DRE ────────────────────────────────────────────────────────────────────
export function dreDoPeriodo({ financeiro, ordens, estoque, totalOrdem, gastos, intervalo, vendas = [] } = {}) {
  // Receita e despesa totais saem da MESMA função que alimenta os cards do topo
  // da tela. Reimplementar a soma aqui abriria a porta para o DRE mostrar um
  // faturamento e o card mostrar outro.
  const resumo = resumirFinanceiro(financeiro, intervalo)
  const receitaBruta = resumo.receitas

  // Quebra do que aquela mesma varredura não devolve: quanto da receita veio de
  // OS (tem CMV apurado) e quanto foi taxa de cartão.
  let receitaComOS = 0
  let receitaSemOS = 0
  let taxaCartao = 0
  let lancamentosTaxa = 0
  let compraDePecas = 0

  for (const l of financeiro || []) {
    if (!l || l.pendente) continue
    if (!dentroDoPeriodo(l.data, intervalo)) continue
    const valor = cent(parseValorBR(l.valor))
    if (l.tipo === 'receita') {
      // Venda paga dentro de uma OS carrega `osId`. Venda de balcão e quitação
      // de dívida antiga não carregam — e é justamente essa parte da receita que
      // fica sem custo de peça apurado.
      if (l.osId != null) receitaComOS = cent(receitaComOS + valor)
      else receitaSemOS = cent(receitaSemOS + valor)
    } else if (l.tipo === 'despesa') {
      if (l.taxaCartao) {
        taxaCartao = cent(taxaCartao + valor)
        lancamentosTaxa++
      } else if (l.compraId != null) {
        // Compra de peça para o estoque NÃO é CMV: é troca de dinheiro por
        // prateleira. Vira custo quando a peça sai numa OS. Fica aqui só para
        // aparecer na conferência de despesas.
        compraDePecas = cent(compraDePecas + valor)
      }
    }
  }

  const receitaLiquida = cent(receitaBruta - taxaCartao)

  // CMV das OS: o custo congelado nos itens.
  const ordensDoPeriodo = ordensConcluidasNoPeriodo(ordens, intervalo)
  const os = margemDoPeriodo(ordensDoPeriodo, { estoque, totalOrdem })

  // CMV do BALCÃO.
  //
  // Até aqui a venda de balcão entrava no faturamento e o custo das peças dela
  // não era apurado em lugar nenhum — a margem de contribuição saía otimista na
  // proporção do que a oficina vende no balcão, e isso era só sinalizado.
  //
  // A venda é datada pelo LANÇAMENTO dela no financeiro, e não pela data do
  // turno: assim custo e receita caem sempre no mesmo mês. Venda paga em duas
  // parcelas tem dois lançamentos, então o `vistas` garante que o custo entre
  // uma vez só. Venda nascida de OS (`osId`) fica de fora — o CMV dela já veio
  // pelas ordens, e contar de novo dobraria o custo.
  const porVenda = new Map((vendas || []).filter(v => v?.id != null).map(v => [String(v.id), v]))
  const vistas = new Set()
  let cmvBalcao = 0
  let itensBalcaoSemCusto = 0
  for (const l of financeiro || []) {
    if (!l || l.pendente || l.tipo !== 'receita') continue
    if (!l.vendaId || l.osId) continue
    if (!dentroDoPeriodo(l.data, intervalo)) continue
    const chave = String(l.vendaId)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    const venda = porVenda.get(chave)
    if (!venda) continue
    for (const item of venda.itens || []) {
      if (item?.tipo !== 'peca') continue
      const custo = parseValorBR(item.custoUnitario)
      const qtd = parseValorBR(item.qtd ?? item.quantidade) || 1
      // Item sem custo congelado é venda antiga, de antes desta apuração
      // existir. Contar zero mentiria para melhor; por isso ele é CONTADO
      // à parte e a conferência diz quantos são.
      if (custo > 0) cmvBalcao = cent(cmvBalcao + custo * qtd)
      else itensBalcaoSemCusto++
    }
  }

  const cmv = cent(os.custoPecas + cmvBalcao)

  const margemContribuicao = cent(receitaLiquida - cmv)

  // Custo fixo e retirada saem de `gastos`, e a retirada é retirada DE DENTRO do
  // custo fixo antes da soma. Sem essa separação ela apareceria duas vezes: uma
  // como despesa da oficina e outra na linha de distribuição.
  //
  // São TRÊS conjuntos disjuntos, e cada um entra numa linha diferente:
  // operação (custo fixo), financeiro (empréstimo/parcela/investimento) e
  // retirada. A retirada tem prioridade no desempate — um lançamento nunca
  // pode cair em dois conjuntos, senão o mesmo dinheiro sai duas vezes.
  const listaGastos = gastos || []
  const gastosRetirada = listaGastos.filter(ehRetirada)
  const gastosFinanceiros = listaGastos.filter(g => !ehRetirada(g) && ehFinanceiro(g))
  const gastosOperacionais = listaGastos.filter(ehCustoDeOperacao)

  // "Tudo" não tem quantos meses de aluguel somar — o custo fixo sairia
  // arbitrário e o resultado seria ficção. O DRE para na margem de contribuição
  // e diz por quê, igual ao Ponto de Equilíbrio faz.
  const meses = mesesDoIntervalo(intervalo)
  const custoFixoDisponivel = meses != null

  const custoFixo = custoFixoDisponivel ? custoFixoMensal(gastosOperacionais, intervalo) : null
  const retirada = custoFixoDisponivel ? somarAbaixoDaLinha(gastosRetirada, intervalo, { incluirRetirada: true }) : 0

  // Empréstimo, parcela de equipamento e compra de bem. Fica ABAIXO do
  // resultado porque não é custo de produzir — mas fica VISÍVEL porque é
  // dinheiro que sai de verdade, e numa oficina alavancada é justamente aqui
  // que o resultado do mês evapora antes de virar dinheiro do dono.
  const financeiras = custoFixoDisponivel ? somarAbaixoDaLinha(gastosFinanceiros, intervalo, { incluirFinanceiro: true }) : 0

  const resultado = custoFixoDisponivel ? cent(margemContribuicao - custoFixo) : null
  const sobraAposFinanceiras = resultado == null ? null : cent(resultado - financeiras)
  const sobraEmCaixa = sobraAposFinanceiras == null ? null : cent(sobraAposFinanceiras - retirada)

  // ── Conferência: o que o DRE reconhece contra o que o financeiro registrou ──
  //
  // Não é erro a esconder. As duas fontes medem coisas diferentes de propósito,
  // e ver a diferença é o que impede alguém de confiar num número que não fecha.
  const despesaReconhecida = cent(taxaCartao + (custoFixo || 0) + financeiras + retirada)
  const conferencia = {
    // Faturamento pelas OS concluídas × faturamento pelo dinheiro que entrou.
    // Divergem por três motivos legítimos: a OS conta na conclusão e o
    // financeiro na hora do pagamento; o balcão só existe no financeiro; e OS
    // concluída e não paga já contou lá e ainda não contou aqui.
    receitaFinanceiro: receitaBruta,
    receitaOrdens: os.receita,
    diferencaReceita: cent(receitaBruta - os.receita),

    // Taxa lançada no financeiro × taxa gravada nos pagamentos das OS. O
    // financeiro inclui a taxa das vendas de balcão; as OS, não.
    taxaFinanceiro: taxaCartao,
    taxaOrdens: os.taxaCartao,
    diferencaTaxa: cent(taxaCartao - os.taxaCartao),

    // Despesa total lançada × o que este DRE reconhece como custo do período.
    // A diferença é, em geral, compra de peça para estoque (vira CMV depois),
    // gasto variável e boleto avulso.
    despesaFinanceiro: resumo.despesas,
    despesaReconhecida,
    naoReconhecido: cent(resumo.despesas - despesaReconhecida),
    compraDePecas,

    // O card "Lucro Líquido" do topo da tela é receitas − TODAS as despesas
    // lançadas. Ele quase nunca bate com o resultado do DRE, e tem de ficar
    // explícito por quê: aquele é o caixa do período (inclui compra de estoque,
    // que é dinheiro que saiu mas virou prateleira, e usa o gasto na data em que
    // foi PAGO); este é o resultado por competência, com o custo fixo do mês
    // inteiro. Dois números certos que respondem perguntas diferentes.
    lucroFinanceiro: cent(receitaBruta - resumo.despesas),
  }

  // ── Onde o número é aproximado, e o que preencher para deixar de ser ────────
  const lacunas = []

  // Venda de balcão passou a apurar o custo da peça, mas só a partir do dia em
  // que isso existe: as vendas antigas não guardaram o custo, e para elas a
  // margem continua otimista. É esse resto que a lacuna mede agora — antes ela
  // dizia que o custo do balcão não era apurado "em lugar nenhum", o que
  // deixou de ser verdade.
  if (itensBalcaoSemCusto > 0) {
    lacunas.push({
      chave: 'balcaoSemCusto',
      valor: 0,
      texto: `${itensBalcaoSemCusto} peça(s) vendida(s) no balcão neste período não guardaram o preço de custo — `
        + 'são vendas feitas antes desta apuração existir. O CMV abaixo não inclui o custo delas, '
        + 'então a margem de contribuição real é um pouco menor que a mostrada.',
      acao: 'Nada a fazer nas antigas. As vendas de balcão daqui para a frente já guardam o custo sozinhas.',
    })
  }

  if (receitaBruta > 0 && receitaSemOS > 0 && itensBalcaoSemCusto === 0) {
    lacunas.push({
      chave: 'receitaSemOS',
      valor: receitaSemOS,
      informativo: true,
      texto: 'Parte do faturamento veio de fora de OS — venda de balcão ou quitação de dívida antiga. '
        + 'O custo das peças de balcão está incluído no CMV abaixo; quitação de dívida não tem custo próprio '
        + '(ele já contou no mês da venda original).',
      acao: '',
    })
  }

  if (receitaBruta > 0 && cmv === 0) {
    lacunas.push({
      chave: 'cmvZerado',
      valor: 0,
      texto: 'O CMV do período está em zero. Isso quase nunca significa "não houve custo de peça": '
        + 'significa que nenhuma peça vendida tem preço de custo cadastrado, ou que não houve OS concluída no período.',
      acao: 'Cadastre o preço de custo das peças em Estoque. Sem ele a margem sai inflada.',
    })
  }

  if (os.comLacuna > 0) {
    lacunas.push({
      chave: 'osIncompleta',
      valor: os.comLacuna,
      texto: `${os.comLacuna} de ${os.ordens} OS concluída(s) no período têm custo incompleto `
        + '(peça sem preço de custo, OS sem itens lançados ou taxa de cartão não calculada). '
        + 'Todas erram para o mesmo lado, o otimista.',
      acao: 'Abra cada OS marcada e complete o custo das peças; recalcule as taxas na aba Cartões.',
    })
  }

  if (receitaBruta > 0 && taxaCartao === 0) {
    lacunas.push({
      chave: 'taxaZerada',
      valor: 0,
      texto: 'Nenhuma taxa de cartão no período. Se houve venda no cartão, a taxa não foi calculada — '
        + 'e a receita líquida está maior do que o que realmente caiu na conta.',
      acao: 'Cadastre as maquininhas em Configurações e use "Recalcular taxas" na aba Cartões.',
    })
  }

  if (custoFixoDisponivel && !(custoFixo > 0)) {
    lacunas.push({
      chave: 'semCustoFixo',
      valor: 0,
      texto: 'Nenhum gasto fixo cadastrado no período. O resultado abaixo NÃO é lucro: '
        + 'ele é a margem de contribuição sem nada descontado, porque o aluguel, a energia e o salário '
        + 'não estão no sistema — mas vencem do mesmo jeito.',
      acao: 'Cadastre aluguel, energia e salário em Gastos com o tipo "Fixo".',
    })
  }

  if (custoFixoDisponivel && gastosRetirada.length === 0) {
    lacunas.push({
      chave: 'semRetirada',
      valor: 0,
      informativo: true,
      texto: 'Não existe categoria de retirada no sistema, então a linha sai zerada. '
        + 'Se o dono tira dinheiro da oficina — e em oficina pequena tira —, esse valor está hoje '
        + 'misturado no custo fixo ou simplesmente fora do sistema, e a "sobra em caixa" abaixo está otimista.',
      acao: 'Cadastre a retirada em Gastos com a descrição "Retirada do sócio" ou "Pró-labore" para ela sair do custo fixo e aparecer aqui.',
    })
  }

  // O DRE inteiro é confiável? Só quando não há NENHUMA lacuna que mexa em valor.
  const aproximado = lacunas.some(l => !l.informativo)

  return {
    // Linhas do demonstrativo, de cima para baixo.
    receitaBruta,
    taxaCartao,
    receitaLiquida,
    cmv,
    margemContribuicao,
    custoFixo,
    resultado,
    financeiras,
    sobraAposFinanceiras,
    retirada,
    sobraEmCaixa,

    // Percentual de cada linha sobre o faturamento.
    percentual: {
      receitaBruta: participacao(receitaBruta, receitaBruta),
      taxaCartao: participacao(taxaCartao, receitaBruta),
      receitaLiquida: participacao(receitaLiquida, receitaBruta),
      cmv: participacao(cmv, receitaBruta),
      margemContribuicao: participacao(margemContribuicao, receitaBruta),
      custoFixo: custoFixo == null ? null : participacao(custoFixo, receitaBruta),
      resultado: resultado == null ? null : participacao(resultado, receitaBruta),
      financeiras: participacao(financeiras, receitaBruta),
      sobraAposFinanceiras: sobraAposFinanceiras == null ? null : participacao(sobraAposFinanceiras, receitaBruta),
      retirada: participacao(retirada, receitaBruta),
      sobraEmCaixa: sobraEmCaixa == null ? null : participacao(sobraEmCaixa, receitaBruta),
    },

    // Contexto da apuração.
    meses,
    custoFixoDisponivel,
    receitaComOS,
    receitaSemOS,
    // Quebra do CMV, para a tela poder explicar de onde veio cada parte.
    cmvOS: os.custoPecas,
    cmvBalcao,
    itensBalcaoSemCusto,
    lancamentos: resumo.quantidade,
    lancamentosTaxa,
    ordens: os.ordens,
    ordensComLacuna: os.comLacuna,
    gastosRetirada: gastosRetirada.length,
    gastosFinanceiros: gastosFinanceiros.length,

    conferencia,
    lacunas,
    aproximado,
  }
}

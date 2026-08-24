// Quanto sobra de cada serviço.
//
// DECISÃO DE MÉTODO — vale entender antes de mexer aqui.
//
// O caminho óbvio seria "margem por OS = preço − peça − mão de obra − taxa".
// Só que a mão de obra desta oficina é salário fixo, não comissão: o mecânico
// custa o mesmo tendo trabalhado 2 ou 8 horas naquele carro. Para ratear esse
// custo por OS seria preciso saber quantas horas cada serviço consumiu — e esse
// dado não existe: nenhum serviço tem tempo cadastrado, e os marcos de início e
// fim de reparo só aparecem nas OS que passaram pelo fluxo novo do pátio (e
// medem tempo de calendário, que inclui a noite e a espera por peça).
//
// Inventar esse rateio produziria um número preciso e errado — o pior tipo.
//
// Então o cálculo é separado em dois, cada um honesto no que mede:
//
//   1. MARGEM DE CONTRIBUIÇÃO por OS — preço menos os custos que são DAQUELE
//      serviço (peças e taxa de cartão). Exato, sem chute. Responde "esse
//      serviço deixou quanto na mesa para pagar as contas da oficina?".
//
//   2. CUSTO FIXO no nível do MÊS — aluguel, energia, salários. Não se divide
//      por OS; compara-se com a soma das margens de contribuição do mês. É daí
//      que sai o ponto de equilíbrio: quanto a oficina precisa gerar para
//      empatar.
//
// É assim que se faz gestão de oficina com salário fixo, e usa só dado que
// existe de verdade.

import { parseValorBR, cent } from './numero.js'
import { dentroDoPeriodo } from './periodo.js'

// Item é peça? Vale o vínculo com o produto OU a marcação explícita.
export function ehPeca(item) {
  if (!item) return false
  if (item.tipo === 'peca') return true
  if (item.tipo === 'servico') return false
  return item.produtoId != null
}

// Por que o custo desta peça não é conhecido — cada motivo pede uma ação
// diferente do dono, e um aviso genérico ("cadastre no Estoque") vira ruído
// quando o produto nem existe mais.
export const MOTIVO_SEM_CUSTO = {
  avulsa: 'avulsa',        // digitada à mão, sem vínculo com o estoque
  fora: 'fora',            // produto não está mais no estoque
  naoCadastrado: 'naoCadastrado', // está no estoque, mas sem preço de custo
}

// Custo de uma peça vendida.
//
// O custo congelado no item (`custoUnitario`) tem prioridade: o preço de custo
// do estoque muda com o tempo, e sem congelar a margem de uma OS de dois anos
// atrás se reescreve sozinha quando alguém reajusta a peça hoje.
//
// Devolve `null` quando não dá para saber — tratar ausência como zero inflaria
// a margem e faria o serviço parecer melhor do que foi.
export function custoDaPeca(item, estoque) {
  const congelado = parseValorBR(item?.custoUnitario)
  if (congelado > 0) return congelado
  if (item?.produtoId == null) return null
  const produto = (estoque || []).find(p => Number(p.id) === Number(item.produtoId))
  if (!produto) return null
  const custo = parseValorBR(produto.precoCusto)
  return custo > 0 ? custo : null
}

// Qual dos três motivos impediu o cálculo — para a tela dizer o que fazer.
export function motivoSemCusto(item, estoque) {
  if (custoDaPeca(item, estoque) != null) return null
  if (item?.produtoId == null) return MOTIVO_SEM_CUSTO.avulsa
  const produto = (estoque || []).find(p => Number(p.id) === Number(item.produtoId))
  return produto ? MOTIVO_SEM_CUSTO.naoCadastrado : MOTIVO_SEM_CUSTO.fora
}

// Quanto o cliente pagou por um item, já descontado o desconto da linha.
export function valorDoItem(item) {
  const unit = parseValorBR(item?.valorUnitario)
  const qtd = parseValorBR(item?.quantidade) || 1
  const desc = parseValorBR(item?.desconto)
  return cent(unit * qtd - desc)
}

// Margem de contribuição de uma OS.
//
// `pecasSemCusto` conta quantas peças ficaram de fora por não ter preço de
// custo cadastrado: com elas na conta, a margem exibida é um TETO, não o valor
// real. A tela precisa dizer isso — margem otimista sem aviso é pior que
// margem nenhuma.
export function margemDaOrdem(os, { estoque, totalOrdem }) {
  const itens = os?.itens || []

  let receitaPecas = 0, receitaServicos = 0, custoPecas = 0
  let pecasSemCusto = 0, pecasComCusto = 0
  const motivos = new Set()

  for (const item of itens) {
    const valor = valorDoItem(item)
    // Peça é o que tem produto vinculado OU está marcado como peça. Testar só
    // `tipo === 'peca'` fazia item sem tipo (dado migrado) virar serviço com
    // custo zero — e a margem saía 100% sem nenhum aviso. A nota impressa já
    // usa esta mesma regra invertida (print.js), então agora as duas combinam.
    if (ehPeca(item)) {
      receitaPecas = cent(receitaPecas + valor)
      const custoUnit = custoDaPeca(item, estoque)
      if (custoUnit == null) {
        pecasSemCusto++
        motivos.add(motivoSemCusto(item, estoque))
      } else {
        pecasComCusto++
        custoPecas = cent(custoPecas + custoUnit * (parseValorBR(item.quantidade) || 1))
      }
    } else {
      receitaServicos = cent(receitaServicos + valor)
    }
  }

  // O total da OS considera o desconto geral, que os itens não conhecem — por
  // isso vem de `totalOrdem`. Mas se ele devolver algo inválido (OS sem valor,
  // campo corrompido), a receita virava 0 e a margem aparecia NEGATIVA pelo
  // custo das peças: um serviço lucrativo mostrado como prejuízo. Nesse caso
  // cai para a soma dos itens, que é a melhor informação disponível.
  const somaItens = cent(receitaPecas + receitaServicos)
  const bruto = os && typeof totalOrdem === 'function' ? Number(totalOrdem(os)) : NaN
  // Zero é um total LEGÍTIMO: cortesia e garantia saem com desconto igual ao
  // subtotal. Antes o zero era confundido com "campo corrompido" e caía na soma
  // dos itens — a OS dada de graça aparecia lucrativa, e no total do mês o
  // retrabalho entrava como margem positiva. Só cai no fallback o que não é
  // número ou é negativo.
  const receita = Number.isFinite(bruto) && bruto >= 0 ? cent(bruto) : somaItens

  // Taxa de cartão do que foi efetivamente pago nesta OS.
  //
  // Enquanto a OS não é cobrada não existe pagamento, então a taxa é zero e a
  // margem sai maior do que vai ficar. Isso precisa estar explícito: um serviço
  // que "sobrou 40%" antes de passar no cartão pode sobrar bem menos depois.
  const pagamentos = os?.pagamentos || []
  const taxaCartao = cent(pagamentos.reduce((s, p) => s + parseValorBR(p?.taxa), 0))

  const margem = cent(receita - custoPecas - taxaCartao)

  // Cartão passado mas taxa zerada: a taxa da máquina ainda não foi calculada
  // (não estava cadastrada na hora da venda). A margem sai maior do que é, e
  // sem este sinal ela sairia sem aviso nenhum — porque tecnicamente há
  // pagamento e todas as peças podem ter custo.
  const taxaPendente = pagamentos.some(p =>
    (p?.forma === 'Cartão Crédito' || p?.forma === 'Cartão Débito') && !(parseValorBR(p?.taxa) > 0)
  )

  // OS sem item nenhum: o valor veio do campo antigo `valor` e não há como
  // saber o que foi peça. Sem este sinal, ela aparecia como 100% de margem.
  const semItens = itens.length === 0 && receita > 0

  return {
    receita,
    receitaPecas,
    receitaServicos,
    custoPecas,
    taxaCartao,
    margem,
    percentual: receita > 0 ? Math.round((margem / receita) * 10000) / 100 : 0,
    pecasSemCusto,
    pecasComCusto,
    motivosSemCusto: [...motivos].filter(Boolean),
    // A OS ainda não foi cobrada: a taxa do cartão pode entrar depois.
    aguardandoPagamento: pagamentos.length === 0,
    taxaPendente,
    semItens,
    // Margem confiável só quando não há NENHUMA lacuna conhecida. Antes isso
    // vigiava apenas peça-sem-custo, e os outros dois buracos — OS sem item e
    // taxa não calculada — passavam como número exato. Os três erram para o
    // mesmo lado, o otimista.
    completa: pecasSemCusto === 0 && !taxaPendente && !semItens,
  }
}

// Soma das margens de contribuição de um conjunto de OS.
export function margemDoPeriodo(ordens, { estoque, totalOrdem }) {
  let receita = 0, custoPecas = 0, taxaCartao = 0, margem = 0
  let comLacuna = 0
  for (const os of ordens || []) {
    const m = margemDaOrdem(os, { estoque, totalOrdem })
    receita = cent(receita + m.receita)
    custoPecas = cent(custoPecas + m.custoPecas)
    taxaCartao = cent(taxaCartao + m.taxaCartao)
    margem = cent(margem + m.margem)
    if (!m.completa) comLacuna++
  }
  return {
    receita, custoPecas, taxaCartao, margem,
    percentual: receita > 0 ? Math.round((margem / receita) * 10000) / 100 : 0,
    ordens: (ordens || []).length,
    comLacuna,
  }
}

// ── Ponto de equilíbrio ──────────────────────────────────────────────────────
// Onde o custo fixo entra: no mês, não na OS.

// Quantos meses de custo fixo um período cobre.
//
// Aluguel e salário não são cobrados por dia: são cobrados por mês. Então a
// pergunta não é "quantos dias tem o período?", é "quantas mensalidades caem
// dentro dele?". Cada mês do calendário entra pela fração que o período cobre —
// assim julho inteiro dá exatamente 1, e 90 dias dão ~2,96 em vez dos 4 meses
// que sairiam de contar todo mês tocado.
//
// O arredondamento no fim é de propósito: mensalidade não se paga pela metade.
// Meio mês de aluguel é um número que não existe na vida da oficina — e mostrar
// "custo fixo de 0,5 mês" no meio do mês faria o ponto de equilíbrio parecer
// atingido no dia 15 todo mês, quando o aluguel inteiro ainda vai vencer.
export function mesesDoIntervalo(intervalo) {
  if (!intervalo || !Number.isFinite(intervalo.de) || !Number.isFinite(intervalo.ate)) return null
  if (intervalo.ate < intervalo.de) return null

  let soma = 0
  const ini = new Date(intervalo.de)
  let cursor = new Date(ini.getFullYear(), ini.getMonth(), 1)
  // Trava de segurança: intervalo absurdo (data digitada com ano 9999) não pode
  // travar a tela num laço de milhares de voltas.
  for (let i = 0; i < 1200 && cursor.getTime() <= intervalo.ate; i++) {
    const iniMes = cursor.getTime()
    const fimMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime()
    const coberto = Math.min(fimMes, intervalo.ate + 1) - Math.max(iniMes, intervalo.de)
    if (coberto > 0) soma += coberto / (fimMes - iniMes)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  // Período menor que um mês ainda deve o mês inteiro.
  return Math.max(1, Math.round(soma))
}

// Custo fixo do período a partir dos gastos cadastrados. Só os marcados como
// "Fixo" — o variável já é custo do próprio serviço.
//
// ANTES ISTO SOMAVA O HISTÓRICO INTEIRO. Depois de um ano de uso, doze aluguéis
// entravam como se fossem o custo de um mês só, e o ponto de equilíbrio ficava
// impossível de atingir — a oficina parecia no vermelho mês após mês. Cada tipo
// de gasto tem de entrar de um jeito:
//
//   • RECORRENTE (aluguel, salário, internet): vence todo mês, então entra uma
//     vez por mês do período — a data de cadastro não importa, ele se repete.
//   • PONTUAL (o IPVA de março, o seguro anual): entra só se o vencimento cair
//     dentro do período. Fora dele é custo de outro mês.
//
// Sem `intervalo` a resposta é "quanto custa um mês típico": só os recorrentes.
// Os pontuais ficam de fora porque não há período para dizer a qual mês eles
// pertencem, e é justamente somá-los sem critério que produzia o bug.
// ── Retirada do sócio ────────────────────────────────────────────────────────
// Hoje NÃO existe categoria de retirada no sistema (as categorias de Gastos são
// Aluguel, Água, Energia, Internet, Telefone, Salário, Impostos, Manutenção,
// Marketing e Outros). Então o normal é esta linha sair zerada — e a tela diz
// isso em vez de fingir que a oficina não distribui lucro.
//
// A detecção por texto existe para quem já cadastra a retirada escrevendo, e é
// DE PROPÓSITO conservadora: só pega o que é inequivocamente retirada. Um falso
// positivo TIRARIA um custo real de dentro do custo fixo e faria o resultado
// parecer melhor do que é — o erro caro. Deixar de detectar só mantém o
// comportamento atual (a retirada fica dentro do custo fixo), que é o menos pior.
//
// "Retirada de entulho" e "ferramentas retiradas" não batem: a palavra sozinha
// não basta, precisa vir acompanhada de sócio/lucro/dono/proprietário.
const RE_RETIRADA = /(pr[óo]\s*-?\s*labore|prolabore)|retirada\s+(d[oae]s?\s+)?(s[óo]cio|lucro|dono|propriet[áa]ri)|distribui[çc][ãa]o\s+d[eo]s?\s+lucro/i

export function ehRetirada(registro) {
  if (!registro) return false
  const categoria = String(registro.categoria || '').trim()
  // Categoria criada à mão exatamente para isso — vale sem precisar de frase.
  if (/^(retirada|pr[óo]-?labore)$/i.test(categoria)) return true
  return RE_RETIRADA.test(`${categoria} ${registro.descricao || ''}`)
}


// ── Compromisso financeiro ───────────────────────────────────────────
// Empréstimo, financiamento, parcela de equipamento e compra de bem NÃO são
// custo de operar a oficina — e por isso não podem entrar no custo da hora nem
// no ponto de equilíbrio.
//
// A razão não é contabilidade, é PREÇO. Se a parcela do empréstimo entra no custo
// da hora, ela vira preço; o preço sobe acima do mercado e a oficina perde
// serviço. E quando a dívida acabar, ninguém vai baixar a tabela. O custo da
// hora responde "quanto custa manter a bancada rodando", e isso não muda quando
// um empréstimo termina.
//
// Dívida é uma cobrança sobre a MARGEM, não um componente do CUSTO. Ela aparece
// no DRE abaixo do resultado, junto da retirada — onde dá para ver o quanto come.
//
// ISTO IMPORTA MUITO NESTA OFICINA: dos gastos levantados pelo dono, 8 credores
// somam R$ 21.617/mês, 61% de tudo que sai. Se isso entrasse no custo da hora,
// o custo da hora quase triplicaria e a tabela de preços ficaria impraticável.
//
// Conservador de propósito, pelo mesmo motivo da retirada ao contrário: um
// falso positivo TIRA custo real de dentro do custo fixo e faz o preço sair
// barato demais. Por isso vale a categoria própria, e no texto só o inequívoco.
//
// O que FICA no custo fixo, e é fácil confundir: Seguro, Contabilidade e
// Depreciação. Depreciação é justamente o custo do equipamento diluido na vida
// util dele — é ela que deve entrar no preço, não a parcela do financiamento.
const CATEGORIA_FINANCEIRA = /^(empr[ée]stimo|financiamento|cons[óo]rcio|equipamento|investimento)s?$/i
const RE_FINANCEIRO = /(empr[ée]stimo|financiamento|cons[óo]rcio|amortiza[çc][ãa]o)/i

export function ehFinanceiro(registro) {
  if (!registro) return false
  const categoria = String(registro.categoria || '').trim()
  if (CATEGORIA_FINANCEIRA.test(categoria)) return true
  return RE_FINANCEIRO.test(`${categoria} ${registro.descricao || ''}`)
}

// Quanto saiu no período de uma lista que fica ABAIXO da linha do resultado —
// retirada e compromisso financeiro. Mora aqui, e não no DRE, porque a tela de
// Gestão precisa do mesmo número: duas implementações acabariam divergindo e uma
// tela desmentiria a outra.
//
// Mesma regra de data do custo fixo: "Fixo" é mensal e entra uma vez por mês do
// período; "Variável" entra se o vencimento cair dentro dele.
export function somarAbaixoDaLinha(lista, intervalo, portas) {
  const itens = lista || []
  const fixas = custoFixoMensal(itens.filter(g => g?.tipo === 'Fixo'), intervalo, portas)
  let variaveis = 0
  for (const g of itens) {
    if (g?.tipo === 'Fixo') continue
    if (!dentroDoPeriodo(g?.vencimento, intervalo)) continue
    variaveis = cent(variaveis + parseValorBR(g?.valor))
  }
  return cent(fixas + variaveis)
}

// O compromisso financeiro do período: empréstimo, parcela de equipamento,
// compra de bem. Sai do custo fixo e entra numa linha própria — ver
// `ehFinanceiro` acima para o porquê.
export function compromissoFinanceiro(gastos, intervalo) {
  const so = (gastos || []).filter(g => !ehRetirada(g) && ehFinanceiro(g))
  return somarAbaixoDaLinha(so, intervalo, { incluirFinanceiro: true })
}

// Um gasto é custo de operar a oficina? É o filtro único que o custo fixo, o
// ponto de equilíbrio e o custo da hora usam — os três têm de concordar.
export function ehCustoDeOperacao(registro) {
  return !ehRetirada(registro) && !ehFinanceiro(registro)
}

// Custo fixo do período.
//
// RETIRADA NÃO É CUSTO FIXO e por isso sai daqui por padrão. Isso importa mais
// do que parece: no dia em que a retirada passar a ser cadastrada com categoria
// própria — que é o certo —, ela entraria no custo fixo e inflaria de uma vez o
// ponto de equilíbrio, o custo da hora em Configurações e a régua de preço do
// orçamento. O dono faria a coisa certa e três números piorariam juntos.
//
// `incluirRetirada` existe só para o DRE, que soma a retirada de propósito na
// linha de distribuição do resultado.
export function custoFixoMensal(gastos, intervalo, { incluirRetirada = false, incluirFinanceiro = false } = {}) {
  const recorte = mesesDoIntervalo(intervalo)
  const meses = recorte ?? 1

  let total = 0
  for (const g of gastos || []) {
    if (g?.tipo !== 'Fixo') continue
    if (!incluirRetirada && ehRetirada(g)) continue
    if (!incluirFinanceiro && ehFinanceiro(g)) continue
    const valor = parseValorBR(g.valor)
    // `recorrente` é o que distingue "um aluguel que se repete" de "doze
    // lançamentos de aluguel, um por mês". Tratar todo Fixo como recorrente
    // multiplicaria os doze pelo número de meses — R$ 30.000 de aluguel num mês
    // só. Quem garante que o dado nasce certo é a tela de Gastos, que já marca
    // `recorrente` sozinha quando o tipo é Fixo.
    if (g.recorrente) total += valor * meses
    else if (recorte != null && dentroDoPeriodo(g.vencimento, intervalo)) total += valor
  }
  return cent(total)
}

// Quanto falta gerar de margem para cobrir o custo fixo do mês.
//
// `cobertura` é a fração do custo fixo já paga pelas margens do período; passar
// de 100% é o ponto em que a oficina começa a lucrar.
export function pontoDeEquilibrio(margemAcumulada, custoFixo) {
  const fixo = cent(custoFixo)
  const margem = cent(margemAcumulada)
  return {
    custoFixo: fixo,
    margem,
    falta: cent(Math.max(0, fixo - margem)),
    sobra: cent(Math.max(0, margem - fixo)),
    cobertura: fixo > 0 ? Math.round((margem / fixo) * 10000) / 100 : null,
    atingido: margem >= fixo && fixo > 0,
  }
}

// ── Custo da hora ────────────────────────────────────────────────────────────
// Calculado pela capacidade instalada, não pelo relógio: é assim que oficina
// precifica, e não depende de apontamento de hora que ninguém faz.
//
// `mecanicos` × `horasPorDia` × `diasUteis` × `ocupacao` = horas que a oficina
// consegue vender no mês. A ocupação (60% a 80% na prática) desconta o tempo
// que se perde em orçamento, espera de peça, retrabalho e conversa.
export function custoDaHora({ custoFixo, mecanicos, horasPorDia, diasUteis, ocupacao }) {
  const m = Number(mecanicos) || 0
  const h = Number(horasPorDia) || 0
  const d = Number(diasUteis) || 0
  const oc = Number(ocupacao) || 0
  const horasVendaveis = m * h * d * (oc / 100)
  if (!(horasVendaveis > 0)) return { horasVendaveis: 0, custoHora: null }
  return {
    horasVendaveis: Math.round(horasVendaveis * 10) / 10,
    custoHora: cent(parseValorBR(custoFixo) / horasVendaveis),
  }
}

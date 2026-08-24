// A leitura geral da oficina — os rankings e a série que o dono precisa.
//
// POR QUE ISTO EXISTE.
//
// O dado já está quase todo no sistema, mas espalhado em sete telas: para saber
// "como está minha empresa" era preciso abrir Financeiro, Produtividade,
// Estoque e Compras e montar o quadro na cabeça. Este arquivo faz o
// agrupamento que faltava — ranking de serviço, de peça, de cliente, e a série
// mês a mês.
//
// A REGRA DE HONESTIDADE, que vale para tudo aqui:
//
// Número que depende de cadastro incompleto NÃO pode aparecer com cara de
// certo. O custo fixo da oficina hoje soma R$ 293 por mês, o que é obviamente
// falso — e com ele o "lucro" sai errado. Por isso `lacunasDaLeitura` devolve o
// que está faltando, e a tela mostra isso ANTES dos números. Decisão tomada com
// número errado é pior que decisão tomada por instinto: nela a pessoa confia.
//
// Funções puras — sem React, testáveis em Node.

import { parseValorBR, cent } from './numero.js'
import { dentroDoPeriodo, resumirFinanceiro } from './periodo.js'
import { momentoEntrada } from './datas.js'
import { custoFixoMensal } from './margem.js'

// As OS que já viraram resultado. Mesmo corte do DRE e do ponto de equilíbrio —
// se esta tela usasse outro, ela contradiria as outras e ninguém acreditaria em
// nenhuma das duas.
export function ordensDoPeriodo(ordens, intervalo) {
  return (ordens || []).filter(o => {
    if (!['Concluída', 'Entregue'].includes(o?.status)) return false
    return dentroDoPeriodo(o.dataConclusao || o.data || o.dataEntrada || '', intervalo)
  })
}

function chaveServico(texto) {
  const LIGACAO = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'COM', 'PARA', 'EM', 'NO', 'NA', 'A', 'O', 'POR'])
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
    .split(' ').filter(p => p && !LIGACAO.has(p)).join(' ')
}

function ordenarEcortar(mapa, limite) {
  return [...mapa.values()]
    .sort((a, b) => b.faturamento - a.faturamento || b.quantidade - a.quantidade)
    .slice(0, limite)
}

// Serviços que mais faturam — não os que mais aparecem.
//
// A diferença importa: numa oficina de injeção o diagnóstico é o que mais
// aparece, e pode não ser o que mais deixa. Volume e dinheiro são perguntas
// diferentes, e o dono decide onde crescer pela segunda.
//
// Agrupa por texto normalizado porque o mesmo serviço está escrito de várias
// formas no cadastro ("INJECAO" e "INJEÇÃO"). Sem isso o ranking quebraria o
// campeão em quatro pedaços e nenhum apareceria no topo.
export function rankingServicos(ordens, intervalo, { limite = 10 } = {}) {
  const mapa = new Map()
  for (const os of ordensDoPeriodo(ordens, intervalo)) {
    for (const item of os.itens || []) {
      if (item?.tipo && item.tipo !== 'servico') continue
      const valor = parseValorBR(item.valorUnitario) * (parseValorBR(item.quantidade) || 1) - parseValorBR(item.desconto)
      if (!(valor > 0)) continue
      const k = chaveServico(item.descricao)
      if (!k) continue
      const atual = mapa.get(k) || { chave: k, nome: item.descricao, quantidade: 0, faturamento: 0 }
      atual.quantidade += parseValorBR(item.quantidade) || 1
      atual.faturamento = cent(atual.faturamento + valor)
      mapa.set(k, atual)
    }
  }
  return ordenarEcortar(mapa, limite)
}

// Peças que mais saíram, por dinheiro e por unidade.
//
// Sai das OS, e não do kardex, porque aqui a pergunta é "o que eu VENDO" — o
// kardex tem também ajuste, estorno e saldo inicial, que não são venda.
export function rankingPecas(ordens, intervalo, { limite = 10, estoque = [] } = {}) {
  const porId = new Map((estoque || []).map(p => [String(p.id), p]))
  const mapa = new Map()
  for (const os of ordensDoPeriodo(ordens, intervalo)) {
    for (const item of os.itens || []) {
      if (item?.tipo !== 'peca') continue
      const qtd = parseValorBR(item.quantidade) || 1
      const valor = parseValorBR(item.valorUnitario) * qtd - parseValorBR(item.desconto)
      const peca = item.produtoId != null ? porId.get(String(item.produtoId)) : null
      const k = peca ? String(peca.id) : chaveServico(item.descricao)
      if (!k) continue
      const atual = mapa.get(k) || {
        chave: k,
        nome: peca?.nome || item.descricao,
        codigo: peca?.codigo || item.codigo || '',
        quantidade: 0, faturamento: 0, custo: 0,
      }
      atual.quantidade += qtd
      atual.faturamento = cent(atual.faturamento + Math.max(0, valor))
      // Custo congelado no item quando existe; senão o custo atual da peça. É
      // aproximação e a tela diz isso — o custo de hoje não é o de ontem.
      const custoUn = parseValorBR(item.custoUnitario) || parseValorBR(peca?.precoCusto)
      atual.custo = cent(atual.custo + custoUn * qtd)
      mapa.set(k, atual)
    }
  }
  return ordenarEcortar(mapa, limite).map(p => ({ ...p, margem: cent(p.faturamento - p.custo) }))
}

// De quem a oficina depende. Concentração é a métrica de risco que ninguém olha
// até doer: se três clientes forem 30% do faturamento e um sair, o buraco
// aparece sem aviso.
export function rankingClientes(ordens, intervalo, { limite = 10, totalOrdem, nomeDoCliente } = {}) {
  const mapa = new Map()
  let total = 0
  for (const os of ordensDoPeriodo(ordens, intervalo)) {
    const valor = cent(Number(totalOrdem ? totalOrdem(os) : 0) || 0)
    if (!(valor > 0)) continue
    const k = String(os.clienteId ?? 'sem-cliente')
    const atual = mapa.get(k) || {
      chave: k,
      nome: (nomeDoCliente ? nomeDoCliente(os) : '') || 'Sem cadastro',
      quantidade: 0, faturamento: 0,
    }
    atual.quantidade++
    atual.faturamento = cent(atual.faturamento + valor)
    mapa.set(k, atual)
    total = cent(total + valor)
  }
  const lista = ordenarEcortar(mapa, limite)
    .map(c => ({ ...c, participacao: total > 0 ? cent((c.faturamento / total) * 100) : 0 }))
  return {
    lista,
    total,
    clientes: mapa.size,
    // Quanto os cinco maiores representam. Acima de 40% em oficina é sinal de
    // dependência — vale saber antes de perder um deles.
    concentracaoTop5: total > 0
      ? cent(ordenarEcortar(mapa, 5).reduce((s, c) => s + c.faturamento, 0) / total * 100)
      : 0,
  }
}

// Faturamento mês a mês. Responde "estou crescendo ou só correndo mais?", que
// nenhuma tela do sistema responde hoje — todas comparam com o mês anterior e
// param aí.
export function serieMensal(ordens, { meses = 12, agora, totalOrdem } = {}) {
  const hoje = agora instanceof Date ? agora : new Date()
  const saida = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const de = d.getTime()
    const ate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
    const doMes = ordensDoPeriodo(ordens, { de, ate })
    const faturamento = cent(doMes.reduce((s, o) => s + (Number(totalOrdem ? totalOrdem(o) : 0) || 0), 0))
    saida.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      ordens: doMes.length,
      faturamento,
      ticket: doMes.length > 0 ? cent(faturamento / doMes.length) : 0,
    })
  }
  return saida
}

// Dinheiro que já é da oficina e está travado. É o mais barato de destravar —
// não exige vender nada novo.
export function dinheiroParado({ orcamentos = [], estoque = [], ordens = [], totalOrdem, diasParaParado = 15, agora } = {}) {
  const hoje = agora instanceof Date ? agora : new Date()
  const limite = hoje.getTime() - diasParaParado * 86400000

  const parados = (orcamentos || []).filter(o => !['Aprovado', 'Convertido', 'Recusado', 'Rejeitado'].includes(o?.status))
  const emOrcamento = cent(parados.reduce((s, o) => s + parseValorBR(o.total ?? o.valorTotal), 0))

  const emEstoque = cent((estoque || []).reduce((s, p) => {
    const qtd = Number(p?.estoque) || 0
    return qtd > 0 ? s + qtd * parseValorBR(p.precoCusto) : s
  }, 0))

  // Carro que entrou e não saiu: ocupa vaga e é serviço que não virou dinheiro.
  const noPatio = (ordens || []).filter(o =>
    !['Concluída', 'Entregue', 'Cancelada'].includes(o?.status) && momentoEntrada(o) > 0 && momentoEntrada(o) < limite
  )

  return {
    emOrcamento, orcamentosParados: parados.length,
    emEstoque, pecasComSaldo: (estoque || []).filter(p => (Number(p?.estoque) || 0) > 0).length,
    noPatio: noPatio.length,
    valorNoPatio: cent(noPatio.reduce((s, o) => s + (Number(totalOrdem ? totalOrdem(o) : 0) || 0), 0)),
  }
}

// O que impede esta leitura de ser confiável.
//
// Vem ANTES dos números na tela, de propósito. Enquanto o custo fixo não estiver
// cadastrado, "lucro" é receita menos despesa de caixa — e retirar dinheiro
// olhando esse número descapitaliza a empresa sem ninguém perceber.
export function lacunasDaLeitura({ gastos = [], config = null, clientes = [], estoque = [] } = {}) {
  const lacunas = []

  const fixoMes = custoFixoMensal(gastos)
  if (fixoMes < 500) {
    lacunas.push({
      id: 'custo_fixo',
      peso: 'alto',
      titulo: 'Gastos fixos não cadastrados',
      texto: fixoMes > 0
        ? `Só R$ ${fixoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por mês estão marcados como Fixo. Sem aluguel, energia e salários, o lucro abaixo é receita menos despesa de caixa — não é lucro.`
        : 'Nenhum gasto fixo cadastrado. Sem aluguel, energia e salários, o lucro abaixo é receita menos despesa de caixa — não é lucro.',
      onde: 'Gastos → tipo "Fixo"',
    })
  }

  const cap = config?.capacidade || {}
  if (!(Number(cap.reparadores) > 0)) {
    lacunas.push({
      id: 'capacidade',
      peso: 'medio',
      titulo: 'Capacidade da oficina não preenchida',
      texto: 'Sem quantos reparadores, horas por dia e dias úteis, não existe custo da hora — e sem ele não dá para saber se o preço de um serviço cobre o tempo de bancada.',
      onde: 'Configurações → Capacidade',
    })
  }

  const semOrigem = (clientes || []).filter(c => !String(c?.origem || '').trim()).length
  if (clientes.length > 0 && semOrigem / clientes.length > 0.5) {
    lacunas.push({
      id: 'origem',
      peso: 'baixo',
      titulo: `${semOrigem} de ${clientes.length} clientes sem origem`,
      texto: 'O bloco de canais fala só da parte respondida. A pergunta fica na Nova Entrada e o preenchimento dos antigos, na tela de Clientes.',
      onde: 'Nova Entrada / Clientes',
    })
  }

  const semCusto = (estoque || []).filter(p => (Number(p?.estoque) || 0) > 0 && !(parseValorBR(p?.precoCusto) > 0)).length
  if (semCusto > 0) {
    lacunas.push({
      id: 'custo_peca',
      peso: 'medio',
      titulo: `${semCusto} peça(s) com saldo e sem custo`,
      texto: 'A margem das OS que usaram essas peças sai por cima — o sistema conta a venda e não conta o que a peça custou.',
      onde: 'Estoque',
    })
  }

  return lacunas
}

// O resumo do topo. `financeiro` manda no que entrou e saiu (é o regime de
// caixa, o mesmo do resto do sistema); as OS mandam na contagem e no ticket.
export function resumoDaGestao({ financeiro = [], ordens = [], intervalo, totalOrdem, gastos = [] } = {}) {
  const caixa = resumirFinanceiro(financeiro, intervalo)
  const doPeriodo = ordensDoPeriodo(ordens, intervalo)
  const faturado = cent(doPeriodo.reduce((s, o) => s + (Number(totalOrdem ? totalOrdem(o) : 0) || 0), 0))
  const fixo = custoFixoMensal(gastos, intervalo)

  return {
    entrou: caixa.receitas,
    saiu: caixa.despesas,
    // "Sobra de caixa", e não "lucro": é o que entrou menos o que saiu, sem
    // custo fixo não lançado e sem o custo das peças consumidas. O nome já
    // avisa que não é resultado.
    sobraDeCaixa: caixa.lucro,
    custoFixoPeriodo: fixo,
    faturadoEmOS: faturado,
    ordens: doPeriodo.length,
    ticketMedio: doPeriodo.length > 0 ? cent(faturado / doPeriodo.length) : 0,
  }
}

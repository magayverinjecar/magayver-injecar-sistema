// Tudo que a oficina tem a receber, num lugar só.
//
// Antes existiam duas dívidas e o sistema só enxergava uma. A OS concluída e
// não paga aparecia em "A Receber"; a venda de balcão em que o cliente disse
// "pago sexta" ficava com status Pendente dentro do turno e, quando o caixa
// fechava, ninguém mais via — nem para cobrar, nem para saber que faltava.
//
// O dado sempre esteve lá: o turno fechado guarda as vendas inteiras, com o
// valor a receber dentro do pagamento "Pagar Depois". Faltava ler.
//
// Funções puras — testáveis sem tela.

import { parseDataBR } from './datas.js'
import { parseValorBR as pNum, cent } from './numero.js'

// Quanto falta receber de uma venda de balcão.
//
// A verdade é sempre `total − recebido`. A linha "Pagar Depois" é só a intenção
// registrada no momento do clique, e ela envelhece: se depois alguém acrescenta
// um item, o total sobe e o declarado fica curto; se o cliente muda de ideia e
// paga na hora sem apagar a linha, o declarado continua lá cobrando de quem já
// pagou. Confiar no declarado sozinho gerava as duas coisas — dívida escondida
// e dívida inventada, inclusive em dobro se alguém clicasse duas vezes.
export function faltaDaVenda(venda) {
  if (!venda) return 0
  const total = pNum(venda.total)
  const recebido = pNum(venda.recebido)
  const real = cent(total - recebido)
  return real > 0.009 ? real : 0
}

// Recebimentos posteriores são lançados no financeiro em vez de reescrever a
// venda: turno fechado é registro histórico, e mexer nele mudaria o fechamento
// daquele dia. Cada quitação aponta para a venda que pagou.
export function totalQuitado(financeiro, vendaId) {
  if (vendaId == null) return 0
  return Math.round((financeiro || [])
    // Só receita abate dívida. Sem o filtro de tipo, uma despesa que viesse a
    // carregar `quitacaoDe` (a taxa do cartão daquele recebimento, por exemplo)
    // seria somada como se o cliente tivesse pago mais do que pagou.
    .filter(f => f.tipo === 'receita' && f.quitacaoDe != null && String(f.quitacaoDe) === String(vendaId))
    .reduce((s, f) => s + pNum(f.valor), 0) * 100) / 100
}

// Vendas de balcão com saldo em aberto, do turno atual e dos já fechados.
export function vendasAReceber({ caixaTurno, caixaHistorico, financeiro }) {
  const turnos = [...(caixaTurno ? [caixaTurno] : []), ...(caixaHistorico || [])]
  const abertas = []
  const jaVistas = new Set()

  for (const t of turnos) {
    for (const v of t.vendas || []) {
      // O turno aberto e o histórico podem conter a mesma venda logo após o
      // fechamento; contar duas vezes dobraria a dívida na tela.
      //
      // Venda sem id não entra na deduplicação: todas colidiriam na chave
      // "undefined" e só a primeira sobreviveria — as demais sumiriam da
      // cobrança sem deixar rastro.
      if (v?.id != null) {
        const chave = String(v.id)
        if (jaVistas.has(chave)) continue
        jaVistas.add(chave)
      }

      const falta = faltaDaVenda(v)
      if (falta <= 0) continue
      const quitado = totalQuitado(financeiro, v.id)
      const saldo = Math.round((falta - quitado) * 100) / 100
      if (saldo <= 0.009) continue

      abertas.push({
        origem: 'venda',
        id: v.id,
        numero: v.numero,
        clienteId: v.clienteId ?? null,
        clienteNome: v.clienteNome || 'Consumidor',
        osId: v.osId ?? null,
        total: pNum(v.total),
        saldo,
        quitadoParcial: quitado,
        data: t.dataAbertura || '',
        quando: parseDataBR(t.dataAbertura) || 0,
      })
    }
  }
  return abertas
}

// OS concluída e não paga — a regra que já existia, agora com a mesma forma
// dos itens de venda para poderem viver na mesma lista.
export function ordensAReceber(ordens, totalOrdem) {
  return (ordens || [])
    .filter(o => o.status === 'Concluída' && !o.pago)
    .map(o => {
      // Uma única OS com total inválido transformava o somatório da tela em
      // "R$ NaN". E OS de valor zero não é dívida — não entra na lista.
      const bruto = Number(totalOrdem(o))
      const total = Number.isFinite(bruto) ? cent(bruto) : 0
      return {
        origem: 'os',
        id: o.id,
        numero: o.id,
        clienteId: o.clienteId ?? null,
        clienteNome: o.clienteNome || '',
        osId: o.id,
        total,
        saldo: total,
        quitadoParcial: 0,
        data: o.dataConclusao || o.data || '',
        quando: parseDataBR(o.dataConclusao) || parseDataBR(o.data) || 0,
      }
    })
    .filter(i => i.saldo > 0.009)
}

// Há quantos dias a dívida existe. Serve para ordenar a cobrança pelo que está
// apodrecendo há mais tempo, não pelo que foi lançado por último.
export function diasEmAberto(item, agora = Date.now()) {
  if (!item?.quando) return null
  return Math.max(0, Math.floor((agora - item.quando) / 86400000))
}

export function listaAReceber({ ordens, totalOrdem, caixaTurno, caixaHistorico, financeiro }) {
  const itens = [
    ...ordensAReceber(ordens, totalOrdem),
    ...vendasAReceber({ caixaTurno, caixaHistorico, financeiro }),
  ]
  // Mais antigo primeiro: é o que corre risco de virar perda. Item sem data vai
  // para o fim (comparar Infinity com Infinity daria NaN e ordem indefinida).
  itens.sort((a, b) => {
    const A = a.quando || Number.MAX_SAFE_INTEGER
    const B = b.quando || Number.MAX_SAFE_INTEGER
    return A - B
  })
  const total = cent(itens.reduce((s, i) => s + (Number.isFinite(i.saldo) ? i.saldo : 0), 0))
  return { itens, total }
}

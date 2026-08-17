// Fechamento de caixa: o que está na gaveta e o que está no banco.
//
// O fechamento antigo somava tudo — dinheiro, PIX, cartão — num "saldo
// esperado" só, e comparava com a soma de sete contagens. Só que cartão e PIX
// nunca estiveram na gaveta: caem direto na conta. Contá-los ali era digitar de
// volta um número que o sistema já sabia, e sempre batia.
//
// O efeito colateral era grave: uma falta de R$ 50 em dinheiro vivo podia ser
// encoberta por uma sobra de R$ 50 no PIX, e a divergência — que existe
// justamente para pegar erro de caixa — não acusava nada.
//
// Agora são duas conferências separadas: a gaveta se conta, o banco se confere
// contra o extrato.
//
// Funções puras — testáveis sem tela.

import { parseValorBR, cent } from './numero.js'

export { parseValorBR as pNum }
const pNum = parseValorBR

export const FORMA_DINHEIRO = 'Dinheiro'

export function ehDinheiro(forma) {
  return (forma || FORMA_DINHEIRO) === FORMA_DINHEIRO
}

// O que cai na conta por um pagamento de cartão é o líquido, não o bruto — é
// contra isso que o extrato vai bater. Pagamento antigo, sem taxa calculada,
// cai no próprio valor.
function valorQueEntra(p) {
  const liquido = pNum(p?.liquido)
  return liquido > 0 ? liquido : pNum(p?.valor)
}

// Separa o movimento do turno entre gaveta (espécie) e banco (o resto).
//
// `semForma` recolhe venda antiga que não guardou o detalhe do pagamento: em vez
// de sumir da conferência, aparece separada para ser olhada com o olho.
export function resumoDoTurno(turno) {
  const vazio = {
    gaveta: { inicial: 0, entradas: 0, saidas: 0, esperado: 0 },
    banco: { linhas: [], total: 0 },
    semForma: 0,
  }
  if (!turno) return vazio

  const inicial = pNum(turno.saldoInicial)
  let dinheiroEntra = 0, dinheiroSai = 0, semForma = 0
  const porForma = new Map()

  function noBanco(forma, campo, valor) {
    const atual = porForma.get(forma) || { forma, entradas: 0, saidas: 0 }
    atual[campo] = cent(atual[campo] + valor)
    porForma.set(forma, atual)
  }

  for (const v of turno.vendas || []) {
    const pagamentos = (v.pagamentos || []).filter(p => p.forma !== 'Pagar Depois')
    if (pagamentos.length === 0) {
      // Venda sem detalhe de pagamento: não dá para saber onde o dinheiro está.
      semForma = cent(semForma + pNum(v.recebido))
      continue
    }
    for (const p of pagamentos) {
      const valor = valorQueEntra(p)
      // Zero é ignorado; negativo NÃO. Descartar valor negativo fazia um estorno
      // lançado como "-50" sumir da gaveta, do banco e do semForma ao mesmo
      // tempo — e virar divergência inexplicada no fechamento.
      if (valor === 0 || !Number.isFinite(valor)) continue
      if (ehDinheiro(p.forma)) dinheiroEntra = cent(dinheiroEntra + valor)
      else noBanco(p.forma, 'entradas', valor)
    }
  }

  for (const m of turno.movimentos || []) {
    const valor = pNum(m.valor)
    if (valor === 0 || !Number.isFinite(valor)) continue
    const entrada = m.tipo === 'reforco'
    if (ehDinheiro(m.forma)) {
      if (entrada) dinheiroEntra = cent(dinheiroEntra + valor)
      else dinheiroSai = cent(dinheiroSai + valor)
    } else {
      noBanco(m.forma || 'Outro', entrada ? 'entradas' : 'saidas', valor)
    }
  }

  const linhas = [...porForma.values()]
    .map(l => ({ ...l, liquido: cent(l.entradas - l.saidas) }))
    .filter(l => l.entradas !== 0 || l.saidas !== 0)
    .sort((a, b) => b.liquido - a.liquido)

  return {
    gaveta: {
      inicial,
      entradas: dinheiroEntra,
      saidas: dinheiroSai,
      esperado: cent(inicial + dinheiroEntra - dinheiroSai),
    },
    banco: { linhas, total: cent(linhas.reduce((s, l) => s + l.liquido, 0)) },
    semForma,
  }
}

// Divergência da gaveta: o que foi contado menos o que deveria estar lá.
// Negativo = está faltando dinheiro.
export function divergenciaGaveta(contado, esperado) {
  return cent(pNum(contado) - pNum(esperado))
}

// Turnos fechados antes desta mudança guardaram `contagem` com todas as formas
// juntas e um `saldoFinal` que somava tudo. O histórico precisa continuar
// legível sem reescrever o passado.
export function ehFechamentoAntigo(turnoFechado) {
  return !!turnoFechado && turnoFechado.conferenciaSeparada !== true
}

// Saídas do caixa: da Oficina (PJ) ou Pessoal (PF).
//
// Algumas contas pessoais do dono ainda passam pelo caixa da oficina, e quem
// lança marcava escrevendo "PF" no motivo — texto livre que deixava escapar
// lançamentos sem a marca. Agora cada saída tem o campo `pessoa`: 'PJ' ou 'PF'.
//
// Contabilmente, gasto pessoal pago pela empresa é RETIRADA do dono, não
// despesa da oficina. Somando no mês as retiradas e as contas pessoais, sai
// quanto a família custa — a base do pró-labore que ele quer definir em 2027.
//
// Este arquivo não mexe na conferência do caixa: o dinheiro pessoal sai da
// gaveta do mesmo jeito.

import { parseValorBR } from './numero'

export const PJ = 'PJ'
export const PF = 'PF'

export function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// Palavras combinadas com o dono em 08/11/2026 (a lista inclui nomes de
// pessoas da casa que aparecem nos motivos). "Casa" só conta fora de nome de loja:
// "Casa da …" costuma ser fornecedor.
const PALAVRAS_PESSOAL = [
  /\bp\.?\s?f\b/,
  /pessoa\s*fisica/,
  /\bpessoal\b/,
  /\bparticular\b/,
  /\bretirada/,
  /\bsofia\b/,
  /\bkaio\b/,
  /\bluziane\b/,
  /\bescola\b/,
  /\bcasa\b(?!\s+d[aoe]s?\b)/,
]

export function pareceSaidaPessoal(motivo) {
  const t = normalizar(motivo)
  return PALAVRAS_PESSOAL.some(re => re.test(t))
}

export function ehRetirada(motivo) {
  return /\bretirada/.test(normalizar(motivo))
}

// A marcação gravada vale. Saída antiga, sem marcação, é estimada pelo texto.
export function pessoaDaSaida(m) {
  if (m?.pessoa === PF || m?.pessoa === PJ) return { pessoa: m.pessoa, estimado: false }
  return { pessoa: pareceSaidaPessoal(m?.motivo) ? PF : PJ, estimado: true }
}

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function chaveDoMes(dataBR) {
  const m = String(dataBR || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}` : null
}

export function rotuloDoMes(chave) {
  const [ano, mes] = String(chave).split('-')
  return `${NOMES_MES[Number(mes) - 1] || mes}/${ano}`
}

const cent = (v) => Math.round(v * 100) / 100

// Um registro por mês, do mais recente para o mais antigo. `turnos` são os
// turnos fechados (caixa_historico) mais o aberto, se houver.
export function resumoPessoalPorMes(turnos) {
  const meses = new Map()
  for (const t of turnos || []) {
    const chave = chaveDoMes(t?.dataAbertura)
    if (!chave) continue
    for (const m of t.movimentos || []) {
      if (m?.tipo !== 'sangria') continue
      const valor = parseValorBR(m.valor)
      if (!valor) continue
      if (!meses.has(chave)) {
        meses.set(chave, { chave, rotulo: rotuloDoMes(chave), oficina: 0, retiradas: 0, contasPessoais: 0, pessoalEstimado: 0, itensPessoais: [] })
      }
      const r = meses.get(chave)
      const { pessoa, estimado } = pessoaDaSaida(m)
      if (pessoa === PF) {
        if (ehRetirada(m.motivo)) r.retiradas += valor
        else r.contasPessoais += valor
        if (estimado) r.pessoalEstimado += valor
        r.itensPessoais.push({ dia: t.dataAbertura, motivo: m.motivo || '', valor, forma: m.forma || '', estimado, retirada: ehRetirada(m.motivo) })
      } else {
        r.oficina += valor
      }
    }
  }
  return [...meses.values()]
    .map(r => ({
      ...r,
      oficina: cent(r.oficina),
      retiradas: cent(r.retiradas),
      contasPessoais: cent(r.contasPessoais),
      pessoal: cent(r.retiradas + r.contasPessoais),
      pessoalEstimado: cent(r.pessoalEstimado),
    }))
    .sort((a, b) => b.chave.localeCompare(a.chave))
}

// Média dos últimos meses FECHADOS. O mês corrente está pela metade, e o
// primeiro mês do sistema (junho/2026) também — os dois puxariam a média para
// baixo. Três meses recentes dizem mais sobre o custo de hoje do que o
// histórico inteiro.
export function mediaDosMesesFechados(meses, hoje = new Date(), quantos = 3) {
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const fechados = (meses || []).filter(m => m.chave < atual)
    .sort((a, b) => b.chave.localeCompare(a.chave))
    .slice(0, quantos)
  if (fechados.length === 0) return null
  const soma = (k) => fechados.reduce((t, m) => t + m[k], 0)
  return {
    meses: fechados.length,
    pessoal: cent(soma('pessoal') / fechados.length),
    retiradas: cent(soma('retiradas') / fechados.length),
    contasPessoais: cent(soma('contasPessoais') / fechados.length),
    oficina: cent(soma('oficina') / fechados.length),
  }
}

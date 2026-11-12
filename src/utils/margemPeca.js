// Margem da peça avulsa: o dono digita o CUSTO e o preço de venda sai
// sozinho, sem abrir a calculadora.
//
// A margem é "em cima do custo" — custo R$ 100 com 65% vira venda de R$ 165,
// que é a conta que o dono faz na calculadora (decisão dele, 12/11/2026). Não
// é a margem sobre a venda (essa daria 39% no mesmo exemplo) — o painel mostra
// sempre "em cima do custo" para os números baterem com o que ele escolheu.
//
// A margem fica em `config.margemPecaAvulsa` — uma só para a oficina inteira:
// o orçamento não pode sair com preço diferente dependendo de quem monta.
// Funções puras, testáveis em Node.

import { parseValorBR } from './numero'

export const MARGEM_PADRAO = 65
export const PASSO_MARGEM = 5

// A margem gravada, ou a padrão. Lixo e número negativo viram a padrão.
export function margemDaConfig(config) {
  const v = config?.margemPecaAvulsa
  if (v === undefined || v === null || v === '') return MARGEM_PADRAO
  const n = parseValorBR(v)
  return Number.isFinite(n) && n >= 0 ? n : MARGEM_PADRAO
}

// O que a pessoa digitou no campo da margem ("65", "65%", "72,5").
// Vazio ou negativo vale 0: a venda fica igual ao custo, nunca abaixo.
export function lerMargem(texto) {
  const n = parseValorBR(String(texto ?? '').replace('%', ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Um clique no − ou no +. Nunca abaixo de zero.
export function passoDaMargem(margem, sentido) {
  const n = (Number(margem) || 0) + sentido * PASSO_MARGEM
  return Math.max(0, Math.round(n * 100) / 100)
}

// Venda = custo × (1 + margem%), em centavos. Sem custo, sem venda (0).
export function vendaPelaMargem(custo, margem) {
  const c = typeof custo === 'number' ? custo : parseValorBR(custo)
  if (!(c > 0)) return 0
  const m = Number(margem) || 0
  return Math.round(c * (1 + m / 100) * 100) / 100
}

// Quanto a venda está em cima do custo, em %. Sem os dois, null.
export function margemSobreCusto(custo, venda) {
  const c = typeof custo === 'number' ? custo : parseValorBR(custo)
  const v = typeof venda === 'number' ? venda : parseValorBR(venda)
  if (!(c > 0) || !(v > 0)) return null
  return Math.round((v / c - 1) * 1000) / 10
}

// Número → texto do jeito que os campos de valor do sistema guardam ("165,00").
export function valorParaCampo(v) {
  return (Number(v) || 0).toFixed(2).replace('.', ',')
}

// "65" / "72,5" para mostrar a margem sem casas sobrando.
export function mostrarMargem(m) {
  const n = Number(m) || 0
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}

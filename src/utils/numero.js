// Leitura de valores digitados em português.
//
// A regra antiga era: "tem vírgula? então ponto é milhar; senão, parseFloat".
// Isso lia "1.500" como 1,5 — quem digitava mil e quinhentos registrava um real
// e cinquenta. Os campos de valor do sistema são texto livre, então isso é
// alcançável em toda venda, gasto e boleto.
//
// Aqui o ponto só é decimal quando NÃO parece separador de milhar.

// "1.500" ou "1.234.567" — grupos de exatamente 3 dígitos até o fim.
const PADRAO_MILHAR = /^\d{1,3}(\.\d{3})+$/

export function parseValorBR(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  // Aceita o que a pessoa realmente digita: "R$ 1.234,56", com espaço no meio.
  const s = (v ?? '').toString().trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!s) return 0

  const negativo = s.startsWith('-')
  const corpo = negativo ? s.slice(1) : s
  let n

  if (corpo.includes(',')) {
    // Vírgula presente: ela é o decimal e o ponto é milhar.
    n = parseFloat(corpo.replace(/\./g, '').replace(',', '.'))
  } else if (PADRAO_MILHAR.test(corpo)) {
    // "1.500" — milhar, não decimal.
    n = parseFloat(corpo.replace(/\./g, ''))
  } else {
    // "3.49", "1500", "0.5" — ponto decimal ou inteiro puro.
    n = parseFloat(corpo)
  }

  if (!Number.isFinite(n)) return 0
  return negativo ? -n : n
}

// Arredonda para centavos. Todo dinheiro que entra em soma passa por aqui.
export function cent(v) {
  const n = typeof v === 'number' ? v : parseValorBR(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

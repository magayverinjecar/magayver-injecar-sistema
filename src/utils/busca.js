// Busca que não obriga a digitar do jeito que está gravado.
//
// Ignora acento e maiúscula em tudo ("joao" acha "João"). Na PLACA ignora
// também o traço, o espaço e o ponto: "abc1234" acha "ABC-1234" e "abc-1234"
// acha "ABC1234". Quem está no balcão digita a placa do jeito que vem na
// cabeça, e exigir o traço fazia a busca dizer que o carro não existe.
//
// O "sem traço" vale só para placa, e campo por campo. Juntar todos os campos
// num texto só e tirar os símbolos faria "#15" achar qualquer placa com 15.
//
// Funções puras — sem React, testáveis em Node.

const ACENTOS = /\p{M}/gu

export function normalizarBusca(s) {
  return String(s ?? '').normalize('NFD').replace(ACENTOS, '').toLowerCase().trim()
}

// Só letras e números: a placa "ABC-1D23" vira "abc1d23".
function soLetrasENumeros(s) {
  return normalizarBusca(s).replace(/[^a-z0-9]/g, '')
}

// `campos`: textos comparados como estão (sem acento e sem maiúscula).
// `placas`: comparadas também sem traço, espaço e ponto.
export function casaBusca(termo, campos = [], placas = []) {
  const t = normalizarBusca(termo)
  if (!t) return true
  if ([...campos, ...placas].some(c => normalizarBusca(c).includes(t))) return true
  // O jeito "sem traço" só entra quando o que foi digitado tem cara de placa:
  // letras, números, traço, espaço ou ponto. "#15" é número de OS, e não pode
  // achar a placa ABC-1500.
  if (!/^[a-z0-9\s.-]+$/.test(t)) return false
  const compacto = soLetrasENumeros(termo)
  return compacto !== '' && placas.some(p => soLetrasENumeros(p).includes(compacto))
}

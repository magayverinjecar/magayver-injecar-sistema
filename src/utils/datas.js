// Datas no sistema são strings em português ("28/07/2026" ou "28/07/2026, 14:30").
// Para ordenar é preciso converter para número.
export function parseDataBR(s) {
  if (!s) return 0
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/)
  if (!m) return 0
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
}

// Quando o veículo entrou na oficina.
//
// Não dá para usar `etapaEm`: ele marca a entrada na ETAPA atual, e a migração
// carimbou todas as OS antigas no mesmo instante — por isso a lista aparecia
// fora de ordem. Nas OS migradas o `dataEntrada` também foi sobrescrito com a
// data da migração, mas o id ('MIG-<timestamp>') preserva o momento original.
export function momentoEntrada(os) {
  const mig = String(os?.id || '').match(/^MIG-(\d{12,14})$/)
  if (mig) return Number(mig[1])
  return parseDataBR(os?.dataEntrada) || parseDataBR(os?.data) || os?.etapaEm || 0
}

// Nome do veículo para exibição.
//
// A recepção digita o modelo num campo só ("GOL TESTE"), e o cadastro quebra em
// marca + modelo. Mostrar só `modelo` perdia a marca e virava "TESTE".
// A OS também guarda `veiculoModelo` com o texto original — quando existe, ele
// tem prioridade por ser exatamente o que foi digitado.
export function nomeVeiculo(veiculo, os) {
  if (os?.veiculoModelo) return os.veiculoModelo
  if (!veiculo) return os?.veiculoInfo || '—'
  const composto = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ').trim()
  return composto || veiculo.modelo || '—'
}

// Data de entrada legível, corrigindo as migradas que ficaram com a data errada.
export function dataEntradaLegivel(os) {
  const ts = momentoEntrada(os)
  if (!ts) return os?.dataEntrada || os?.data || '—'
  return new Date(ts).toLocaleDateString('pt-BR')
}

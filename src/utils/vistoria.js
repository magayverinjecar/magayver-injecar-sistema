// Categorias de foto e itens da vistoria de entrada.
// ATENÇÃO: estes nomes e chaves têm que bater exatamente com o que já está
// gravado no banco (715 fotos e 70 vistorias). Mudar um rótulo aqui faz o
// registro antigo cair na categoria errada ou sumir da tela.

// As categorias oferecidas para foto NOVA. Desde 11/2026 cada roda tem a sua
// (Roda 1 a 4); antes era uma foto só, "Rodas".
export const CATEGORIAS_FOTO = [
  'Frente', 'Traseira', 'Lateral Esq.', 'Lateral Dir.',
  'Painel', 'Motor', 'Chassi', 'Teto', 'Interior',
  'Roda 1', 'Roda 2', 'Roda 3', 'Roda 4', 'Outros',
]

// As categorias que a tela mostra para um conjunto de fotos: as de sempre e,
// além delas, qualquer categoria que já tenha foto gravada e não esteja mais
// na lista — senão a foto some da tela. A "Rodas" antiga entra antes da
// Roda 1, e só nas OS que têm foto nela; as outras entram antes de "Outros".
export function categoriasDaTela(fotos) {
  const usadas = new Set((fotos || []).map(f => f?.categoria).filter(Boolean))
  const lista = [...CATEGORIAS_FOTO]
  if (usadas.has('Rodas')) lista.splice(lista.indexOf('Roda 1'), 0, 'Rodas')
  const sobrando = [...usadas].filter(c => !lista.includes(c))
  lista.splice(lista.indexOf('Outros'), 0, ...sobrando)
  return lista
}

// Fotos do reparo são outra coisa: provam o serviço executado, não o estado de
// chegada. Ficam separadas para não se misturarem no link que o cliente recebe.
export const CATEGORIAS_REPARO = [
  'Peça removida', 'Peça nova', 'Antes', 'Depois', 'Procedimento', 'Outros',
]

export const MOMENTO_ENTRADA = 'entrada'
export const MOMENTO_REPARO = 'reparo'

// Foto sem `momento` é das antigas, tiradas na vistoria de entrada.
export function momentoDaFoto(f) {
  return f?.momento === MOMENTO_REPARO ? MOMENTO_REPARO : MOMENTO_ENTRADA
}

export function fotosDaEntrada(fotos) {
  return (fotos || []).filter(f => momentoDaFoto(f) === MOMENTO_ENTRADA)
}

export function fotosDoReparo(fotos) {
  return (fotos || []).filter(f => momentoDaFoto(f) === MOMENTO_REPARO)
}

export const INSPECAO_ITENS = [
  { id: 'farois',     label: 'Faróis (alto/baixo)' },
  { id: 'lanternas',  label: 'Lanternas traseiras' },
  { id: 'pisca',      label: 'Pisca-alerta e setas' },
  { id: 'luz_re',     label: 'Luz de ré' },
  { id: 'luz_freio',  label: 'Luz de freio' },
  { id: 'limpadores', label: 'Limpadores de para-brisa' },
  { id: 'lavadores',  label: 'Lavadores de para-brisa' },
  { id: 'ar_cond',    label: 'Ar-condicionado' },
  { id: 'vidros',     label: 'Vidros elétricos' },
  { id: 'buzina',     label: 'Buzina' },
]

// Chaves gravadas desde sempre — a tela do cliente também as espera.
export const STATUS_INSP = {
  ok:      { label: 'OK',       cls: 'bg-green-100 text-green-700' },
  warning: { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700' },
  issue:   { label: 'Problema', cls: 'bg-red-100 text-red-700' },
}

export function novaInspecao() {
  return INSPECAO_ITENS.map(i => ({ ...i, status: undefined, nota: '' }))
}

// Completa a lista salva com os itens que faltarem, preservando o que já existe.
export function normalizarInspecao(salvos) {
  if (!Array.isArray(salvos) || salvos.length === 0) return novaInspecao()
  const porId = new Map(salvos.map(i => [i.id, i]))
  return INSPECAO_ITENS.map(padrao => {
    const s = porId.get(padrao.id)
    return { ...padrao, status: s?.status, nota: s?.nota || '' }
  })
}

// Link que o cliente abre para ver as fotos. O id da OS começa com '#', então
// precisa ser codificado ou o navegador trata como âncora.
export function linkVistoria(osId) {
  return `${window.location.origin}/vistoria/${encodeURIComponent(osId)}`
}

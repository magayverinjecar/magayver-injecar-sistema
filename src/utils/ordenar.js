// Ordenar tabela por clique no cabeçalho.
//
// A regra do clique: 1º crescente, 2º decrescente, 3º volta à ordem original.
// O terceiro estado existe porque a ordem natural da lista carrega informação —
// no Estoque é a ordem de cadastro, nas Movimentações é a cronologia — e sem
// ele a única forma de voltar seria recarregar a tela.
//
// O QUE ESTA FUNÇÃO EXISTE PARA EVITAR: ordenar dinheiro como texto. Comparado
// como string, "R$ 1.000,00" vem ANTES de "R$ 90,00", porque o "1" é menor que
// o "9". A tabela fica ordenada e errada ao mesmo tempo — o pior tipo, porque
// ninguém desconfia de uma coluna que parece organizada.
//
// Funções puras — sem React, testáveis em Node.

import { parseValorBR } from './numero.js'

// Texto comparável: sem acento, minúsculo. "ÓLEO" e "oleo" ficam juntos.
function chaveTexto(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
}

// O próximo estado do clique naquela coluna.
//
// `primeira` é o sentido do 1º clique. O padrão é crescente (Estoque), mas há
// coluna em que o útil é o contrário: em data, a mais nova primeiro; em número
// da OS e em valor, o maior primeiro. O 2º clique inverte; o 3º volta ao natural.
export function proximaOrdem(atual, campo, primeira = 'asc') {
  const outra = primeira === 'asc' ? 'desc' : 'asc'
  if (!atual || atual.campo !== campo) return { campo, direcao: primeira }
  if (atual.direcao === primeira) return { campo, direcao: outra }
  return null   // terceiro clique: volta ao natural
}

// Ordena sem tocar na lista original.
//
// `colunas` diz o tipo de cada campo e como tirar o valor do item:
//   { custo: { tipo: 'numero', valor: (p) => p.precoCusto } }
//
// VAZIO: em coluna de número vale zero — é o que faz "ordenar por custo
// crescente" trazer para o topo justamente as peças sem custo, que é quando
// alguém ordena por custo. Em coluna de texto o vazio vai para o fim nas duas
// direções: nome em branco no topo do A-Z é ruído, não informação.
// Coluna de número com `vazioNoFim: true` trata vazio (null, '') como o texto:
// sempre no fim. É o caso da data (OS sem data de entrega) e do número da OS
// (ficha migrada não tem número).
export function ordenarPor(lista, ordem, colunas = {}) {
  const itens = [...(lista || [])]
  if (!ordem?.campo) return itens

  const col = colunas[ordem.campo]
  if (!col) return itens
  const sinal = ordem.direcao === 'desc' ? -1 : 1
  const ehNumero = col.tipo === 'numero'

  // `map` guarda a posição original: é ela que mantém a ordenação estável, para
  // itens de valor igual não trocarem de lugar a cada clique.
  return itens
    .map((item, i) => ({ item, i, v: col.valor(item) }))
    .sort((a, b) => {
      if (ehNumero) {
        if (col.vazioNoFim) {
          const va = a.v === null || a.v === undefined || a.v === ''
          const vb = b.v === null || b.v === undefined || b.v === ''
          if (va && vb) return a.i - b.i
          if (va) return 1
          if (vb) return -1
        }
        const x = parseValorBR(a.v), y = parseValorBR(b.v)
        if (x !== y) return (x - y) * sinal
        return a.i - b.i
      }
      const x = chaveTexto(a.v), y = chaveTexto(b.v)
      if (!x && !y) return a.i - b.i
      if (!x) return 1        // vazio sempre por último, nas duas direções
      if (!y) return -1
      if (x !== y) return x.localeCompare(y, 'pt-BR') * sinal
      return a.i - b.i
    })
    .map(x => x.item)
}

// A setinha do cabeçalho. Devolve o caractere, ou vazio quando a coluna não é a
// ordenada — mostrar seta em todas faria a coluna ativa se perder no meio.
export function setaDaColuna(ordem, campo) {
  if (ordem?.campo !== campo) return ''
  return ordem.direcao === 'desc' ? '↓' : '↑'
}

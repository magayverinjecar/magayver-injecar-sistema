// Peças que o reparador pediu, separadas pela área da avaliação em que ele
// lançou (Injeção, Freios, Suspensão…). Quem monta o orçamento copia a lista
// e vai atrás das peças sem precisar perguntar ao reparador de onde é cada uma.
//
// Cada peça de `os.pecasNecessarias` pode ter `area` (A…H, de utils/avaliacao).
// Sem área — as antigas e as da caixa "Outras peças" — vão para "Outras peças".
// Funções puras, testáveis em Node.

import { AREAS } from './avaliacao'
import { normalizarBusca } from './busca'

// Uma peça em qualquer formato que já foi gravado: { descricao }, { nome } ou
// só o texto.
export function normalizarPeca(p) {
  if (p == null) return null
  if (typeof p === 'string') return { descricao: p.trim(), quantidade: '1', area: '' }
  if (typeof p !== 'object') return null
  return {
    ...p,
    descricao: String(p.descricao ?? p.nome ?? '').trim(),
    quantidade: String(p.quantidade ?? '').trim() || '1',
    area: AREAS.some(a => a.id === p.area) ? p.area : '',
  }
}

// [{ area, nome, pecas }] na ordem das áreas, com "Outras peças" no fim.
// Peça sem nome não entra.
export function pecasPorArea(pecas) {
  const lista = (Array.isArray(pecas) ? pecas : []).map(normalizarPeca).filter(p => p && p.descricao)
  const grupos = AREAS
    .map(a => ({ area: a.id, nome: a.nome, pecas: lista.filter(p => p.area === a.id) }))
    .filter(g => g.pecas.length > 0)
  const outras = lista.filter(p => !p.area)
  if (outras.length) grupos.push({ area: '', nome: 'Outras peças', pecas: outras })
  return grupos
}

// "Lançar no orçamento": as peças do reparador que ainda NÃO estão nos itens
// da OS, prontas para entrar como peça avulsa (sem ligação com o estoque —
// não reserva nem baixa nada) e sem preço, que a oficina preenche depois.
// "Já está" = já existe peça com o mesmo nome (sem acento e sem maiúscula):
// clicar duas vezes não duplica.
export function pecasParaLancar(pecas, itensDaOS) {
  const nome = (s) => normalizarBusca(s).replace(/\s+/g, ' ')
  const jaNaOS = new Set((itensDaOS || []).filter(i => i?.tipo === 'peca').map(i => nome(i.descricao)))
  const todas = pecasPorArea(pecas).flatMap(g => g.pecas)
  const novas = []
  let jaEstavam = 0
  for (const p of todas) {
    const chave = nome(p.descricao)
    if (jaNaOS.has(chave)) { jaEstavam++; continue }
    // A mesma peça em duas áreas da lista do reparador entra duas vezes, cada
    // uma com a sua quantidade: juntar perderia uma das quantidades.
    novas.push({
      tipo: 'peca', produtoId: null, servicoId: null,
      descricao: p.descricao.toUpperCase(),
      quantidade: Number(String(p.quantidade).replace(',', '.')) > 0 ? Number(String(p.quantidade).replace(',', '.')) : 1,
      valorUnitario: '0', desconto: '0', mecanicoId: null,
    })
  }
  return { novas, jaEstavam }
}

// O texto do "Copiar lista", para colar no WhatsApp do fornecedor: o carro em
// cima (sem ele o fornecedor não sabe que peça mandar) e as peças por área.
// Se nenhuma peça tem área, sai a lista corrida, sem título.
export function textoDasPecas(grupos, carro = {}) {
  const cabecalho = [carro.nome, carro.placa, carro.ano, carro.motor ? `motor ${carro.motor}` : '']
    .map(x => String(x ?? '').trim()).filter(x => x && x !== '—').join(' · ')
  const semAreas = grupos.every(g => !g.area)
  const blocos = grupos.map(g => {
    const linhas = g.pecas.map(p => `${p.quantidade}x ${p.descricao}`).join('\n')
    if (semAreas) return linhas
    return `${g.area ? g.nome.toUpperCase() : 'OUTRAS'}\n${linhas}`
  })
  return [cabecalho, ...blocos].filter(Boolean).join('\n\n')
}

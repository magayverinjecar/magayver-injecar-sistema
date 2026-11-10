// Filtros das listas de Ordens de Serviço e de Orçamentos: situação (aberta,
// fechada…), período e a ordem dos status.
//
// Funções puras — sem React, testáveis em Node.

import { parseDataBR, momentoEntrada } from './datas.js'

// ── Situação ──
// O status da OS tem 11 valores; no dia a dia a pergunta é mais curta:
// "está aberta? está pronta? já saiu?". Os status antigos (de OS criadas antes
// da troca de nomes) entram no grupo equivalente para nenhuma OS sumir da tela.
export const SITUACOES_OS = [
  { id: 'todas', rotulo: 'Todas' },
  {
    id: 'abertas', rotulo: 'Abertas',
    status: ['Recepção', 'Em Diagnóstico', 'Aguardando Aprovação', 'Aprovado', 'Aguardando Peça', 'Em Execução', 'Em Conferência',
      'Aberta', 'Diagnóstico', 'Aprovada', 'Em Andamento'],
  },
  { id: 'prontas', rotulo: 'Prontas p/ entregar', status: ['Concluída'] },
  { id: 'fechadas', rotulo: 'Fechadas (entregues)', status: ['Entregue'] },
  { id: 'paradas', rotulo: 'Recusadas / canceladas', status: ['Rejeitada', 'Cancelada'] },
]

export const SITUACOES_ORC = [
  { id: 'todas', rotulo: 'Todos' },
  { id: 'pendentes', rotulo: 'Esperando resposta', status: ['Pendente'] },
  { id: 'aprovados', rotulo: 'Aprovados', status: ['Aprovado'] },
  { id: 'convertidos', rotulo: 'Viraram OS', status: ['Convertido'] },
  { id: 'recusados', rotulo: 'Recusados', status: ['Recusado'] },
]

export function situacaoPorId(situacoes, id) {
  return situacoes.find(s => s.id === id) || situacoes[0]
}

export function naSituacao(situacao, status) {
  return !situacao?.status || situacao.status.includes(status)
}

// ── Ordem dos status ──
// "Na ordem do serviço": o caminho do carro, e no fim as que pararam.
const FLUXO_OS = ['Recepção', 'Em Diagnóstico', 'Aguardando Aprovação', 'Aprovado', 'Aguardando Peça', 'Em Execução', 'Em Conferência', 'Concluída', 'Entregue', 'Rejeitada', 'Cancelada']
const STATUS_ANTIGO = { 'Aberta': 'Recepção', 'Diagnóstico': 'Em Diagnóstico', 'Aprovada': 'Aprovado', 'Em Andamento': 'Em Execução' }
export function posicaoDoStatusOS(status) {
  const i = FLUXO_OS.indexOf(STATUS_ANTIGO[status] || status)
  return i < 0 ? null : i
}

const FLUXO_ORC = ['Pendente', 'Aprovado', 'Convertido', 'Recusado']
export function posicaoDoStatusOrc(status) {
  const i = FLUXO_ORC.indexOf(status)
  return i < 0 ? null : i
}

// ── Datas da OS ──
// Entrada: `momentoEntrada` — o mesmo que a tela da oficina usa. Ele já sabe
// que as fichas migradas guardam a entrada verdadeira no id, e não na data.
export function entradaDaOS(os) {
  return momentoEntrada(os) || null
}
// Entrega: a data gravada ao entregar. OS entregue antes desse campo existir
// usa a de conclusão, para não sumir do filtro "pela entrega".
export function entregaDaOS(os) {
  return parseDataBR(os?.dataEntrega) || (os?.status === 'Entregue' ? parseDataBR(os?.dataConclusao) : 0) || null
}

export function dataCurta(ms) {
  return ms ? new Date(ms).toLocaleDateString('pt-BR') : ''
}

// ── Período ──
export const PERIODOS = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7dias', rotulo: 'Últimos 7 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mespassado', rotulo: 'Mês passado' },
  { id: 'escolher', rotulo: 'Escolher datas…' },
]

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const fimDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
// "2026-11-10" (o que o campo de data devolve) → Date local. `new Date(iso)`
// leria como meia-noite em Londres, que no Brasil é o dia anterior.
function deISO(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}

// [início, fim] em milissegundos, com o fim no último instante do dia. `null`
// quando o período é "tudo". Num lado em branco do "escolher", aquele lado
// fica aberto.
export function intervaloDoPeriodo({ periodo, de, ate } = {}, agora = new Date()) {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  switch (periodo) {
    case 'hoje': return [inicioDoDia(hoje), fimDoDia(hoje)]
    case '7dias': { const d = new Date(hoje); d.setDate(d.getDate() - 6); return [inicioDoDia(d), fimDoDia(hoje)] }
    case 'mes': return [inicioDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fimDoDia(hoje)]
    case 'mespassado': return [
      inicioDoDia(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      fimDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    ]
    case 'escolher': {
      const a = deISO(de), b = deISO(ate)
      if (!a && !b) return null
      return [a ? inicioDoDia(a) : -Infinity, b ? fimDoDia(b) : Infinity]
    }
    default: return null
  }
}

// Data vazia fica de fora quando há período: não dá para dizer que caiu nele.
export function noPeriodo(ms, intervalo) {
  if (!intervalo) return true
  if (!ms) return false
  return ms >= intervalo[0] && ms <= intervalo[1]
}

// Como o período aparece escrito no rodapé ("este mês", "01/10/2026 a 31/10/2026").
export function nomeDoPeriodo({ periodo, de, ate } = {}) {
  if (periodo === 'escolher') {
    const a = deISO(de), b = deISO(ate)
    if (!a && !b) return ''
    if (a && b) return `${a.toLocaleDateString('pt-BR')} a ${b.toLocaleDateString('pt-BR')}`
    return a ? `desde ${a.toLocaleDateString('pt-BR')}` : `até ${b.toLocaleDateString('pt-BR')}`
  }
  const p = PERIODOS.find(x => x.id === periodo)
  return !p || p.id === 'tudo' ? '' : p.rotulo.toLowerCase()
}

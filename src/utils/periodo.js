// Recorte de período do financeiro.
//
// O resumo somava tudo desde o primeiro dia da oficina: "Faturamento" só subia e
// nunca respondia a pergunta que o dono realmente faz — julho foi melhor que
// junho? Aqui fica o recorte, em funções puras (sem React, sem estado), para
// poder ser testado em Node e usado igual em qualquer tela.

import { parseDataBR } from './datas.js'
import { parseValorBR, cent } from './numero.js'

// Ordem em que aparecem na tela.
export const PERIODOS = [
  { chave: 'mes',      label: 'Este mês' },
  { chave: 'anterior', label: 'Mês passado' },
  { chave: '90d',      label: '90 dias' },
  { chave: 'ano',      label: 'Este ano' },
  { chave: 'tudo',     label: 'Tudo' },
  { chave: 'custom',   label: 'Personalizado' },
]

const DIA = 86400000

function fimDoDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

function inicioDoDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Os inputs de data do sistema são <input type="date"> ("2026-07-01"), mas as
// datas gravadas nos lançamentos são "DD/MM/AAAA". Aceita os dois para o campo
// personalizado funcionar independentemente de onde o valor veio.
function paraTimestamp(v) {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v || '').trim()
  if (!s) return 0
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3])
    // "2026-13-45" vira outro mês silenciosamente; melhor tratar como não informado.
    if (d.getFullYear() !== +iso[1] || d.getMonth() !== +iso[2] - 1 || d.getDate() !== +iso[3]) return 0
    return d.getTime()
  }
  return parseDataBR(s)
}

function dataLegivel(ts) {
  return new Date(ts).toLocaleDateString('pt-BR')
}

// Intervalo do período escolhido.
//
// `agora` é injetável só para os testes conseguirem fixar a virada de mês e de
// ano; na tela ninguém passa esse parâmetro.
export function intervaloDe(chave, opcoes = {}) {
  const { de, ate, agora } = opcoes
  const hoje = agora instanceof Date ? agora : new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()

  if (chave === 'anterior') {
    // new Date(y, m, 0) = último dia do mês anterior — resolve sozinho a virada
    // de ano (janeiro → dezembro do ano passado) e mês de 28/30/31 dias.
    const primeiro = new Date(y, m - 1, 1)
    const ultimo = new Date(y, m, 0)
    return { de: primeiro.getTime(), ate: fimDoDia(ultimo), rotulo: 'mês passado' }
  }

  if (chave === '90d') {
    return { de: inicioDoDia(hoje) - 89 * DIA, ate: fimDoDia(hoje), rotulo: 'últimos 90 dias' }
  }

  if (chave === 'ano') {
    return { de: new Date(y, 0, 1).getTime(), ate: fimDoDia(new Date(y, 11, 31)), rotulo: 'este ano' }
  }

  if (chave === 'tudo') {
    // Infinito nos dois lados é o que marca "sem recorte" para `dentroDoPeriodo`:
    // é o único caso em que lançamento com data ilegível ainda entra na conta.
    return { de: -Infinity, ate: Infinity, rotulo: 'todo o período' }
  }

  if (chave === 'custom') {
    let tDe = paraTimestamp(de)
    let tAte = paraTimestamp(ate)
    // Nada preenchido ainda (a pessoa acabou de clicar em "Personalizado"):
    // mostra o mês corrente em vez de zerar a tela.
    if (!tDe && !tAte) return intervaloDe('mes', { agora: hoje })
    // Datas trocadas (fim antes do início) devolveriam período vazio sem avisar.
    // A troca é feita antes de virar início/fim de dia, senão o intervalo sai
    // com as horas invertidas.
    if (tDe && tAte && tDe > tAte) [tDe, tAte] = [tAte, tDe]
    const ini = tDe ? inicioDoDia(new Date(tDe)) : 0
    const fim = tAte ? fimDoDia(new Date(tAte)) : fimDoDia(hoje)
    const rotulo = tDe && tAte
      ? `${dataLegivel(ini)} a ${dataLegivel(fim)}`
      : tDe ? `de ${dataLegivel(ini)}` : `até ${dataLegivel(fim)}`
    return { de: ini, ate: fim, rotulo }
  }

  // 'mes' e qualquer chave desconhecida caem aqui: mês corrente é o padrão.
  return {
    de: new Date(y, m, 1).getTime(),
    ate: fimDoDia(new Date(y, m + 1, 0)),
    rotulo: 'este mês',
  }
}

// O intervalo imediatamente anterior, para a comparação "▲ 12% vs mês passado".
//
// Mês e ano em curso são comparados só até o ponto equivalente do período
// anterior (dia 10 de agosto contra 1 a 10 de julho). Comparar dez dias contra
// um mês inteiro daria uma queda que não existe. `parcial` avisa a tela disso.
// Devolve null quando não existe base de comparação ("Tudo").
export function periodoAnteriorDe(chave, opcoes = {}) {
  const { agora } = opcoes
  const hoje = agora instanceof Date ? agora : new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()
  const atual = intervaloDe(chave, opcoes)

  if (chave === 'tudo') return null

  if (chave === 'anterior') {
    const primeiro = new Date(y, m - 2, 1)
    const ultimo = new Date(y, m - 1, 0)
    return { de: primeiro.getTime(), ate: fimDoDia(ultimo), rotulo: 'mês retrasado', parcial: false }
  }

  // "Personalizado" sem data preenchida mostra o mês corrente (ver `intervaloDe`),
  // então a comparação também tem de ser a do mês — senão a mesma tela mostrava
  // o mesmo valor com duas variações diferentes.
  if (chave === 'custom' && !paraTimestamp(opcoes.de) && !paraTimestamp(opcoes.ate)) {
    return periodoAnteriorDe('mes', opcoes)
  }

  if (chave === 'mes' || chave === 'ano' || chave === undefined || !PERIODOS.some(p => p.chave === chave)) {
    const anoCiclo = chave === 'ano'
    const inicioAnterior = anoCiclo ? new Date(y - 1, 0, 1) : new Date(y, m - 1, 1)
    const fimAnterior = anoCiclo ? fimDoDia(new Date(y - 1, 11, 31)) : fimDoDia(new Date(y, m, 0))
    const agoraTs = hoje.getTime()
    const emCurso = agoraTs < atual.ate
    const decorrido = Math.max(0, Math.min(agoraTs, atual.ate) - atual.de)
    // Trava no fim do período anterior: fevereiro tem 28 dias e não pode receber
    // os 30 dias já decorridos de um mês de 31.
    const ate = emCurso ? Math.min(inicioAnterior.getTime() + decorrido, fimAnterior) : fimAnterior
    return {
      de: inicioAnterior.getTime(),
      ate,
      rotulo: emCurso
        ? (anoCiclo ? 'mesmo período do ano passado' : 'mesmo período do mês passado')
        : (anoCiclo ? 'ano passado' : 'mês passado'),
      parcial: emCurso,
    }
  }

  // '90d' e 'custom': o bloco de mesma duração imediatamente antes.
  const duracao = atual.ate - atual.de
  const ate = atual.de - 1
  return {
    de: ate - duracao,
    ate,
    rotulo: chave === '90d' ? '90 dias anteriores' : 'período anterior',
    parcial: false,
  }
}

// A data do lançamento cai dentro do intervalo?
export function dentroDoPeriodo(dataBR, intervalo) {
  if (!intervalo) return true
  const t = parseDataBR(dataBR)
  if (!t) {
    // `parseDataBR` devolve 0 quando a data falta ou está fora do formato. Esse
    // lançamento não pode sumir do "Tudo" — é dinheiro que já estava no total
    // que o dono vê hoje —, mas também não dá para fingir que é de julho.
    return !Number.isFinite(intervalo.de) && !Number.isFinite(intervalo.ate)
  }
  return t >= intervalo.de && t <= intervalo.ate
}

// Receitas, despesas e lucro de um intervalo.
//
// Pendente fica de fora: boleto cadastrado e ainda não pago é compromisso, não
// despesa realizada — entra em "A Pagar", não no resultado do mês.
export function resumirFinanceiro(lancamentos, intervalo) {
  let receitas = 0
  let despesas = 0
  let quantidade = 0

  for (const l of lancamentos || []) {
    if (!l || l.pendente) continue
    if (!dentroDoPeriodo(l.data, intervalo)) continue
    const valor = cent(parseValorBR(l.valor))
    if (l.tipo === 'receita') receitas = cent(receitas + valor)
    else if (l.tipo === 'despesa') despesas = cent(despesas + valor)
    else continue
    quantidade++
  }

  return { receitas, despesas, lucro: cent(receitas - despesas), quantidade }
}

// Variação percentual contra o período anterior.
//
// Sem base (anterior zerado) devolve null em vez de Infinity: "∞%" na tela não
// informa nada e ainda quebra a formatação.
export function variacao(atual, anterior) {
  const a = Number(atual)
  const b = Number(anterior)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (b === 0) return null
  // Módulo no denominador para o sinal continuar significando "melhorou/piorou"
  // quando o período anterior fechou no vermelho.
  return cent(((a - b) / Math.abs(b)) * 100)
}

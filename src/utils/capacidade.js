// Capacidade instalada da oficina — os números que transformam custo fixo em
// preço de hora.
//
// Vive fora das telas porque duas precisam do mesmo dado: Configurações, para
// cadastrar, e Financeiro, para mostrar o custo da hora ao lado do ponto de
// equilíbrio. Cada tela com a própria cópia dos padrões seria a mesma armadilha
// do parser de valor: dois lugares divergindo em silêncio.

// Padrões do dia a dia de oficina — 8 horas, 22 dias úteis, 70% de ocupação.
//
// `reparadores` nasce VAZIO de propósito: quantas pessoas põem a mão no carro é
// o único número que ninguém pode chutar pela oficina. Um "1" pré-preenchido
// seria aceito sem leitura e produziria um custo da hora errado com cara de
// certo — e custo da hora errado vira tabela de preço errada.
import { custoDaHora, custoFixoMensal } from './margem.js'

export const CAPACIDADE_PADRAO = {
  reparadores: '',
  horasPorDia: '8',
  diasUteis: '22',
  ocupacao: '70',
}

// Os campos são guardados como texto porque vêm de <input> — o mesmo que já se
// faz com as taxas das maquininhas. Quem calcula converte.
export function capacidadeDoConfig(config) {
  const salvo = config?.capacidade || {}
  const campo = (nome) => {
    const v = salvo[nome]
    return v === undefined || v === null || v === '' ? CAPACIDADE_PADRAO[nome] : String(v)
  }
  return {
    reparadores: campo('reparadores'),
    horasPorDia: campo('horasPorDia'),
    diasUteis: campo('diasUteis'),
    ocupacao: campo('ocupacao'),
  }
}

// O que ainda falta para o custo da hora existir.
//
// Devolver a lista do que falta, e não um `false`, é o que permite a tela dizer
// "preencha quantos reparadores" em vez de mostrar R$ 0,00 por hora — que é um
// preço, e alguém acabaria usando.
export function problemasDaCapacidade(cap) {
  const faltas = []
  if (!(Number(cap?.reparadores) > 0)) faltas.push('quantos reparadores põem a mão no carro')
  if (!(Number(cap?.horasPorDia) > 0)) faltas.push('horas trabalhadas por dia')
  if (!(Number(cap?.diasUteis) > 0)) faltas.push('dias úteis no mês')
  if (!(Number(cap?.ocupacao) > 0)) faltas.push('ocupação (%)')
  return faltas
}

// Ocupação que não fecha com a realidade da bancada.
//
// Não é erro de digitação nem impede o cálculo — por isso é aviso, não bloqueio.
// Mas 100% significa "toda hora paga do mecânico vira hora vendida", o que
// nenhuma oficina consegue: orçamento que não fecha, espera de peça e retrabalho
// consomem hora paga que ninguém fatura. Quem usa 100% divide o custo fixo por
// mais horas do que vende e sai barato demais em toda tabela de preço.
export function avisoDaOcupacao(ocupacao) {
  const oc = Number(ocupacao)
  if (!(oc > 0)) return null
  if (oc > 100) return 'Ocupação acima de 100% não existe: ninguém vende mais horas do que paga. O custo da hora sai menor que o real.'
  if (oc >= 95) return 'Ocupação de ' + oc + '% supõe que quase nada se perde em orçamento, espera de peça e retrabalho. Na prática fica entre 60% e 80% — acima disso o custo da hora sai barato demais.'
  if (oc < 40) return 'Ocupação abaixo de 40% é raro. Se estiver certo, o custo da hora fica alto porque a oficina tem muita hora paga e pouca vendida.'
  return null
}

// O custo da hora de bancada, pronto para quem precisa dele.
//
// Vive aqui porque duas telas usam a mesma conta (Orçamento e OS, para conferir
// se o preço cobre o tempo) e Configurações a mostra. Repetir em três lugares
// garantiria que uma delas ficasse com um número diferente das outras.
//
// Devolve `null` enquanto a capacidade não estiver preenchida ou não houver
// gasto fixo cadastrado — sem esses dois não existe custo da hora, e mostrar
// zero seria pior do que não mostrar nada.
export function custoHoraDaOficina({ gastos, config }) {
  const cap = capacidadeDoConfig(config)
  const { custoHora } = custoDaHora({
    custoFixo: custoFixoMensal(gastos),
    mecanicos: cap.reparadores,
    horasPorDia: cap.horasPorDia,
    diasUteis: cap.diasUteis,
    ocupacao: cap.ocupacao,
  })
  return custoHora && custoHora > 0 ? custoHora : null
}

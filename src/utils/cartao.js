// Maquininhas de cartão: cadastro, taxa e data em que o dinheiro cai.
//
// A oficina opera mais de uma máquina, e elas cobram diferente pelo mesmo
// serviço: uma credita na hora (taxa maior, porque está antecipando), outra
// credita no próximo dia útil (taxa menor). Sem saber POR QUAL máquina passou,
// não há como calcular o que realmente entrou nem comparar as duas.
//
// Tudo aqui é função pura, para poder ser testado sem tela.

// Leitura de valores em português — ver utils/numero.js.
export { parseValorBR } from './numero.js'
import { parseValorBR } from './numero.js'

// Teto de sanidade para taxa de maquininha. Nenhuma adquirente do mercado cobra
// perto disso; o número existe para pegar o dedo escorregado que digita "349"
// no lugar de "3,49" — que viraria R$ 349 de despesa numa venda de R$ 100.
export const TAXA_MAXIMA_PCT = 30

export const PRAZOS = {
  mesmo_dia:        { label: 'Na hora (mesmo dia)',  curto: 'Na hora',  dias: 0 },
  proximo_dia_util: { label: 'Próximo dia útil',     curto: 'D+1',      dias: 1 },
}

// Máquina recém-criada: nasce sem taxa nenhuma de propósito. Taxa chutada é
// pior que taxa ausente — a ausente aparece como pendência, a chutada vira
// número errado com cara de certo.
export function novaMaquina(id) {
  return {
    id,
    nome: '',
    ativa: true,
    prazo: 'mesmo_dia',
    taxaDebito: '',
    taxaCreditoVista: '',
    faixasParcelado: [],
  }
}

export function maquinasDoConfig(config) {
  const salvas = config?.maquinasCartao
  return Array.isArray(salvas) ? salvas : []
}

export function maquinasAtivas(config) {
  return maquinasDoConfig(config).filter(m => m.ativa !== false)
}

// Com uma máquina só, escolher não é decisão — é digitação. A tela já abre nela.
export function maquinaPadrao(config) {
  return maquinasAtivas(config)[0] || null
}

export function acharMaquina(config, maquinaId) {
  if (maquinaId == null) return null
  return maquinasDoConfig(config).find(m => String(m.id) === String(maquinaId)) || null
}

// ── Taxa ─────────────────────────────────────────────────────────────────────
// As operadoras publicam a tabela do parcelado em faixas ("2 a 6x: 4,99%"),
// então é assim que ela é guardada: cada faixa vale ATÉ N parcelas.
//
// Devolve { percentual, origem } — `origem` diz de onde o número veio, para a
// tela poder avisar quando caiu num palpite em vez de numa faixa cadastrada.
export function taxaDe(maquina, { modalidade, parcelas = 1 } = {}) {
  if (!maquina) return { percentual: 0, origem: 'sem_maquina' }

  if (modalidade === 'debito') {
    return { percentual: parseValorBR(maquina.taxaDebito), origem: 'debito' }
  }

  const n = Number(parcelas) || 1
  if (n <= 1) {
    return { percentual: parseValorBR(maquina.taxaCreditoVista), origem: 'credito_vista' }
  }

  const faixas = ordenarFaixas(maquina.faixasParcelado)
  if (faixas.length === 0) {
    // Sem tabela de parcelado cadastrada, o à vista é o mais próximo da verdade
    // — mas fica marcado como estimativa para a tela poder cobrar o cadastro.
    return { percentual: parseValorBR(maquina.taxaCreditoVista), origem: 'estimado_sem_faixa' }
  }

  const faixa = faixas.find(f => n <= (Number(f.ate) || 0))
  if (faixa) return { percentual: parseValorBR(faixa.taxa), origem: 'faixa' }

  // Passou do teto cadastrado: usa a última faixa e avisa.
  return { percentual: parseValorBR(faixas[faixas.length - 1].taxa), origem: 'acima_do_teto' }
}

export function ordenarFaixas(faixas) {
  return [...(faixas || [])]
    .filter(f => Number(f?.ate) > 0)
    .sort((a, b) => Number(a.ate) - Number(b.ate))
}

// Bruto é o que o cliente pagou; líquido é o que cai na conta. A taxa é
// arredondada primeiro e o líquido sai por subtração, para que
// taxa + liquido volte a dar exatamente o bruto (senão sobra centavo fantasma).
export function aplicarTaxa(bruto, percentual) {
  const b = Math.round(parseValorBR(bruto) * 100) / 100
  const pct = parseValorBR(percentual)
  if (!(b > 0) || !(pct > 0)) return { bruto: b, percentual: pct > 0 ? pct : 0, taxa: 0, liquido: b }
  const taxa = Math.round(b * pct) / 100
  return { bruto: b, percentual: pct, taxa, liquido: Math.round((b - taxa) * 100) / 100 }
}

// Atalho: calcula direto a partir da máquina e da modalidade.
export function calcularPagamentoCartao(maquina, { bruto, modalidade, parcelas = 1 } = {}) {
  const { percentual, origem } = taxaDe(maquina, { modalidade, parcelas })
  return { ...aplicarTaxa(bruto, percentual), origem }
}

// ── Quando o dinheiro cai ────────────────────────────────────────────────────
// Feriado nacional derruba o D+1 justamente no fim de semana prolongado, que é
// quando se olha para o saldo antes de decidir uma compra.

// Domingo de Páscoa (Meeus/Jones/Butcher). Base dos feriados móveis.
function domingoDePascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

function chaveISO(data) {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function somarDias(data, dias) {
  const nova = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  nova.setDate(nova.getDate() + dias)
  return nova
}

const cacheFeriados = new Map()

// Feriados em que o banco não compensa. Inclui segunda e terça de carnaval:
// não são feriado nacional na lei, mas não há compensação bancária neles.
export function feriadosBancarios(ano) {
  if (cacheFeriados.has(ano)) return cacheFeriados.get(ano)

  const dias = [
    new Date(ano, 0, 1),    // Confraternização Universal
    new Date(ano, 3, 21),   // Tiradentes
    new Date(ano, 4, 1),    // Dia do Trabalho
    new Date(ano, 8, 7),    // Independência
    new Date(ano, 9, 12),   // Nossa Senhora Aparecida
    new Date(ano, 10, 2),   // Finados
    new Date(ano, 10, 15),  // Proclamação da República
    new Date(ano, 11, 25),  // Natal
  ]
  // Consciência Negra virou feriado nacional pela Lei 14.759/2023.
  if (ano >= 2024) dias.push(new Date(ano, 10, 20))

  const pascoa = domingoDePascoa(ano)
  dias.push(somarDias(pascoa, -48)) // segunda de carnaval
  dias.push(somarDias(pascoa, -47)) // terça de carnaval
  dias.push(somarDias(pascoa, -2))  // Sexta-Feira Santa
  dias.push(somarDias(pascoa, 60))  // Corpus Christi

  const set = new Set(dias.map(chaveISO))
  cacheFeriados.set(ano, set)
  return set
}

// `feriadosExtras`: datas 'YYYY-MM-DD' de feriado municipal, cadastráveis depois.
export function ehDiaUtil(data, feriadosExtras = []) {
  const diaSemana = data.getDay()
  if (diaSemana === 0 || diaSemana === 6) return false
  const iso = chaveISO(data)
  if (feriadosBancarios(data.getFullYear()).has(iso)) return false
  return !feriadosExtras.includes(iso)
}

export function proximoDiaUtil(data, feriadosExtras = []) {
  let d = somarDias(data, 1)
  // O limite existe só para não girar para sempre se algum dado vier corrompido.
  for (let i = 0; i < 30 && !ehDiaUtil(d, feriadosExtras); i++) d = somarDias(d, 1)
  return d
}

// Em que dia o valor vira saldo no banco. Máquina que credita na hora cai no
// mesmo dia inclusive em domingo — o dinheiro já está lá, não passa por
// compensação bancária.
export function dataCredito(maquina, dataVenda = new Date(), feriadosExtras = []) {
  const base = new Date(dataVenda.getFullYear(), dataVenda.getMonth(), dataVenda.getDate())
  if (!maquina || maquina.prazo !== 'proximo_dia_util') return base
  return proximoDiaUtil(base, feriadosExtras)
}

export function dataCreditoISO(maquina, dataVenda = new Date(), feriadosExtras = []) {
  return chaveISO(dataCredito(maquina, dataVenda, feriadosExtras))
}

// ── Pagamentos ───────────────────────────────────────────────────────────────
// As telas guardam a forma como texto ("Cartão Crédito"). Só o cartão passa por
// adquirente e tem taxa; dinheiro, PIX e transferência entram integrais.

export const FORMA_DEBITO  = 'Cartão Débito'
export const FORMA_CREDITO = 'Cartão Crédito'

export function ehCartao(forma) {
  return forma === FORMA_DEBITO || forma === FORMA_CREDITO
}

export function modalidadeDaForma(forma) {
  if (forma === FORMA_DEBITO)  return 'debito'
  if (forma === FORMA_CREDITO) return 'credito'
  return null
}

// Completa um pagamento com o que ele custou e quando cai. Devolve SEMPRE os
// três valores (bruto, taxa, liquido) para que quem lê não precise saber se era
// cartão ou não.
//
// `taxaPendente` marca o caso do cadastro ainda incompleto: a taxa entra como
// zero (não se inventa número), mas o pagamento guarda máquina, modalidade e
// parcelas — tudo que é preciso para recalcular quando a taxa for cadastrada.
export function enriquecerPagamento(pagamento, config, dataVenda = new Date()) {
  const bruto = Math.round(parseValorBR(pagamento?.valor) * 100) / 100
  const base = { ...pagamento, bruto, taxa: 0, liquido: bruto }

  if (!ehCartao(pagamento?.forma)) return base

  const maquina = acharMaquina(config, pagamento?.maquinaId)
  const modalidade = modalidadeDaForma(pagamento.forma)
  const parcelas = modalidade === 'credito' ? (Number(pagamento.parcelas) || 1) : 1
  const r = calcularPagamentoCartao(maquina, { bruto, modalidade, parcelas })

  return {
    ...base,
    maquinaId:   maquina?.id ?? null,
    // Nome copiado: renomear a máquina depois não pode reescrever o passado.
    maquinaNome: maquina?.nome || '',
    modalidade,
    parcelas,
    taxa: r.taxa,
    taxaPercentual: r.percentual,
    liquido: r.liquido,
    creditoEm: dataCreditoISO(maquina, dataVenda),
    // Sem máquina escolhida ou sem taxa cadastrada, o valor entra cheio e isso
    // fica registrado — para a tela cobrar o cadastro e para dar pra reprocessar.
    taxaPendente: !maquina || !(r.percentual > 0),
    origemTaxa: r.origem,
  }
}

export function enriquecerPagamentos(pagamentos, config, dataVenda = new Date()) {
  return (pagamentos || []).map(p => enriquecerPagamento(p, config, dataVenda))
}

// Totais de uma lista já enriquecida.
export function somarPagamentos(pagamentos) {
  const lista = pagamentos || []
  const soma = (f) => Math.round(lista.reduce((s, p) => s + (Number(f(p)) || 0), 0) * 100) / 100
  return {
    bruto:        soma(p => p.bruto),
    taxa:         soma(p => p.taxa),
    liquido:      soma(p => p.liquido),
    temPendencia: lista.some(p => p.taxaPendente),
  }
}

// ── Comparação entre máquinas ────────────────────────────────────────────────
// A pergunta que a oficina precisa responder para negociar: "esse mesmo volume,
// na outra máquina, teria custado quanto?". Só dá para responder porque cada
// lançamento guarda COMO passou — débito, à vista ou parcelado.

// `detalhes`: [{ modalidade, parcelas, bruto, taxa }] gravados no lançamento.
// Devolve o que a máquina informada cobraria por esse mesmo movimento.
export function simularNaMaquina(detalhes, maquina) {
  let taxa = 0
  let comparavel = 0      // volume que a máquina sabe precificar
  let semTabela = 0       // volume sem taxa cadastrada — não entra na conta
  for (const d of detalhes || []) {
    const bruto = parseValorBR(d?.bruto)
    if (!(bruto > 0)) continue
    const r = taxaDe(maquina, { modalidade: d.modalidade, parcelas: d.parcelas })
    if (!(r.percentual > 0)) { semTabela = Math.round((semTabela + bruto) * 100) / 100; continue }
    taxa = Math.round((taxa + aplicarTaxa(bruto, r.percentual).taxa) * 100) / 100
    comparavel = Math.round((comparavel + bruto) * 100) / 100
  }
  return { taxa, comparavel, semTabela, completo: semTabela === 0 }
}

// Taxa efetiva: quanto por cento do que passou ficou pela adquirente. É este
// número — não o da tabela — que se leva para a mesa de negociação.
export function taxaEfetiva(taxa, volume) {
  const v = parseValorBR(volume)
  if (!(v > 0)) return 0
  return Math.round((parseValorBR(taxa) / v) * 10000) / 100
}

// Consolida os lançamentos de taxa de um período: total por máquina e a
// simulação de cada máquina sobre o movimento inteiro.
//
// `lancamentos` já vem filtrado por data — o recorte é da tela; a conta é aqui.
export function resumirTaxasCartao(lancamentos, maquinas) {
  const porMaquina = new Map()
  const todosDetalhes = []
  let taxaTotal = 0, volumeTotal = 0

  for (const l of lancamentos || []) {
    const taxa = parseValorBR(l?.valor)
    const base = parseValorBR(l?.baseCalculo)
    const chave = String(l?.maquinaId)
    const atual = porMaquina.get(chave)
      || { id: l?.maquinaId ?? null, nome: l?.maquinaNome || 'Máquina removida', taxa: 0, volume: 0, vendas: 0 }
    atual.taxa = Math.round((atual.taxa + taxa) * 100) / 100
    atual.volume = Math.round((atual.volume + base) * 100) / 100
    atual.vendas += 1
    porMaquina.set(chave, atual)

    taxaTotal = Math.round((taxaTotal + taxa) * 100) / 100
    volumeTotal = Math.round((volumeTotal + base) * 100) / 100
    if (Array.isArray(l?.detalhes)) todosDetalhes.push(...l.detalhes)
  }

  // Sem o detalhe de como cada venda passou, simular seria chute: a mesma
  // quantia em débito ou em 10x custa coisas muito diferentes.
  //
  // E só entra na comparação a máquina capaz de precificar o movimento INTEIRO.
  // Uma máquina com só a taxa de débito cadastrada cobraria "R$ 19,80" para um
  // volume de R$ 10.000 — e apareceria em primeiro lugar como a mais barata,
  // prometendo uma economia que não existe. Ela aparece à parte, sem diferença
  // calculada, junto com o aviso do que falta cadastrar.
  const simulacoes = todosDetalhes.length > 0
    ? (maquinas || []).map(m => {
        const s = simularNaMaquina(todosDetalhes, m)
        return {
          maquina: m,
          ...s,
          diferenca: s.completo ? Math.round((taxaTotal - s.taxa) * 100) / 100 : null,
        }
      })
    : []

  const comparativo = simulacoes.filter(s => s.completo).sort((a, b) => a.taxa - b.taxa)
  const incompletas = simulacoes.filter(s => !s.completo)

  return {
    lista: [...porMaquina.values()].sort((a, b) => b.taxa - a.taxa),
    taxaTotal,
    volumeTotal,
    efetiva: taxaEfetiva(taxaTotal, volumeTotal),
    comparativo,
    incompletas,
    temDetalhe: todosDetalhes.length > 0,
  }
}

// ── Validação do cadastro ────────────────────────────────────────────────────
// Devolve a lista de problemas de uma máquina, para a tela mostrar o que falta
// antes que a taxa errada comece a contaminar o financeiro.
export function problemasDaMaquina(maquina) {
  const problemas = []
  if (!maquina) return ['Máquina não encontrada']
  if (!String(maquina.nome || '').trim()) problemas.push('Sem apelido')

  const debito = parseValorBR(maquina.taxaDebito)
  const vista = parseValorBR(maquina.taxaCreditoVista)
  if (!(debito > 0)) problemas.push('Taxa de débito não informada')
  else if (debito > TAXA_MAXIMA_PCT) problemas.push(`Taxa de débito acima de ${TAXA_MAXIMA_PCT}% — confira a vírgula`)
  if (!(vista > 0)) problemas.push('Taxa de crédito à vista não informada')
  else if (vista > TAXA_MAXIMA_PCT) problemas.push(`Taxa de crédito acima de ${TAXA_MAXIMA_PCT}% — confira a vírgula`)

  const faixas = ordenarFaixas(maquina.faixasParcelado)
  if (faixas.length === 0) {
    problemas.push('Sem tabela de parcelado')
  } else {
    if (faixas.some(f => !(parseValorBR(f.taxa) > 0))) problemas.push('Faixa de parcelado sem taxa')
    if (faixas.some(f => parseValorBR(f.taxa) > TAXA_MAXIMA_PCT)) problemas.push(`Faixa de parcelado acima de ${TAXA_MAXIMA_PCT}% — confira a vírgula`)
    const tetos = faixas.map(f => Number(f.ate))
    if (new Set(tetos).size !== tetos.length) problemas.push('Duas faixas terminam no mesmo número de parcelas')
  }
  return problemas
}

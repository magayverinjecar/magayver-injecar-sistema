// Clientes para chamar — quando um carro que já passou aqui deve ser chamado
// de volta para revisão.
//
// A regra, combinada com o dono em 08/11/2026:
// - o carro entra na lista se já fez algum ITEM DE REVISÃO aqui (óleo, bicos,
//   velas, filtros, TBI, revisão preventiva);
// - vence 6 meses depois da ÚLTIMA visita, de qualquer serviço: quem voltou
//   ontem para trocar o radiador não é chamado amanhã;
// - um contato por carro, mesmo que ele tenha feito vários itens;
// - "não respondeu" volta para a lista uma vez, 15 dias depois;
// - "não incomodar" (o cliente respondeu SAIR) tira o cliente de tudo.
//
// As OS antigas têm o serviço digitado à mão — a troca de óleo aparece escrita
// de mais de dez jeitos. Por isso o item é reconhecido de duas formas: pela
// marca "item de revisão" no catálogo de serviços, e pelo próprio texto.
// Sem o texto, a lista de janeiro de 2027 sairia vazia.

import { parseDataBR, momentoEntrada, nomeVeiculo } from './datas'

export const MESES_REVISAO = 6
export const DIAS_ANTES = 15
export const DIAS_NOVA_TENTATIVA = 15
const DIA = 24 * 60 * 60 * 1000

export const RESULTADOS = [
  { id: 'agendou',       rotulo: 'Agendou' },
  { id: 'nao-quer',      rotulo: 'Não quer' },
  { id: 'nao-respondeu', rotulo: 'Não respondeu' },
  { id: 'nao-incomodar', rotulo: 'Não incomodar' },
]

export function rotuloResultado(id) {
  return RESULTADOS.find(r => r.id === id)?.rotulo || id
}

// Sem acento e em minúscula: "ÓLEO", "Oleo" e "óleo" viram a mesma palavra.
export function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// Peças e reparos que têm "óleo" no nome sem serem a troca de óleo do motor:
// bomba, sensor, retentor, vareta… e o óleo de outros sistemas (câmbio, freio,
// direção). Sai do texto antes de procurar a palavra "óleo".
const NAO_E_TROCA_DE_OLEO = [
  /(bomba|sensor|retentor|junta|tampa|pescador|oring\w*|anel|vareta|interruptor|bulbo|radiador|resfriador|trocador|atuador|pressao|suspiro|respiro|mangote|carter|vazamento)\s+(d[aeo]s?\s+)?((pressao|bomba|nivel|tampa)\s+)?(d[aeo]s?\s+)?oleos?\b/g,
  /oleos?\s+(d[aeo]s?\s+|para\s+(o\s+|a\s+)?)?(cambio|transmiss\w*|diferencial|direcao|freio|hidraulic\w*|compressor|caixa|completar|atf|dot)/g,
  // SAE 80/90/140 é óleo de engrenagem (câmbio, diferencial).
  /oleos?\s+(sae\s+)?(80w?\d*|90|140)\b/g,
]

// A ordem é a da frase da mensagem: "fizemos troca de óleo, limpeza dos bicos…"
const CATEGORIAS = [
  {
    id: 'oleo', rotulo: 'troca de óleo',
    teste: t => /\boleos?\b/.test(NAO_E_TROCA_DE_OLEO.reduce((s, re) => s.replace(re, ' '), t)),
  },
  {
    id: 'bicos', rotulo: 'limpeza dos bicos',
    // Trocar um bico com defeito é reparo, não revisão — por isso o texto
    // precisa falar de limpeza (ou da máquina de ultrassom, ou da flauta).
    teste: t => /ultra\s?s{1,2}o[mn]|flauta/.test(t)
      || /limpeza.{0,25}injecao/.test(t)
      || (/\b(bicos?|injetor(es)?)\b/.test(t) && /(limp|teste|equaliz)/.test(t)),
  },
  { id: 'velas', rotulo: 'troca de velas', teste: t => /\bvelas?\b|cabos?\s+de\s+ignicao/.test(t) },
  {
    id: 'filtros', rotulo: 'troca de filtros',
    // O filtro de óleo já está dentro da "troca de óleo" — inclusive no "óleo e
    // filtro", no singular. O pré-filtro vem junto com a bomba de combustível:
    // é reparo, não revisão.
    teste: t => /\bfiltros?\b/.test(t
      .replace(/filtros?\s+(d[eo]\s+)?oleo/g, '')
      .replace(/oleo\s+e\s+filtro\b/g, '')
      .replace(/pre[\s-]?filtro/g, '')),
  },
  { id: 'tbi', rotulo: 'limpeza do TBI', teste: t => /\btbi\b|borboleta|descarboniz/.test(t) },
  { id: 'revisao', rotulo: 'revisão preventiva', teste: t => /revisao (preventiva|geral|completa)|preventiv/.test(t) },
]

// Serviço marcado no catálogo que o texto não reconhece entra com este nome.
const ROTULO_GENERICO = 'uma revisão'

// Só o começo da descrição diz QUAL serviço foi feito. Muita OS traz o
// procedimento inteiro escrito ("SUBSTITUIÇÃO DA TURBINA; DESMONTAGEM…; DRENAGEM
// DO ÓLEO…"), e o óleo citado no meio do passo a passo não é troca de óleo.
function titulo(t) {
  return t.split(/[;:*•\n]|\s[-–]\s|\.\s/)[0].slice(0, 90)
}

// O texto de um item (serviço ou peça) parece item de revisão? Devolve as
// categorias reconhecidas — vazio quando não é.
export function categoriasDoTexto(texto) {
  const t = titulo(normalizar(texto))
  if (!t.trim()) return []
  return CATEGORIAS.filter(c => c.teste(t)).map(c => c.id)
}

export function ehTextoDeRevisao(texto) {
  return categoriasDoTexto(texto).length > 0
}

// Um serviço do catálogo conta como revisão? Quem decide é a marca da lista de
// Serviços. Enquanto ninguém marcou nem desmarcou, vale o que o nome diz.
export function servicoEhRevisao(servico) {
  if (typeof servico?.revisao === 'boolean') return servico.revisao
  return ehTextoDeRevisao(servico?.nome)
}

// Categorias de um item da OS. Peça conta: "ÓLEO 5W30" ou "FILTRO DE AR"
// lançados como peça dizem que a troca aconteceu.
export function categoriasDoItem(item, servicoPorId) {
  const s = item?.servicoId != null ? servicoPorId?.get(String(item.servicoId)) : null
  if (s && typeof s.revisao === 'boolean') {
    if (!s.revisao) return []
    const doTexto = categoriasDoTexto(item?.descricao)
    if (doTexto.length) return doTexto
    const doNome = categoriasDoTexto(s.nome)
    return doNome.length ? doNome : ['generico']
  }
  return categoriasDoTexto(item?.descricao)
}

export function categoriasDaOS(os, servicoPorId) {
  const set = new Set()
  for (const it of os?.itens || []) for (const c of categoriasDoItem(it, servicoPorId)) set.add(c)
  return set
}

// "troca de óleo, limpeza dos bicos e troca de velas"
export function frasesDosServicos(categorias) {
  const lista = CATEGORIAS.filter(c => categorias.has(c.id)).map(c => c.rotulo)
  if (categorias.has('generico') && lista.length === 0) lista.push(ROTULO_GENERICO)
  if (lista.length <= 1) return lista[0] || ROTULO_GENERICO
  return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1]
}

const VISITA = new Set(['Entregue', 'Concluída'])

export function ehVisita(os) {
  return !!os && !os.rascunho && VISITA.has(os.status)
}

// Carro com OS aberta está na oficina agora — não tem por que chamar.
export function estaNaOficina(os) {
  return !!os && !os.rascunho && !VISITA.has(os.status) && os.status !== 'Cancelada'
    && !String(os.id).startsWith('DRAFT-')
}

// Quando o carro esteve aqui: a data de ENTRADA. A de entrega parecia a mais
// certa, mas 83 OS antigas foram entregues em lote no sistema em 30/07/2026 —
// com ela, todas venceriam no mesmo dia. Para um lembrete de 6 meses, os dias
// entre a entrada e a saída não mudam nada.
export function dataDaVisita(os) {
  return momentoEntrada(os) || parseDataBR(os?.dataEntrega) || parseDataBR(os?.dataConclusao) || 0
}

export function somarMeses(ts, meses) {
  const d = new Date(ts)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d.getTime()
}

function inicioDoDia(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Telefone no formato do wa.me: 55 + DDD + número. Devolve '' quando não dá
// para confiar no número (curto demais, longo demais).
export function foneWhatsApp(tel) {
  let d = String(tel || '').replace(/\D/g, '')
  if (d.startsWith('0')) d = d.replace(/^0+/, '')
  if (d.length === 10 || d.length === 11) return '55' + d
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return ''
}

// "JOÃO CARLOS" → "João"
export function primeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0] || ''
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''
}

function nomeDoMes(ts, hoje) {
  const d = new Date(ts)
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' })
  return d.getFullYear() === new Date(hoje).getFullYear() ? mes : `${mes} de ${d.getFullYear()}`
}

function fmtKm(v) {
  const n = Number(String(v || '').replace(/\D/g, ''))
  return n > 0 ? n.toLocaleString('pt-BR') : ''
}

// A mensagem aprovada pelo dono em 08/11/2026. O único trecho variável que
// não estava no texto é o número de meses: quando o cliente voltou depois
// para outro serviço, já se passaram mais de 6 meses desde a revisão.
export function mensagemRevisao(entrada, hoje = Date.now()) {
  const nome = primeiroNome(entrada.cliente?.nome)
  const carro = entrada.carro
  const placa = entrada.placa
  const et = entrada.etiquetaOleo
  if (et && (et.kmProxima || et.dataProxima)) {
    const km = fmtKm(et.kmProxima)
    const quando = [km && `aos ${km} km`, et.dataProxima && `em ${new Date(et.dataProxima).toLocaleDateString('pt-BR')}`]
      .filter(Boolean).join(' ou ')
    return `Oi, ${nome}! Aqui é da Magayver Injecar. A próxima troca de óleo do seu ${carro} está chegando: é ${quando}, como está na etiqueta do vidro. Quer agendar? Aproveitamos para fazer uma revisão rápida da injeção. Se preferir não receber esses lembretes, é só responder SAIR.`
  }
  const meses = Math.max(MESES_REVISAO, Math.round((hoje - entrada.dataRevisao) / (30.44 * DIA)))
  const mes = nomeDoMes(entrada.dataRevisao, hoje)
  const servicos = frasesDosServicos(entrada.categorias)
  const placaTxt = placa ? ` (placa ${placa})` : ''
  return `Oi, ${nome}! Tudo bem? Aqui é da Magayver Injecar. Em ${mes} fizemos ${servicos} no seu ${carro}${placaTxt}. Já se passaram ${meses} meses, e é o momento certo para uma revisão preventiva da injeção. Ela evita falha, consumo alto e surpresa na estrada. Quer que eu reserve um horário para você esta semana? Se preferir não receber esses lembretes, é só responder SAIR.`
}

export function linkWhatsApp(entrada, hoje = Date.now()) {
  const fone = foneWhatsApp(entrada.cliente?.telefone)
  if (!fone) return ''
  return `https://wa.me/${fone}?text=${encodeURIComponent(mensagemRevisao(entrada, hoje))}`
}

// A lista inteira, um registro por carro que já fez revisão aqui.
//
// situacao:
//   'chamar'     — venceu ou vence nos próximos 15 dias, e ninguém chamou ainda
//                  (ou "não respondeu" há mais de 15 dias, segunda tentativa)
//   'futuro'     — ainda não chegou a hora
//   'chamado'    — já houve contato neste ciclo
//   'na-oficina' — tem OS aberta agora
//   'bloqueado'  — o cliente pediu para não ser incomodado
export function montarListaRevisao({ ordens = [], veiculos = [], clientes = [], servicos = [], hoje = Date.now() }) {
  const servicoPorId = new Map(servicos.map(s => [String(s.id), s]))
  const veiculoPorId = new Map(veiculos.map(v => [String(v.id), v]))
  const clientePorId = new Map(clientes.map(c => [String(c.id), c]))

  const porVeiculo = new Map()
  for (const os of ordens) {
    if (!os || os.rascunho || os.veiculoId == null || os.veiculoId === '') continue
    const k = String(os.veiculoId)
    if (!porVeiculo.has(k)) porVeiculo.set(k, [])
    porVeiculo.get(k).push(os)
  }

  const inicioHoje = inicioDoDia(hoje)
  const resultado = []

  for (const [vid, lista] of porVeiculo) {
    const visitas = lista.filter(ehVisita)
      .map(os => ({ os, ts: dataDaVisita(os) }))
      .filter(v => v.ts > 0)
      .sort((a, b) => b.ts - a.ts)
    if (visitas.length === 0) continue

    let revisao = null
    for (const v of visitas) {
      const cats = categoriasDaOS(v.os, servicoPorId)
      if (cats.size) { revisao = { ...v, cats }; break }
    }
    if (!revisao) continue

    const ultima = visitas[0]
    const veiculo = veiculoPorId.get(vid) || null
    const clienteId = ultima.os.clienteId ?? veiculo?.clienteId ?? null
    const cliente = clienteId != null ? clientePorId.get(String(clienteId)) || null : null

    // A etiqueta do vidro promete uma data para o óleo; ela vale mesmo que o
    // carro tenha voltado depois para outro serviço.
    const etiquetaOleo = revisao.os.etiquetaOleo || null
    const vence = etiquetaOleo?.dataProxima
      ? inicioDoDia(etiquetaOleo.dataProxima)
      : somarMeses(ultima.ts, MESES_REVISAO)

    const chamadas = (veiculo?.chamadas || []).filter(c => c && c.em >= ultima.ts)
      .sort((a, b) => a.em - b.em)
    const ultimaChamada = chamadas[chamadas.length - 1] || null

    let situacao
    let tentativa = 1
    let novaTentativaEm = null
    if (cliente?.naoIncomodar) situacao = 'bloqueado'
    else if (lista.some(estaNaOficina)) situacao = 'na-oficina'
    else if (!ultimaChamada) situacao = inicioHoje >= vence - DIAS_ANTES * DIA ? 'chamar' : 'futuro'
    else if (ultimaChamada.resultado === 'nao-respondeu' && chamadas.length < 2) {
      novaTentativaEm = ultimaChamada.em + DIAS_NOVA_TENTATIVA * DIA
      if (hoje >= novaTentativaEm) { situacao = 'chamar'; tentativa = 2 }
      else situacao = 'chamado'
    } else situacao = 'chamado'

    resultado.push({
      veiculoId: veiculo?.id ?? ultima.os.veiculoId,
      veiculo,
      cliente,
      clienteId,
      carro: nomeVeiculo(veiculo, revisao.os),
      placa: veiculo?.placa || revisao.os.veiculoPlaca || '',
      osUltima: ultima.os,
      dataUltima: ultima.ts,
      osRevisao: revisao.os,
      dataRevisao: revisao.ts,
      categorias: revisao.cats,
      etiquetaOleo,
      vence,
      diasParaVencer: Math.round((vence - inicioHoje) / DIA),
      chamadas,
      ultimaChamada,
      situacao,
      tentativa,
      novaTentativaEm,
      temTelefone: !!foneWhatsApp(cliente?.telefone),
    })
  }

  return resultado.sort((a, b) => a.vence - b.vence)
}

// O registro que vai para a ficha do veículo quando alguém marca o resultado.
export function novaChamada({ resultado, por, osId }) {
  return { em: Date.now(), resultado, por: por || '', lista: 'revisao', osId: osId ?? null }
}

// Guarda as 30 mais recentes — a ficha do veículo não precisa carregar anos
// de tentativas.
export function anexarChamada(veiculo, chamada) {
  return { ...veiculo, chamadas: [...(veiculo.chamadas || []), chamada].slice(-30) }
}

// Avaliação técnica por ÁREAS — o checklist do diagnóstico separado em
// Injeção, Ignição, Freios, Suspensão… e o que dele vira recomendação ao
// cliente. A oficina passou a fazer mecânica, e o cliente vem para uma
// checagem completa do que precisa trocar; o escritório imprime esta
// avaliação (utils/print.js) para o cliente ver o que foi verificado.
//
// Onde mora cada coisa na OS (tudo aditivo, nada renomeado):
//   A Injeção  → `diagnosticoItens` (as 12 medições de sempre), agora com
//                `verificado` e `nota` por item;
//   B a G      → `avaliacao.itens[itemId] = { status, nota }`;
//   H Acessórios → `inspecaoVisual` (a vistoria de entrada), só leitura aqui.
// Situações: 'normal' (OK), 'atencao', 'problema' (trocar) — as mesmas chaves
// que a aba Diagnóstico da OS já grava.
//
// As recomendações NÃO são uma lista solta: saem de cada item marcado Atenção
// ou Trocar. O que fica gravado é só o ajuste do reparador (texto, urgência,
// "não recomendar") em `avaliacao.ajustes[itemId]`, e as recomendações que ele
// escreveu à mão em `avaliacao.extras`.
//
// Fotos da avaliação: `avaliacao.fotos[itemId] = [{ id, url, em }]`, de
// qualquer área (até a H). São SEPARADAS das fotos do reparo (`os.fotos`):
// mostram ao cliente o que foi visto na checagem, e saem no papel embaixo da
// área a que pertencem.

import { DIAGNOSTICO_ITENS, valorDoItem } from './diagnostico'
import { INSPECAO_ITENS } from './vistoria'

export const NORMAL = 'normal'
export const ATENCAO = 'atencao'
export const PROBLEMA = 'problema'

export const URGENCIAS = [
  { id: 'urgente', rotulo: 'Urgente' },
  { id: 'recomendado', rotulo: 'Recomendado' },
  { id: 'pode_esperar', rotulo: 'Pode esperar' },
]
const ORDEM_URGENCIA = { urgente: 0, recomendado: 1, pode_esperar: 2 }

export const MAX_FOTOS_POR_ITEM = 4

export function fotosDoItem(os, itemId) {
  const lista = os?.avaliacao?.fotos?.[itemId]
  return Array.isArray(lista) ? lista.filter(f => f && f.url) : []
}

export const AREAS = [
  { id: 'A', nome: 'Injeção eletrônica', fonte: 'diagnostico' },
  { id: 'B', nome: 'Ignição', itens: [
    { id: 'ign_velas', label: 'Velas' },
    { id: 'ign_bobinas', label: 'Bobinas e cabos' },
    { id: 'ign_falha', label: 'Falha de combustão nos cilindros' },
  ] },
  { id: 'C', nome: 'Freios', itens: [
    { id: 'frei_dianteiro', label: 'Pastilhas e discos dianteiros' },
    { id: 'frei_traseiro', label: 'Freio traseiro (lonas, tambores ou pastilhas)' },
    { id: 'frei_fluido', label: 'Fluido de freio' },
    { id: 'frei_mangueiras', label: 'Mangueiras e vazamentos' },
    { id: 'frei_mao', label: 'Freio de mão' },
  ] },
  { id: 'D', nome: 'Suspensão e direção', itens: [
    { id: 'susp_amortecedores', label: 'Amortecedores' },
    { id: 'susp_buchas', label: 'Buchas, pivôs e bieletas' },
    { id: 'susp_direcao', label: 'Terminais e caixa de direção' },
    { id: 'susp_coxins', label: 'Coxins dos amortecedores' },
    { id: 'susp_pneus', label: 'Desgaste dos pneus' },
    { id: 'susp_homocineticas', label: 'Homocinéticas e coifas' },
  ] },
  { id: 'E', nome: 'Arrefecimento', itens: [
    { id: 'arr_liquido', label: 'Nível e condição do líquido' },
    { id: 'arr_radiador', label: 'Radiador e mangueiras' },
    { id: 'arr_bomba', label: "Bomba d'água" },
    { id: 'arr_valvula', label: 'Válvula termostática' },
    { id: 'arr_ventilador', label: 'Eletroventilador' },
  ] },
  { id: 'F', nome: 'Motor e lubrificação', itens: [
    { id: 'mot_oleo', label: 'Nível e estado do óleo' },
    { id: 'mot_vazamentos', label: 'Vazamentos por juntas e retentores' },
    { id: 'mot_correia_dentada', label: 'Correia dentada' },
    { id: 'mot_correias', label: 'Correias auxiliares e tensores' },
    { id: 'mot_coxins', label: 'Coxins do motor e câmbio' },
  ] },
  { id: 'G', nome: 'Elétrica e bateria', itens: [
    { id: 'ele_bateria', label: 'Bateria (teste de carga)' },
    { id: 'ele_alternador', label: 'Alternador (carga)' },
    { id: 'ele_partida', label: 'Motor de partida' },
  ] },
  { id: 'H', nome: 'Acessórios e iluminação', fonte: 'vistoria' },
]

// A vistoria de entrada grava ok/atencao/problema (OS) ou ok/warning/issue
// (checklist antigo). Aqui tudo vira normal/atencao/problema.
function statusDaVistoria(s) {
  if (s === 'ok') return NORMAL
  if (s === 'atencao' || s === 'warning') return ATENCAO
  if (s === 'problema' || s === 'issue') return PROBLEMA
  return null
}

// Medição da injeção conta como verificada quando tem valor, quando foi
// marcada Atenção/Trocar, ou quando o reparador tocou em OK (`verificado`).
// O status padrão gravado é 'normal' mesmo sem ninguém ter olhado — por isso
// 'normal' sozinho não basta.
function medicaoVerificada(item) {
  return !!item && (item.verificado === true || String(valorDoItem(item)).trim() !== ''
    || item.status === ATENCAO || item.status === PROBLEMA)
}

// Todos os itens de todas as áreas, já com status/nota/valor, no formato da
// tela e do papel: { area, id, label, unidade?, valor?, status|null, nota, verificado, somenteLeitura, fotos }
export function itensDaAvaliacao(os) {
  const porIdDiag = new Map((os?.diagnosticoItens || []).map(i => [i.id, i]))
  const porIdVist = new Map((os?.inspecaoVisual || []).map(i => [i.id, i]))
  const salvos = os?.avaliacao?.itens || {}
  const lista = []
  for (const area of AREAS) {
    if (area.fonte === 'diagnostico') {
      for (const p of DIAGNOSTICO_ITENS) {
        const s = porIdDiag.get(p.id)
        const verificado = medicaoVerificada(s)
        lista.push({
          area: area.id, id: p.id, label: p.label, unidade: p.unidade, valor: valorDoItem(s),
          status: verificado ? (s?.status || NORMAL) : null, nota: s?.nota || '', verificado,
          fotos: fotosDoItem(os, p.id),
        })
      }
    } else if (area.fonte === 'vistoria') {
      for (const p of INSPECAO_ITENS) {
        const s = porIdVist.get(p.id)
        const status = statusDaVistoria(s?.status)
        lista.push({ area: area.id, id: p.id, label: p.label, status, nota: s?.nota || '', verificado: !!status, somenteLeitura: true, fotos: fotosDoItem(os, p.id) })
      }
    } else {
      for (const p of area.itens) {
        const s = salvos[p.id]
        const status = [NORMAL, ATENCAO, PROBLEMA].includes(s?.status) ? s.status : null
        lista.push({ area: area.id, id: p.id, label: p.label, status, nota: s?.nota || '', verificado: !!status, fotos: fotosDoItem(os, p.id) })
      }
    }
  }
  return lista
}

export function resumoDaAvaliacao(itens) {
  const r = { total: itens.length, verificados: 0, ok: 0, atencao: 0, problema: 0 }
  for (const i of itens) {
    if (!i.verificado) continue
    r.verificados++
    if (i.status === ATENCAO) r.atencao++
    else if (i.status === PROBLEMA) r.problema++
    else r.ok++
  }
  return r
}

function textoPadrao(item) {
  const nota = String(item.nota || '').trim()
  return nota ? `${item.label} — ${nota}` : item.label
}

// O que vai em "O que recomendamos fazer", já na ordem de urgência.
export function recomendacoesDaAvaliacao(os, itens = itensDaAvaliacao(os)) {
  const ajustes = os?.avaliacao?.ajustes || {}
  const recs = []
  for (const i of itens) {
    if (i.status !== ATENCAO && i.status !== PROBLEMA) continue
    const a = ajustes[i.id] || {}
    if (a.removida) continue
    recs.push({
      chave: i.id, itemId: i.id, area: i.area,
      texto: String(a.texto || '').trim() || textoPadrao(i),
      urgencia: a.urgencia || (i.status === PROBLEMA ? 'urgente' : 'recomendado'),
      automatica: true,
    })
  }
  for (const e of os?.avaliacao?.extras || []) {
    if (!String(e?.texto || '').trim()) continue
    recs.push({ chave: e.id, itemId: null, area: e.area || '', texto: e.texto.trim(), urgencia: e.urgencia || 'recomendado', automatica: false })
  }
  const ordemArea = (a) => { const k = AREAS.findIndex(x => x.id === a); return k < 0 ? 99 : k }
  return recs.sort((x, y) => (ORDEM_URGENCIA[x.urgencia] ?? 9) - (ORDEM_URGENCIA[y.urgencia] ?? 9) || ordemArea(x.area) - ordemArea(y.area))
}

// Numera as fotos na ordem em que aparecem no papel (área por área, item por
// item). Só entram itens verificados: foto de item sem situação marcada não
// tem o que ilustrar. Devolve o número de cada foto por item, para a lista de
// recomendações apontar "📷 fotos 1 e 2".
export function fotosNumeradas(itens) {
  const porItem = {}
  const lista = []
  for (const i of itens) {
    if (!i.verificado || !i.fotos?.length) continue
    porItem[i.id] = []
    for (const f of i.fotos) {
      const n = lista.length + 1
      porItem[i.id].push(n)
      lista.push({ n, item: i, id: f.id, url: f.url })
    }
  }
  return { porItem, lista, total: lista.length }
}

// A OS tem avaliação para imprimir? (algum item verificado ou alguma recomendação)
export function temAvaliacao(os) {
  return resumoDaAvaliacao(itensDaAvaliacao(os)).verificados > 0
    || (os?.avaliacao?.extras || []).some(e => String(e?.texto || '').trim())
}

export function nomeDaArea(id) {
  return AREAS.find(a => a.id === id)?.nome || ''
}

// De onde vêm os clientes — e qual canal traz DINHEIRO.
//
// A pergunta que isto responde é de administrador, não de recepção: "onde eu
// coloco o dinheiro de anúncio no mês que vem?". Contar cliente por canal
// responde metade; a outra metade é quanto cada canal faturou. Os dois números
// quase nunca são iguais, e é a diferença entre eles que decide o orçamento:
// um canal pode trazer 40% dos clientes e 12% do faturamento (serviço pequeno,
// gente que pesquisa preço) enquanto outro traz 15% dos clientes e 35% do
// faturamento (indicação, que já chega decidida). Só a contagem faria fechar o
// canal errado.
//
// Funções puras — sem React, sem estado, testáveis em Node.

import { momentoEntrada } from './datas.js'
import { cent } from './numero.js'
import { dentroDoPeriodo } from './periodo.js'

// Os canais, na ordem em que aparecem na tela de entrada.
//
// A lista é curta de propósito. Quem preenche é a recepção com o cliente na
// frente: vinte opções viram "Outro" em toda entrada, e aí o relatório não diz
// nada. Também não há sobreposição — "Anúncio" foi deixado de fora porque
// anúncio dele roda no Google e no Instagram, e a pessoa não saberia qual
// marcar. Mexer aqui muda a tela e o relatório ao mesmo tempo, que é o ponto
// de a lista viver num arquivo só.
export const ORIGENS_CLIENTE = [
  'Google',
  'Instagram',
  'Facebook',
  'WhatsApp',
  'Indicação de amigo',
  'Indicação de oficina',
  'Passou em frente',
  'Cliente antigo',
  'Outro',
]

// O que aparece quando o cliente foi cadastrado sem a pergunta. Não é um canal:
// é a medida de quanto do relatório ainda é chute.
export const SEM_ORIGEM = 'Não informado'

export function origemDoCliente(cliente) {
  const v = String(cliente?.origem || '').trim()
  return v || SEM_ORIGEM
}

// Quando cada cliente apareceu pela primeira vez.
//
// O cadastro do cliente não guarda data de criação, e mesmo que guardasse a data
// certa seria outra: o que interessa é quando o carro entrou, não quando alguém
// digitou o nome. Então a "captação" é a data da PRIMEIRA OS daquele cliente —
// inclusive OS que viraram orçamento recusado, porque o canal entregou o
// contato do mesmo jeito. Julgar canal só pelo que fechou esconde o canal que
// traz volume e é mal aproveitado no balcão.
//
// A data sai de `momentoEntrada`, e não de `dataEntrada` direto: a migração
// sobrescreveu o `dataEntrada` de toda OS antiga com a data em que a migração
// rodou, e só o id ('MIG-<timestamp>') preserva o momento verdadeiro. Lendo o
// campo cru, a carteira inteira seria contada como "captada" no mês da
// migração, e cada cliente sumiria do mês em que realmente chegou. É a mesma
// função que Veículos, Meus Serviços e as telas da oficina já usam para
// responder esta pergunta.
export function primeiraVisitaPorCliente(ordens) {
  const mapa = new Map()
  for (const o of ordens || []) {
    const id = String(o?.clienteId ?? '')
    if (!id || id === 'null' || id === 'undefined') continue
    // Zero = data ilegível. Essa OS não vira captação em período nenhum, nem em
    // "Tudo" — ao contrário de `dentroDoPeriodo`, que deixa passar lançamento
    // sem data. A diferença é de propósito: lá o valor já estava no total que o
    // dono vê; aqui, carimbar o cliente num mês inventado seria pior do que
    // deixá-lo de fora da comparação entre canais.
    const t = momentoEntrada(o)
    if (!t) continue
    const atual = mapa.get(id)
    if (atual == null || t < atual) mapa.set(id, t)
  }
  return mapa
}

// OS que já viraram receita. Mesma regra do ponto de equilíbrio e do DRE
// (`Concluída`/`Entregue`, data da conclusão) — se este painel usasse outro
// corte, o faturamento por canal não bateria com o faturamento da mesma tela
// logo acima, e o dono deixaria de acreditar nos dois.
function ehReceitaNoPeriodo(os, intervalo) {
  if (!['Concluída', 'Entregue'].includes(os?.status)) return false
  return dentroDoPeriodo(os.dataConclusao || os.data || os.dataEntrada || '', intervalo)
}

function linhaVazia(canal) {
  return { canal, novos: 0, ordens: 0, faturamento: 0, pctNovos: 0, pctFaturamento: 0 }
}

// A tabela do painel.
//
// `intervalo` vem do seletor de período da tela — é ele que dá o "mês a mês,
// ano a ano" sem este arquivo precisar saber o que é um mês.
export function tabularOrigem({ clientes, ordens, totalOrdem, intervalo }) {
  const porCanal = new Map()
  const linha = (canal) => {
    if (!porCanal.has(canal)) porCanal.set(canal, linhaVazia(canal))
    return porCanal.get(canal)
  }

  const origemDe = new Map()
  for (const c of clientes || []) {
    if (c?.id == null) continue
    origemDe.set(String(c.id), origemDoCliente(c))
  }

  // ── Clientes captados no período ──────────────────────────────────────────
  const primeira = primeiraVisitaPorCliente(ordens)
  let novosTotal = 0
  for (const [clienteId, quando] of primeira) {
    if (!intervalo || (quando >= intervalo.de && quando <= intervalo.ate)) {
      // Cliente que existe nas OS mas sumiu do cadastro ainda foi captado por
      // algum canal — some do relatório se for ignorado, e o total deixa de
      // fechar com a realidade.
      linha(origemDe.get(clienteId) || SEM_ORIGEM).novos++
      novosTotal++
    }
  }

  // Cadastro sem OS nenhuma não tem data de captação. Só entra quando não há
  // recorte de período ("Tudo"), pela mesma razão que `dentroDoPeriodo` deixa
  // passar lançamento sem data: não dá para fingir que é de julho.
  const semRecorte = intervalo && !Number.isFinite(intervalo.de) && !Number.isFinite(intervalo.ate)
  if (!intervalo || semRecorte) {
    for (const c of clientes || []) {
      if (c?.id == null) continue
      if (primeira.has(String(c.id))) continue
      linha(origemDoCliente(c)).novos++
      novosTotal++
    }
  }

  // ── Faturamento do período, atribuído ao canal do cliente ─────────────────
  let faturamentoTotal = 0
  let ordensTotal = 0
  // Duas coisas diferentes, contadas separado: OS que nunca teve cliente (o
  // `novaOrdem` aceita clienteId nulo) e OS de cliente que saiu do cadastro.
  // Somadas numa contagem só, a frase da tela mentiria em metade dos casos e
  // mandaria o dono caçar um cliente apagado que nunca existiu.
  let ordensSemCliente = 0
  let ordensClienteSumido = 0
  for (const os of ordens || []) {
    if (!ehReceitaNoPeriodo(os, intervalo)) continue
    const id = String(os.clienteId ?? '')
    const temId = !!id && id !== 'null' && id !== 'undefined'
    const canal = temId ? origemDe.get(id) : undefined
    if (!temId) ordensSemCliente++
    else if (!canal) ordensClienteSumido++
    const valor = cent(Number(totalOrdem ? totalOrdem(os) : 0) || 0)
    const l = linha(canal || SEM_ORIGEM)
    l.ordens++
    l.faturamento = cent(l.faturamento + valor)
    faturamentoTotal = cent(faturamentoTotal + valor)
    ordensTotal++
  }

  // ── Percentuais ───────────────────────────────────────────────────────────
  const linhas = [...porCanal.values()].map(l => ({
    ...l,
    pctNovos: novosTotal > 0 ? cent((l.novos / novosTotal) * 100) : 0,
    pctFaturamento: faturamentoTotal > 0 ? cent((l.faturamento / faturamentoTotal) * 100) : 0,
    // Quanto vale, em média, um cliente vindo deste canal. É este número que
    // se compara com o custo do anúncio.
    ticket: l.ordens > 0 ? cent(l.faturamento / l.ordens) : 0,
  }))

  // Maior faturamento primeiro — é a coluna que decide orçamento. "Não
  // informado" vai sempre para o fim: não é um canal, é uma lacuna, e no topo
  // da tabela pareceria a melhor fonte de clientes da oficina.
  linhas.sort((a, b) => {
    if (a.canal === SEM_ORIGEM) return 1
    if (b.canal === SEM_ORIGEM) return -1
    if (b.faturamento !== a.faturamento) return b.faturamento - a.faturamento
    return b.novos - a.novos
  })

  const semOrigem = porCanal.get(SEM_ORIGEM) || linhaVazia(SEM_ORIGEM)
  return {
    linhas,
    novosTotal,
    faturamentoTotal,
    ordensTotal,
    ordensSemCliente,
    ordensClienteSumido,
    // Quanto do período já tem a pergunta respondida. Enquanto for baixo, os
    // percentuais são opinião — e a tela precisa dizer isso.
    cobertura: novosTotal > 0 ? cent(((novosTotal - semOrigem.novos) / novosTotal) * 100) : 0,
    semOrigemNovos: semOrigem.novos,
  }
}

// Quantos cadastros do sistema inteiro já têm a pergunta respondida — o número
// que mede se vale a pena olhar o relatório ainda.
export function coberturaGeral(clientes) {
  const total = (clientes || []).length
  let comOrigem = 0
  for (const c of clientes || []) if (String(c?.origem || '').trim()) comOrigem++
  return { total, comOrigem, pct: total > 0 ? cent((comOrigem / total) * 100) : 0 }
}

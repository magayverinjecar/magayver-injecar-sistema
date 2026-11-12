// O "pedido de cotação": um texto pronto para colar no ChatGPT, com o carro,
// os serviços que o reparador marcou e as peças que ele pediu, e o pedido do
// que trazer — peças com marca, referência, preço, loja e link (Mercado Livre
// e outras lojas), e a mão de obra pelo TEMPO de cada serviço vezes a hora da
// oficina.
//
// Por que tempo × hora, e não "quanto cobrar": o ChatGPT não conhece a cidade
// nem o preço desta oficina; o tempo de um serviço ele estima bem, e o valor
// sai da hora que o dono cadastrou em Configurações (`config.valorHoraMaoObra`).
//
// Fica de fora o que identifica o cliente (nome, telefone, placa): o pedido
// vai para fora do sistema e não precisa disso para achar a peça.
// Funções puras — testáveis em Node.

import { nomeVeiculo } from './datas'
import { parseValorBR } from './numero'
import { recomendacoesDaAvaliacao } from './avaliacao'
import { pecasPorArea } from './pecasPorArea'

const reais = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "VW GOL 1.6 — ano 2014 — motor 1.6 — flex — 85.430 km", só com o que existe.
export function linhaDoCarro(os, veiculo) {
  const nome = nomeVeiculo(veiculo, os)
  const ano = String(veiculo?.ano || '').trim()
  const motor = String(veiculo?.motor || '').trim()
  const comb = String(os?.combustivel || veiculo?.combustivel || '').trim()
  const km = String(os?.kmEntrada || '').trim()
  return [
    nome && nome !== '—' ? nome : '',
    ano ? `ano ${ano}` : '',
    motor ? `motor ${motor}` : '',
    comb ? comb.toLowerCase() : '',
    km ? `${km} km` : '',
  ].filter(Boolean).join(' — ')
}

// Os serviços a cotar, na ordem de urgência: o serviço escolhido pelo
// reparador ("Trocar pastilhas…"), ou o item com o que ele viu, quando não
// escolheu serviço. O que pode esperar vai marcado.
export function servicosParaCotar(os) {
  return recomendacoesDaAvaliacao(os).map(r => r.texto + (r.urgencia === 'pode_esperar' ? ' (pode esperar)' : ''))
}

export function temOQueCotar(os) {
  return servicosParaCotar(os).length > 0 || pecasPorArea(os?.pecasNecessarias).length > 0
}

export function textoPedidoCotacao({ os, veiculo, valorHora }) {
  const carro = linhaDoCarro(os, veiculo)
  const servicos = servicosParaCotar(os)
  const grupos = pecasPorArea(os?.pecasNecessarias)
  const hora = parseValorBR(valorHora)
  const blocos = []

  blocos.push(`Preciso de uma cotação para este veículo:\n${carro || '(veículo não informado)'}`)

  if (servicos.length) {
    blocos.push(['SERVIÇOS A FAZER', ...servicos.map(s => `- ${s}`)].join('\n'))
  }

  if (grupos.length) {
    const semAreas = grupos.every(g => !g.area)
    const linhas = ['PEÇAS QUE O REPARADOR PEDIU']
    for (const g of grupos) {
      if (!semAreas) linhas.push(g.area ? g.nome.toUpperCase() : 'OUTRAS')
      for (const p of g.pecas) linhas.push(`- ${p.quantidade}x ${p.descricao}`)
    }
    blocos.push(linhas.join('\n'))
  }

  const pedidoPecas = [
    '1) PEÇAS: pesquise no Mercado Livre e também em outras lojas de autopeças online',
    '(quando não achar no Mercado Livre, ou para comparar preço).',
    'Para cada peça, traga 2 ou 3 opções numa tabela com: marca, referência (código da peça), preço, loja e link do anúncio.',
    'Confira se a peça serve para este motor e ano; se não tiver certeza, avise.',
  ]
  if (!grupos.length) pedidoPecas.push('O reparador não listou peças: sugira as peças necessárias para os serviços acima e cote cada uma.')
  else if (servicos.length) pedidoPecas.push('Se algum serviço acima precisar de peça que não está na lista, sugira e cote também.')

  const valorDaHora = hora > 0 ? reais(hora) : 'R$ ___'
  const pedidoMaoDeObra = servicos.length
    ? [
      '2) MÃO DE OBRA: para cada serviço, informe o tempo estimado em horas (tabela de tempos de oficina para este carro).',
      `Minha hora de mão de obra é ${valorDaHora}; calcule o valor de cada serviço com ela.`,
    ]
    : [
      '2) MÃO DE OBRA: diga o serviço para instalar as peças acima e o tempo estimado em horas (tabela de tempos de oficina para este carro).',
      `Minha hora de mão de obra é ${valorDaHora}; calcule o valor de cada serviço com ela.`,
    ]

  blocos.push([
    ...pedidoPecas,
    '',
    ...pedidoMaoDeObra,
    '',
    '3) No fim, um resumo: total das peças (pela opção mais barata que sirva) e total da mão de obra.',
  ].join('\n'))

  return blocos.join('\n\n')
}

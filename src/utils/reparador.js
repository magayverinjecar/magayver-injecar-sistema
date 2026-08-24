// Todo serviço tem dono.
//
// POR QUE ISTO EXISTE — leia antes de afrouxar.
//
// Na leitura de gestão de 23/08 apareceram 23 OS concluídas sem reparador
// nenhum, somando R$ 24 mil. Esse dinheiro não é de ninguém: não entra na
// produtividade de quem trabalhou, não diz qual serviço rende, e some da conta
// de quem faz o quê. O trabalho foi feito — só não foi registrado quem fez.
//
// Não foi má vontade: o campo existia e era OPCIONAL, e campo opcional em tela
// de oficina com carro esperando fica vazio. A correção não é cobrar mais
// atenção das pessoas, é o sistema não deixar passar.
//
// ONDE A REGRA MORDE, E POR QUÊ SÓ AÍ:
//
//   1. AO ADICIONAR SERVIÇO NA OS — bloqueia. É o momento em que a pessoa
//      escolheu o serviço e sabe quem vai fazer. Custo zero perguntar aqui.
//
//   2. AO CONCLUIR OU ENTREGAR — bloqueia. É exatamente aqui que o serviço
//      vira número: `gestao.js` e o DRE só contam OS em "Concluída" ou
//      "Entregue". Antes disso o dado ainda pode ser corrigido sem estrago.
//      Esta é a rede que pega as OS ANTIGAS e as que vieram de orçamento.
//
//   3. NO ORÇAMENTO — NÃO bloqueia, de propósito. O orçamento é montado antes
//      de o carro ser agendado; muitas vezes ninguém sabe quem vai pegar.
//      Obrigar ali faz a pessoa marcar qualquer um só para passar da tela, e
//      dado errado é pior que dado vazio: ele tem cara de certo e ninguém
//      volta para conferir.
//
//   4. NO KIT — não bloqueia. Kit é molde, não venda: o mesmo kit é aplicado
//      em OS diferentes, com pessoas diferentes.
//
// O orçamento vira OS com os itens sem dono, e é o item 2 que cobra. A regra
// não fica com buraco; ela só cobra no momento em que a resposta existe.
//
// Funções puras — sem React, testáveis em Node.

import { ehPeca } from './margem.js'

// Serviço é o que não é peça. Usa `ehPeca` de propósito, em vez de testar
// `tipo === 'servico'`: é o MESMO critério que a margem e o CMV usam para
// separar os dois. Se um item conta como serviço no dinheiro, tem de contar
// como serviço aqui — senão o sistema cobraria dono de uma coisa e pagaria
// como outra.
export function ehServico(item) {
  return !!item && !ehPeca(item)
}

// Os serviços desta OS que estão sem reparador.
export function servicosSemReparador(os) {
  return (os?.itens || []).filter(i => ehServico(i) && i.mecanicoId == null)
}

// Os status em que o serviço vira número. Vem de `gestao.js` e do DRE: os dois
// contam OS em "Concluída" ou "Entregue" e ignoram o resto. Mudou lá, muda aqui.
export const STATUS_QUE_CONTAM = ['Concluída', 'Entregue']

// A OS pode ir para este status? Devolve `null` quando pode, ou o motivo.
//
// Só morde na entrada para um status que conta. "Reparo concluído" manda a OS
// para conferência, que não conta — e por isso o reparador não é parado no meio
// do serviço, com o carro na bancada.
export function bloqueioDeConclusao(os, novoStatus) {
  if (!STATUS_QUE_CONTAM.includes(novoStatus)) return null
  const faltando = servicosSemReparador(os)
  if (faltando.length === 0) return null
  return { faltando, texto: textoDaPendencia(faltando, novoStatus) }
}

// A mensagem. Diz o QUE falta, em QUAIS serviços e ONDE resolver — uma que só
// dissesse "preencha o reparador" obrigaria a pessoa a caçar quais.
export function textoDaPendencia(faltando, novoStatus = 'Concluída') {
  const lista = faltando.slice(0, 8).map(i => '  • ' + (i.descricao || 'serviço sem nome')).join('\n')
  const resto = faltando.length > 8 ? `\n  ... e mais ${faltando.length - 8}` : ''
  const quantos = faltando.length === 1
    ? 'Há 1 serviço sem reparador nesta OS'
    : `Há ${faltando.length} serviços sem reparador nesta OS`
  return `${quantos}:\n\n${lista}${resto}\n\n`
    + `Sem isso o trabalho não entra na produtividade de ninguém e o faturamento `
    + `fica sem dono.\n\nAbra a aba Itens, clique no lápis de cada serviço e escolha `
    + `quem fez. Depois marque como "${novoStatus}".`
}

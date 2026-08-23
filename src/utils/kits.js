// KITS de itens — "Kit Polo TSI", "Revisão 10 mil".
//
// Vem muita cotação de revisão e sempre a mesma lista: filtro de ar, filtro de
// cabine, óleo, filtro de óleo com a referência certa e a mão de obra. Digitar
// isso item por item em toda OS custava tempo e dava erro de referência.
// O kit é um MOLDE: guarda QUAIS itens e QUANTOS, apontando para o cadastro.
//
// O kit NÃO congela preço. Se ele congelasse, reajustar uma peça obrigaria a
// editar kit por kit. O preço vem do cadastro no momento em que o kit é
// aplicado — por isso `montarItensDoKit` recebe `servicos` e `estoque`.
//
// Onde mora: `config.kitsItens` (mesmo lugar de maquinasCartao e capacidade).
// É lista pequena, editada raramente — não vale tabela nova.

import { parseValorBR } from './numero'

// Ids do cadastro às vezes chegam como número e às vezes como texto (o
// orçamento guarda refId como string). Comparar por String evita o "não achei
// a peça" que aparecia só em uma das telas.
export function produtoDoCadastro(estoque, produtoId) {
  if (produtoId === null || produtoId === undefined || produtoId === '') return null
  return (estoque || []).find(p => String(p.id) === String(produtoId)) || null
}

export function servicoDoCadastro(servicos, servicoId) {
  if (servicoId === null || servicoId === undefined || servicoId === '') return null
  return (servicos || []).find(s => String(s.id) === String(servicoId)) || null
}

export function kitsDoConfig(config) {
  return Array.isArray(config?.kitsItens) ? config.kitsItens : []
}

// A prateleira está vazia AGORA, para esta peça.
//
// É valor derivado de propósito: nada é gravado no item. Quando o dono
// registrar a entrada da peça em Compras, o alerta some sozinho — uma marca
// gravada no item ficaria vermelha para sempre.
//
// Serviço não tem estoque; quem chama filtra pelo tipo antes.
// Peça avulsa (sem vínculo com o cadastro) também não entra: não há o que
// conferir na prateleira.
export function pecaSemEstoque(estoque, produtoId) {
  const p = produtoDoCadastro(estoque, produtoId)
  if (!p) return false
  return (Number(p.estoque) || 0) <= 0
}

// Preço de HOJE de uma linha do kit, e o total do kit inteiro. Fica aqui para
// a tela de cadastro e o seletor mostrarem o mesmo número — dois cálculos
// paralelos acabariam divergindo.
export function precoDaLinha(linha, servicos, estoque) {
  const ref = linha.tipo === 'peca'
    ? produtoDoCadastro(estoque, linha.produtoId)
    : servicoDoCadastro(servicos, linha.servicoId)
  return ref ? parseValorBR(ref.preco) : 0
}

export function totalDoKit(kit, servicos, estoque) {
  return (kit?.itens || []).reduce(
    (soma, l) => soma + precoDaLinha(l, servicos, estoque) * (Number(l.quantidade) || 1), 0)
}

// Descrição que a OS grava para uma peça: nome + referência entre parênteses.
// É o mesmo texto que o painel de adicionar item monta — o kit não pode gerar
// uma descrição diferente da que sai quando o dono lança a peça na mão.
function descricaoPeca(p) {
  return `${p.nome}${p.codigo ? ` (${p.codigo})` : ''}`
}

// Transforma o molde em itens prontos para lançar, com o preço de HOJE.
//
// Devolve também `faltando`: as peças cujo estoque não cobre a quantidade
// pedida. Elas SÃO lançadas assim mesmo — orçamento é proposta, não venda, e o
// dono pode orçar peça que ainda vai comprar. O que ele não pode é mandar o
// orçamento sem perceber que falta peça.
export function montarItensDoKit(kit, { servicos = [], estoque = [], reservadoDe = () => 0 } = {}) {
  const itens = []
  const faltando = []

  for (const linha of kit?.itens || []) {
    const qtd = Number(linha.quantidade) || 1

    if (linha.tipo === 'peca') {
      const p = produtoDoCadastro(estoque, linha.produtoId)
      // Disponível = saldo físico − o que outras OS já reservaram (bloco 02).
      const saldo = p ? Number(p.estoque) || 0 : 0
      const reservadas = p ? reservadoDe(p.id) : 0
      const disponivel = saldo - reservadas

      if (!p) {
        // A peça saiu do cadastro depois que o kit foi montado. Entra pela
        // descrição guardada, sem vínculo e sem preço — melhor aparecer no
        // orçamento pedindo atenção do que sumir calada.
        faltando.push({ nome: linha.descricao || 'PEÇA REMOVIDA DO CADASTRO', pedido: qtd, disponivel: 0, semCadastro: true })
      } else if (disponivel < qtd) {
        faltando.push({ nome: p.nome, pedido: qtd, disponivel, saldo, reservadas })
      }

      itens.push({
        tipo: 'peca',
        produtoId: p ? p.id : null,
        servicoId: null,
        descricao: (p ? descricaoPeca(p) : linha.descricao || '').toUpperCase(),
        quantidade: qtd,
        valorUnitario: p ? p.preco : '0',
        desconto: '0',
        mecanicoId: null,
      })
    } else {
      const s = servicoDoCadastro(servicos, linha.servicoId)
      itens.push({
        tipo: 'servico',
        produtoId: null,
        servicoId: s ? s.id : null,
        descricao: (s ? s.nome : linha.descricao || '').toUpperCase(),
        quantidade: qtd,
        valorUnitario: s ? s.preco : '0',
        desconto: '0',
        // O kit não amarra reparador: quem executa muda de carro para carro.
        mecanicoId: null,
      })
    }
  }

  return { itens, faltando }
}

// Texto do aviso de peça em falta. Fica aqui para a OS e o Orçamento avisarem
// com as mesmas palavras.
export function avisoDeFalta(faltando) {
  const linhas = faltando.map(f => f.semCadastro
    ? `• ${f.nome} — não está mais no cadastro`
    : `• ${f.nome} — pedido ${f.pedido}, disponível ${f.disponivel}${f.reservadas > 0 ? ` (${f.saldo} em saldo, ${f.reservadas} reservadas em OS ainda não aprovadas)` : ''}`)
  const n = faltando.length
  return `${n} ${n === 1 ? 'peça deste kit está' : 'peças deste kit estão'} sem estoque disponível:\n\n${linhas.join('\n')}\n\n`
    + 'Elas serão lançadas do mesmo jeito (antes da aprovação a peça só fica reservada) e '
    + 'ficarão marcadas em vermelho na lista de itens.\n\nLançar o kit?'
}

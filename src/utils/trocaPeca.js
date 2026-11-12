// Trocar a peça avulsa por uma peça do cadastro.
//
// O orçamento às vezes é montado às pressas com peça AVULSA (só o nome e o
// preço). Depois o dono quer ligar aquela linha à peça certa do cadastro, para
// ela reservar e baixar do estoque. A troca acontece no mesmo lugar da lista.
//
// Regras (decididas com o dono, 12/11/2026):
//   - a quantidade e o desconto da linha continuam;
//   - o PREÇO que já estava no orçamento continua — é o que o cliente viu. Só
//     quando a linha estava sem preço entra o preço do cadastro;
//   - a descrição passa a ser a do cadastro ("NOME (CÓDIGO)"), igual à de
//     quem lança a peça pelo painel;
//   - o custo NÃO vem do avulso: quem grava (`trocarItemOrdem`) congela o
//     custo do cadastro, como em qualquer peça lançada.
// Funções puras, testáveis em Node.

import { parseValorBR } from './numero'
import { ehPecaDeEstoque } from './reserva'

// Só a peça avulsa tem o botão de trocar.
export function podeTrocarPorCadastro(item) {
  return !!item && item.tipo === 'peca' && !ehPecaDeEstoque(item)
}

// A linha nova, pronta para `trocarItemOrdem` (que dá o id e congela o custo).
export function itemDaTroca(avulsa, produto) {
  const temPreco = parseValorBR(avulsa?.valorUnitario) > 0
  const nome = String(produto?.nome || '').trim()
  const codigo = String(produto?.codigo || '').trim()
  return {
    tipo: 'peca',
    produtoId: produto.id,
    servicoId: null,
    descricao: `${nome}${codigo ? ` (${codigo})` : ''}`.toUpperCase(),
    quantidade: avulsa?.quantidade ?? 1,
    valorUnitario: temPreco ? avulsa.valorUnitario : String(produto?.preco ?? '0'),
    desconto: avulsa?.desconto ?? '0',
    mecanicoId: null,
  }
}

// O que digitar na busca quando a troca abre: a primeira palavra da peça
// avulsa ("PASTILHA DE FREIO" → "pastilha"). O nome inteiro raramente bate
// com o do cadastro; a primeira palavra quase sempre acha a família.
export function buscaInicialDaTroca(descricao) {
  return String(descricao || '').trim().split(/\s+/)[0]?.toLowerCase() || ''
}

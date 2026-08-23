// Os campos da peça, no padrão que um sistema de oficina precisa ter — e que a
// nota fiscal eletrônica exige.
//
// Até aqui a peça tinha 7 campos digitáveis. O que falta é justamente o que a
// NF-e traz de graça na importação do XML: código do fabricante, EAN, NCM,
// CEST, origem da mercadoria e a unidade em que a peça foi comprada. Sem esses
// campos a importação teria de jogar fora o que a nota traz, ou gravar em
// lugar nenhum.
//
// Tudo mora no jsonb da peça — nenhuma coluna nova no banco.

import { parseValorBR } from './numero'

// Molde de uma peça nova. Quem cadastra rápido preenche só a primeira seção.
export const PECA_VAZIA = {
  // identificação
  codigo: '',            // código interno / principal (o que a oficina usa)
  codigoFabricante: '',  // código original do fabricante (GM, VW, Bosch...)
  ean: '',               // código de barras
  nome: '',
  marca: '',
  categoria: '',
  aplicacao: '',         // que carros usam — texto livre até o bloco 06
  // estoque e preço
  estoque: '',
  minimo: '',
  precoCusto: '',
  preco: '',
  localizacao: '',       // prateleira/gaveta
  // compra
  unidade: 'UN',         // unidade de USO (como sai para a OS)
  unidadeCompra: '',     // unidade da nota, quando diferente (CX, BALDE...)
  fatorConversao: '',    // quantas unidades de uso vêm em 1 de compra
  fornecedorId: '',
  garantiaDias: '',
  // fiscal (NF-e)
  ncm: '',
  cest: '',
  origem: '0',           // 0 = nacional (o caso comum)
  // controle
  ativo: true,
}

// Unidades que aparecem em nota de autopeças. `sigla` é o que a NF-e usa.
export const UNIDADES = [
  { sigla: 'UN', nome: 'Unidade' },
  { sigla: 'PC', nome: 'Peça' },
  { sigla: 'JG', nome: 'Jogo' },
  { sigla: 'CJ', nome: 'Conjunto' },
  { sigla: 'LT', nome: 'Litro' },
  { sigla: 'ML', nome: 'Mililitro' },
  { sigla: 'KG', nome: 'Quilo' },
  { sigla: 'MT', nome: 'Metro' },
  { sigla: 'CX', nome: 'Caixa' },
  { sigla: 'PT', nome: 'Pacote' },
  { sigla: 'GL', nome: 'Galão' },
  { sigla: 'BD', nome: 'Balde' },
  { sigla: 'FR', nome: 'Frasco' },
  { sigla: 'TB', nome: 'Tubo' },
  { sigla: 'PR', nome: 'Par' },
]

// Origem da mercadoria (tabela A da NF-e). São 9 códigos; a oficina usa 0, 1 e
// 2 na prática — o resto entra pelo XML quando vier.
export const ORIGENS = [
  { codigo: '0', nome: 'Nacional' },
  { codigo: '1', nome: 'Importada — importação direta' },
  { codigo: '2', nome: 'Importada — adquirida no mercado interno' },
  { codigo: '3', nome: 'Nacional com mais de 40% de conteúdo importado' },
  { codigo: '4', nome: 'Nacional — processos produtivos básicos' },
  { codigo: '5', nome: 'Nacional com até 40% de conteúdo importado' },
  { codigo: '6', nome: 'Importada — sem similar nacional (lista CAMEX)' },
  { codigo: '7', nome: 'Importada no mercado interno — sem similar nacional' },
  { codigo: '8', nome: 'Nacional com mais de 70% de conteúdo importado' },
]

// Quantas unidades de USO vêm em uma unidade de COMPRA. 1 quando não há
// conversão — é o caso da maioria das peças.
export function fatorDaPeca(peca) {
  const f = parseValorBR(peca?.fatorConversao)
  return f > 0 ? f : 1
}

// Converte a quantidade que veio na nota para a unidade da prateleira.
// Nota diz "2 CX" e a peça tem fator 24 → entram 48 unidades no estoque.
export function quantidadeDeCompraParaUso(peca, quantidadeNota) {
  const q = parseValorBR(quantidadeNota)
  return q * fatorDaPeca(peca)
}

// Custo por unidade de USO a partir do custo da unidade de COMPRA.
// Caixa de 24 por R$ 240 → R$ 10 por unidade.
export function custoDeCompraParaUso(peca, custoNota) {
  const c = parseValorBR(custoNota)
  const f = fatorDaPeca(peca)
  return f > 0 ? c / f : c
}

// Só há conversão de verdade quando existe unidade de compra diferente e fator
// maior que 1. Serve para a tela mostrar o aviso na hora certa.
export function temConversao(peca) {
  return !!peca?.unidadeCompra
    && peca.unidadeCompra !== peca.unidade
    && fatorDaPeca(peca) > 1
}

// NCM tem 8 dígitos; CEST tem 7. Guardamos só os números, para a nota não
// receber ponto nem espaço.
export function soDigitos(valor, max) {
  const d = String(valor ?? '').replace(/\D/g, '')
  return max ? d.slice(0, max) : d
}

// Formato de exibição: NCM 8708.99.90 e CEST 01.234.56 — como aparecem na nota.
export function formatarNcm(valor) {
  const d = soDigitos(valor, 8)
  if (d.length <= 4) return d
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`
}
export function formatarCest(valor) {
  const d = soDigitos(valor, 7)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
}

// O que ainda falta preencher para esta peça sair numa nota fiscal. Serve para
// a tela avisar sem bloquear — o dono completa quando for emitir.
export function pendenciasFiscais(peca) {
  const faltam = []
  if (soDigitos(peca?.ncm).length !== 8) faltam.push('NCM')
  if (!peca?.unidade) faltam.push('unidade')
  if (peca?.origem == null || peca.origem === '') faltam.push('origem')
  return faltam
}

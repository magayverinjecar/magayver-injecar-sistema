// Leitura da NF-e do fornecedor.
//
// Entrada de peça digitada à mão é onde o estoque se perde: erra-se o código,
// erra-se a quantidade, e o boleto vira uma conta a pagar que ninguém lançou. O
// XML da nota tem tudo isso certo, assinado pelo emissor.
//
// O arquivo é dividido em duas partes de propósito:
//
//   `extrairNFe`     — do XML para dados soltos. Precisa do navegador
//                      (DOMParser) e não decide nada.
//   `interpretarNFe` — dos dados soltos para a compra do sistema. É onde estão
//                      as decisões (casar código, ratear frete, virar boleto), e
//                      é função pura: roda e é testada em Node.
//
// A separação existe porque o risco não está em ler XML — está em interpretar
// errado e criar peça duplicada ou boleto no valor errado.

import { pecaComCodigo, normalizar } from './pecas.js'
import { cent } from './numero.js'

// Dinheiro em portugues, tambem nas mensagens: "R$ 353.46" num aviso faz quem
// le parar para conferir se leu certo.
const reais = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const NS = 'http://www.portalfiscal.inf.br/nfe'

function texto(no, tag) {
  if (!no) return ''
  const achado = no.getElementsByTagNameNS
    ? no.getElementsByTagNameNS(NS, tag)[0] || no.getElementsByTagName(tag)[0]
    : no.getElementsByTagName(tag)[0]
  return achado ? (achado.textContent || '').trim() : ''
}

function num(v) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

// So os digitos do documento: o cadastro tem "22.763.502/0078-96" e a nota
// traz "22763502007896".
export function soDigitosDoc(v) {
  return String(v || '').replace(/\D/g, '')
}

// Matriz e filial dividem os oito primeiros digitos. A oficina compra da PMZ da
// Max Teixeira numa semana e da PMZ de outra rua na seguinte: e o mesmo
// fornecedor para quem paga, com CNPJ diferente na nota.
export function mesmaRaizCnpj(a, b) {
  const x = soDigitosDoc(a), y = soDigitosDoc(b)
  return x.length >= 8 && y.length >= 8 && x.slice(0, 8) === y.slice(0, 8)
}

// "2026-09-20" e "2026-08-21T13:04:58-04:00" → "20/09/2026"
export function dataDaNFe(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// ── XML → dados soltos ──────────────────────────────────────────────────────
export function extrairNFe(xmlTexto) {
  const doc = new DOMParser().parseFromString(xmlTexto, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Este arquivo não é um XML válido.')
  }

  const inf = doc.getElementsByTagName('infNFe')[0]
  if (!inf) {
    throw new Error('Não achei a nota dentro do arquivo. Verifique se é o XML da NF-e (o que começa com "nfeProc" ou "NFe"), e não o DANFE em PDF.')
  }

  const ide = inf.getElementsByTagName('ide')[0]
  const emit = inf.getElementsByTagName('emit')[0]
  const dest = inf.getElementsByTagName('dest')[0]
  const totalICMS = inf.getElementsByTagName('ICMSTot')[0]
  // `vNFTot` fica dentro de <total>, IRMAO de <IBSCBSTot> — nao dentro dele.
  // Procurar no lugar errado devolvia zero calado, e o aviso dos dois totais
  // simplesmente nao aparecia.
  const totalNota = inf.getElementsByTagName('total')[0]

  const itens = [...inf.getElementsByTagName('det')].map(det => {
    const prod = det.getElementsByTagName('prod')[0]
    const icms = det.getElementsByTagName('ICMS')[0]
    return {
      nItem: det.getAttribute('nItem') || '',
      codigo: texto(prod, 'cProd'),
      ean: texto(prod, 'cEAN'),
      nome: texto(prod, 'xProd'),
      ncm: texto(prod, 'NCM'),
      cest: texto(prod, 'CEST'),
      cfop: texto(prod, 'CFOP'),
      unidade: texto(prod, 'uCom'),
      quantidade: num(texto(prod, 'qCom')),
      valorUnitario: num(texto(prod, 'vUnCom')),
      valorTotal: num(texto(prod, 'vProd')),
      desconto: num(texto(prod, 'vDesc')),
      frete: num(texto(prod, 'vFrete')),
      seguro: num(texto(prod, 'vSeg')),
      outros: num(texto(prod, 'vOutro')),
      origem: texto(icms, 'orig'),
    }
  })

  // Duplicata = boleto. É o que a oficina vai efetivamente pagar, e o valor
  // dela pode ser diferente do total da nota (desconto de fatura, por exemplo).
  const duplicatas = [...inf.getElementsByTagName('dup')].map(d => ({
    numero: texto(d, 'nDup'),
    vencimento: texto(d, 'dVenc'),
    valor: num(texto(d, 'vDup')),
  }))

  return {
    chave: (inf.getAttribute('Id') || '').replace(/^NFe/, ''),
    numero: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    emissao: texto(ide, 'dhEmi') || texto(ide, 'dEmi'),
    natureza: texto(ide, 'natOp'),
    emitente: {
      cnpj: texto(emit, 'CNPJ'),
      nome: texto(emit, 'xNome'),
      fantasia: texto(emit, 'xFant'),
      uf: texto(emit, 'UF'),
    },
    destinatario: {
      cnpj: texto(dest, 'CNPJ') || texto(dest, 'CPF'),
      nome: texto(dest, 'xNome'),
    },
    totais: {
      produtos: num(texto(totalICMS, 'vProd')),
      frete: num(texto(totalICMS, 'vFrete')),
      seguro: num(texto(totalICMS, 'vSeg')),
      desconto: num(texto(totalICMS, 'vDesc')),
      outros: num(texto(totalICMS, 'vOutro')),
      ipi: num(texto(totalICMS, 'vIPI')),
      nota: num(texto(totalICMS, 'vNF')),
      // A reforma de 2026 acrescentou IBS/CBS, e com ela um segundo total. Nas
      // notas atuais a duplicata continua saindo pelo vNF; guardamos os dois
      // para a tela poder avisar quando divergirem.
      notaComIbsCbs: num(texto(totalNota, 'vNFTot')),
    },
    itens,
    duplicatas,
  }
}

// ── dados soltos → compra do sistema ────────────────────────────────────────

// Custo real de uma unidade: o que a nota cobra pelo item mais o que veio
// rateado em cima dele. Comprar por R$ 100 com R$ 30 de frete não é comprar por
// R$ 100 — e é esse número que vira margem errada lá na frente.
//
// O rateio é por VALOR, não por quantidade: numa nota com um sensor caro e cem
// parafusos, dividir o frete por peça jogaria quase tudo nos parafusos.
export function custoUnitarioReal(item, totais) {
  const qtd = item.quantidade || 0
  if (qtd <= 0) return 0

  const base = item.valorTotal || (item.valorUnitario * qtd)
  const acessorios = (item.frete || 0) + (item.seguro || 0) + (item.outros || 0) - (item.desconto || 0)

  // O que veio no total da nota e não estava em nenhum item: alguns emissores
  // lançam o frete só no total. Rateia proporcional ao valor do item.
  const somaProdutos = totais?.produtos || 0
  const soltoNaNota = (totais?.frete || 0) + (totais?.seguro || 0) + (totais?.outros || 0) - (totais?.desconto || 0)
  const parte = somaProdutos > 0 ? base / somaProdutos : 0
  const rateado = soltoNaNota * parte

  return cent((base + acessorios + rateado) / qtd)
}

// Casa o item da nota com o cadastro: primeiro pelo código do fornecedor
// (é o que o XML traz e o que vai se repetir na próxima nota), depois pelo EAN.
//
// O EAN vem em segundo porque o mesmo código de barras aparece em peças de
// fabricantes diferentes com códigos próprios; já o código, uma vez casado,
// casa sempre.
export function casarComEstoque(item, estoque) {
  const porCodigo = pecaComCodigo(estoque, item.codigo)
  if (porCodigo) return { peca: porCodigo, por: 'codigo' }

  const ean = normalizar(item.ean)
  if (ean && ean !== 'SEM GTIN') {
    const porEan = (estoque || []).find(p => normalizar(p.ean || p.codigoBarras) === ean)
    if (porEan) return { peca: porEan, por: 'ean' }
  }
  return { peca: null, por: null }
}

// Nome legível: os emissores enfiam código interno e sufixo no xProd
// ("(409 - ILZNAR8C9D) -VELA IGNICAO UNITARIA"). O que interessa para quem
// procura a peça na prateleira é o final.
export function nomeLimpo(xProd) {
  let s = String(xProd || '').trim()
  s = s.replace(/^\([^)]*\)\s*-?\s*/, '')   // tira "(409 - ILZNAR8C9D) -"
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s.toUpperCase()
}

// A nota inteira, já traduzida para o que o sistema entende.
//
// Não grava nada: devolve o que SERIA criado, para a tela mostrar antes de
// confirmar. Entrada de estoque que acontece sem alguém conferir é como o
// saldo vira ficção.
export function interpretarNFe(nfe, { estoque = [], fornecedores = [], compras = [] } = {}) {
  const jaImportada = (compras || []).find(c => c.chaveNFe && c.chaveNFe === nfe.chave)

  const cnpjNota = soDigitosDoc(nfe.emitente.cnpj)
  const exato = (fornecedores || []).find(f => soDigitosDoc(f.cnpj) && soDigitosDoc(f.cnpj) === cnpjNota) || null
  // Sem o exato, procura a mesma empresa em outra filial. Vincular e melhor do
  // que deixar solto: a compra fica no fornecedor certo para o historico, e a
  // tela diz que o CNPJ e de outra loja para ninguem achar que foi engano.
  const porRaiz = exato ? null : ((fornecedores || []).find(f => mesmaRaizCnpj(f.cnpj, cnpjNota)) || null)
  const fornecedor = exato || porRaiz

  const itens = nfe.itens.map(item => {
    const { peca, por } = casarComEstoque(item, estoque)
    const custo = custoUnitarioReal(item, nfe.totais)
    return {
      ...item,
      nomeLimpo: nomeLimpo(item.nome),
      custoUnitario: custo,
      // O custo com rateio pode ser maior que o preço de tabela da nota; a tela
      // mostra os dois para não parecer erro de digitação.
      temRateio: cent(custo) !== cent(item.valorUnitario),
      peca,
      casouPor: por,
      nova: !peca,
    }
  })

  // `vencimento` sai em ISO porque o campo da tela de compra e um <input
  // type="date">, que so aceita AAAA-MM-DD — em DD/MM/AAAA ele fica VAZIO, sem
  // reclamar, e o boleto perde a data. `vencimentoBR` e so para ler aqui.
  const parcelas = (nfe.duplicatas || []).map(d => ({
    numero: d.numero,
    vencimento: (String(d.vencimento || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
    vencimentoBR: dataDaNFe(d.vencimento),
    valor: d.valor,
  }))

  const somaParcelas = cent(parcelas.reduce((s, p) => s + p.valor, 0))
  const somaItens = cent(itens.reduce((s, i) => s + i.custoUnitario * i.quantidade, 0))

  const avisos = []
  if (jaImportada) {
    avisos.push({
      tipo: 'duplicada',
      texto: `Esta nota já foi importada na compra ${jaImportada.numero}. Importar de novo criaria a entrada em dobro no estoque.`,
    })
  }
  if (parcelas.length === 0) {
    avisos.push({
      tipo: 'sem_boleto',
      texto: 'A nota não traz duplicata (boleto). Nenhuma conta a pagar será criada — se houver boleto, lance à mão.',
    })
  } else if (somaParcelas !== cent(nfe.totais.nota)) {
    avisos.push({
      tipo: 'boleto_diverge',
      texto: `Os boletos somam ${reais(somaParcelas)} e a nota fecha em ${reais(nfe.totais.nota)}. Confira antes de confirmar.`,
    })
  }
  if (nfe.totais.notaComIbsCbs > 0 && cent(nfe.totais.notaComIbsCbs) !== cent(nfe.totais.nota)) {
    avisos.push({
      tipo: 'ibs_cbs',
      texto: `A nota tem dois totais: ${reais(nfe.totais.nota)} (o que o boleto cobra) e ${reais(nfe.totais.notaComIbsCbs)} com IBS/CBS. O sistema usa o do boleto.`,
    })
  }
  if (porRaiz) {
    avisos.push({
      tipo: 'filial',
      texto: `O CNPJ da nota (${cnpjNota}) e o do cadastro de "${porRaiz.nome}" (${soDigitosDoc(porRaiz.cnpj)}) sao da mesma empresa, mas de filiais diferentes. A compra foi ligada a esse cadastro — troque no campo Fornecedor se preferir separar as lojas.`,
    })
  }
  if (!fornecedor) {
    avisos.push({
      tipo: 'sem_fornecedor',
      texto: `"${nfe.emitente.nome}" nao esta no seu cadastro de fornecedores. A compra vai ficar com o nome da nota; cadastre depois para o historico de compras dele juntar.`,
    })
  }
  const semCodigo = itens.filter(i => !String(i.codigo || '').trim()).length
  if (semCodigo > 0) {
    avisos.push({
      tipo: 'sem_codigo',
      texto: `${semCodigo} item(ns) vieram sem código do fornecedor. Eles não têm como casar sozinhos com o cadastro nas próximas notas.`,
    })
  }

  return {
    chave: nfe.chave,
    numero: nfe.numero,
    serie: nfe.serie,
    emissao: dataDaNFe(nfe.emissao),
    natureza: nfe.natureza,
    emitente: nfe.emitente,
    fornecedor,
    fornecedorPorRaiz: !!porRaiz,
    itens,
    parcelas,
    totais: nfe.totais,
    somaItens,
    somaParcelas,
    novas: itens.filter(i => i.nova).length,
    casadas: itens.filter(i => !i.nova).length,
    jaImportada: jaImportada || null,
    avisos,
  }
}

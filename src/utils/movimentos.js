// Vocabulário e identidade dos movimentos de estoque (kardex).
//
// O id do MOVIMENTO é um uuid gerado aqui, no aparelho — e não o gerarId()
// de relógio usado no resto do app. Dois motivos:
// 1. dois aparelhos lançando no mesmo milissegundo não podem colidir
//    (o gerarId() colide, e movimento colidido é história apagada);
// 2. o id viaja com o movimento para o servidor: se a fila reenviar o
//    mesmo movimento, o banco reconhece o id e NÃO soma o saldo de novo.

export function novoIdMovimento() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* segue para o plano B */ }
  // Plano B (navegador muito antigo): uuid v4 montado de getRandomValues.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Id DETERMINÍSTICO: a mesma chave sempre dá o mesmo uuid.
//
// Serve para a ação que não pode contar duas vezes mesmo vinda de dois
// aparelhos: cancelar a mesma OS em dois tablets, receber a mesma compra em
// dois caixas. Cada um monta o movimento com a mesma chave (tipo + OS + item
// + ciclo), chega ao banco com o MESMO id, e o `on conflict do nothing` da
// função ignora o segundo. Hash cyrb128 (4 × 32 bits) — não é criptográfico,
// mas as chaves são curtas e estruturadas, colisão acidental é desprezível.
export function idMovimentoDeterministico(...partes) {
  const chave = partes.map(p => String(p ?? '')).join('')
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < chave.length; i++) {
    const k = chave.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  const hex = [h1, h2, h3, h4].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('')
  // Layout de uuid v4 (versão 4, variante 8) — o Postgres só exige o formato.
  const v = '4' + hex.slice(13, 16)
  const r = (8 + (parseInt(hex[16], 16) & 3)).toString(16) + hex.slice(17, 20)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${v}-${r}-${hex.slice(20, 32)}`
}

// Mensagem de erro de leitura do extrato. "Verifique a internet" é o caso
// comum; mas antes de o SQL da etapa 2 ser rodado a tabela não existe
// (PGRST205) — e aí o aviso precisa apontar para a causa certa.
export function mensagemErroExtrato(e) {
  if (e?.code === 'PGRST205') {
    return 'O extrato ainda não foi ligado no banco: falta rodar o SQL da etapa 2 (kardex).'
  }
  return 'Não deu para carregar. Verifique a internet.'
}

// Vocabulário fechado dos tipos de movimento. Entrada soma, saída subtrai —
// mas o sinal vive na QUANTIDADE do movimento, não aqui.
export const TIPOS_MOV = {
  saida_os:       'Saída para OS',
  estorno_os:     'Estorno de OS',
  saida_venda:    'Venda de balcão',
  estorno_venda:  'Estorno de venda',
  entrada_compra: 'Compra recebida',
  estorno_compra: 'Estorno de compra',
  ajuste:         'Ajuste manual',
  saldo_inicial:  'Saldo inicial',
  fusao:          'Peças juntadas',
}

export function rotuloDoTipo(tipo) {
  return TIPOS_MOV[tipo] || tipo || '—'
}

// Descreve a origem de um movimento para a tela ("OS OS-123", "Venda #3001"...)
export function rotuloDaOrigem(mov) {
  if (!mov?.origem_tipo) return ''
  const nome = { os: 'OS', venda: 'Venda', compra: 'Compra' }[mov.origem_tipo] || mov.origem_tipo
  return mov.origem_id ? `${nome} ${mov.origem_id}` : nome
}

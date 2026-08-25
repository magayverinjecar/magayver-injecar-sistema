// Comprime uma imagem para JPEG antes do upload.
// Reduz o lado maior para MAX px e aplica qualidade 0.7 — uma foto de celular
// de ~4 MB cai para ~200 KB, evitando estourar o payload das linhas do Supabase.
//
// POR QUE HÁ DOIS CAMINHOS DE DECODIFICAÇÃO — leia antes de simplificar.
//
// Em 24/08/2026 o reparador tentou mandar a foto do reparo e recebeu o nome do
// arquivo seguido de `{"isTrusted":false}`. O arquivo era `54691.HEIC`: o
// formato que o iPhone usa por padrão desde o iOS 11.
//
// O caminho antigo era FileReader → data URL → `new Image()`. Quando o
// navegador não sabe desenhar HEIC num `<img>`, ele dispara `onerror` com um
// EVENTO — não com um Erro. Por isso a mensagem saiu como `isTrusted`: era o
// evento de erro sendo mostrado no lugar de um motivo.
//
// E repare onde a falha acontecia: ANTES do upload. Não era rede, não era
// permissão — a foto nunca chegou a sair do aparelho.
//
// `createImageBitmap` decodifica o arquivo DIRETO, sem passar por base64. Ele
// entende formatos que o `<img>` recusa, e de quebra não infla a memória em
// 33% (que é o custo do base64) numa foto de 12 megapixels. Quando ele não dá
// conta, o caminho antigo ainda é tentado — nenhum aparelho que funcionava
// antes deixa de funcionar.

// O que os campos de foto aceitam — e por que NÃO é "image/*".
//
// Esta é a metade preventiva da correção do HEIC. Com `image/*`, o iOS entrega
// o arquivo ORIGINAL, que desde o iOS 11 é HEIC por padrão. Quando a lista de
// tipos aceitos não inclui HEIC, o próprio iPhone converte para JPEG antes de
// entregar — o problema deixa de existir em vez de ser tratado.
//
// Os três tipos cobrem tudo que aparece na prática: foto de câmera (jpeg),
// print de tela (png) e imagem baixada da web (webp). Não usar `image/*` é
// deliberado: é justamente ele que deixa o HEIC passar.
//
// A decodificação abaixo continua existindo como rede de segurança, para o
// aparelho que ignorar o accept e para quem já tem HEIC salvo na galeria.
export const ACEITA_IMAGEM = 'image/jpeg,image/png,image/webp'

// Nome de arquivo ou tipo que indica foto de iPhone.
function ehHeic(file) {
  const nome = String(file?.name || '').toLowerCase()
  const tipo = String(file?.type || '').toLowerCase()
  return /\.hei[cf]$/.test(nome) || tipo.includes('hei')
}

// Decodifica o arquivo em algo que o canvas saiba desenhar.
async function decodificar(file) {
  // 1. O caminho bom: direto do arquivo.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { fonte: bitmap, largura: bitmap.width, altura: bitmap.height, fechar: () => bitmap.close?.() }
    } catch {
      // Segue para o caminho antigo — não desiste aqui.
    }
  }

  // 2. O caminho de sempre: data URL + <img>.
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não consegui abrir o arquivo da imagem.'))
    reader.onload = ev => {
      const img = new Image()
      // O `onerror` do <img> entrega um Evento, não um Erro. Devolver o evento
      // cru foi o que produziu "isTrusted" na tela do reparador.
      img.onerror = () => reject(new Error(
        ehHeic(file)
          ? 'Esta foto está no formato HEIC, do iPhone, e este aparelho não conseguiu abrir. '
            + 'No iPhone: Ajustes → Câmera → Formatos → "Mais Compatível" faz as próximas saírem em JPEG.'
          : 'Não consegui ler esta imagem — o arquivo pode estar corrompido ou num formato que o aparelho não abre.',
      ))
      img.onload = () => resolve({ fonte: img, largura: img.width, altura: img.height, fechar: () => {} })
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}

export async function comprimirImagem(file, MAX = 1280, qualidade = 0.7) {
  const { fonte, largura, altura, fechar } = await decodificar(file)
  try {
    let w = largura, h = altura
    if (w > h) {
      if (w > MAX) { h = h * MAX / w; w = MAX }
    } else {
      if (h > MAX) { w = w * MAX / h; h = MAX }
    }
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(fonte, 0, 0, w, h)

    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', qualidade))
    if (!blob) throw new Error('Não consegui converter a imagem para JPEG.')
    return blob
  } finally {
    // Libera a memória do bitmap mesmo quando dá errado no meio.
    fechar()
  }
}

export default comprimirImagem

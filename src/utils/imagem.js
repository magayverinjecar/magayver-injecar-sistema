// Comprime uma imagem para JPEG antes do upload.
// Reduz o lado maior para MAX px e aplica qualidade 0.7 — uma foto de celular
// de ~4 MB cai para ~200 KB, evitando estourar o payload das linhas do Supabase.
export function comprimirImagem(file, MAX = 1280, qualidade = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = ev => {
      const img = new Image()
      img.src = ev.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > h) {
          if (w > MAX) { h = h * MAX / w; w = MAX }
        } else {
          if (h > MAX) { w = w * MAX / h; h = MAX }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (blob) resolve(blob)
          else reject(new Error('Erro na compressão'))
        }, 'image/jpeg', qualidade)
      }
      img.onerror = err => reject(err)
    }
    reader.onerror = err => reject(err)
  })
}

export default comprimirImagem

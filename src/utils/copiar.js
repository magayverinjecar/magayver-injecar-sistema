// Copia um texto para a área de transferência. No celular antigo ou fora do
// https a API nova pode faltar; aí vai pelo jeito antigo, com um campo
// escondido. Devolve true se copiou.
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const campo = document.createElement('textarea')
      campo.value = texto
      campo.setAttribute('readonly', '')
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      const ok = document.execCommand('copy')
      campo.remove()
      return ok
    } catch {
      return false
    }
  }
}

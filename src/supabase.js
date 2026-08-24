import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://squuvpbmetclbcqryalr.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdXV2cGJtZXRjbGJjcXJ5YWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTUyMjYsImV4cCI6MjA5NzM5MTIyNn0.CMrd8t_XA0_wWLxWhtYJA8HbpcDQwvpc5OodBw3srVo'

// Toda chamada ao Supabase ganha prazo.
//
// Sem isto, num wifi de oficina com portal cativo ou conexão meio-aberta, o
// fetch fica pendurado para sempre — nem sucesso, nem erro. E uma requisição
// pendurada dentro da drenagem da fila trava a trava `drenandoFila` em `true`
// pelo resto da sessão: o motor de retentativa desliga em silêncio e a tarja
// congela num número velho. 30s é folgado para uma gravação e ainda dá conta
// de uma foto de vistoria em conexão ruim.
const PRAZO_REQUISICAO = 30000

function fetchComPrazo(url, opcoes = {}) {
  // Respeita um signal que já tenha vindo de quem chamou, se houver.
  if (opcoes.signal) return fetch(url, opcoes)
  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), PRAZO_REQUISICAO)
  return fetch(url, { ...opcoes, signal: controle.signal })
    .finally(() => clearTimeout(prazo))
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchComPrazo },
})

// O número da OS começa com "#", que o Storage lê como início de fragmento de
// URL e corta o resto do caminho — o upload morria com erro de RLS. Qualquer
// caractere fora do conjunto seguro vira "-" antes de virar chave do arquivo.
function caminhoSeguro(caminho) {
  return String(caminho).replace(/[^A-Za-z0-9._/-]/g, '-')
}

// Faz upload de um Blob para o bucket 'fotos' e retorna URL pública
export async function uploadFoto(blob, caminho, contentType = 'image/jpeg') {
  const { data, error } = await supabase.storage
    .from('Fotos')
    .upload(caminhoSeguro(caminho), blob, { contentType, upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('Fotos').getPublicUrl(data.path)
  return urlData.publicUrl
}

// Por que o envio da foto falhou, em português e sem chutar.
//
// A mensagem antiga era "Verifique a conexão e tente de novo" para QUALQUER
// falha. Em 24/08 o upload parou por PERMISSÃO: o bucket liberava `anon` e não
// `authenticated`, e o login por pessoa fez todo mundo virar `authenticated`.
// A tela mandou conferir a internet — que estava ótima.
//
// Uma mensagem que chuta o motivo é pior que uma que assume não saber: manda a
// pessoa procurar no lugar errado. Por isso o texto cru do erro vai junto no
// fim — feio, mas é o que permite dizer o que houve sem adivinhar.
export function motivoDoErroDeFoto(err) {
  // Erro de fetch e erro do Storage tem formatos diferentes, e um objeto
  // solto viraria "[object Object]" — que nao diz nada a quem le nem a quem
  // for consertar. Serializa antes de desistir.
  let texto = typeof err === 'string' ? err
    : String(err?.message || err?.error || err?.statusCode || '')
  if (!texto) { try { texto = JSON.stringify(err) } catch { texto = '' } }
  if (['{}', '[object Object]', 'null', 'undefined'].includes(texto)) texto = ''

  if (/row-level security|Unauthorized|AccessDenied|not authorized|\b40[13]\b/i.test(texto)) {
    return 'O servidor recusou a foto por PERMISSÃO — não é a sua internet. '
      + 'Avise quem cuida do sistema: falta liberar o envio de foto para quem tem login.'
  }
  if (/abort|timeout|prazo/i.test(texto)) {
    return 'A foto demorou demais e o envio foi cancelado. '
      + 'Tente de novo perto do wi-fi.'
  }
  if (/failed to fetch|networkerror|load failed|offline/i.test(texto)) {
    return 'Não consegui falar com o servidor. Confira a internet e tente de novo.'
  }
  if (/compress|canvas|decode|imagem/i.test(texto)) {
    return 'Não consegui ler essa imagem. Tire a foto de novo ou escolha outra da galeria.'
  }
  if (/exceeded|too large|payload|size/i.test(texto)) {
    return 'A foto ficou grande demais para o servidor aceitar.'
  }
  return texto
    ? 'Erro ao enviar a foto: ' + texto
    : 'A foto não subiu e o servidor não disse por quê. Tente de novo; '
      + 'se repetir, avise quem cuida do sistema.'
}

// A rubrica do cliente vira arquivo no Storage. Guardá-la em base64 dentro da
// linha da OS inflava a tabela toda (~3 MB) e cada sincronização rebaixava
// todas as rubricas de novo. Quem chamar deve cair no base64 se isto falhar —
// a assinatura nunca pode se perder por causa de otimização.
export async function uploadAssinatura(dataUrl, chave) {
  const blob = await (await fetch(dataUrl)).blob()
  return uploadFoto(blob, `fotos/assinaturas/${chave}.png`, 'image/png')
}

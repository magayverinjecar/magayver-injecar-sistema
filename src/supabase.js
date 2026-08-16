import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://squuvpbmetclbcqryalr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdXV2cGJtZXRjbGJjcXJ5YWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTUyMjYsImV4cCI6MjA5NzM5MTIyNn0.CMrd8t_XA0_wWLxWhtYJA8HbpcDQwvpc5OodBw3srVo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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

// A rubrica do cliente vira arquivo no Storage. Guardá-la em base64 dentro da
// linha da OS inflava a tabela toda (~3 MB) e cada sincronização rebaixava
// todas as rubricas de novo. Quem chamar deve cair no base64 se isto falhar —
// a assinatura nunca pode se perder por causa de otimização.
export async function uploadAssinatura(dataUrl, chave) {
  const blob = await (await fetch(dataUrl)).blob()
  return uploadFoto(blob, `fotos/assinaturas/${chave}.png`, 'image/png')
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Eye, EyeOff, ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase'
import { useAuth } from '../context/AuthContext'

// Cada um escolhe a senha que quiser — decisao do dono da oficina.
//
// A unica exigencia que sobra e o minimo de 6 caracteres, que e do proprio
// Supabase e NAO pode ser removido. Conferir aqui serve so para a pessoa ver
// um aviso em portugues, em vez de o servidor recusar em ingles.
export function problemaNaSenha(s) {
  const v = String(s || '')
  if (v.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.'
  return ''
}

export default function MinhaSenha() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pronto, setPronto] = useState(false)

  async function salvar() {
    setErro('')
    if (!atual) return setErro('Digite sua senha atual.')

    const problema = problemaNaSenha(nova)
    if (problema) return setErro(problema)
    if (nova !== confirma) return setErro('A confirmação não bate com a nova senha.')
    if (nova.trim() === atual.trim()) return setErro('A senha nova precisa ser diferente da atual.')

    setSalvando(true)
    try {
      const { data: sessao } = await supabase.auth.getUser()
      const email = sessao?.user?.email
      if (!email) {
        setErro('Sua sessão expirou. Entre de novo e tente outra vez.')
        return
      }

      // Confere a senha ATUAL antes de trocar. O Supabase nao exige isso — a
      // sessao ja prova quem e —, mas aqui os aparelhos passam de mao em mao e
      // gente esquece de sair. Sem esta conferencia, quem pegasse o tablet
      // aberto trocaria a senha do colega e o trancaria para fora.
      //
      // A conferencia usa um cliente SEPARADO, que nao guarda sessao. Fazer o
      // login de verificacao no cliente principal mexia na sessao que ja estava
      // aberta — o Supabase emite "saiu" antes de "entrou", o app entendia como
      // logout e derrubava a pessoa no meio da troca.
      const conferidor = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const conferencia = await conferidor.auth.signInWithPassword({ email, password: atual.trim() })
      await conferidor.auth.signOut({ scope: 'local' }).catch(() => {})
      if (conferencia.error) {
        setErro('Sua senha atual está incorreta.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password: nova.trim() })
      if (error) {
        console.error('[minha-senha] falha ao trocar:', error)
        const m = String(error.message || '').toLowerCase()
        // Mensagem generica esconde o motivo e faz a pessoa tentar de novo do
        // mesmo jeito. Melhor dizer o que o servidor respondeu.
        if (m.includes('pwned') || m.includes('leaked') || m.includes('compromised')
            || m.includes('weak') || m.includes('easy to guess')) {
          // O servidor confere a senha contra listas publicas de vazamento.
          // A mensagem original vem em ingles, e nove pessoas vao esbarrar
          // nela — precisa dizer o que fazer, nao so que deu errado.
          setErro('Essa senha é fácil de adivinhar: ela aparece em listas de senhas vazadas. Escolha outra — evite datas, nomes, placas e sequências.')
        } else if (m.includes('should be at least') || m.includes('password')) {
          setErro(`O servidor recusou a senha: ${error.message}`)
        } else if (m.includes('session') || m.includes('jwt') || m.includes('expired')) {
          setErro('Sua sessão expirou. Entre de novo e tente outra vez.')
        } else {
          setErro(`Não consegui trocar a senha: ${error.message}`)
        }
        return
      }
      setPronto(true)
    } catch (e) {
      console.error('[minha-senha] erro inesperado:', e)
      setErro('Não consegui falar com o servidor. Verifique a internet e tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  if (pronto) return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
          <Check size={24} />
        </div>
        <p className="font-semibold text-slate-800">Senha alterada</p>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Use a senha nova na próxima vez que entrar. Ninguém além de você a conhece —
          nem o administrador. Se esquecer, ele consegue definir uma nova para você.
        </p>
        <button onClick={() => navigate('/')} className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Voltar ao sistema
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto mt-6 space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={15} /> Voltar
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Minha senha</h2>
            <p className="text-xs text-slate-400">{currentUser?.nome}</p>
          </div>
        </div>

        <p className="text-sm text-slate-500 mt-4 mb-5">
          Troque para uma senha que só você saiba. Escolha a que preferir —
          o mínimo é 6 caracteres.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha atual</label>
            <input type={mostrar ? 'text' : 'password'} value={atual} onChange={e => setAtual(e.target.value)}
              autoComplete="current-password" className={campo} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
            <div className="relative">
              <input type={mostrar ? 'text' : 'password'} value={nova} onChange={e => setNova(e.target.value)}
                autoComplete="new-password" className={campo + ' pr-9'} />
              <button type="button" onClick={() => setMostrar(m => !m)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Repita a nova senha</label>
            <input type={mostrar ? 'text' : 'password'} value={confirma} onChange={e => setConfirma(e.target.value)}
              autoComplete="new-password" className={campo}
              onKeyDown={e => { if (e.key === 'Enter' && !salvando) salvar() }} />
          </div>
        </div>

        {erro && (
          <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={14} /> {erro}
          </p>
        )}

        <button onClick={salvar} disabled={salvando}
          className="w-full mt-5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
          {salvando ? 'Trocando…' : 'Trocar senha'}
        </button>
      </div>
    </div>
  )
}

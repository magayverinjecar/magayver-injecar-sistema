import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Eye, EyeOff, LogIn, Sun, Moon, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const PERFIL_COR = {
  admin: 'bg-orange-100 text-orange-600',
  reparador: 'bg-blue-100 text-blue-600',
  recepcao: 'bg-green-100 text-green-600',
  personalizado: 'bg-purple-100 text-purple-600',
}
const PERFIL_LABEL = { admin: 'Administrador', reparador: 'Reparador', recepcao: 'Recepção', personalizado: 'Personalizado' }

export default function PinLogin() {
  const { login } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const [selecionado, setSelecionado] = useState(null)
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState('')
  const [tentativas, setTentativas] = useState(0)
  const [entrando, setEntrando] = useState(false)
  const [pessoas, setPessoas] = useState(null)   // null = ainda carregando
  const [erroLista, setErroLista] = useState('')
  const [listaAberta, setListaAberta] = useState(false)
  const inputRef = useRef(null)
  const caixaRef = useRef(null)

  // A lista de nomes vem de uma janelinha do banco que devolve SO numero, nome,
  // perfil e e-mail — nunca o PIN. Antes esta tela lia a tabela inteira de
  // funcionarios, com os PINs em texto puro, para quem nem tinha entrado.
  useEffect(() => {
    let vivo = true
    supabase.rpc('funcionarios_para_login').then(({ data, error }) => {
      if (!vivo) return
      if (error) {
        console.error('[login] nao consegui carregar a lista de usuarios:', error)
        setErroLista('Não consegui carregar a lista de usuários.')
        setPessoas([])
        return
      }
      setPessoas(data || [])
    })
    return () => { vivo = false }
  }, [])

  // A janelinha ja devolve so quem esta ativo e tem e-mail de acesso.
  const funcionariosComSenha = pessoas || []
  const carregando = pessoas === null

  useEffect(() => {
    if (selecionado) setTimeout(() => inputRef.current?.focus(), 100)
  }, [selecionado])

  function selecionarFuncionario(f) {
    setSelecionado(f)
    setSenha('')
    setErro('')
    setMostrar(false)
    setListaAberta(false)
  }

  // Clicar fora fecha a lista. Sem isto ela fica aberta por cima do campo de
  // senha, e a pessoa acha que a tela travou.
  useEffect(() => {
    if (!listaAberta) return
    function fora(e) {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setListaAberta(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [listaAberta])

  // Quem confere a senha agora e o SERVIDOR.
  //
  // Antes a comparacao era `senha === selecionado.pin`, dentro do navegador,
  // contra um PIN em texto puro que a propria tela tinha baixado. Isso nunca foi
  // autenticacao: qualquer pessoa com o endereco do site lia o PIN de todo
  // mundo. E, para o banco, todo aparelho da oficina continuava sendo um
  // visitante anonimo — por isso nao havia como trancar nada.
  async function entrar() {
    if (!senha) return setErro('Digite sua senha.')
    if (!selecionado?.email) return setErro('Este usuário não tem e-mail de acesso cadastrado. Avise o responsável pelo sistema.')

    setEntrando(true)
    setErro('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: selecionado.email,
        // Espaco no fim e a fonte classica de "senha incorreta" no teclado do
        // tablet, que ainda insiste em completar palavra.
        password: senha.trim(),
      })

      if (error) {
        const msg = String(error.message || '').toLowerCase()
        if (msg.includes('email not confirmed')) {
          setErro('Esta conta ainda não foi liberada. Avise o responsável pelo sistema.')
        } else if (msg.includes('invalid login')) {
          const novas = tentativas + 1
          setTentativas(novas)
          setSenha('')
          setErro(novas >= 3
            ? `Senha incorreta. ${novas} tentativa(s) — verifique com o administrador.`
            : 'Senha incorreta. Tente novamente.')
        } else {
          console.error('[login] falha ao entrar:', error)
          setErro('Não consegui falar com o servidor. Verifique a internet e tente de novo.')
        }
        return
      }

      // A sessao existe; agora busca o cadastro completo (permissoes, nome
      // financeiro). Sem cadastro, NAO entra: conta solta no servidor, sem
      // funcionario correspondente, entraria assumindo permissoes padrao.
      const { data: linha, error: erroCadastro } = await supabase
        .from('funcionarios').select('id, data').eq('id', selecionado.id).maybeSingle()

      if (erroCadastro || !linha?.data) {
        console.error('[login] entrou mas nao achei o cadastro do funcionario', erroCadastro)
        await supabase.auth.signOut({ scope: 'local' })
        setErro('Sua conta entrou, mas não encontrei seu cadastro de funcionário. Avise o responsável pelo sistema.')
        return
      }

      login({ id: linha.id, ...linha.data })
      navigate('/', { replace: true })
    } catch (e) {
      console.error('[login] erro inesperado:', e)
      setErro('Não consegui falar com o servidor. Verifique a internet e tente de novo.')
    } finally {
      setEntrando(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !entrando) entrar()
  }

  // Classes que mudam com o tema
  const bg       = dark ? 'bg-slate-900'  : 'bg-slate-100'
  const card     = dark ? 'bg-slate-800 border-slate-700'  : 'bg-white border-slate-200'
  const txtMain  = dark ? 'text-white'    : 'text-slate-800'
  const txtSub   = dark ? 'text-slate-400': 'text-slate-500'
  const inputCls = dark
    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-primary-500'
    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-primary-500'
  const toggleBtn = dark
    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
  const voltarBtn = dark
    ? 'text-slate-400 hover:text-white'
    : 'text-slate-400 hover:text-slate-700'

  return (
    <div className={`min-h-screen ${bg} flex flex-col items-center justify-center p-4 relative transition-colors duration-300`}>

      {/* Toggle tema */}
      <button onClick={toggle} title={dark ? 'Modo claro' : 'Modo escuro'}
        className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${toggleBtn}`}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center shadow-lg">
          <Wrench size={22} className="text-white" />
        </div>
        <div>
          <p className={`text-xl font-bold leading-tight ${txtMain}`}>Magayver</p>
          <p className="text-primary-500 text-sm font-semibold leading-tight">Injecar</p>
        </div>
      </div>

      {/* Uma tela só: escolhe o nome na lista, desce para a senha, entra.
          Antes eram dois passos — uma grade com um quadrado por pessoa e,
          depois de clicar, outra tela só para a senha. A grade crescia junto
          com a equipe (já são nove) e o segundo passo não fazia nada além de
          existir. Lista suspensa é o que um sistema faz. */}
      <div className="w-full max-w-sm">
        <div className={`rounded-3xl p-8 shadow-xl border ${card}`}>

          {carregando ? (
            /* Enquanto os funcionários não chegam, nenhuma porta é oferecida. */
            <div className="text-center text-sm space-y-4 py-4">
              <div className="w-8 h-8 mx-auto border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
              <p className={txtSub}>Carregando usuários...</p>
            </div>
          ) : erroLista ? (
            /* Lista vazia SEM leitura confirmada nao e "oficina nova": e leitura
               que falhou. O servidor devolve lista vazia — sem erro — quando uma
               politica do banco esconde a tabela, e era exatamente nesse caso
               que a tela oferecia entrar como administrador SEM SENHA, para
               qualquer um que abrisse o site. Sem confirmacao de leitura, a
               porta fica fechada. */
            <div className="text-center text-sm space-y-4 py-2">
              <p className={txtSub}>{erroLista}</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-medium text-sm transition-colors"
              >
                Tentar de novo
              </button>
              <p className={`text-xs ${txtSub}`}>Verifique a internet. Se continuar, avise o responsável pelo sistema.</p>
            </div>
          ) : funcionariosComSenha.length === 0 ? (
            /* NAO existe mais acesso de administrador sem senha aqui.
               Ele servia para a primeira instalacao, quando ainda nao ha
               ninguem cadastrado — e entregava o sistema INTEIRO, com
               financeiro e cadastro de funcionarios, para quem clicasse.
               O gatilho era "lista de funcionarios vazia", e lista vazia
               e exatamente o que o banco devolve quando uma politica
               esconde a tabela: sem erro, com sucesso. */
            <div className="text-center text-sm space-y-4 py-2">
              <p className={txtSub}>Nenhum funcionário com senha configurada.</p>
              <p className={`text-xs ${txtSub}`}>
                Cadastre um funcionário com senha pelo painel do Supabase para poder entrar.
              </p>
              <button
                onClick={() => window.location.reload()}
                className={`w-full border py-3 rounded-xl font-medium text-sm transition-colors ${voltarBtn} border-slate-300`}
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <div className="space-y-4">

              <div className="relative" ref={caixaRef}>
                <label className={`block text-sm mb-2 ${txtSub}`}>Quem está entrando</label>
                <button type="button" onClick={() => setListaAberta(v => !v)}
                  className={`w-full flex items-center gap-3 border rounded-xl px-3 py-2.5 text-sm text-left transition-all ${inputCls} ${listaAberta ? 'ring-2 ring-primary-500' : ''}`}>
                  {selecionado ? (
                    <>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${PERFIL_COR[selecionado.perfil] || 'bg-slate-200 text-slate-600'}`}>
                        {selecionado.nome[0].toUpperCase()}
                      </div>
                      <span className="flex-1 min-w-0">
                        <span className={`block truncate font-medium ${txtMain}`}>{selecionado.nome}</span>
                        <span className={`block text-xs ${txtSub}`}>{PERFIL_LABEL[selecionado.perfil] || selecionado.perfil}</span>
                      </span>
                    </>
                  ) : (
                    <span className={`flex-1 ${txtSub}`}>Escolha seu nome</span>
                  )}
                  <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${listaAberta ? 'rotate-180' : ''} ${txtSub}`} />
                </button>

                {listaAberta && (
                  /* Rola a partir de umas seis pessoas: a lista não pode empurrar
                     o botão de entrar para fora da tela do celular. */
                  <div className={`absolute z-20 w-full mt-1 rounded-xl border shadow-xl overflow-hidden max-h-64 overflow-y-auto ${card}`}>
                    {funcionariosComSenha.map(f => {
                      const ehEste = selecionado?.id === f.id
                      return (
                        <button key={f.id} type="button" onClick={() => selecionarFuncionario(f)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-0 ${dark ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-100 hover:bg-slate-50'} ${ehEste ? (dark ? 'bg-slate-700' : 'bg-primary-50') : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${PERFIL_COR[f.perfil] || 'bg-slate-200 text-slate-600'}`}>
                            {f.nome[0].toUpperCase()}
                          </div>
                          <span className="flex-1 min-w-0">
                            <span className={`block truncate text-sm font-medium ${txtMain}`}>{f.nome}</span>
                            <span className={`block text-xs ${txtSub}`}>{PERFIL_LABEL[f.perfil] || f.perfil}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm mb-2 ${txtSub}`}>Senha</label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={mostrar ? 'text' : 'password'}
                    value={senha}
                    onChange={e => { setSenha(e.target.value); setErro('') }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setListaAberta(false)}
                    placeholder={selecionado ? 'Digite sua senha' : 'Escolha o nome primeiro'}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 pr-11 transition-all ${inputCls} ${erro ? 'border-red-500' : ''}`}
                  />
                  <button type="button" onClick={() => setMostrar(v => !v)}
                    className={`absolute right-3 top-3 transition-colors ${txtSub}`}>
                    {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {erro && <p className="text-red-500 text-xs mt-2">{erro}</p>}
              </div>

              {/* Trava no primeiro toque: o login vai ao servidor e pode
                  demorar. Sem isto, a tela fica parada e calada e a pessoa
                  aperta mais quatro vezes achando que travou. */}
              <button onClick={entrar} disabled={entrando || !selecionado}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <LogIn size={16} /> {entrando ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

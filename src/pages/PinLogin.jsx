import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Eye, EyeOff, ArrowLeft, LogIn, Sun, Moon } from 'lucide-react'
import { useApp } from '../context/AppContext'
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
  const { funcionarios } = useApp()
  const { login } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const [selecionado, setSelecionado] = useState(null)
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState('')
  const [tentativas, setTentativas] = useState(0)
  const inputRef = useRef(null)

  const funcionariosComSenha = funcionarios.filter(f => f.pin && f.perfil)

  useEffect(() => {
    if (selecionado) setTimeout(() => inputRef.current?.focus(), 100)
  }, [selecionado])

  function selecionarFuncionario(f) {
    setSelecionado(f)
    setSenha('')
    setErro('')
    setMostrar(false)
  }

  function voltar() {
    setSelecionado(null)
    setSenha('')
    setErro('')
  }

  function entrar() {
    if (!senha) return setErro('Digite sua senha.')
    if (senha === selecionado.pin) {
      login(selecionado)
      navigate('/dashboard', { replace: true })
    } else {
      const novas = tentativas + 1
      setTentativas(novas)
      setSenha('')
      setErro(novas >= 3
        ? `Senha incorreta. ${novas} tentativa(s) — verifique com o administrador.`
        : 'Senha incorreta. Tente novamente.')
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') entrar()
  }

  // Classes que mudam com o tema
  const bg       = dark ? 'bg-slate-900'  : 'bg-slate-100'
  const card     = dark ? 'bg-slate-800 border-slate-700'  : 'bg-white border-slate-200'
  const cardUser = dark ? 'bg-slate-800 border-slate-700 hover:border-primary-500' : 'bg-white border-slate-200 hover:border-primary-400'
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

  const adminPermissoes = {
    menus: ['patio','dashboard','agenda','assistente-financeiro','ordens-servico','orcamentos','clientes','veiculos','servicos','funcionarios','produtividade','estoque','compras','insumos','fornecedores','financeiro','caixa','gastos','configuracoes'],
    verPrecos: true, verFinanceiro: true, editarConfigs: true, gerenciarFuncionarios: true,
  }

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

      {!selecionado ? (
        /* ── Seleção de usuário ── */
        <div className="w-full max-w-md">
          <p className={`text-center text-sm mb-6 ${txtSub}`}>Quem está usando o sistema?</p>

          {funcionariosComSenha.length === 0 ? (
            <div className={`text-center text-sm rounded-2xl p-8 space-y-4 border ${card}`}>
              <p className={txtSub}>Nenhum funcionário com senha configurada.</p>
              <button
                onClick={() => { login({ id: 0, nome: 'Administrador', perfil: 'admin', pin: '', permissoes: adminPermissoes }); navigate('/dashboard', { replace: true }) }}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-medium text-sm transition-colors"
              >
                Primeiro Acesso — Entrar como Admin
              </button>
              <p className={`text-xs ${txtSub}`}>Configure os funcionários em Funcionários.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {funcionariosComSenha.map(f => (
                <button key={f.id} onClick={() => selecionarFuncionario(f)}
                  className={`border rounded-2xl p-5 text-left transition-all ${cardUser}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-3 ${PERFIL_COR[f.perfil] || 'bg-slate-200 text-slate-600'}`}>
                    {f.nome[0].toUpperCase()}
                  </div>
                  <p className={`font-semibold text-sm leading-tight ${txtMain}`}>{f.nome.split(' ')[0]}</p>
                  <p className={`text-xs mt-0.5 ${txtSub}`}>{PERFIL_LABEL[f.perfil] || f.perfil}</p>
                </button>
              ))}
            </div>
          )}
        </div>

      ) : (
        /* ── Tela de senha ── */
        <div className="w-full max-w-sm">
          <div className={`rounded-3xl p-8 shadow-xl border ${card}`}>

            <div className="flex flex-col items-center mb-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 ${PERFIL_COR[selecionado.perfil] || 'bg-slate-200 text-slate-600'}`}>
                {selecionado.nome[0].toUpperCase()}
              </div>
              <p className={`text-lg font-semibold ${txtMain}`}>{selecionado.nome.split(' ')[0]}</p>
              <p className={`text-sm ${txtSub}`}>{PERFIL_LABEL[selecionado.perfil] || selecionado.perfil}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-2 ${txtSub}`}>Senha</label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={mostrar ? 'text' : 'password'}
                    value={senha}
                    onChange={e => { setSenha(e.target.value); setErro('') }}
                    onKeyDown={onKeyDown}
                    placeholder="Digite sua senha"
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 pr-11 transition-all ${inputCls} ${erro ? 'border-red-500' : ''}`}
                  />
                  <button type="button" onClick={() => setMostrar(v => !v)}
                    className={`absolute right-3 top-3 transition-colors ${txtSub}`}>
                    {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {erro && <p className="text-red-500 text-xs mt-2">{erro}</p>}
              </div>

              <button onClick={entrar}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <LogIn size={16} /> Entrar
              </button>
            </div>

            <button onClick={voltar}
              className={`mt-6 flex items-center justify-center gap-1.5 text-sm w-full transition-colors ${voltarBtn}`}>
              <ArrowLeft size={14} /> Trocar usuário
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

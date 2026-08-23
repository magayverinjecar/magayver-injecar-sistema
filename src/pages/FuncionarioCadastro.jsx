import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, Users, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import gerarId from '../utils/id'
import { GRUPOS_MENU, PERMISSOES_ESPECIAIS, FUNCIONARIO_VAZIO, PERMISSOES_VAZIAS } from '../utils/permissoes'

// Cadastro de funcionario em tela inteira, nao em popup.
//
// Era o maior popup do sistema: sete campos mais a grade inteira de permissoes
// (uma chave por tela do sistema, mais as especiais). Tudo isso rolava dentro
// de uma caixa com `max-h-[75vh]`, com a lista da equipe inutil atras. Decidir
// o que uma pessoa enxerga do sistema e trabalho de conferencia, nao de
// espiadela: pede a tela toda, as permissoes lado a lado, e endereco proprio
// para poder voltar depois.
//
// A mesma tela serve para cadastrar e para editar.
export default function FuncionarioCadastro() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { funcionarios, setFuncionarios } = useApp()
  const { refreshPermissoes } = useAuth()

  const editando = id != null
  const original = editando ? funcionarios.find(x => String(x.id) === String(id)) : null

  const [form, setForm] = useState({ ...FUNCIONARIO_VAZIO })
  const [permissoes, setPermissoes] = useState({ ...PERMISSOES_VAZIAS })
  const [mostrarPin, setMostrarPin] = useState(false)
  const [erro, setErro] = useState('')
  const salvouRef = useRef(false)

  // A equipe chega do banco depois da primeira pintura: sem isto, abrir a
  // edicao por link direto (ou dar F5 aqui) mostraria ficha em branco, e salvar
  // apagaria o cadastro da pessoa junto com as permissoes dela.
  //
  // Ajuste de estado durante a pintura, e nao em efeito: e o padrao do React
  // para estado derivado, e evita a tela piscar vazia antes de corrigir.
  const [carregadoDe, setCarregadoDe] = useState(null)
  if (original && carregadoDe !== original.id) {
    setCarregadoDe(original.id)
    setForm({
      nome: original.nome || '',
      nomeFinanceiro: original.nomeFinanceiro || '',
      cargo: original.cargo || '',
      telefone: original.telefone || '',
      email: original.email || '',
      // Funcionario antigo, cadastrado antes deste campo, e ativo.
      ativo: original.ativo !== false,
      especialidade: original.especialidade || '',
      pin: original.pin || '',
      perfil: original.perfil || 'personalizado',
    })
    setPermissoes(original.permissoes || { ...PERMISSOES_VAZIAS })
  }

  const referencia = editando
    ? (original ? JSON.stringify([{
        nome: original.nome || '', nomeFinanceiro: original.nomeFinanceiro || '',
        cargo: original.cargo || '', telefone: original.telefone || '',
        email: original.email || '', ativo: original.ativo !== false,
        especialidade: original.especialidade || '', pin: original.pin || '',
        perfil: original.perfil || 'personalizado',
      }, original.permissoes || { ...PERMISSOES_VAZIAS }]) : null)
    : JSON.stringify([{ ...FUNCIONARIO_VAZIO }, { ...PERMISSOES_VAZIAS }])
  const sujo = referencia != null && JSON.stringify([form, permissoes]) !== referencia

  useEffect(() => {
    if (!sujo) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])

  function voltar() {
    if (sujo && !salvouRef.current && !confirm('Sair sem salvar? O que foi preenchido se perde.')) return
    navigate('/funcionarios')
  }

  // Mexer numa chave na mao tira a pessoa do modelo pronto: ela deixou de ser
  // "Recepcao" no instante em que ganhou uma tela que a recepcao nao tem.
  function toggleMenu(idMenu) {
    setPermissoes(p => ({
      ...p,
      menus: p.menus.includes(idMenu) ? p.menus.filter(m => m !== idMenu) : [...p.menus, idMenu],
    }))
    setForm(f => ({ ...f, perfil: 'personalizado' }))
  }

  function toggleEspecial(idEsp) {
    setPermissoes(p => ({ ...p, [idEsp]: !p[idEsp] }))
    setForm(f => ({ ...f, perfil: 'personalizado' }))
  }

  function salvar() {
    if (!form.nome.trim()) { setErro('O nome e obrigatorio.'); return }
    if (form.pin && form.pin.length < 4) { setErro('A senha deve ter no minimo 4 caracteres.'); return }
    const dados = { ...form, permissoes }
    if (editando) {
      setFuncionarios(prev => prev.map(x => String(x.id) === String(id) ? { ...x, ...dados } : x))
      // Atualiza a sessao na hora se a pessoa editada for quem esta logada.
      refreshPermissoes({ id: original?.id ?? id, ...dados })
    } else {
      setFuncionarios(prev => [...prev, { ...dados, id: gerarId() }])
    }
    salvouRef.current = true
    navigate('/funcionarios')
  }

  const totalTelas = permissoes.menus?.length || 0

  if (editando && !original && funcionarios.length > 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <Users size={30} className="text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Funcionario nao encontrado.</p>
        <button onClick={() => navigate('/funcionarios')}
          className="mt-4 inline-flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          <ArrowLeft size={15} /> Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl lg:max-w-none mx-auto">

      <div className="flex items-center gap-3 mb-5">
        <button onClick={voltar} title="Voltar"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl lg:text-base font-bold text-slate-800">
            {editando ? 'Editar Funcionario' : 'Novo Funcionario'}
          </h1>
          <p className="text-sm lg:text-xs text-slate-400">
            Marque so as telas que esta pessoa precisa ver. O que nao for marcado nao aparece no menu dela.
          </p>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{erro}</p>
        </div>
      )}

      {/* Na tela cheia os dados ficam a esquerda e as permissoes a direita, em
          vez de uma coisa embaixo da outra rolando dentro de uma caixa. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start space-y-4 lg:space-y-0">
            {/* Dados básicos */}
        <div className="bg-white border border-slate-200 rounded-xl lg:rounded p-5 lg:p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome Financeiro
              <span className="ml-1.5 text-xs font-normal text-slate-400">(aparece em documentos e relatórios)</span>
            </label>
            <input value={form.nomeFinanceiro} onChange={e => setForm(f => ({ ...f, nomeFinanceiro: e.target.value }))} placeholder="Ex: M. Torres, Magayver T." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
            <input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Reparador, Auxiliar..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
            <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(41) 99999-0000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {/* O e-mail da conta de login. Fica guardado explicitamente, e nao
              adivinhado a partir do nome: um endereco no painel do Supabase
              diferente por uma letra do que esta aqui da "senha incorreta"
              sem ninguem descobrir o motivo. Nunca recebe e-mail nenhum — e
              so o nome de usuario. */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail de acesso
              <span className="ml-1.5 text-xs font-normal text-slate-400">(usado para entrar no sistema; nao recebe mensagens)</span>
            </label>
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value.trim().toLowerCase() }))}
              placeholder="nome@injecar.local"
              autoCapitalize="none" autoCorrect="off" spellCheck="false" inputMode="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade</label>
            <input value={form.especialidade} onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} placeholder="Injeção, Freios..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIN (4 dígitos)</label>
            <div className="relative">
              <input type={mostrarPin ? 'text' : 'password'} value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="Mínimo 4 caracteres" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-9" />
              <button type="button" onClick={() => setMostrarPin(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                {mostrarPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Telas permitidas */}
        <div className="bg-white border border-slate-200 rounded-xl lg:rounded p-5 lg:p-4 lg:row-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-3">Telas que pode acessar</label>
          <div className="space-y-3">
            {GRUPOS_MENU.map(({ grupo, itens }) => (
              <div key={grupo}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{grupo}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {itens.map(({ id, label }) => {
                    const ativo = permissoes.menus.includes(id)
                    return (
                      <button key={id} type="button" onClick={() => toggleMenu(id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all border ${ativo ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-primary-500' : 'bg-slate-200'}`}>
                          {ativo && <Check size={10} className="text-white" />}
                        </div>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissões especiais */}
        <div className="bg-white border border-slate-200 rounded-xl lg:rounded p-5 lg:p-4">
          <label className="block text-sm font-medium text-slate-700 mb-3">Permissões especiais</label>
          <div className="space-y-2">
            {PERMISSOES_ESPECIAIS.map(({ id, label }) => {
              const ativo = !!permissoes[id]
              return (
                <button key={id} type="button" onClick={() => toggleEspecial(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all border ${ativo ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-primary-500' : 'bg-slate-200'}`}>
                    {ativo && <Check size={11} className="text-white" />}
                  </div>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4 px-4 py-3 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600">
        <span>
          {!form.nome.trim()
            ? <>Falta: <strong className="font-medium text-amber-700">nome</strong></>
            : <><strong className="font-medium">{totalTelas}</strong> tela(s) liberada(s){sujo && ' - alteracoes nao salvas'}</>}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={voltar}
            className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded text-xs font-medium hover:bg-white transition-colors">
            Cancelar
          </button>
          <button onClick={salvar}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-1.5 rounded text-xs font-semibold transition-colors">
            <Check size={14} /> {editando ? 'Salvar alteracoes' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Plus, Phone, Wrench, Trash2, ClipboardList, Shield, Pencil, Check, DollarSign, Ban } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { MODELOS } from '../context/AuthContext'

const AVATAR_COR = {
  admin: 'bg-orange-100 text-orange-600',
  reparador: 'bg-blue-100 text-blue-600',
  recepcao: 'bg-green-100 text-green-600',
  personalizado: 'bg-purple-100 text-purple-600',
}

export default function Funcionarios() {
  const navigate = useNavigate()
  const { funcionarios, setFuncionarios, ordens } = useApp()

  // Cadastrar e editar vivem em `pages/FuncionarioCadastro.jsx`, em tela cheia.
  // Era o maior popup do sistema — sete campos mais a grade inteira de
  // permissoes rolando dentro de uma caixa. Decidir o que alguem enxerga do
  // sistema pede a tela toda.
  function abrirNovo() { navigate('/funcionarios/novo') }
  function abrirEditar(f) { navigate(`/funcionarios/${f.id}`) }

  // Desativar corta o acesso; excluir apaga o autor do historico. Sao coisas
  // diferentes, e quase sempre o que se quer e a primeira.
  function alternarAtivo(f) {
    const desativando = f.ativo !== false
    const aviso = desativando
      ? `Desativar o acesso de ${f.nome}?

Ele deixa de conseguir entrar no sistema. O historico e as OS dele continuam intactos, e voce pode reativar quando quiser.`
      : `Reativar o acesso de ${f.nome}?`
    if (!confirm(aviso)) return
    setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...x, ativo: !desativando } : x))
  }

  function excluir(id) {
    if (confirm('Excluir funcionário?')) setFuncionarios(prev => prev.filter(f => f.id !== id))
  }

  function osDoFuncionario(id) {
    return ordens.filter(o => o.mecanicoId === id)
  }

  // Rodape de sistema, como nas outras telas: o que se quer saber olhando a
  // equipe e quem esta sem acesso e quem nao consegue entrar por falta de PIN.
  const desativados = funcionarios.filter(f => f.ativo === false).length
  const semPin = funcionarios.filter(f => !f.pin).length

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={abrirNovo} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Funcionário
        </button>
      </div>

      {/* Cartao e do celular. No computador a equipe vira tabela, como o resto
          do sistema: nome embaixo de nome, numero embaixo de numero. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
        {funcionarios.map(f => {
          const osAbertas = osDoFuncionario(f.id).filter(o => !['Concluída','Cancelada','Entregue'].includes(o.status))
          const osConcluidas = osDoFuncionario(f.id).filter(o => ['Concluída','Entregue'].includes(o.status))
          const perfilLabel = MODELOS[f.perfil]?.label || 'Personalizado'
          const avatarCor = AVATAR_COR[f.perfil] || 'bg-slate-100 text-slate-600'
          const menusCount = f.permissoes?.menus?.length || 0

          return (
            <div key={f.id} className={`bg-white rounded-xl shadow-sm border p-5 ${f.ativo === false ? 'border-amber-200 opacity-60' : 'border-slate-100'}`}>
              {f.ativo === false && (
                <p className="mb-3 text-xs font-semibold text-amber-600 flex items-center gap-1">
                  <Ban size={12} /> Acesso desativado — nao entra no sistema
                </p>
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${avatarCor}`}>
                    {f.nome[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{f.nome}</p>
                    {f.nomeFinanceiro && (
                      <p className="text-xs text-primary-500 flex items-center gap-1">
                        <DollarSign size={10} />{f.nomeFinanceiro}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{f.cargo || 'Funcionário'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(f)} className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  {/* Desativar em vez de excluir. Excluir deixa todo o historico
                      dele apontando para um numero que nao existe mais — as OS
                      que ele fez perdem o autor. E, com a tranca do banco
                      ligada, desativar CORTA O ACESSO de verdade, na hora, em
                      todos os aparelhos dele. */}
                  <button
                    onClick={() => alternarAtivo(f)}
                    title={f.ativo === false ? 'Reativar acesso' : 'Desativar acesso'}
                    className={`p-1.5 rounded transition-colors ${f.ativo === false
                      ? 'hover:bg-green-50 text-green-500 hover:text-green-600'
                      : 'hover:bg-amber-50 text-slate-500 hover:text-amber-600'}`}
                  >
                    {f.ativo === false ? <Check size={14} /> : <Ban size={14} />}
                  </button>
                  <button onClick={() => excluir(f.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                  <Shield size={10} />{perfilLabel}
                </span>
                <span className="text-xs text-slate-400">{menusCount} tela(s)</span>
                {f.pin && <span className="text-xs text-green-500">• PIN ativo</span>}
              </div>

              <div className="space-y-1.5 text-sm mb-4">
                {f.telefone && <div className="flex items-center gap-2 text-slate-600"><Phone size={13} className="text-slate-400" />{f.telefone}</div>}
                {f.especialidade && <div className="flex items-center gap-2 text-slate-600"><Wrench size={13} className="text-slate-400" />{f.especialidade}</div>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <ClipboardList size={14} className="text-blue-400" />
                  <span className="text-slate-600">{osAbertas.length} abertas</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <ClipboardList size={14} className="text-green-400" />
                  <span className="text-slate-600">{osConcluidas.length} concluídas</span>
                </div>
              </div>
            </div>
          )
        })}
        {funcionarios.length === 0 && <p className="text-sm text-slate-400 py-4">Nenhum funcionário cadastrado.</p>}
      </div>

      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cargo</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acesso</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Especialidade</th>
              {/* Contagens a direita: numero embaixo de numero deixa a coluna
                  conferivel de cima a baixo. */}
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Abertas</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Concl.</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {funcionarios.map(f => {
              const osDele = osDoFuncionario(f.id)
              const osAbertas = osDele.filter(o => !['Concluída','Cancelada','Entregue'].includes(o.status)).length
              const osConcluidas = osDele.filter(o => ['Concluída','Entregue'].includes(o.status)).length
              const perfilLabel = MODELOS[f.perfil]?.label || 'Personalizado'
              const avatarCor = AVATAR_COR[f.perfil] || 'bg-slate-100 text-slate-600'
              const menusCount = f.permissoes?.menus?.length || 0
              const inativo = f.ativo === false
              return (
                <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${inativo ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarCor}`}>
                        {f.nome[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{f.nome}</p>
                        {f.nomeFinanceiro && <p className="text-xs text-primary-500 truncate">{f.nomeFinanceiro}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    {f.cargo || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {/* Acesso numa coluna so: perfil, quantas telas, se entra
                        (PIN) e se esta cortado. E o que se confere ao olhar a
                        equipe: quem enxerga o que. */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {inativo ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                          title="Não entra no sistema">
                          <Ban size={10} /> Desativado
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
                            <Shield size={10} />{perfilLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">{menusCount} tela(s)</span>
                          {!f.pin && <span className="text-[11px] text-amber-600" title="Sem PIN não consegue entrar">sem PIN</span>}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">
                    {f.telefone || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    {f.especialidade || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums">
                    {osAbertas > 0 ? <span className="font-semibold text-blue-600">{osAbertas}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums">
                    {osConcluidas > 0 ? <span className="text-slate-600">{osConcluidas}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditar(f)} title="Editar"
                        className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => alternarAtivo(f)}
                        title={inativo ? 'Reativar acesso' : 'Desativar acesso'}
                        className={`p-1.5 rounded transition-colors ${inativo
                          ? 'hover:bg-green-50 text-green-500 hover:text-green-600'
                          : 'hover:bg-amber-50 text-slate-500 hover:text-amber-600'}`}>
                        {inativo ? <Check size={14} /> : <Ban size={14} />}
                      </button>
                      <button onClick={() => excluir(f.id)} title="Excluir"
                        className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {funcionarios.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum funcionário cadastrado.</p>}
        {funcionarios.length > 0 && (
          <div className="flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {funcionarios.length} {funcionarios.length === 1 ? 'pessoa' : 'pessoas'}
              {desativados > 0 && (
                <span className="ml-2 text-slate-500" title="Desativado não entra no sistema">· {desativados} desativado(s)</span>
              )}
              {semPin > 0 && (
                <span className="ml-2 text-slate-500" title="Sem PIN a pessoa não consegue entrar">· {semPin} sem PIN</span>
              )}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { resumoPessoalPorMes, mediaDosMesesFechados } from '../utils/pessoal'

// Pessoal × Oficina — quanto do caixa foi para a família, mês a mês.
//
// É a base do salário (pró-labore) que o dono quer definir para 2027: somando
// as retiradas e as contas pessoais pagas pelo caixa, sai quanto a família
// custa por mês. A regra mora em utils/pessoal.js.
//
// Saída antiga, de antes da marcação Oficina/Pessoal, é classificada pelo
// texto do motivo e aparece como estimativa.

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PainelPessoal() {
  const { caixaHistorico, caixaTurno } = useApp()
  const [aberto, setAberto] = useState(null)

  const meses = useMemo(
    () => resumoPessoalPorMes([...(caixaHistorico || []), ...(caixaTurno ? [caixaTurno] : [])]),
    [caixaHistorico, caixaTurno],
  )
  const media = useMemo(() => mediaDosMesesFechados(meses), [meses])

  if (meses.length === 0) {
    return <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-100 p-8 text-center">Nenhuma saída de caixa registrada.</p>
  }

  return (
    <div className="space-y-4">
      {media && (
        <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">Média do gasto pessoal por mês</p>
          <p className="text-3xl font-bold text-slate-800 mt-1 tabular-nums">{fmt(media.pessoal)}</p>
          <p className="text-sm text-slate-500 mt-1">
            {fmt(media.retiradas)} em retiradas + {fmt(media.contasPessoais)} em contas pessoais pagas pelo caixa
            <span className="text-slate-400"> · média {media.meses === 1 ? 'do último mês fechado' : `dos últimos ${media.meses} meses fechados`}</span>
          </p>
          <p className="text-xs text-slate-400 mt-2">É quanto a família custou, em média, saindo do caixa da oficina — a base para definir o seu salário fixo.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mês</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Oficina</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Retiradas</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contas pessoais</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-purple-600 uppercase tracking-wide">Total pessoal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {meses.map(m => {
              const expandido = aberto === m.chave
              const tudoEstimado = m.pessoal > 0 && m.pessoalEstimado >= m.pessoal - 0.005
              const parteEstimada = m.pessoalEstimado > 0.005 && !tudoEstimado
              return [
                <tr key={m.chave} onClick={() => setAberto(expandido ? null : m.chave)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {expandido ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      {m.rotulo}
                    </span>
                    {(tudoEstimado || parteEstimada) && (
                      <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                        title="Saídas de antes da marcação Oficina/Pessoal, classificadas pelo texto do motivo">
                        {tudoEstimado ? 'estimado' : 'parte estimada'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{fmt(m.oficina)}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{fmt(m.retiradas)}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{fmt(m.contasPessoais)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-purple-700 tabular-nums">{fmt(m.pessoal)}</td>
                </tr>,
                expandido && (
                  <tr key={m.chave + '-itens'} className="bg-purple-50/40">
                    <td colSpan={5} className="px-4 py-3">
                      {m.itensPessoais.length === 0 ? (
                        <p className="text-xs text-slate-400">Nenhuma saída pessoal neste mês.</p>
                      ) : (
                        <div className="space-y-1">
                          {m.itensPessoais.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-slate-500 whitespace-nowrap tabular-nums">{it.dia}</span>
                              <span className="flex-1 min-w-0 truncate text-slate-700" title={it.motivo}>
                                {it.motivo || '—'}
                                {it.retirada && <span className="ml-1.5 text-[10px] text-slate-400">retirada</span>}
                                {it.estimado && <span className="ml-1.5 text-[10px] text-amber-700">pelo texto</span>}
                              </span>
                              <span className="text-slate-700 font-medium tabular-nums whitespace-nowrap">{fmt(it.valor)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-400">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        Conta só o que saiu pelo caixa (sangrias). Clique no mês para ver cada saída pessoal. As saídas de antes da marcação
        foram classificadas pelo texto (PF, retirada, nomes da família, escola, casa) — se alguma estiver errada, corrija no Caixa,
        enquanto o turno estiver aberto.
      </p>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { CreditCard, TrendingDown, Percent, AlertTriangle, ArrowRight, Info, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { maquinasDoConfig, resumirTaxasCartao, taxaEfetiva, parseValorBR } from '../utils/cartao'
import { dentroDoPeriodo } from '../utils/periodo'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v) => String(v).replace('.', ',') + '%'

// Quanto a oficina paga de adquirência, por máquina — e quanto pagaria se o
// mesmo movimento tivesse passado na outra. É o número que se leva para
// renegociar: sem ele, a conversa com a operadora é no "acho que está caro".
// `intervalo` vem da tela, que já tem um seletor de período fixo no topo. Este
// painel tinha o seu próprio, e os dois não conversavam: mudar o de cima não
// mexia nos números dos cartões, e a tela mostrava dois períodos ao mesmo tempo.
export default function PainelCartoes({ intervalo }) {
  const { financeiro, config } = useApp()
  const maquinas = maquinasDoConfig(config)

  const dados = useMemo(() => {
    const lancs = financeiro.filter(f => f.taxaCartao && dentroDoPeriodo(f.data, intervalo))
    return resumirTaxasCartao(lancs, maquinas)
  }, [financeiro, intervalo, maquinas])

  return (
    <div className="space-y-4">

      {dados.volumeTotal === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
          <CreditCard size={30} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Nenhuma taxa de cartão registrada neste período.</p>
          <p className="text-xs text-slate-400 mt-1">
            {maquinas.length === 0
              ? 'Cadastre suas maquininhas em Configurações para começar a medir.'
              : 'Assim que uma venda for paga no cartão, ela aparece aqui.'}
          </p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Passou no cartão', valor: fmt(dados.volumeTotal), icon: CreditCard, cor: 'text-slate-800', ic: 'text-violet-500' },
              { label: 'Ficou de taxa',    valor: fmt(dados.taxaTotal),   icon: TrendingDown, cor: 'text-red-600',  ic: 'text-red-400' },
              { label: 'Taxa efetiva',     valor: pct(dados.efetiva),     icon: Percent,      cor: 'text-slate-800', ic: 'text-amber-500' },
            ].map(({ label, valor, icon: Icon, cor, ic }) => (
              <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={14} className={ic} />
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
              </div>
            ))}
          </div>

          {/* Por máquina */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Por maquininha</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Máquina</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Volume</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Taxa paga</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Efetiva</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dados.lista.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-800">{m.nome}</p>
                        <p className="text-xs text-slate-400">{m.vendas} venda(s)</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-600 tabular-nums">{fmt(m.volume)}</td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-red-500 tabular-nums">{fmt(m.taxa)}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-700 tabular-nums">{pct(taxaEfetiva(m.taxa, m.volume))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparativo */}
          {dados.comparativo.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">E se tudo tivesse passado numa máquina só?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mesmo movimento do período, recalculado com a tabela de cada máquina — respeitando débito, à vista e cada faixa de parcelas.
                </p>
              </div>
              <div className="divide-y divide-slate-50">
                {dados.comparativo.map(({ maquina, taxa, diferenca }) => (
                  <div key={maquina.id ?? maquina.nome} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800 truncate min-w-0">{maquina.nome}</p>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">{fmt(taxa)}</span>
                      {diferenca != null && Math.abs(diferenca) >= 0.01 && (
                        <span className={`text-xs font-semibold tabular-nums px-2 py-1 rounded ${
                          diferenca > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {diferenca > 0 ? `economizaria ${fmt(diferenca)}` : `custaria +${fmt(-diferenca)}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dados.incompletas?.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {dados.incompletas.map(i => i.maquina.nome).join(', ')} {dados.incompletas.length === 1 ? 'ficou' : 'ficaram'} de
                fora da comparação: {dados.incompletas.length === 1 ? 'falta' : 'faltam'} taxa cadastrada para parte
                do movimento do período. Comparar assim daria uma economia que não existe.
              </p>
            </div>
          )}

          {dados.comparativo.length === 1 && dados.incompletas?.length === 0 && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <Info size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Com uma máquina cadastrada não há o que comparar. Cadastre a segunda em Configurações
                — mesmo sem usá-la ainda, dá para ver quanto o mesmo movimento custaria nela.
              </p>
            </div>
          )}

          {!dados.temDetalhe && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                As taxas deste período foram lançadas sem o detalhe de como cada venda passou
                (débito, à vista ou parcelado), então a comparação entre máquinas fica de fora.
                As vendas novas já saem com esse detalhe.
              </p>
            </div>
          )}
        </>
      )}

      <PendenciasTaxa />
    </div>
  )
}

// Vendas que entraram antes de a taxa estar cadastrada. Ficam visíveis para não
// virarem buraco silencioso no custo do mês.
function PendenciasTaxa() {
  const { caixaTurno, caixaHistorico, reprocessarTaxasPendentes } = useApp()
  const [feito, setFeito] = useState(null)
  const [recalculando, setRecalculando] = useState(false)

  const pendentes = useMemo(() => {
    const turnos = [...(caixaTurno ? [caixaTurno] : []), ...(caixaHistorico || [])]
    const achadas = []
    for (const t of turnos) {
      for (const v of t.vendas || []) {
        for (const p of v.pagamentos || []) {
          if (p.taxaPendente) achadas.push({ venda: v.numero, valor: parseValorBR(p.valor), temMaquina: !!p.maquinaId })
        }
      }
    }
    return achadas
  }, [caixaTurno, caixaHistorico])

  if (pendentes.length === 0) {
    return feito ? (
      <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <Info size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-green-800">
          {feito.pagamentos} pagamento(s) recalculado(s), somando {fmt(feito.taxa)} de taxa que
          estava faltando. Já entrou nos números acima.
        </p>
      </div>
    ) : null
  }

  const total = pendentes.reduce((s, p) => s + p.valor, 0)
  const recuperaveis = pendentes.filter(p => p.temMaquina).length

  function recalcular() {
    if (recalculando) return
    setRecalculando(true)
    try {
      const res = reprocessarTaxasPendentes()
      if (res.pagamentos === 0) {
        alert('Nenhum pagamento pôde ser recalculado.\n\nA taxa daquela modalidade ainda não está cadastrada em Configurações → Maquininhas de cartão.')
        return
      }
      setFeito(res)
    } finally {
      setTimeout(() => setRecalculando(false), 1000)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          {pendentes.length} pagamento(s) sem taxa calculada
        </h3>
        <p className="text-xs text-amber-800 mt-0.5">
          {fmt(total)} passou no cartão antes de a taxa estar cadastrada. O valor entrou cheio —
          o custo real deste período é maior do que o mostrado acima.
        </p>
      </div>
      <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <ArrowRight size={12} className="text-slate-400" />
          {recuperaveis > 0
            ? `${recuperaveis} tem a máquina identificada e pode ser recalculado agora.`
            : 'Nenhum tem máquina identificada — não dá para saber onde passou.'}
        </p>
        {recuperaveis > 0 && (
          <button onClick={recalcular} disabled={recalculando}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <RefreshCw size={13} />{recalculando ? 'Recalculando…' : 'Recalcular taxas'}
          </button>
        )}
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { Megaphone, UserPlus, AlertTriangle, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { tabularOrigem, coberturaGeral, SEM_ORIGEM } from '../utils/origemCliente'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '%'

// Cor fixa por canal, para o mesmo canal ter a mesma cor em todo mes que se
// abrir — comparar julho com agosto fica visual, sem reler a legenda.
const COR = {
  'Google': 'bg-blue-500',
  'Instagram': 'bg-pink-500',
  'Facebook': 'bg-indigo-500',
  'WhatsApp': 'bg-green-500',
  'Indicação de amigo': 'bg-amber-500',
  'Indicação de oficina': 'bg-orange-500',
  'Passou em frente': 'bg-teal-500',
  'Cliente antigo': 'bg-slate-400',
  'Outro': 'bg-violet-500',
  [SEM_ORIGEM]: 'bg-slate-300',
}

// De onde vêm os clientes — e de onde vem o dinheiro.
//
// A tela mostra as duas colunas lado a lado de propósito. A pergunta que o dono
// faz é "qual canal traz mais cliente?", mas a decisão que ele precisa tomar é
// onde colocar o dinheiro do anúncio — e essas duas coisas se separam com
// frequência. Canal que traz muita gente de serviço pequeno aparece grande na
// coluna de clientes e pequeno na de faturamento; a barra dupla mostra isso sem
// precisar de explicação.
//
// `intervalo` vem do seletor de período fixo no topo da tela, como no painel de
// cartões: é ele que dá o "mês a mês, ano a ano" sem este componente precisar
// de um seletor próprio que discordasse do de cima.
export default function PainelOrigem({ intervalo }) {
  const { clientes, ordens, totalOrdem } = useApp()

  const dados = useMemo(
    () => tabularOrigem({ clientes, ordens, totalOrdem, intervalo }),
    [clientes, ordens, totalOrdem, intervalo],
  )
  const geral = useMemo(() => coberturaGeral(clientes), [clientes])

  const canais = dados.linhas.filter(l => l.canal !== SEM_ORIGEM)

  // Enquanto ninguém tiver respondido, mostrar percentual seria inventar. A tela
  // diz o que fazer para o relatório passar a existir, em vez de exibir um
  // gráfico de nada.
  if (geral.comOrigem === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
        <Megaphone size={30} className="text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Nenhum cliente com origem registrada ainda.</p>
        <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          O campo <strong className="text-slate-500">"Como nos conheceu"</strong> fica na Nova Entrada, nos dados do cliente.
          A partir da primeira resposta este painel começa a somar — e em um mês já dá para
          comparar os canais. Os {geral.total} cadastros antigos podem ir sendo preenchidos aos
          poucos, conforme cada cliente voltar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Clientes novos no período', valor: String(dados.novosTotal), icon: UserPlus, ic: 'text-blue-500', cor: 'text-slate-800' },
          { label: 'Faturado em OS no período', valor: fmt(dados.faturamentoTotal), icon: Megaphone, ic: 'text-green-500', cor: 'text-slate-800' },
          {
            label: 'Novos com origem respondida',
            valor: dados.novosTotal > 0 ? pct(dados.cobertura) : '—',
            icon: Info,
            ic: dados.cobertura >= 80 ? 'text-green-500' : 'text-amber-500',
            cor: dados.cobertura >= 80 ? 'text-slate-800' : 'text-amber-600',
          },
        ].map(({ label, valor, icon: Icon, ic, cor }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={14} className={ic} />
              <p className="text-sm text-slate-500">{label}</p>
            </div>
            <p className={`text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
          </div>
        ))}
      </div>

      {/* A tabela. Cliente e dinheiro na mesma linha, com barra em cima da
          barra — é o desencontro entre as duas que interessa. */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Por canal</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cliente novo é contado no mês da <strong>primeira entrada</strong> dele na oficina, mesmo que o
            orçamento não tenha fechado. O valor é o de <strong>todas</strong> as OS concluídas no
            período — inclusive de cliente antigo, que continua sendo crédito do canal que o trouxe.
          </p>
          {/* Este total não é o mesmo do card "Receitas" lá em cima, e a
              diferença tem motivo: lá é dinheiro que ENTROU no caixa (incluindo
              venda de balcão, que não tem cliente nem canal); aqui é o valor
              das OS FECHADAS, pagas ou não. Para comparar canal entre si, o
              valor da OS é o certo — é o que o canal produziu, independente de
              quando o cliente pagou. Sem esta frase, dois números parecidos e
              diferentes na mesma tela fazem desconfiar dos dois. */}
          <p className="text-xs text-slate-400 mt-1.5">
            Não confunda com o card <strong>Receitas</strong> no topo da tela: lá é o dinheiro que entrou no
            caixa (inclui balcão, que não tem canal); aqui é o valor das OS fechadas, pagas ou não.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Canal</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clientes novos</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Faturamento</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ticket médio</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Clientes × dinheiro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dados.linhas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <p className="text-sm text-slate-500">Nenhum cliente novo nem OS concluída neste período.</p>
                    <p className="text-xs text-slate-400 mt-1">Escolha outro período no topo da tela.</p>
                  </td>
                </tr>
              )}
              {dados.linhas.map(l => {
                const lacuna = l.canal === SEM_ORIGEM
                return (
                  <tr key={l.canal} className={`hover:bg-slate-50 ${lacuna ? 'bg-slate-50/60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COR[l.canal] || 'bg-slate-400'}`} />
                        <p className={`text-sm font-medium ${lacuna ? 'text-slate-400 italic' : 'text-slate-800'}`}>{l.canal}</p>
                      </div>
                      {lacuna && <p className="text-[11px] text-slate-400 mt-0.5 pl-4">Entrou sem a pergunta ser feita</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <p className="text-sm font-semibold text-slate-700">{l.novos}</p>
                      {dados.novosTotal > 0 && <p className="text-xs text-slate-400">{pct(l.pctNovos)}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <p className="text-sm font-semibold text-slate-700">{fmt(l.faturamento)}</p>
                      {dados.faturamentoTotal > 0 && <p className="text-xs text-slate-400">{pct(l.pctFaturamento)} · {l.ordens} OS</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-slate-600 tabular-nums">
                      {l.ordens > 0 ? fmt(l.ticket) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1" title={`${pct(l.pctNovos)} dos clientes novos · ${pct(l.pctFaturamento)} do faturamento`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-400 w-3 flex-shrink-0">nº</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${COR[l.canal] || 'bg-slate-400'} opacity-50`} style={{ width: `${Math.min(100, l.pctNovos)}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-400 w-3 flex-shrink-0">R$</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${COR[l.canal] || 'bg-slate-400'}`} style={{ width: `${Math.min(100, l.pctFaturamento)}%` }} />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* A leitura pronta: onde o dinheiro está e onde ele não está. Só aparece
          quando há canal suficiente para a frase significar alguma coisa. */}
      {/* O guard olha o faturamento DOS CANAIS, não o total do período: o total
          inclui a linha "Não informado", e nas primeiras semanas do recurso é
          nela que está quase todo o dinheiro (cliente antigo, sem origem). Com
          o guard no total, a tela escreveria "quem mais trouxe dinheiro foi
          Google (R$ 0,00)" — afirmação falsa, no estado mais provável de todos.
          E o desencontro é procurado a partir do SEGUNDO colocado, senão a
          frase compara o primeiro com ele mesmo. */}
      {canais.length >= 2 && canais[0].faturamento > 0 && (() => {
        const porFaturamento = canais[0]
        const porVolume = [...canais].sort((a, b) => b.novos - a.novos)[0]
        const desencontro = canais.slice(1).find(c => c.pctNovos - c.pctFaturamento >= 15 && c.novos > 0)
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-5 py-4 space-y-2">
            <h3 className="font-semibold text-slate-800 text-sm">Leitura do período</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Quem mais trouxe <strong>dinheiro</strong> foi <strong className="text-slate-800">{porFaturamento.canal}</strong>
              {' '}({fmt(porFaturamento.faturamento)}, {pct(porFaturamento.pctFaturamento)} do total)
              {porVolume.canal !== porFaturamento.canal && porVolume.novos > 0 && (
                <> — mas quem mais trouxe <strong>gente</strong> foi <strong className="text-slate-800">{porVolume.canal}</strong>, com {porVolume.novos} cliente(s) novo(s).</>
              )}
              {(porVolume.canal === porFaturamento.canal || porVolume.novos === 0) && <>.</>}
            </p>
            {desencontro && (
              <p className="text-sm text-slate-500 leading-relaxed">
                <strong className="text-slate-700">{desencontro.canal}</strong> traz {pct(desencontro.pctNovos)} dos clientes
                e {pct(desencontro.pctFaturamento)} do faturamento: volume alto, serviço pequeno.
                Ticket médio de {fmt(desencontro.ticket)} contra {fmt(porFaturamento.ticket)} do primeiro colocado.
              </p>
            )}
          </div>
        )
      })()}

      {/* Enquanto a lacuna for grande, os percentuais acima são chute com cara
          de número. Dizer isso é o que separa relatório de enfeite. */}
      {dados.semOrigemNovos > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>{dados.semOrigemNovos}</strong> dos {dados.novosTotal} clientes novos deste período entraram sem a
            pergunta ser feita{dados.cobertura < 50 && ' — mais da metade'}. Enquanto isso acontecer, os percentuais
            acima falam só da parte respondida, não da oficina inteira.
            {geral.comOrigem < geral.total && (
              <> No sistema todo, {geral.comOrigem} de {geral.total} cadastros têm origem ({pct(geral.pct)}).</>
            )}
          </p>
        </div>
      )}

      {(dados.ordensClienteSumido > 0 || dados.ordensSemCliente > 0) && (
        <p className="text-xs text-slate-400 px-1">
          {dados.ordensClienteSumido > 0 && (
            <>{dados.ordensClienteSumido} OS do período estão ligadas a um cliente que não está mais no cadastro. </>
          )}
          {dados.ordensSemCliente > 0 && (
            <>{dados.ordensSemCliente} OS do período foram abertas sem cliente. </>
          )}
          O faturamento delas entrou em "{SEM_ORIGEM}".
        </p>
      )}
    </div>
  )
}

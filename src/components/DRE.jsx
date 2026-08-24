import { useMemo, useState } from 'react'
import { FileBarChart, AlertTriangle, Info, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { dreDoPeriodo } from '../utils/dre'
import { variacao } from '../utils/periodo'

// DRE gerencial do período — em custeio variável.
//
// A ordem das linhas não é decorativa, é o raciocínio:
//
//   Receita bruta          o que o cliente pagou
//   (−) Taxa de cartão     a adquirente ficou com isso antes de o dinheiro chegar
//   = Receita líquida      o que de fato entrou
//   (−) CMV                as peças que saíram da prateleira para fazer o serviço
//   = Margem de contribuição   ← quanto sobrou para pagar a ESTRUTURA
//   (−) Custo fixo         aluguel, energia, salário — do MÊS, não da OS
//   = Resultado            lucro ou prejuízo de verdade
//   (−) Retirada do sócio  informativo: NÃO é despesa da oficina
//   = Sobra em caixa
//
// A retirada fica abaixo do resultado de propósito. Retirada é distribuição do
// lucro, não custo de operar. Somá-la às despesas faz um mês lucrativo aparecer
// no vermelho só porque o dono tirou dinheiro — e é o erro que mais confunde
// resultado em oficina pequena.
//
// O período vem de fora (`intervalo`/`anterior`) em vez de o componente ter o
// próprio SeletorPeriodo: a tela do Financeiro já tem um seletor fixo no topo,
// sempre visível. Um segundo seletor dentro da aba criaria dois controles
// dizendo coisas diferentes sobre a mesma tela.
//
// A conta mora em `utils/dre.js`, que é função pura e testada em Node. Aqui só
// se desenha.

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v) => v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// Variação contra o período anterior.
//
// Em custo, subir é notícia ruim: a seta é a mesma, mas a cor inverte — senão
// "custo fixo +30%" sairia em verde como se fosse conquista.
function Variacao({ atual, anterior, subirEhBom = true, rotulo }) {
  const v = variacao(atual, anterior)
  if (v == null) return <span className="text-[11px] text-slate-300">sem base</span>
  if (Math.abs(v) < 0.5) return <span className="text-[11px] text-slate-400">estável</span>
  const subiu = v > 0
  const Icone = subiu ? ArrowUpRight : ArrowDownRight
  const cor = subirEhBom == null ? 'text-slate-500' : (subiu === subirEhBom ? 'text-green-600' : 'text-red-500')
  return (
    <span className={`text-[11px] inline-flex items-center gap-0.5 ${cor}`} title={`vs ${rotulo}`}>
      <Icone size={12} className="flex-shrink-0" />
      <span className="font-semibold tabular-nums">{Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>
    </span>
  )
}

function Aviso({ children, tom = 'amber' }) {
  const cls = tom === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-slate-50 border-slate-200 text-slate-600'
  const Icone = tom === 'amber' ? AlertTriangle : Info
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 ${cls}`}>
      <Icone size={14} className="flex-shrink-0 mt-0.5 opacity-70" />
      <div className="text-xs leading-snug">{children}</div>
    </div>
  )
}

// Uma linha do demonstrativo.
//
// `tipo`: 'deducao' (o que sai), 'subtotal' (uma conta fechada) ou 'destaque'
// (a linha que o dono procura primeiro). `valor === null` significa "não dá para
// calcular" — e aparece como tal, nunca como R$ 0,00.
function Linha({ rotulo, explicacao, valor, percentual, base, subirEhBom, rotuloAnterior, tipo = 'deducao', indisponivel, incerto }) {
  const negativo = tipo === 'deducao'
  const destaque = tipo === 'destaque'
  const subtotal = tipo === 'subtotal' || destaque

  // `incerto` pinta de âmbar o número que ainda não pode ser lido como
  // conquista. Um "lucro" verde de R$ 76 mil calculado sem nenhum custo fixo
  // cadastrado é lido como boa notícia antes de alguém chegar no aviso.
  const corValor = indisponivel ? 'text-slate-400'
    : incerto ? 'text-amber-600'
    : destaque ? (valor >= 0 ? 'text-emerald-600' : 'text-red-600')
    : negativo ? 'text-red-500'
    : 'text-slate-800'

  return (
    <tr className={subtotal ? 'bg-slate-50/70' : ''}>
      <td className={`px-4 sm:px-5 py-3 align-top ${subtotal ? 'border-t border-slate-200' : ''}`}>
        <p className={`${destaque ? 'text-sm font-bold text-slate-900' : subtotal ? 'text-sm font-semibold text-slate-800' : 'text-sm text-slate-600'}`}>
          {negativo && <span className="text-slate-400 font-normal">(−) </span>}
          {subtotal && <span className="text-slate-400 font-normal">= </span>}
          {rotulo}
        </p>
        <p className="text-[11px] text-slate-400 leading-snug mt-0.5 max-w-md">{explicacao}</p>
      </td>
      <td className={`px-3 sm:px-5 py-3 text-right align-top whitespace-nowrap ${subtotal ? 'border-t border-slate-200' : ''}`}>
        <p className={`tabular-nums ${destaque ? 'text-lg font-bold' : subtotal ? 'text-base font-semibold' : 'text-sm font-medium'} ${corValor}`}>
          {indisponivel ? '—' : (negativo && valor > 0 ? '−' : '') + fmt(valor)}
        </p>
      </td>
      <td className={`px-2 sm:px-4 py-3 text-right align-top whitespace-nowrap text-[11px] text-slate-400 tabular-nums ${subtotal ? 'border-t border-slate-200' : ''}`}>
        {indisponivel ? '' : pct(percentual)}
      </td>
      <td className={`px-3 sm:px-5 py-3 text-right align-top whitespace-nowrap ${subtotal ? 'border-t border-slate-200' : ''}`}>
        {!indisponivel && base !== undefined && (
          <Variacao atual={valor} anterior={base} subirEhBom={subirEhBom} rotulo={rotuloAnterior} />
        )}
      </td>
    </tr>
  )
}

export default function DRE({ intervalo, anterior }) {
  const { financeiro, ordens, estoque, totalOrdem, gastos, caixaTurno, caixaHistorico } = useApp()
  const [verConferencia, setVerConferencia] = useState(false)

  // Todas as vendas de balcão — as do turno aberto e as dos turnos já fechados.
  // O DRE precisa delas para somar o custo das peças vendidas fora de OS; sem
  // isso a margem de contribuição saía otimista na proporção do balcão.
  const vendas = useMemo(() => [
    ...(caixaTurno?.vendas || []),
    ...(caixaHistorico || []).flatMap(t => t?.vendas || []),
  ], [caixaTurno, caixaHistorico])

  const dados = useMemo(
    () => dreDoPeriodo({ financeiro, ordens, estoque, totalOrdem, gastos, intervalo, vendas }),
    [financeiro, ordens, estoque, totalOrdem, gastos, intervalo, vendas],
  )

  // O mesmo demonstrativo no período anterior, só para as variações. Sem base de
  // comparação ("Tudo"), `anterior` é null e as setas simplesmente não aparecem.
  const base = useMemo(
    () => (anterior ? dreDoPeriodo({ financeiro, ordens, estoque, totalOrdem, gastos, intervalo: anterior, vendas }) : null),
    [financeiro, ordens, estoque, totalOrdem, gastos, anterior, vendas],
  )

  const rotuloAnterior = anterior?.rotulo || ''
  const semFixo = !dados.custoFixoDisponivel
  const c = dados.conferencia

  return (
    <div className="space-y-4">
      {/* Demonstrativo */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileBarChart size={17} className="text-primary-500" />
            DRE do período · {intervalo.rotulo}
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-snug">
            De cima para baixo: o que entrou, o que saiu por causa do serviço, e o que sobrou para pagar a estrutura.
            {anterior && <> A coluna da direita compara com {rotuloAnterior}{anterior.parcial ? ' (mesmo trecho do mês, para a comparação ser justa)' : ''}.</>}
          </p>
        </div>

        {dados.aproximado && (
          <div className="px-5 pt-4">
            <Aviso>
              <strong>Os números abaixo são aproximados e erram para o lado otimista.</strong> O que falta preencher
              está listado logo depois do demonstrativo.
            </Aviso>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 sm:px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Linha</th>
                <th className="text-right px-3 sm:px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Valor</th>
                <th className="text-right px-2 sm:px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide" title="Quanto essa linha representa do faturamento">% fat.</th>
                <th className="text-right px-3 sm:px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">vs ant.</th>
              </tr>
            </thead>
            <tbody>
              <Linha
                tipo="subtotal"
                rotulo="Receita bruta"
                explicacao={`Tudo que os clientes pagaram no período — OS e balcão. ${dados.lancamentos} lançamento${dados.lancamentos === 1 ? '' : 's'} de caixa.`}
                valor={dados.receitaBruta} percentual={dados.percentual.receitaBruta}
                base={base?.receitaBruta} subirEhBom rotuloAnterior={rotuloAnterior}
              />
              <Linha
                rotulo="Taxa de cartão"
                explicacao={`O que a maquininha ficou antes de o dinheiro chegar na conta. ${dados.lancamentosTaxa} lançamento${dados.lancamentosTaxa === 1 ? '' : 's'} de taxa.`}
                valor={dados.taxaCartao} percentual={dados.percentual.taxaCartao}
                base={base?.taxaCartao} subirEhBom={false} rotuloAnterior={rotuloAnterior}
              />
              <Linha
                tipo="subtotal"
                rotulo="Receita líquida"
                explicacao="O que de fato entrou depois da adquirência."
                valor={dados.receitaLiquida} percentual={dados.percentual.receitaLiquida}
                base={base?.receitaLiquida} subirEhBom rotuloAnterior={rotuloAnterior}
              />
              <Linha
                rotulo="Custo das peças vendidas (CMV)"
                explicacao={`O que as peças custaram para a oficina, apurado nas ${dados.ordens} OS concluída${dados.ordens === 1 ? '' : 's'} do período. Compra de peça para estoque NÃO entra aqui — ela vira custo quando a peça sai numa OS.`}
                valor={dados.cmv} percentual={dados.percentual.cmv}
                base={base?.cmv} subirEhBom={false} rotuloAnterior={rotuloAnterior}
              />
              <Linha
                tipo="destaque"
                rotulo="Margem de contribuição"
                explicacao="Quanto sobrou dos serviços para pagar a estrutura. Ainda NÃO desconta aluguel, energia nem salário — com salário fixo esses custos não são de nenhuma OS, são do mês."
                valor={dados.margemContribuicao} percentual={dados.percentual.margemContribuicao}
                base={base?.margemContribuicao} subirEhBom rotuloAnterior={rotuloAnterior}
              />
              <Linha
                rotulo="Custo fixo do período"
                explicacao={semFixo
                  ? 'Indisponível em "Tudo": não há quantos meses de aluguel somar. Escolha um mês ou um intervalo com datas.'
                  : `Aluguel, energia, salário e o mais que vence todo mês, cadastrado em Gastos como "Fixo". ${dados.meses === 1 ? '1 mês' : `${dados.meses} meses`} de contas fixas.`}
                valor={dados.custoFixo} percentual={dados.percentual.custoFixo} indisponivel={semFixo}
                base={base?.custoFixo} subirEhBom={false} rotuloAnterior={rotuloAnterior}
              />
              <Linha
                tipo="destaque"
                rotulo="Resultado do período"
                explicacao={semFixo
                  ? 'Sem custo fixo apurado não existe resultado. Escolha um período com mês definido.'
                  // Custo fixo zerado não é "tudo pago": é conta que não está no
                  // sistema. Chamar isso de lucro seria a mentira mais cara desta
                  // tela — o aluguel vence de qualquer jeito.
                  : !(dados.custoFixo > 0)
                    ? 'ATENÇÃO: sem gasto fixo cadastrado, este número é igual à margem de contribuição — não é lucro. O aluguel, a energia e o salário vencem mesmo sem estar no sistema.'
                    : dados.resultado >= 0
                      ? 'Lucro de verdade: as contas fixas do período já estão pagas pelos serviços.'
                      : 'Prejuízo: os serviços do período não cobriram as contas fixas. Caixa movimentado não desmente isso.'}
                valor={dados.resultado} percentual={dados.percentual.resultado} indisponivel={semFixo}
                incerto={!semFixo && !(dados.custoFixo > 0)}
                base={base?.resultado} subirEhBom rotuloAnterior={rotuloAnterior}
              />

              {/* Abaixo da linha: distribuição, não custo. */}
              <tr>
                <td colSpan={4} className="px-4 sm:px-5 pt-4 pb-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-t border-dashed border-slate-200 pt-3">
                    Abaixo da linha — distribuição do lucro, não custo da oficina
                  </p>
                </td>
              </tr>
              <Linha
                rotulo="Retirada do sócio"
                explicacao={dados.gastosRetirada > 0
                  ? `${dados.gastosRetirada} lançamento${dados.gastosRetirada === 1 ? '' : 's'} reconhecido${dados.gastosRetirada === 1 ? '' : 's'} como retirada/pró-labore, tirado${dados.gastosRetirada === 1 ? '' : 's'} de dentro do custo fixo para não contar duas vezes.`
                  : 'Zerada porque nenhum gasto foi lançado como retirada no período — não porque não houve retirada. Em Gastos existem as categorias "Retirada" e "Pró-labore": marcadas assim, elas saem do custo fixo e aparecem aqui, depois do resultado.'}
                valor={dados.retirada} percentual={dados.percentual.retirada} indisponivel={semFixo}
                base={base?.retirada} subirEhBom={null} rotuloAnterior={rotuloAnterior}
              />
              <Linha
                tipo="subtotal"
                rotulo="Sobra em caixa"
                explicacao="O que ficou na oficina depois de pagar tudo e distribuir o que foi distribuído."
                valor={dados.sobraEmCaixa} percentual={dados.percentual.sobraEmCaixa} indisponivel={semFixo}
                base={base?.sobraEmCaixa} subirEhBom rotuloAnterior={rotuloAnterior}
              />
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <p className="text-xs text-slate-600 leading-snug">
              <strong>Este é um DRE gerencial em custeio variável, não um DRE contábil.</strong> O custo fixo entra
              inteiro, uma vez, no nível do período — não é rateado por OS. Ratear exigiria saber quantas horas cada
              serviço consumiu, e esse dado não existe: aqui o mecânico é salário fixo e custa o mesmo tendo levado
              2 ou 8 horas no carro. Um rateio chutado daria um número preciso e errado.
            </p>
          </div>
        </div>
      </div>

      {/* O que falta preencher */}
      {dados.lacunas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">O que deixa estes números imprecisos</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada item abaixo puxa o resultado para cima. Enquanto houver algum, trate o DRE como um teto.
            </p>
          </div>
          <div className="p-4 space-y-2.5">
            {dados.lacunas.map(l => (
              <Aviso key={l.chave} tom={l.informativo ? 'slate' : 'amber'}>
                <p>{l.texto}</p>
                <p className="mt-1 opacity-80"><strong>O que fazer:</strong> {l.acao}</p>
              </Aviso>
            ))}
          </div>
        </div>
      )}

      {/* Conferência entre as fontes.
          Número que não bate é informação, não erro a esconder: as fontes medem
          coisas diferentes de propósito, e ver a diferença é o que impede alguém
          de confiar num total que não fecha. */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={() => setVerConferencia(v => !v)}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm">Conferência entre as fontes</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              De onde saiu cada linha e por que os totais da tela não são todos iguais.
            </p>
          </div>
          {verConferencia
            ? <ChevronDown size={17} className="text-slate-400 flex-shrink-0" />
            : <ChevronRight size={17} className="text-slate-400 flex-shrink-0" />}
        </button>

        {verConferencia && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-600 leading-snug">
                Cada linha do DRE lê de <strong>uma fonte só</strong>, e as fontes não se sobrepõem — é assim que a
                mesma despesa não é contada duas vezes. Receita e taxa de cartão vêm dos lançamentos do financeiro;
                o CMV vem das peças das OS (não existe no financeiro); o custo fixo e a retirada vêm dos Gastos. O
                total de despesas do financeiro <strong>não é usado</strong> em nenhuma linha do resultado — ele já
                contém a taxa, o espelho dos gastos pagos e a compra de estoque, e somá-lo seria contar tudo de novo.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <tbody className="divide-y divide-slate-50">
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-700">Faturamento pelo caixa <span className="text-slate-400">(fonte do DRE)</span></p>
                      <p className="text-[11px] text-slate-400">Lançamentos de receita — inclui balcão, conta na data do pagamento.</p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">{fmt(c.receitaFinanceiro)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-700">Faturamento pelas OS concluídas</p>
                      <p className="text-[11px] text-slate-400">Conta na data da conclusão, só OS, inclusive as ainda não pagas.</p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">{fmt(c.receitaOrdens)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-500">Diferença entre as duas</p>
                      <p className="text-[11px] text-slate-400">
                        Divergem de propósito: regime diferente (pagamento × conclusão), balcão só existe no caixa, e
                        OS concluída não paga já contou nas OS e ainda não contou no caixa.
                      </p>
                    </td>
                    <td className={`py-2.5 text-right tabular-nums font-semibold whitespace-nowrap ${Math.abs(c.diferencaReceita) < 0.01 ? 'text-slate-400' : 'text-amber-600'}`}>
                      {fmt(c.diferencaReceita)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-700">Taxa de cartão: caixa × OS</p>
                      <p className="text-[11px] text-slate-400">
                        {fmt(c.taxaFinanceiro)} lançados no financeiro contra {fmt(c.taxaOrdens)} gravados nos
                        pagamentos das OS. O financeiro inclui a taxa das vendas de balcão; as OS, não.
                      </p>
                    </td>
                    <td className={`py-2.5 text-right tabular-nums font-semibold whitespace-nowrap ${Math.abs(c.diferencaTaxa) < 0.01 ? 'text-slate-400' : 'text-amber-600'}`}>
                      {fmt(c.diferencaTaxa)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-700">Despesas lançadas no financeiro</p>
                      <p className="text-[11px] text-slate-400">Tudo que virou despesa no período, de qualquer origem.</p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">{fmt(c.despesaFinanceiro)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-700">Do que o DRE reconhece como custo</p>
                      <p className="text-[11px] text-slate-400">Taxa de cartão + custo fixo + retirada.</p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">{fmt(c.despesaReconhecida)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-500">Fora do resultado</p>
                      <p className="text-[11px] text-slate-400">
                        Sobretudo compra de peça para estoque ({fmt(c.compraDePecas)}), que é dinheiro trocado por
                        prateleira e só vira custo quando a peça sai numa OS. Também entram aqui gasto variável e
                        boleto avulso já pago.
                      </p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-slate-500 whitespace-nowrap">{fmt(c.naoReconhecido)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3">
                      <p className="text-slate-700">Card "Lucro Líquido" no topo desta tela</p>
                      <p className="text-[11px] text-slate-400">
                        Receitas menos TODAS as despesas lançadas. É o caixa do período — não bate com o resultado do
                        DRE ({semFixo ? '—' : fmt(dados.resultado)}) e não deveria: aquele mede quanto dinheiro sobrou,
                        este mede quanto a operação lucrou.
                      </p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">{fmt(c.lucroFinanceiro)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

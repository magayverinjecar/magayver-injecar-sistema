import { useMemo } from 'react'
import { Target, AlertTriangle, Timer, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { margemDoPeriodo, custoFixoMensal, mesesDoIntervalo, pontoDeEquilibrio, custoDaHora } from '../utils/margem'
import { dentroDoPeriodo } from '../utils/periodo'
import { capacidadeDoConfig, problemasDaCapacidade } from '../utils/capacidade'
import { parseDataBR } from '../utils/datas'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

function Aviso({ children, tom = 'amber' }) {
  const cls = tom === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-slate-50 border-slate-200 text-slate-600'
  const Icone = tom === 'amber' ? AlertTriangle : Info
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 ${cls}`}>
      <Icone size={14} className="flex-shrink-0 mt-0.5 opacity-70" />
      <p className="text-xs leading-snug">{children}</p>
    </div>
  )
}

// Ponto de equilíbrio do período: a oficina trabalhou de graça ou sobrou?
//
// Fecha o ciclo que a margem por OS deixa aberto de propósito. Lá o custo fixo
// não é rateado — com salário fixo não existe hora apontada para dividir, e
// ratear no chute daria um número preciso e errado. Aqui ele entra onde é
// verdade: no mês inteiro, contra a SOMA das margens de contribuição.
//
// É por isso que a comparação existe. Caixa cheio não significa lucro: se a soma
// das margens não cobrir o aluguel, a energia e o salário, o mês fechou no
// vermelho mesmo com movimento.
export default function PontoDeEquilibrio({ intervalo }) {
  const { ordens, estoque, totalOrdem, gastos, config } = useApp()

  const meses = mesesDoIntervalo(intervalo)

  // OS que já viraram receita no período. Orçamento aberto e carro em execução
  // não entram: não há margem realizada até o serviço estar concluído.
  //
  // A data é a da CONCLUSÃO — é quando o serviço deixou de ser trabalho em curso
  // e virou resultado. Cair no `data`/`dataEntrada` só serve para as OS antigas
  // migradas, que não têm conclusão gravada.
  const ordensDoPeriodo = useMemo(() => (ordens || []).filter(o => {
    if (!['Concluída', 'Entregue'].includes(o.status)) return false
    const quando = o.dataConclusao || o.data || o.dataEntrada || ''
    return dentroDoPeriodo(quando, intervalo)
  }), [ordens, intervalo])

  const resultado = useMemo(
    () => margemDoPeriodo(ordensDoPeriodo, { estoque, totalOrdem }),
    [ordensDoPeriodo, estoque, totalOrdem],
  )

  const custoFixoPeriodo = custoFixoMensal(gastos, intervalo)
  const custoFixoMes = custoFixoMensal(gastos)
  const pe = pontoDeEquilibrio(resultado.margem, custoFixoPeriodo)

  const cap = capacidadeDoConfig(config)
  const faltaCapacidade = problemasDaCapacidade(cap)
  const { horasVendaveis, custoHora } = custoDaHora({
    custoFixo: custoFixoMes,
    mecanicos: cap.reparadores,
    horasPorDia: cap.horasPorDia,
    diasUteis: cap.diasUteis,
    ocupacao: cap.ocupacao,
  })

  // Gasto fixo pontual sem data não pode ser colocado em mês nenhum, então fica
  // de fora da conta. Silenciosamente ele viraria um buraco no custo fixo.
  const fixosSemData = (gastos || []).filter(
    g => g?.tipo === 'Fixo' && !g.recorrente && !parseDataBR(g.vencimento),
  ).length

  const cabecalho = (
    <div className="px-5 py-4 border-b border-slate-100">
      <h2 className="font-semibold text-slate-800 flex items-center gap-2">
        <Target size={17} className="text-emerald-500" />Ponto de equilíbrio · {intervalo.rotulo}
      </h2>
      <p className="text-xs text-slate-500 mt-1">
        O que sobrou dos serviços já cobre as contas fixas do período?
      </p>
    </div>
  )

  // "Tudo" não tem quantos meses de aluguel comparar — o número sairia arbitrário.
  if (meses == null) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {cabecalho}
        <div className="p-5">
          <Aviso tom="slate">
            O ponto de equilíbrio é uma conta de mês fechado: custo fixo do período contra a
            margem do mesmo período. Em <strong>"Tudo"</strong> não há quantos meses de aluguel
            somar. Escolha "Este mês", "Mês passado" ou um intervalo com datas.
          </Aviso>
        </div>
      </div>
    )
  }

  if (custoFixoPeriodo <= 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {cabecalho}
        <div className="p-5">
          <Aviso>
            Nenhum gasto fixo cadastrado no período ({intervalo.rotulo}). Sem isso não existe ponto de
            equilíbrio — mostrar "R$ 0,00 para empatar" diria que a oficina já lucrou, o que é
            falso: o aluguel vence de qualquer jeito. Cadastre aluguel, energia e salário em{' '}
            <strong>Gastos</strong> com o tipo <strong>"Fixo"</strong>.
          </Aviso>
        </div>
      </div>
    )
  }

  // Barra de cobertura — trava em 100% para o "passou do ponto" não estourar a caixa.
  const larguraBarra = Math.max(0, Math.min(100, pe.cobertura ?? 0))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {cabecalho}

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500">Custo fixo do período</p>
            <p className="text-xl font-bold text-red-500 tabular-nums mt-0.5">{fmt(pe.custoFixo)}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {meses === 1 ? '1 mês de contas fixas' : `${meses} meses de contas fixas`}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500">Margem de contribuição</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums mt-0.5">{fmt(pe.margem)}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {resultado.ordens} OS concluída{resultado.ordens === 1 ? '' : 's'} no período
            </p>
          </div>
          <div className={`rounded-lg px-4 py-3 ${pe.atingido ? 'bg-green-50' : 'bg-orange-50'}`}>
            <p className="text-xs text-slate-500">{pe.atingido ? 'Passou do ponto' : 'Falta para empatar'}</p>
            <p className={`text-xl font-bold tabular-nums mt-0.5 ${pe.atingido ? 'text-green-600' : 'text-orange-600'}`}>
              {fmt(pe.atingido ? pe.sobra : pe.falta)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {pe.cobertura != null && `${num(pe.cobertura)}% do custo fixo coberto`}
            </p>
          </div>
        </div>

        <div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pe.atingido ? 'bg-green-500' : 'bg-orange-400'}`}
              style={{ width: `${larguraBarra}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-snug">
            {pe.atingido
              ? <>As contas fixas do período já estão pagas. Cada real de margem daqui em diante é lucro.</>
              : <>Até aqui os serviços cobriram {num(pe.cobertura)}% das contas fixas. Enquanto a barra não fecha, a oficina está trabalhando para pagar a estrutura — mesmo com o caixa movimentado.</>}
          </p>
        </div>

        {/* Custo da hora: o mesmo custo fixo, olhando para frente. */}
        <div className="border-t border-slate-100 pt-4">
          {faltaCapacidade.length > 0 ? (
            <Aviso>
              <strong>Custo da hora indisponível.</strong> Falta preencher em Configurações →
              Capacidade da oficina: {faltaCapacidade.join(' · ')}. É o que diz quanto a hora
              precisa render para pagar esta mesma estrutura.
            </Aviso>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Timer size={17} className="text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-700">
                  Custo da hora: <strong className="text-emerald-600 tabular-nums">{fmt(custoHora)}</strong>
                  <span className="text-slate-400"> / hora</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug tabular-nums">
                  {fmt(custoFixoMes)} por mês ÷ {num(horasVendaveis)} horas vendáveis. É o piso do preço:
                  cobrar isso empata a estrutura e não deixa lucro. O ponto de equilíbrio acima é o mesmo
                  custo olhando para trás; este é olhando para frente, na hora de fazer o orçamento.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-600 leading-snug">
            <strong>A margem acima NÃO desconta aluguel, energia nem salário.</strong> Ela é o que cada
            serviço deixou depois de pagar as peças e a taxa do cartão — os custos que são daquela OS.
            Com salário fixo o mecânico custa o mesmo tendo levado 2 ou 8 horas no carro, então esse
            custo não é de nenhuma OS: é do mês. Por isso ele aparece aqui, inteiro, de um lado da
            comparação — e não picado dentro de cada serviço.
          </p>
        </div>

        {resultado.comLacuna > 0 && (
          <Aviso>
            {resultado.comLacuna} de {resultado.ordens} OS têm margem incompleta (peça sem preço de custo,
            taxa de cartão não calculada ou OS sem itens lançados). Todas erram para o mesmo lado, o
            otimista: a margem real é <strong>menor</strong> que a mostrada, e o ponto de equilíbrio está
            mais longe do que parece.
          </Aviso>
        )}

        {fixosSemData > 0 && (
          <Aviso>
            {fixosSemData} gasto{fixosSemData === 1 ? '' : 's'} fixo{fixosSemData === 1 ? '' : 's'} não
            recorrente{fixosSemData === 1 ? '' : 's'} sem data de vencimento ficou de fora: sem data não dá
            para saber a que mês pertence. Preencha a data em Gastos, ou marque como recorrente se ele se
            repete todo mês.
          </Aviso>
        )}
      </div>
    </div>
  )
}

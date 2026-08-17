import { TrendingUp, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { margemDaOrdem } from '../utils/margem'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Percentual de margem passa de qualquer escala quando o desconto quase zera a
// OS (−799900% é ruído, não informação).
function pct(v) {
  if (!Number.isFinite(v)) return '—'
  if (v < -999) return '< −999%'
  if (v > 999) return '> 999%'
  return String(v).replace('.', ',') + '%'
}

function Aviso({ children }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-800 leading-snug">{children}</p>
    </div>
  )
}

// Quanto sobrou deste serviço.
//
// Margem de CONTRIBUIÇÃO: o que o cliente pagou menos os custos que são deste
// serviço — peças e taxa de cartão. O custo fixo da oficina (aluguel, energia,
// salário) não é rateado aqui de propósito: com salário fixo, o mecânico custa
// o mesmo tendo levado 2 ou 8 horas no carro, e não existe apontamento de hora
// para dividir isso com honestidade. Ratear no chute daria um número preciso e
// errado. O custo fixo é comparado com a soma das margens no fim do mês.
//
// Fica atrás de um clique porque é informação de dono, e a tela da OS é usada
// na frente do cliente.
export default function MargemDaOS({ os, total }) {
  const { estoque, totalOrdem } = useApp()
  // `temPermissao` só enxerga menus; as flags soltas (ver preços, ver
  // financeiro) são expostas à parte pelo AuthContext.
  const { podeVerPrecos } = useAuth()
  const [aberto, setAberto] = useState(false)

  // Mesma permissão que já esconde valor de custo do reparador.
  if (!podeVerPrecos) return null
  if (!(total > 0)) return null

  const m = margemDaOrdem(os, { estoque, totalOrdem })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button onClick={() => setAberto(v => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <TrendingUp size={15} className="text-green-600" />
          Quanto sobrou deste serviço
        </span>
        <span className="flex items-center gap-2">
          {aberto && (
            <span className={`text-sm font-bold tabular-nums ${m.margem >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(m.margem)}
            </span>
          )}
          {aberto ? <EyeOff size={15} className="text-slate-400" /> : <Eye size={15} className="text-slate-400" />}
        </span>
      </button>

      {aberto && (
        <div className="px-5 pb-4 space-y-2">
          <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente pagou</span>
              <span className="tabular-nums text-slate-700">{fmt(m.receita)}</span>
            </div>
            {m.custoPecas > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Custo das peças</span>
                <span className="tabular-nums text-red-500">− {fmt(m.custoPecas)}</span>
              </div>
            )}
            {m.taxaCartao > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Taxa do cartão</span>
                <span className="tabular-nums text-red-500">− {fmt(m.taxaCartao)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5 font-semibold">
              <span className="text-slate-700">Sobrou</span>
              <span className={`tabular-nums ${m.margem >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmt(m.margem)} <span className="font-normal text-slate-400">({pct(m.percentual)})</span>
              </span>
            </div>
          </div>

          {m.aguardandoPagamento && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-snug">
                Serviço ainda não cobrado. Se o cliente pagar no cartão, a taxa da maquininha
                sai daqui — a margem final vai ser menor que esta.
              </p>
            </div>
          )}

          {/* Todo aviso abaixo significa a mesma coisa: a margem real é MENOR
              que a exibida. Cada um pede uma ação diferente, por isso são
              separados — aviso genérico o dono aprende a ignorar. */}
          {m.semItens && (
            <Aviso>
              Esta OS não tem itens lançados — o valor veio do campo antigo. Não dá para saber
              quanto foi peça, então <strong>não há como calcular quanto sobrou</strong>. O número
              acima é o valor cheio, não a margem.
            </Aviso>
          )}

          {m.taxaPendente && (
            <Aviso>
              Foi pago no cartão, mas a taxa da máquina ainda não foi calculada — a margem real é
              menor. Cadastre a taxa em Configurações e use "Recalcular taxas" no Financeiro → Cartões.
            </Aviso>
          )}

          {m.pecasSemCusto > 0 && (
            <Aviso>
              {m.pecasSemCusto} peça(s) sem custo conhecido ficaram de fora — este valor é o{' '}
              <strong>máximo</strong> que sobrou, não o real.
              {m.motivosSemCusto.includes('naoCadastrado') && ' Cadastre o preço de custo no Estoque.'}
              {m.motivosSemCusto.includes('fora') && ' Uma delas não está mais no Estoque.'}
              {m.motivosSemCusto.includes('avulsa') && ' Uma delas foi digitada à mão, sem vínculo com o Estoque.'}
            </Aviso>
          )}

          <p className="text-[11px] text-slate-400 leading-snug">
            Não desconta aluguel, energia nem salário: esses são do mês inteiro, não deste carro.
            É o que este serviço deixou para pagar as contas da oficina.
          </p>
        </div>
      )}
    </div>
  )
}

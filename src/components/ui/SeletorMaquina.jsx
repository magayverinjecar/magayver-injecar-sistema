import { CreditCard, AlertTriangle, CalendarClock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { maquinasAtivas, enriquecerPagamento, PRAZOS } from '../../utils/cartao'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function dataLegivel(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Escolha da maquininha em qualquer tela que receba cartão.
//
// Substitui os botões "Na hora / 1 dia útil", que pediam à recepção uma
// informação que é da máquina, não da venda. Escolhida a máquina, o prazo vem
// junto — e a taxa aparece antes de confirmar, que é a única hora em que dá
// para perceber que se passou no cartão errado.
export default function SeletorMaquina({ valor, forma, parcelas, maquinaId, onSelecionar }) {
  const { config } = useApp()
  const maquinas = maquinasAtivas(config)

  if (maquinas.length === 0) {
    return (
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Nenhuma maquininha cadastrada — a taxa deste cartão não vai ser descontada.
          Cadastre em Configurações.
        </p>
      </div>
    )
  }

  const calc = enriquecerPagamento({ forma, valor, maquinaId, parcelas }, config)
  const escolhida = maquinas.find(m => String(m.id) === String(maquinaId))

  return (
    <div className="space-y-2">
      {maquinas.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {maquinas.map(m => {
            const ativa = String(m.id) === String(maquinaId)
            return (
              <button key={m.id} type="button" onClick={() => onSelecionar(m.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                  ativa ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                <CreditCard size={13} className="flex-shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{m.nome}</span>
                  <span className={`block text-[10px] font-normal ${ativa ? 'text-primary-500' : 'text-slate-400'}`}>
                    {PRAZOS[m.prazo]?.curto || ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {maquinas.length === 1 && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <CreditCard size={12} />{maquinas[0].nome} · {PRAZOS[maquinas[0].prazo]?.label}
        </p>
      )}

      {calc.taxaPendente ? (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-snug">
            {!escolhida
              ? 'Escolha a máquina para a taxa ser calculada.'
              : `Taxa desta modalidade ainda não cadastrada em "${escolhida.nome}". A venda entra pelo valor cheio e fica marcada para recalcular depois.`}
          </p>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Taxa da máquina ({String(calc.taxaPercentual).replace('.', ',')}%)
            </span>
            <span className="text-red-500 font-medium tabular-nums">− {fmt(calc.taxa)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <CalendarClock size={11} />
              {escolhida?.prazo === 'proximo_dia_util' ? `Cai em ${dataLegivel(calc.creditoEm)}` : 'Cai na conta hoje'}
            </span>
            <span className="text-green-600 font-semibold tabular-nums">{fmt(calc.liquido)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

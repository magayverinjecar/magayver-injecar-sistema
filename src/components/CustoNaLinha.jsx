import { useState } from 'react'
import { parseValorBR } from '../utils/numero'
import { vendaPelaMargem, mostrarMargem } from '../utils/margemPeca'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// O campo amarelo da peça avulsa sem preço (as que vêm do "Lançar no
// orçamento"): a pessoa digita o CUSTO e, enquanto digita, já vê a venda que
// vai sair com a margem da oficina. Enter ou sair do campo grava os dois.
// Em branco não grava nada — a linha continua pedindo.
export default function CustoNaLinha({ descricao, margem, onSalvar }) {
  const [texto, setTexto] = useState('')
  const custo = parseValorBR(texto)
  const venda = vendaPelaMargem(custo, margem)

  function salvar() {
    if (custo > 0) onSalvar(texto.trim())
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <input type="text" inputMode="decimal" placeholder="custo" value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={e => { if (e.key === 'Enter') salvar() }}
        aria-label={`Custo de ${descricao}`}
        title={`Digite quanto a peça custa e aperte Enter: a venda sai com ${mostrarMargem(margem)}% em cima`}
        className="w-24 text-right border border-amber-300 bg-amber-50 rounded-md px-2 py-1 text-sm placeholder:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300" />
      <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
        {venda > 0 ? <>venda <strong className="font-semibold text-slate-600">{fmt(venda)}</strong></> : `+${mostrarMargem(margem)}% = venda`}
      </span>
    </span>
  )
}

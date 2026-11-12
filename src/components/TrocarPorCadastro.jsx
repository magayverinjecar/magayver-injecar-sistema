import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { parseValorBR } from '../utils/numero'
import { pecaAtiva, casaBusca } from '../utils/pecas'
import { buscaInicialDaTroca } from '../utils/trocaPeca'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A busca que abre embaixo da peça avulsa quando se clica em "Trocar por peça
// do cadastro". Mesmas colunas do painel de adicionar (código, disponível,
// custo, venda), para escolher sem sair da linha. Escolheu, troca.
export default function TrocarPorCadastro({ avulsa, estoque = [], reservadoDe = () => 0, onEscolher, onCancelar }) {
  const [busca, setBusca] = useState(() => buscaInicialDaTroca(avulsa?.descricao))
  const lista = estoque.filter(p => pecaAtiva(p) && casaBusca(p, busca))
  const temPreco = parseValorBR(avulsa?.valorUnitario) > 0

  return (
    <div className="border border-primary-200 bg-primary-50/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">
          Trocar <span className="text-orange-700">{avulsa?.descricao}</span> por uma peça do cadastro
        </p>
        <button type="button" onClick={onCancelar}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg px-2 py-1 transition-colors">
          <X size={13} />Cancelar
        </button>
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
          aria-label="Buscar peça do cadastro" placeholder="Nome ou código da peça"
          className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div className="border border-slate-200 rounded-lg bg-white max-h-64 overflow-y-auto divide-y divide-slate-100">
        {lista.map(p => {
          const saldo = Number(p.estoque) || 0
          const disp = saldo - reservadoDe(p.id)
          return (
            <button key={p.id} type="button" onClick={() => onEscolher(p)}
              className="w-full text-left px-3 py-2 hover:bg-primary-50 transition-colors sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_5rem_6rem_6rem] sm:items-center sm:gap-2">
              <span className="block text-sm font-medium text-slate-800 break-words">{p.nome}</span>
              <span className="mt-0.5 sm:mt-0 flex flex-wrap gap-x-3 text-xs text-slate-500 sm:contents">
                <span className="font-mono sm:truncate">{p.codigo || '—'}</span>
                <span className={`font-medium sm:text-right tabular-nums ${disp > 0 ? 'text-green-600' : 'text-red-500'}`}>{disp} disp.</span>
                <span className="sm:text-right tabular-nums">{parseValorBR(p.precoCusto) > 0 ? `custo ${fmt(parseValorBR(p.precoCusto))}` : 'sem custo'}</span>
                <span className="sm:text-right tabular-nums font-semibold text-slate-700">{fmt(parseValorBR(p.preco))}</span>
              </span>
            </button>
          )
        })}
        {lista.length === 0 && (
          <p className="text-xs text-slate-400 px-3 py-4 text-center">
            {busca ? `Nada no cadastro com "${busca}". Apague e tente outra palavra ou o código.` : 'Nada no cadastro.'}
          </p>
        )}
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        A peça escolhida entra no lugar desta, com a mesma quantidade.{' '}
        {temPreco
          ? <>O preço do orçamento continua ({fmt(parseValorBR(avulsa.valorUnitario))}).</>
          : <>Esta linha está sem preço: entra o preço do cadastro.</>}
        {' '}A partir daí ela conta no estoque: reservada até a aprovação, baixada depois.
      </p>
    </div>
  )
}

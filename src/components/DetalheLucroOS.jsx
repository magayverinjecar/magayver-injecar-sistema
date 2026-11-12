import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { detalheDaOS } from '../utils/lucroPorOS'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Peça por peça de uma OS: o custo de cada uma é o que vai para o fornecedor.
// Os números somam exatamente a linha de cima (mesma conta, utils/lucroPorOS).
export default function DetalheLucroOS({ os, linha, estoque, onAbrir }) {
  const { pecas, servicos } = useMemo(() => detalheDaOS(os, { estoque }), [os, estoque])
  const qtd = (q) => Number(q).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
      {pecas.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700 mb-1">Peças</p>
          {/* Celular: uma linha por peça — numa tabela de 6 colunas a do
              fornecedor, que é a que importa aqui, ficava fora da tela. */}
          <ul className="sm:hidden divide-y divide-slate-50 text-xs">
            {pecas.map((p, i) => (
              <li key={p.id ?? i} className="py-1.5">
                <p className="text-slate-700">
                  {qtd(p.quantidade)}x {p.descricao}
                  {p.avulsa && <span className="ml-1 text-[10px] px-1 py-0.5 rounded border border-slate-200 text-slate-400">avulsa</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 tabular-nums">
                  {p.custo == null
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sem custo lançado</span>
                    : <span className="text-amber-700 font-semibold">fornecedor {num(p.custo)}</span>}
                  <span className="text-slate-500">venda {num(p.venda)}</span>
                  {p.lucro != null && <span className={p.lucro >= 0 ? 'text-green-700' : 'text-red-600'}>lucro {num(p.lucro)}</span>}
                </p>
              </li>
            ))}
            <li className="pt-1.5 font-semibold tabular-nums flex flex-wrap gap-x-3">
              <span className="text-slate-500">Total:</span>
              <span className="text-amber-700">fornecedor {num(linha.custoPecas)}</span>
              <span className="text-slate-700">lucro {num(linha.lucroPecas)}</span>
            </li>
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs min-w-[30rem]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="text-left font-semibold py-1">Peça</th>
                  <th className="text-right font-semibold py-1 px-2">Qtd</th>
                  <th className="text-right font-semibold py-1 px-2">Custo un.</th>
                  <th className="text-right font-semibold py-1 px-2 text-amber-700">Fornecedor</th>
                  <th className="text-right font-semibold py-1 px-2">Venda</th>
                  <th className="text-right font-semibold py-1">Lucro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pecas.map((p, i) => (
                  <tr key={p.id ?? i}>
                    <td className="py-1.5 text-slate-700">
                      {p.descricao}
                      {p.avulsa && <span className="ml-1 text-[10px] px-1 py-0.5 rounded border border-slate-200 text-slate-400">avulsa</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-slate-500">{qtd(p.quantidade)}</td>
                    {p.custo == null ? (
                      <td colSpan={2} className="py-1.5 px-2 text-right">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sem custo lançado</span>
                      </td>
                    ) : (
                      <>
                        <td className="py-1.5 px-2 text-right tabular-nums text-slate-500">{num(p.custoUnit)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-amber-700">{num(p.custo)}</td>
                      </>
                    )}
                    <td className="py-1.5 px-2 text-right tabular-nums text-slate-700">{num(p.venda)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${p.lucro == null ? 'text-slate-400' : p.lucro >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {p.lucro == null ? '—' : num(p.lucro)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold">
                  <td colSpan={3} className="py-1.5 text-right text-slate-500">Total das peças</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-amber-700">{num(linha.custoPecas)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-slate-700">{num(pecas.reduce((s, p) => s + p.venda, 0))}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-700">{num(linha.lucroPecas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Esta OS não tem peça.</p>
      )}

      {servicos.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 mb-1">Mão de obra</p>
          <ul className="divide-y divide-slate-50 text-xs">
            {servicos.map((s, i) => (
              <li key={s.id ?? i} className="flex justify-between gap-3 py-1.5">
                <span className="text-slate-700">{s.descricao}{s.quantidade !== 1 ? ` (${qtd(s.quantidade)}x)` : ''}</span>
                <span className="tabular-nums text-slate-700">{num(s.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-600">
          Do fornecedor: <strong className="text-amber-700 tabular-nums">{fmt(linha.custoPecas)}</strong>
          <span className="text-slate-300"> · </span>
          Sobrou: <strong className={`tabular-nums ${linha.sobrou >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(linha.sobrou)}</strong>
          {linha.taxaCartao > 0 && <span className="text-slate-400"> (já sem a taxa do cartão, {fmt(linha.taxaCartao)})</span>}
        </p>
        <button type="button" onClick={onAbrir}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 border border-primary-200 bg-white rounded-lg px-2.5 py-1">
          <ExternalLink size={12} />Abrir OS
        </button>
      </div>
    </div>
  )
}

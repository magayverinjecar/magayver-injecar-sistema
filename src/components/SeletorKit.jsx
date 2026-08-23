import { useState } from 'react'
import { Package, ChevronDown, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { kitsDoConfig, montarItensDoKit, pecaSemEstoque, totalDoKit } from '../utils/kits'

// Botão "Aplicar kit" — o mesmo na OS e no Orçamento avulso.
//
// Ele monta os itens com o preço de hoje e entrega prontos para quem chamou:
// a OS lança pelo adicionarItemOrdem (que dá baixa no estoque), o orçamento
// pelo caminho dele. Assim a regra do kit é uma só e as duas telas não podem
// divergir.

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SeletorKit({ onAplicar, desabilitado = false, titulo = '' }) {
  const { config, servicos, estoque, reservadoDe } = useApp()
  const kits = kitsDoConfig(config)
  const [aberto, setAberto] = useState(false)

  function escolher(kit) {
    setAberto(false)
    const { itens, faltando } = montarItensDoKit(kit, { servicos, estoque, reservadoDe })
    if (!itens.length) {
      alert(`O kit "${kit.nome}" está vazio.`)
      return
    }
    onAplicar({ kit, itens, faltando })
  }

  return (
    <div className="relative flex-shrink-0">
      <button type="button" onClick={() => setAberto(v => !v)} disabled={desabilitado} aria-expanded={aberto}
        title={titulo}
        className="flex items-center gap-1.5 border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
        <Package size={15} />Aplicar kit<ChevronDown size={14} />
      </button>

      {aberto && (
        <>
          {/* Mesma mecânica dos outros menus da OS: clique fora fecha */}
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-100 z-20">
            <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase sticky top-0 bg-white border-b border-slate-50">
              Kits salvos
            </p>

            {kits.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-400 text-center">
                Nenhum kit criado.<br />
                <span className="text-xs">Crie em <strong>Estoque &gt; Kits</strong>.</span>
              </p>
            ) : kits.map(kit => {
              const linhas = kit.itens || []
              const total = totalDoKit(kit, servicos, estoque)
              const faltam = linhas.filter(l => l.tipo === 'peca' && pecaSemEstoque(estoque, l.produtoId)).length
              return (
                <button key={kit.id} type="button" onClick={() => escolher(kit)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 break-words">{kit.nome}</span>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0">{fmt(total)}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {linhas.length} {linhas.length === 1 ? 'item' : 'itens'}
                  </span>
                  {faltam > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-medium mt-0.5">
                      <AlertTriangle size={12} className="flex-shrink-0" />
                      {faltam} sem estoque
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

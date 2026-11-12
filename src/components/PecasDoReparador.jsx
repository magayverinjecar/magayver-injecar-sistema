import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { pecasPorArea, textoDasPecas } from '../utils/pecasPorArea'

// Copia o texto. No celular antigo ou fora do https a API nova pode faltar;
// aí vai pelo jeito antigo, com um campo escondido.
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const campo = document.createElement('textarea')
      campo.value = texto
      campo.setAttribute('readonly', '')
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      const ok = document.execCommand('copy')
      campo.remove()
      return ok
    } catch {
      return false
    }
  }
}

// As peças que o reparador pediu, separadas pela área da avaliação, com o
// botão de copiar a lista inteira (o carro vai junto, para o fornecedor).
// Quando nenhuma peça tem área (OS antiga), mostra a lista corrida de sempre.
export default function PecasDoReparador({ pecas, carro, titulo = 'Peças que o reparador pediu', classeTitulo = 'text-xs font-bold text-blue-800 uppercase tracking-wide' }) {
  const [copiado, setCopiado] = useState(false)
  const grupos = pecasPorArea(pecas)
  if (grupos.length === 0) return null
  const total = grupos.reduce((s, g) => s + g.pecas.length, 0)
  const comAreas = grupos.some(g => g.area)

  async function copiar() {
    const ok = await copiarTexto(textoDasPecas(grupos, carro))
    if (!ok) { alert('Não consegui copiar a lista neste aparelho.'); return }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const linha = (p, i) => (
    <li key={p.id ?? i} className="text-sm text-slate-700">
      <span className="font-semibold">{p.quantidade}x</span> {p.descricao}
    </li>
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={classeTitulo}>{titulo} ({total})</p>
        <button type="button" onClick={copiar} title="Copia a lista com o carro, para colar no WhatsApp do fornecedor"
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            copiado ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}>
          {copiado ? <><Check size={13} />Copiado</> : <><Copy size={13} />Copiar lista</>}
        </button>
      </div>
      {comAreas ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {grupos.map(g => (
            <div key={g.area || 'outras'}>
              <p className="text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 pb-0.5 mb-1">
                {g.area ? `${g.area} · ${g.nome}` : g.nome}
              </p>
              <ul className="space-y-0.5">{g.pecas.map(linha)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-0.5">{grupos[0].pecas.map(linha)}</ul>
      )}
    </div>
  )
}

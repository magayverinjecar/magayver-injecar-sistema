import { PERIODOS } from '../../utils/periodo.js'

// Seletor de período das telas de dinheiro.
//
// Controlado de propósito: quem chama guarda a escolha e monta o intervalo com
// `intervaloDe`. Assim a mesma barra serve o Financeiro e o painel de cartões
// sem cada tela reinventar o cálculo de datas — que era exatamente o que estava
// duplicado antes.
export default function SeletorPeriodo({ periodo, datas, onChange, opcoes, className = '' }) {
  const lista = opcoes?.length ? PERIODOS.filter(p => opcoes.includes(p.chave)) : PERIODOS
  const { de = '', ate = '' } = datas || {}

  function escolher(chave) {
    onChange(chave, { de, ate })
  }

  function mudarData(campo, valor) {
    // Mexer numa data já significa "quero o período personalizado".
    onChange('custom', { de, ate, [campo]: valor })
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {lista.map(p => (
          <button key={p.chave} type="button" onClick={() => escolher(p.chave)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              periodo === p.chave ? 'bg-primary-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {periodo === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-slate-500">De</label>
          <input type="date" value={de} onChange={e => mudarData('de', e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <label className="text-sm text-slate-500">até</label>
          <input type="date" value={ate} onChange={e => mudarData('ate', e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          {!de && !ate && (
            <span className="text-xs text-slate-400">Sem datas escolhidas — mostrando o mês corrente.</span>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Merge, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { gruposDuplicados, sugerirVencedora, pecaAtiva } from '../utils/pecas'

const fmt = (v) => 'R$ ' + Number(String(v ?? '0').replace(/\./g, '').replace(',', '.') || 0)
  .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A mesma peça cadastrada várias vezes com o mesmo código.
//
// Aconteceu porque o cadastro nunca bloqueou código repetido: sete cadastros da
// mesma vela, cinco do mesmo filtro de cabine. O saldo real fica espalhado, o
// alerta de mínimo dispara errado e a busca mostra a peça três vezes.
//
// Juntar NÃO apaga: o saldo das outras é transferido por movimento (o extrato
// conta a história) e elas ficam desativadas apontando para a que ficou. As OS,
// os orçamentos e os kits antigos continuam funcionando.
export default function AbaDuplicadas() {
  const { estoque, juntarPecas } = useApp()
  const [busca, setBusca] = useState('')
  const [escolhas, setEscolhas] = useState({})   // codigo -> id da peça que fica
  const [juntando, setJuntando] = useState(null)
  const [feitos, setFeitos] = useState([])

  const grupos = useMemo(() => {
    return gruposDuplicados(estoque.filter(pecaAtiva))
      .filter(g => !feitos.includes(g.codigo))
  }, [estoque, feitos])

  const filtrados = grupos.filter(g => {
    if (!busca.trim()) return true
    const alvo = `${g.codigoOriginal} ${g.pecas.map(p => p.nome).join(' ')}`.toLowerCase()
    return alvo.includes(busca.toLowerCase())
  })

  const totalLinhasExtras = grupos.reduce((s, g) => s + g.pecas.length - 1, 0)

  async function juntar(g) {
    const vencedoraId = escolhas[g.codigo] ?? sugerirVencedora(g.pecas)?.id
    const vencedora = g.pecas.find(p => String(p.id) === String(vencedoraId))
    const perdedoras = g.pecas.filter(p => String(p.id) !== String(vencedoraId))
    const texto = `Juntar ${g.pecas.length} cadastros do código ${g.codigoOriginal}?\n\n`
      + `FICA:  ${vencedora.nome} — saldo passa a ser ${g.saldoTotal}\n\n`
      + `SAEM (desativadas, mas continuam no histórico):\n`
      + perdedoras.map(p => `• ${p.nome} (saldo ${p.estoque || 0})`).join('\n')
      + `\n\nO extrato de cada peça vai registrar a transferência.`
    if (!confirm(texto)) return
    setJuntando(g.codigo)
    try {
      const res = await juntarPecas(vencedoraId, perdedoras.map(p => p.id))
      if (res?.ok === false) {
        alert('Não deu para juntar: ' + (res.motivo || 'erro desconhecido'))
        return
      }
      setFeitos(prev => [...prev, g.codigo])
    } finally {
      setJuntando(null)
    }
  }

  if (grupos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 py-14 text-center">
        <CheckCircle2 size={32} className="mx-auto mb-3 text-green-500" />
        <p className="text-sm font-medium text-slate-700">Nenhum código duplicado.</p>
        <p className="text-xs text-slate-400 mt-1">
          Cada peça tem um cadastro só — o saldo de cada uma fecha com a prateleira.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          <strong>{grupos.length} {grupos.length === 1 ? 'código repetido' : 'códigos repetidos'}</strong>, somando{' '}
          <strong>{totalLinhasExtras} {totalLinhasExtras === 1 ? 'cadastro a mais' : 'cadastros a mais'}</strong> do que deveria existir.
          O saldo de cada peça está dividido entre eles. Juntar soma os saldos num cadastro só e desativa os outros —
          nada é apagado, e o extrato registra a transferência.
        </span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar por código ou nome..." value={busca} onChange={e => setBusca(e.target.value)}
          className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-72" />
      </div>

      <div className="space-y-3">
        {filtrados.map(g => {
          const vencedoraId = String(escolhas[g.codigo] ?? sugerirVencedora(g.pecas)?.id)
          return (
            <div key={g.codigo} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-700">{g.codigoOriginal}</span>
                  <span className="text-xs text-slate-400">{g.pecas.length} cadastros</span>
                  {g.nomesIguais
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">nomes iguais</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">nomes diferentes — confira</span>}
                </div>
                <button onClick={() => juntar(g)} disabled={juntando === g.codigo}
                  className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  <Merge size={14} />{juntando === g.codigo ? 'Juntando…' : `Juntar (saldo ${g.saldoTotal})`}
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {g.pecas.map(p => {
                  const fica = String(p.id) === vencedoraId
                  return (
                    <label key={p.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${fica ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}>
                      <input type="radio" name={`fica-${g.codigo}`} checked={fica}
                        onChange={() => setEscolhas(e => ({ ...e, [g.codigo]: p.id }))}
                        className="accent-primary-500" />
                      <span className="flex-1 min-w-0">
                        <span className={`text-sm ${fica ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{p.nome}</span>
                        {fica && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">fica</span>}
                        {p.categoria && <span className="ml-2 text-xs text-slate-400">{p.categoria}</span>}
                      </span>
                      <span className="text-sm tabular-nums text-slate-600 whitespace-nowrap">{Number(p.estoque) || 0} un.</span>
                      <span className="text-xs tabular-nums text-slate-400 whitespace-nowrap w-24 text-right">
                        custo {p.precoCusto ? fmt(p.precoCusto) : '—'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {filtrados.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-8">Nenhum grupo com esse termo.</p>
      )}
    </div>
  )
}

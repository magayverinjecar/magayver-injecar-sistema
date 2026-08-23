import { useState, useEffect, useMemo } from 'react'
import { Search, RefreshCw, History } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { TIPOS_MOV, rotuloDoTipo, rotuloDaOrigem, mensagemErroExtrato } from '../utils/movimentos'

const POR_PAGINA = 300

// Cor do "chip" de tipo: entrada esverdeada, saída avermelhada, ajuste neutro.
const COR_TIPO = {
  entrada_compra: 'bg-green-50 text-green-700',
  estorno_os: 'bg-green-50 text-green-700',
  estorno_venda: 'bg-green-50 text-green-700',
  saldo_inicial: 'bg-green-50 text-green-700',
  saida_os: 'bg-red-50 text-red-600',
  saida_venda: 'bg-red-50 text-red-600',
  estorno_compra: 'bg-red-50 text-red-600',
  ajuste: 'bg-slate-100 text-slate-600',
  fusao: 'bg-blue-50 text-blue-700',
}

// Visão geral do kardex: as últimas movimentações de TODAS as peças, lidas sob
// demanda da tabela estoque_mov (ela não fica sincronizada no app — é história,
// só cresce, e ninguém precisa dela carregada o dia inteiro).
export default function EstoqueMovimentacoes() {
  const { estoque } = useApp()
  const [movs, setMovs] = useState([])
  const [estado, setEstado] = useState('carregando') // carregando | erro | pronto
  const [erro, setErro] = useState('')
  const [fim, setFim] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('todos')

  const nomePorPeca = useMemo(() => {
    const m = new Map()
    for (const p of estoque) m.set(String(p.id), p)
    return m
  }, [estoque])

  async function buscarPagina(offset) {
    const { data, error } = await supabase
      .from('estoque_mov')
      .select('*')
      .order('criado_em', { ascending: false })
      .order('seq', { ascending: false })
      .range(offset, offset + POR_PAGINA - 1)
    if (error) throw error
    return data || []
  }

  async function carregar() {
    setEstado('carregando')
    try {
      const pagina = await buscarPagina(0)
      setMovs(pagina)
      setFim(pagina.length < POR_PAGINA)
      setEstado('pronto')
    } catch (e) {
      console.error('[movimentações] falha ao carregar:', e)
      setErro(mensagemErroExtrato(e))
      setEstado('erro')
    }
  }

  async function carregarMais() {
    if (carregandoMais || fim) return
    setCarregandoMais(true)
    try {
      const pagina = await buscarPagina(movs.length)
      // Movimento novo que entrou entre uma página e outra desloca o offset e
      // repetiria a última linha — descarta o que já está na tela.
      setMovs(prev => {
        const vistos = new Set(prev.map(m => m.id))
        return [...prev, ...pagina.filter(m => !vistos.has(m.id))]
      })
      setFim(pagina.length < POR_PAGINA)
    } catch (e) {
      console.error('[movimentações] falha ao carregar mais:', e)
      alert(mensagemErroExtrato(e))
    } finally {
      setCarregandoMais(false)
    }
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = movs.filter(m => {
    if (tipo !== 'todos' && m.tipo !== tipo) return false
    if (busca) {
      const peca = nomePorPeca.get(String(m.peca_id))
      const alvo = `${peca?.nome || ''} ${peca?.codigo || ''} ${m.peca_id} ${m.motivo || ''} ${rotuloDaOrigem(m)}`.toLowerCase()
      if (!alvo.includes(busca.toLowerCase())) return false
    }
    return true
  })

  const fmtData = (iso) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return '—' }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar peça, motivo, OS..." value={busca} onChange={e => setBusca(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
          </div>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="todos">Todos os tipos</option>
            {Object.entries(TIPOS_MOV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button onClick={carregar} className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <RefreshCw size={15} />Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {estado === 'carregando' && (
          <p className="text-center text-sm text-slate-400 py-12">Carregando as movimentações…</p>
        )}
        {estado === 'erro' && (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-red-500">{erro}</p>
            <button onClick={carregar} className="text-sm text-primary-600 hover:underline">Tentar de novo</button>
          </div>
        )}
        {estado === 'pronto' && movs.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <History size={32} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm">Nenhuma movimentação registrada ainda.</p>
            <p className="text-xs mt-1">O extrato conta a partir de agora: toda entrada, saída, estorno e ajuste aparece aqui.</p>
          </div>
        )}
        {estado === 'pronto' && movs.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Quando</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Peça</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo / Origem</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtrados.map(m => {
                    const peca = nomePorPeca.get(String(m.peca_id))
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{fmtData(m.criado_em)}</td>
                        <td className="px-5 py-3 text-sm font-medium text-slate-800">
                          {peca?.nome || <span className="text-slate-400 italic">peça removida ({m.peca_id})</span>}
                          {peca?.codigo && <span className="block text-xs font-normal text-slate-400 font-mono">{peca.codigo}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${COR_TIPO[m.tipo] || 'bg-slate-100 text-slate-600'}`}>
                            {rotuloDoTipo(m.tipo)}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-sm font-semibold text-right whitespace-nowrap ${Number(m.qtd) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Number(m.qtd) > 0 ? `+${m.qtd}` : m.qtd}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {rotuloDaOrigem(m) && <span className="text-slate-500">{rotuloDaOrigem(m)}</span>}
                          {rotuloDaOrigem(m) && m.motivo && <span className="text-slate-300"> · </span>}
                          {m.motivo && <span className="italic">{m.motivo}</span>}
                          {!rotuloDaOrigem(m) && !m.motivo && '—'}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{m.autor_nome || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtrados.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">Nada encontrado com esses filtros{fim ? '' : ' — nas movimentações já carregadas'}.</p>
            )}
            {!fim && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button onClick={carregarMais} disabled={carregandoMais}
                  className="text-sm text-primary-600 hover:underline disabled:text-slate-400">
                  {carregandoMais ? 'Carregando…' : 'Carregar movimentações mais antigas'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

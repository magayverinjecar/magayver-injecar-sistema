import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Wallet, Search, X, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { lucroPorOS, totaisDe, PERIODOS_RAPIDOS, intervaloRapido } from '../utils/lucroPorOS'
import { nomeVeiculo } from '../utils/datas'
import { casaBusca } from '../utils/busca'
import DetalheLucroOS from './DetalheLucroOS'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Lucro por OS — quanto cada serviço deixou de peça e de mão de obra, e quanto
// do dinheiro que entrou é do fornecedor (a regra mora em utils/lucroPorOS).
//
// Feita para o dono, que não lembra número de OS nem placa: abre em "Hoje",
// com botões de data (ontem, esta semana, este mês…), a lista das OS fechadas
// com cliente e carro à esquerda e, ao clicar numa, a OS peça por peça à
// direita. No celular o detalhe abre embaixo da OS clicada.
//
// Vive em duas portas: a página própria (/lucro-por-os, que abre numa aba
// nova, grande) e a aba "Lucro por OS" do Financeiro (`embutido`, com o botão
// de abrir a aba nova). As duas só para quem tem a permissão 'lucro-por-os'.
export default function LucroPorOSConteudo({ embutido = false }) {
  const { ordens, estoque, totalOrdem, getCliente, getVeiculo } = useApp()
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState('hoje')
  const [datas, setDatas] = useState({ de: '', ate: '' })
  const [busca, setBusca] = useState('')
  // A OS aberta no detalhe. Uma por vez.
  const [aberta, setAberta] = useState(null)

  const intervalo = useMemo(() => intervaloRapido(periodo, datas), [periodo, datas])
  const { linhas: todas } = useMemo(
    () => lucroPorOS(ordens, intervalo, { estoque, totalOrdem }),
    [ordens, intervalo, estoque, totalOrdem],
  )

  const osDe = (id) => (ordens || []).find(o => o.id === id)
  const veiculoDe = (id) => { const os = osDe(id); return os ? getVeiculo?.(os.veiculoId) : null }
  const carroDe = (id) => {
    const os = osDe(id)
    if (!os) return ''
    const v = veiculoDe(id)
    const nome = nomeVeiculo(v, os)
    return [nome !== '—' ? nome : '', v?.placa || os.placa || ''].filter(Boolean).join(' · ')
  }
  const clienteDe = (id) => {
    const os = osDe(id)
    return os ? (getCliente?.(os.clienteId)?.nome || '') : ''
  }

  // Busca por número, placa (com ou sem traço) ou cliente, dentro do período.
  // Os quadros somam só o que ficou na lista.
  const linhas = todas.filter(l => casaBusca(busca, [l.numero, clienteDe(l.id), carroDe(l.id)], [veiculoDe(l.id)?.placa, osDe(l.id)?.placa]))
  const totais = totaisDe(linhas)
  const filtrando = busca.trim() !== ''
  const selecionada = linhas.find(l => l.id === aberta) || null

  const escolherPeriodo = (chave) => { setPeriodo(chave); setAberta(null) }
  const abrirOS = (id) => navigate(`/ordens-servico/${encodeURIComponent(id)}`)
  const alternar = (id) => setAberta(a => (a === id ? null : id))
  const abrirAbaNova = () => window.open('/lucro-por-os', '_blank', 'noopener')

  const cartoes = [
    { label: 'Recebido', valor: totais.recebido, nota: totais.aPrazo > 0 ? `+ ${fmt(totais.aPrazo)} a receber` : `${linhas.length} ${linhas.length === 1 ? 'OS paga' : 'OS pagas'}`, cor: 'text-slate-800' },
    { label: 'Separar p/ fornecedor', valor: totais.custoPecas, nota: 'custo das peças', cor: 'text-amber-700', destaque: true },
    { label: 'Lucro nas peças', valor: totais.lucroPecas, nota: 'venda − custo', cor: 'text-slate-800' },
    { label: 'Mão de obra', valor: totais.maoDeObra, nota: 'serviços cobrados', cor: 'text-slate-800' },
    { label: 'Taxa do cartão', valor: totais.taxaCartao, nota: 'ficou na maquininha', cor: 'text-slate-800' },
    { label: 'Sobrou', valor: totais.sobrou, nota: 'para pagar a oficina', cor: totais.sobrou >= 0 ? 'text-green-700' : 'text-red-600' },
  ]

  const cabecalhoDaOS = (l) => (
    <div className="mb-2">
      <p className="text-sm font-bold text-slate-800">{l.numero || 'OS'} · {clienteDe(l.id) || 'cliente'}</p>
      <p className="text-xs text-slate-500">{carroDe(l.id) || '—'} · pago em {l.data || '—'} · valor {fmt(l.valor)}</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Botões de data */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS_RAPIDOS.map(p => (
          <button key={p.chave} type="button" onClick={() => escolherPeriodo(p.chave)} aria-pressed={periodo === p.chave}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              periodo === p.chave ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            {p.label}
          </button>
        ))}
        {embutido && (
          <button type="button" onClick={abrirAbaNova} title="Abre esta tela sozinha, numa aba nova do navegador"
            className="sm:ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors">
            <ExternalLink size={14} />Abrir numa aba nova
          </button>
        )}
      </div>
      {periodo === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-slate-500" htmlFor="lucro-de">De</label>
          <input id="lucro-de" type="date" value={datas.de} onChange={e => setDatas(d => ({ ...d, de: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
          <label className="text-slate-500" htmlFor="lucro-ate">até</label>
          <input id="lucro-ate" type="date" value={datas.ate} onChange={e => setDatas(d => ({ ...d, ate: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
        </div>
      )}

      {/* Quadros — somam o que está na lista */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {cartoes.map(c => (
          <div key={c.label} className={`rounded-xl p-4 shadow-sm border ${c.destaque ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <p className={`text-xs font-medium flex items-center gap-1 ${c.destaque ? 'text-amber-700' : 'text-slate-500'}`}>
              {c.destaque && <Wallet size={13} />}{c.label}
            </p>
            <p className={`text-lg font-bold tabular-nums mt-1 ${c.cor}`}>{fmt(c.valor)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{c.nota}</p>
          </div>
        ))}
      </div>

      {totais.comPecaSemCusto > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-snug">
            {totais.comPecaSemCusto === 1 ? '1 OS tem' : `${totais.comPecaSemCusto} OS têm`} peça sem custo lançado:
            o lucro dela aparece maior do que é, e o "separar p/ fornecedor" sai menor. Abra a OS e lance o custo da peça.
          </p>
        </div>
      )}

      {/* Lista à esquerda, OS escolhida à direita (no celular, embaixo dela) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input value={busca} onChange={e => { setBusca(e.target.value); setAberta(null) }}
                aria-label="Buscar OS, placa ou cliente" placeholder="Buscar OS, placa ou cliente"
                className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {filtrando && (
                <button type="button" onClick={() => { setBusca(''); setAberta(null) }} aria-label="Limpar a busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {linhas.length} {linhas.length === 1 ? 'OS paga' : 'OS pagas'} {filtrando ? `na busca (de ${todas.length})` : intervalo.rotulo}
              {linhas.length > 0 && ' · clique numa para ver peça por peça'}
            </p>
          </div>

          {linhas.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <TrendingUp size={26} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-600">
                {filtrando ? <>Nenhuma OS com “{busca.trim()}” {intervalo.rotulo}.</> : <>Nenhuma OS paga {intervalo.rotulo}.</>}
              </p>
              <p className="text-xs text-slate-400 mt-1">A OS entra aqui no dia em que é cobrada. Tente “Esta semana” ou “Este mês”.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 lg:max-h-[70vh] lg:overflow-y-auto">
              {linhas.map(l => {
                const ativa = aberta === l.id
                return (
                  <li key={l.id}>
                    <button type="button" onClick={() => alternar(l.id)} aria-expanded={ativa}
                      className={`w-full text-left px-4 py-3 transition-colors ${ativa ? 'bg-primary-50 lg:border-l-4 lg:border-primary-500 lg:pl-3' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm min-w-0">
                          <span className="font-semibold text-slate-800">{l.numero || 'OS'}</span>
                          <span className="text-slate-600"> · {clienteDe(l.id) || 'cliente'}</span>
                        </p>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${l.sobrou >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(l.sobrou)}</span>
                          <ChevronRight size={15} className="hidden lg:block text-slate-300" />
                          <ChevronDown size={15} className={`lg:hidden text-slate-300 transition-transform ${ativa ? 'rotate-180' : ''}`} />
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{carroDe(l.id) || '—'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        pago em {l.data || '—'} · valor {fmt(l.valor)} · <span className="text-amber-700">fornecedor {fmt(l.custoPecas)}</span>
                      </p>
                      {(l.pecasSemCusto > 0 || l.aPrazo > 0 || l.taxaPendente) && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {l.pecasSemCusto > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">peça sem custo</span>}
                          {l.aPrazo > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{fmt(l.aPrazo)} a prazo</span>}
                          {l.taxaPendente && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">taxa não calculada</span>}
                        </span>
                      )}
                    </button>
                    {ativa && (
                      <div className="lg:hidden px-3 pb-3 bg-primary-50/40">
                        <DetalheLucroOS os={osDe(l.id)} linha={l} estoque={estoque} onAbrir={() => abrirOS(l.id)} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-4">
          {selecionada ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              {cabecalhoDaOS(selecionada)}
              <DetalheLucroOS os={osDe(selecionada.id)} linha={selecionada} estoque={estoque} onAbrir={() => abrirOS(selecionada.id)} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center">
              <p className="text-sm text-slate-500">Clique numa OS da lista para ver peça por peça:</p>
              <p className="text-xs text-slate-400 mt-1">o custo de cada peça (o que é do fornecedor), a venda, o lucro e a mão de obra.</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-600">Sobrou</strong> = o que a OS cobrou − o custo das peças − a taxa do cartão.
        A mão de obra entra inteira: o salário é fixo e aparece no mês, no DRE, não em cada OS.
        O <strong className="text-amber-700">separar p/ fornecedor</strong> é o custo das peças destas OS — o dinheiro
        que entrou agora, mas que é dos boletos das peças. Orçamento recusado e OS cancelada não entram.
        {totais.descontoGeral > 0 && <> Descontos dados no fechamento: {fmt(totais.descontoGeral)}.</>}
      </p>
    </div>
  )
}

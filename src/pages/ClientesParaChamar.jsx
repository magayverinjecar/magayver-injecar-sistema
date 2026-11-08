import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageCircle, Phone, Car, Undo2, BellOff, CalendarClock, ExternalLink } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import {
  montarListaRevisao, linkWhatsApp, frasesDosServicos, novaChamada, anexarChamada,
  rotuloResultado, RESULTADOS,
} from '../utils/revisao'

// Clientes para chamar — quem fez revisão aqui e está na hora de voltar.
//
// A oficina vive do cliente que chega pelo anúncio; esta tela é o outro lado:
// chamar quem já confiou o carro uma vez. A regra de quem aparece mora em
// utils/revisao.js. Aqui é só a lista, o WhatsApp e a anotação do resultado.
//
// O envio é manual de propósito: a mensagem abre pronta no WhatsApp e a pessoa
// aperta enviar. Disparo automático para 30 clientes de uma vez é o que faz o
// número da oficina ser bloqueado.

const fmtData = (ts) => (ts ? new Date(ts).toLocaleDateString('pt-BR') : '—')

function textoVencimento(dias) {
  if (dias === 0) return 'vence hoje'
  if (dias > 0) return dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`
}

const ABAS = [
  { id: 'chamar', rotulo: 'Para chamar' },
  { id: 'futuro', rotulo: 'Próximos' },
  { id: 'chamado', rotulo: 'Já chamados' },
]

const COR_RESULTADO = {
  'agendou': 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100',
  'nao-quer': 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50',
  'nao-respondeu': 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50',
  'nao-incomodar': 'bg-white border-red-200 text-red-600 hover:bg-red-50',
}

export default function ClientesParaChamar() {
  const navigate = useNavigate()
  const { ordens, veiculos, setVeiculos, clientes, setClientes, servicos } = useApp()
  const { currentUser } = useAuth()
  const [aba, setAba] = useState('chamar')
  const [busca, setBusca] = useState('')
  // Linhas em que o WhatsApp já foi aberto nesta tela: o próximo passo é dizer
  // como foi, e os botões de resultado ganham destaque.
  const [abertos, setAbertos] = useState(() => new Set())
  // O "hoje" da lista é o momento em que a tela abriu.
  const [hoje] = useState(() => Date.now())

  const lista = useMemo(
    () => montarListaRevisao({ ordens, veiculos, clientes, servicos, hoje }),
    [ordens, veiculos, clientes, servicos, hoje],
  )

  const grupos = useMemo(() => {
    const g = { chamar: [], futuro: [], chamado: [], 'na-oficina': [], bloqueado: [] }
    for (const e of lista) g[e.situacao]?.push(e)
    // O que venceu há mais tempo vem primeiro; nos já chamados, o contato mais recente.
    g.chamado = [...g.chamado, ...g.bloqueado]
      .sort((a, b) => (b.ultimaChamada?.em || 0) - (a.ultimaChamada?.em || 0))
    return g
  }, [lista])

  const alvo = busca.trim().toLowerCase()
  const visiveis = (grupos[aba] || []).filter(e => !alvo
    || String(e.cliente?.nome || '').toLowerCase().includes(alvo)
    || String(e.placa || '').toLowerCase().replace(/\W/g, '').includes(alvo.replace(/\W/g, ''))
    || String(e.carro || '').toLowerCase().includes(alvo))

  function abrirWhatsApp(e) {
    const link = linkWhatsApp(e)
    if (!link) return
    window.open(link, '_blank')
    setAbertos(s => new Set(s).add(String(e.veiculoId)))
  }

  function registrar(e, resultado) {
    if (!e.veiculo) return
    const nome = e.cliente?.nome?.split(' ')[0] || 'Este cliente'
    if (resultado === 'nao-incomodar'
      && !confirm(`${nome} pediu para não receber lembretes?\n\nO cliente sai de todas as listas de chamada. Dá para desfazer em "Já chamados".`)) return
    const reg = novaChamada({ resultado, por: currentUser?.nome, osId: e.osUltima?.id })
    setVeiculos(prev => prev.map(v => String(v.id) === String(e.veiculoId) ? anexarChamada(v, reg) : v))
    if (resultado === 'nao-incomodar' && e.clienteId != null) {
      setClientes(prev => prev.map(c => String(c.id) === String(e.clienteId)
        ? { ...c, naoIncomodar: true, naoIncomodarEm: reg.em, naoIncomodarPor: reg.por }
        : c))
    }
    setAbertos(s => { const n = new Set(s); n.delete(String(e.veiculoId)); return n })
  }

  // Desfaz a última anotação deste carro. Clique errado em "não quer" tiraria o
  // cliente da lista sem ninguém perceber — por isso a volta fica à mão.
  //
  // Cliente bloqueado pode ter sido marcado por OUTRO carro dele: aqui só sai a
  // marca do cliente, e a anotação deste carro só se ela mesma for o bloqueio.
  function desfazer(e) {
    const ult = e.ultimaChamada
    const bloqueado = e.situacao === 'bloqueado'
    if (ult && (!bloqueado || ult.resultado === 'nao-incomodar')) {
      setVeiculos(prev => prev.map(v => String(v.id) === String(e.veiculoId)
        ? { ...v, chamadas: (v.chamadas || []).filter(c => c.em !== ult.em) }
        : v))
    }
    if (bloqueado && e.clienteId != null) {
      setClientes(prev => prev.map(c => {
        if (String(c.id) !== String(e.clienteId)) return c
        const resto = { ...c }
        delete resto.naoIncomodar
        delete resto.naoIncomodarEm
        delete resto.naoIncomodarPor
        return resto
      }))
    }
  }

  const naOficina = grupos['na-oficina'].length

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 max-w-3xl">
        Clientes que fizeram revisão aqui (óleo, bicos, velas, filtros, TBI) e completam 6 meses desde a última visita.
        O WhatsApp abre com a mensagem pronta; depois de enviar, marque como foi.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg w-full sm:w-auto">
          {ABAS.map(a => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                aba === a.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {a.rotulo} <span className="tabular-nums text-xs text-slate-400">({grupos[a.id].length})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Nome, placa ou carro..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-64" />
        </div>
      </div>

      <div className="space-y-2">
        {visiveis.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-slate-100">
            {alvo ? `Ninguém encontrado para "${busca}".`
              : aba === 'chamar' ? 'Ninguém para chamar agora. Os próximos estão na aba "Próximos".'
              : aba === 'futuro' ? 'Nenhum carro com revisão para vencer.'
              : 'Ninguém foi chamado ainda.'}
          </p>
        )}

        {visiveis.map(e => (
          <LinhaCliente key={String(e.veiculoId)} e={e} aba={aba}
            aberto={abertos.has(String(e.veiculoId))}
            onWhatsApp={() => abrirWhatsApp(e)}
            onResultado={(r) => registrar(e, r)}
            onDesfazer={() => desfazer(e)}
            onVerOS={() => navigate(`/ordens-servico/${encodeURIComponent(e.osRevisao.id)}`)} />
        ))}
      </div>

      <p className="text-[11px] text-slate-400">
        {lista.length} carros já fizeram revisão aqui
        {naOficina > 0 && <> · {naOficina} estão na oficina agora e não aparecem</>}
        {grupos.bloqueado.length > 0 && <> · {grupos.bloqueado.length} pediram para não receber</>}
      </p>
    </div>
  )
}

function LinhaCliente({ e, aba, aberto, onWhatsApp, onResultado, onDesfazer, onVerOS }) {
  const ult = e.ultimaChamada
  // Duas OS abertas no mesmo dia não são uma volta do cliente.
  const voltouDepois = e.dataUltima > e.dataRevisao
    && new Date(e.dataUltima).toDateString() !== new Date(e.dataRevisao).toDateString()
  const podeAnotar = !!e.veiculo
  const vencido = e.diasParaVencer < 0

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${aberto ? 'border-green-300 ring-2 ring-green-100' : 'border-slate-100'}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        {/* Quem e qual carro */}
        <div className="lg:w-64 flex-shrink-0 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{e.cliente?.nome || 'Cliente sem cadastro'}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Phone size={11} />{e.cliente?.telefone || <span className="text-red-500">sem telefone</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 min-w-0">
            <Car size={11} className="flex-shrink-0" />
            <span className="truncate">{e.carro}</span>
            {e.placa && <span className="font-mono text-slate-400 whitespace-nowrap">· {e.placa}</span>}
          </p>
        </div>

        {/* O que fez e quando vence */}
        <div className="flex-1 min-w-0 text-sm text-slate-600 space-y-0.5">
          <p>
            Fez <strong className="font-medium text-slate-800">{frasesDosServicos(e.categorias)}</strong> em {fmtData(e.dataRevisao)}
            <button type="button" onClick={onVerOS} title="Abrir a OS"
              className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-primary-600 hover:underline">
              OS {e.osRevisao.id}<ExternalLink size={10} />
            </button>
          </p>
          {voltouDepois && (
            <p className="text-xs text-slate-500">Voltou em {fmtData(e.dataUltima)} para outro serviço — o prazo conta dessa visita.</p>
          )}
          <p className={`text-xs flex items-center gap-1 ${aba === 'chamado' ? 'text-slate-400' : vencido ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
            <CalendarClock size={12} />
            {fmtData(e.vence)} · {textoVencimento(e.diasParaVencer)}
            {e.tentativa === 2 && <span className="ml-1 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold">2ª tentativa</span>}
          </p>
          {ult && (
            <p className="text-xs text-slate-500">
              Último contato: <strong className="font-medium">{rotuloResultado(ult.resultado)}</strong> em {fmtData(ult.em)}{ult.por ? ` por ${ult.por}` : ''}
              {e.novaTentativaEm && e.situacao === 'chamado' && <> · nova tentativa a partir de {fmtData(e.novaTentativaEm)}</>}
            </p>
          )}
          {e.situacao === 'bloqueado' && (
            <p className="text-xs text-red-600 flex items-center gap-1"><BellOff size={12} />Pediu para não receber lembretes.</p>
          )}
        </div>

        {/* Ações */}
        <div className="lg:w-80 flex-shrink-0 space-y-2">
          {aba === 'chamado' ? (
            <button type="button" onClick={onDesfazer}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-colors">
              <Undo2 size={13} />{e.situacao === 'bloqueado' ? 'Voltar a chamar este cliente' : 'Desfazer a anotação'}
            </button>
          ) : (
            <>
              <button type="button" onClick={onWhatsApp} disabled={!e.temTelefone}
                title={e.temTelefone ? 'Abre o WhatsApp com a mensagem pronta' : 'O cadastro não tem um telefone válido'}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg px-3 py-2 transition-colors">
                <MessageCircle size={15} />Chamar no WhatsApp
              </button>
              {podeAnotar ? (
                <div>
                  <p className={`text-[11px] mb-1 ${aberto ? 'text-green-700 font-semibold' : 'text-slate-400'}`}>
                    {aberto ? 'Enviou? Marque como foi:' : 'Como foi:'}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {RESULTADOS.map(r => (
                      <button key={r.id} type="button" onClick={() => onResultado(r.id)}
                        className={`text-xs font-medium border rounded-md px-2 py-1 transition-colors ${COR_RESULTADO[r.id]}`}>
                        {r.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">O veículo desta OS não está mais no cadastro — não dá para anotar o contato.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

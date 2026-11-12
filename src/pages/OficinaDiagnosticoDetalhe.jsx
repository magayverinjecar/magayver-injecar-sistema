import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Car, User, Clock, Gauge, Fuel, AlertTriangle,
  MessageSquare, Save, CheckCircle2, FileText, Camera, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw,
  ImagePlus, X, Loader2, Pencil, Package,
} from 'lucide-react'
import { uploadFoto, motivoDoErroDeFoto } from '../supabase'
import { comprimirImagem, ACEITA_IMAGEM } from '../utils/imagem'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { useAuth } from '../context/AuthContext'
import gerarId from '../utils/id'
import { statusColor } from './OrdensServico'
import { normalizarDiagnostico } from '../utils/diagnostico'
import {
  AREAS, NORMAL, ATENCAO, PROBLEMA, URGENCIAS, MAX_FOTOS_POR_ITEM,
  itensDaAvaliacao, resumoDaAvaliacao, recomendacoesDaAvaliacao,
  VERBOS_SERVICO, servicoSugerido, verboDoServico, modoDaAvaliacao,
} from '../utils/avaliacao'
import { tipoDaOS } from '../utils/tipoAtendimento'

// Tela de diagnóstico do reparador. Traz tudo que ele precisa para trabalhar —
// veículo, contexto, relato do cliente — sem depender de acesso à OS, onde
// ficam valores e financeiro.
//
// A avaliação é por ÁREAS (utils/avaliacao.js): Injeção (as 12 medições de
// sempre), Ignição, Freios, Suspensão… cada item com OK / Atenção / Trocar.
// O que for marcado Atenção ou Trocar vira recomendação sozinho. O reparador
// só SALVA — quem imprime a avaliação para o cliente é o escritório, na OS.

const AVALIACAO_VAZIA = { modo: 'queixa', itens: {}, ajustes: {}, extras: [], itensExtras: [] }

const BOTOES_STATUS = [
  { id: NORMAL, rotulo: 'OK', ativo: 'bg-green-50 border-green-500 text-green-700' },
  { id: ATENCAO, rotulo: 'Atenção', ativo: 'bg-amber-50 border-amber-500 text-amber-700' },
  { id: PROBLEMA, rotulo: 'Trocar', ativo: 'bg-red-50 border-red-500 text-red-700' },
]

function BotoesStatus({ valor, onEscolher }) {
  return (
    <div className="flex gap-1.5 flex-1">
      {BOTOES_STATUS.map(b => (
        <button key={b.id} type="button" onClick={() => onEscolher(valor === b.id ? null : b.id)}
          className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            valor === b.id ? b.ativo : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
          }`}>
          {b.rotulo}
        </button>
      ))}
    </div>
  )
}

const COR_URGENCIA = {
  urgente: 'bg-red-50 border-red-400 text-red-700',
  recomendado: 'bg-amber-50 border-amber-400 text-amber-700',
  pode_esperar: 'bg-slate-100 border-slate-400 text-slate-700',
}

function BotoesUrgencia({ valor, onEscolher }) {
  return (
    <div className="flex gap-1.5 mt-2 ml-6 flex-wrap">
      {URGENCIAS.map(u => (
        <button key={u.id} type="button" onClick={() => onEscolher(u.id)}
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
            valor === u.id ? COR_URGENCIA[u.id] : 'bg-white border-slate-200 text-slate-400'
          }`}>
          {u.rotulo}
        </button>
      ))}
    </div>
  )
}

// Fotos da avaliação de um item — opcionais. São SEPARADAS das fotos do reparo:
// mostram ao cliente o que foi visto, no papel, embaixo da área do item.
function FotosDoItem({ item, enviando, ocupado, onCamera, onGaleria, onRemover }) {
  const fotos = item.fotos || []
  const cheio = fotos.length >= MAX_FOTOS_POR_ITEM
  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      {!cheio && !enviando && (
        <>
          <button type="button" disabled={ocupado} onClick={onCamera} title="Tirar foto deste item (opcional)"
            className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] font-medium flex items-center gap-1 hover:bg-slate-50 disabled:opacity-40">
            <Camera size={13} />Foto
          </button>
          <button type="button" disabled={ocupado} onClick={onGaleria} title="Escolher foto da galeria (opcional)"
            className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] font-medium flex items-center gap-1 hover:bg-slate-50 disabled:opacity-40">
            <ImagePlus size={13} />Galeria
          </button>
        </>
      )}
      {fotos.map(f => (
        <div key={f.id} className="relative">
          <a href={f.url} target="_blank" rel="noreferrer">
            <img src={f.url} alt={`Foto — ${item.label}`} className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
          </a>
          <button type="button" aria-label="Apagar foto" onClick={() => onRemover(f.id)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center shadow-sm hover:text-red-600">
            <X size={11} />
          </button>
        </div>
      ))}
      {enviando && (
        <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      )}
    </div>
  )
}

// "Serviço a fazer" de um item marcado Atenção ou Trocar: o reparador diz o
// que fazer, não só o que viu. Os botões escrevem "Trocar <nome do item>" num
// toque; o texto continua livre. É o mesmo texto que aparece em "O que
// recomendamos fazer" (avaliacao.ajustes[id].servico).
function ServicoAFazer({ item, valor, onMudar }) {
  const ativo = verboDoServico(valor)
  return (
    <div className="mt-2">
      <p className="text-[10px] font-bold uppercase text-primary-600 mb-1">
        Serviço a fazer{!String(valor || '').trim() && <span className="font-normal normal-case text-slate-400"> (opcional)</span>}
      </p>
      <div className="flex gap-1 flex-wrap mb-1.5">
        {VERBOS_SERVICO.map(v => (
          <button key={v} type="button" onClick={() => onMudar(servicoSugerido(v, item.label, valor))}
            className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              ativo === v ? 'bg-primary-500 border-primary-500 text-white' : 'bg-primary-50 border-orange-200 text-primary-700 hover:bg-primary-100'
            }`}>
            {v}
          </button>
        ))}
      </div>
      <input value={valor || ''} onChange={e => onMudar(e.target.value)}
        placeholder={`Ex.: ${servicoSugerido('Trocar', item.label)}`}
        className="w-full rounded-lg text-xs px-2.5 py-2 border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-300" />
    </div>
  )
}

function resumoDaArea(itens) {
  const r = resumoDaAvaliacao(itens)
  if (r.verificados === 0) return { texto: `0 de ${r.total}`, cor: 'text-slate-400' }
  const partes = []
  if (r.problema) partes.push(`${r.problema} trocar`)
  if (r.atencao) partes.push(`${r.atencao} atenção`)
  const texto = `${r.verificados} de ${r.total}${partes.length ? ' · ' + partes.join(' · ') : r.verificados === r.total ? ' · tudo OK' : ''}`
  const cor = r.problema ? 'text-red-600' : r.atencao ? 'text-amber-600' : r.verificados === r.total ? 'text-green-700' : 'text-slate-500'
  return { texto, cor }
}

export default function OficinaDiagnosticoDetalhe() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const {
    ordens, getCliente, getVeiculo, carregando,
    salvarDiagnostico, finalizarDiagnostico,
  } = useApp()
  const { temPermissao } = useAuth()

  const os = ordens.find(o => o.id === osId)
  const podeVerOS = temPermissao('ordens-servico')
  const podeVistoria = temPermissao('checklist-fotos')

  const [itens, setItens] = useState(null)
  const [falhasScanner, setFalhasScanner] = useState(null)
  const [conclusao, setConclusao] = useState(null)
  const [pecas, setPecas] = useState(null)
  const [avaliacaoLocal, setAvaliacaoLocal] = useState(null)
  const [abertas, setAbertas] = useState(() => new Set(['A']))
  // O item fora da lista sendo digitado: { area, label } ou null.
  const [novoItem, setNovoItem] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  // Fotos da avaliação: qual item está enviando, e para qual item vai a foto
  // que o seletor de arquivo devolver.
  const [enviandoFoto, setEnviandoFoto] = useState(null)
  const alvoFoto = useRef(null)
  const inputCamera = useRef(null)
  const inputGaleria = useRef(null)
  // O envio da foto demora; quando termina, grava com o que estiver na tela
  // NAQUELE momento — não com o que estava quando a foto foi escolhida.
  const ultimo = useRef(null)

  const diagItens = itens ?? normalizarDiagnostico(os?.diagnosticoItens)
  const scanner = falhasScanner ?? os?.falhasScanner ?? ''
  const parecer = conclusao ?? os?.observacoesTecnicas ?? ''
  const listaPecas = pecas ?? os?.pecasNecessarias ?? []
  // O modo, quando ninguém escolheu ainda, segue o tipo de atendimento da
  // entrada: revisão preventiva já abre completa (utils/avaliacao.js).
  const aval = avaliacaoLocal ?? { ...AVALIACAO_VAZIA, ...(os?.avaliacao || {}), modo: modoDaAvaliacao(os) }
  const pendente = itens !== null || falhasScanner !== null || conclusao !== null || pecas !== null || avaliacaoLocal !== null

  useEffect(() => {
    if (!pendente) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendente])

  useEffect(() => {
    ultimo.current = { diagItens, scanner, parecer, listaPecas, aval }
  })

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando...</p>
    </div>
  )

  if (!os) return (
    <div className="p-6 text-center">
      <p className="text-slate-500">Veículo não encontrado.</p>
      <button onClick={() => navigate('/oficina/diagnostico')} className="mt-3 text-primary-500 text-sm">← Voltar</button>
    </div>
  )

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  const tipo = tipoDaOS(os)
  const luzes = os.luzesPainel || []
  // A OS como ficaria se salvasse agora — é dela que saem as áreas, o
  // progresso e as recomendações.
  const osAtual = { ...os, diagnosticoItens: diagItens, avaliacao: aval }
  const todosItens = itensDaAvaliacao(osAtual)
  const resumo = resumoDaAvaliacao(todosItens)
  const recomendacoes = recomendacoesDaAvaliacao(osAtual, todosItens)
  const naoRecomendados = todosItens.filter(i => (i.status === ATENCAO || i.status === PROBLEMA) && aval.ajustes?.[i.id]?.removida)
  const completa = aval.modo === 'completa'

  // O que realmente vai ser gravado. `dadosDoDiagnostico` descarta linha sem
  // descrição, então contar `listaPecas` cru mostrava "3 peça(s)" para três
  // linhas em branco recém-criadas no "+" — número que some ao salvar.
  const pecasPreenchidas = listaPecas.filter(p => String(p.descricao || '').trim())
  // Peça sem área (ou de área que não existe mais) fica em "Outras peças".
  const outrasPecas = listaPecas.filter(p => !AREAS.some(a => a.id === p.area))
  // Depois de aprovado o carro já saiu da fase de diagnóstico: a tela vira
  // consulta, para o reparador reler o laudo enquanto executa o serviço.
  const naFaseDiagnostico = ['Recepção', 'Em Diagnóstico', 'Diagnóstico'].includes(os.status)

  // ── Área A: as medições de injeção (diagnosticoItens) ──
  function mudarMedicao(itemId, patch) {
    setItens(diagItens.map(i => i.id === itemId ? { ...i, ...patch } : i))
  }
  function statusMedicao(itemId, status) {
    // Desmarcar volta ao padrão gravado ('normal') sem contar como verificado.
    mudarMedicao(itemId, status ? { status, verificado: true } : { status: NORMAL, verificado: false })
  }

  // ── Áreas B a G: avaliacao.itens ──
  function mudarAval(fn) { setAvaliacaoLocal(fn(aval)) }
  function statusItem(itemId, status) {
    mudarAval(a => {
      const atual = a.itens?.[itemId] || {}
      const novo = { ...atual, status: status || undefined }
      if (!status) delete novo.status
      return { ...a, itens: { ...(a.itens || {}), [itemId]: novo } }
    })
  }
  function notaItem(itemId, nota) {
    mudarAval(a => ({ ...a, itens: { ...(a.itens || {}), [itemId]: { ...(a.itens?.[itemId] || {}), nota } } }))
  }
  function ajustar(itemId, patch) {
    mudarAval(a => ({ ...a, ajustes: { ...(a.ajustes || {}), [itemId]: { ...(a.ajustes?.[itemId] || {}), ...patch } } }))
  }
  function mudarExtra(eid, patch) {
    mudarAval(a => ({ ...a, extras: (a.extras || []).map(e => e.id === eid ? { ...e, ...patch } : e) }))
  }
  function addExtra() {
    mudarAval(a => ({ ...a, extras: [...(a.extras || []), { id: gerarId(), area: '', texto: '', urgencia: 'recomendado' }] }))
  }
  function removerExtra(eid) {
    mudarAval(a => ({ ...a, extras: (a.extras || []).filter(e => e.id !== eid) }))
  }

  // ── Itens fora da lista: defeito que não está na checagem fixa ──
  // Vale só para esta OS. Depois de criado, funciona igual aos das áreas B–G.
  function adicionarItemFora() {
    const label = String(novoItem?.label || '').trim()
    if (!label) return
    const area = novoItem.area
    mudarAval(a => ({ ...a, itensExtras: [...(a.itensExtras || []), { id: `x${gerarId()}`, area, label }] }))
    setNovoItem(null)
  }
  function renomearItemFora(item) {
    const novo = prompt('Nome do item:', item.label)
    const label = String(novo ?? '').trim()
    if (!label || label === item.label) return
    mudarAval(a => ({ ...a, itensExtras: (a.itensExtras || []).map(x => x.id === item.id ? { ...x, label } : x) }))
  }
  function removerItemFora(item) {
    const n = item.fotos?.length || 0
    const temAlgo = item.status || String(item.nota || '').trim() || n > 0
    if (temAlgo && !confirm(`Tirar "${item.label}" da avaliação?`
      + (n ? `\n\n${n === 1 ? 'A foto dele também sai' : `As ${n} fotos dele também saem`} da avaliação.` : ''))) return
    const semEle = (obj) => { const novo = { ...(obj || {}) }; delete novo[item.id]; return novo }
    mudarAval(a => ({
      ...a,
      itensExtras: (a.itensExtras || []).filter(x => x.id !== item.id),
      itens: semEle(a.itens), ajustes: semEle(a.ajustes), fotos: semEle(a.fotos),
    }))
  }
  function alternarArea(areaId) {
    setAbertas(s => { const n = new Set(s); if (n.has(areaId)) n.delete(areaId); else n.add(areaId); return n })
  }

  // A peça nasce na área em que o reparador estava (Freios, Suspensão…): é
  // assim que a OS mostra as peças separadas para quem faz o orçamento. Sem
  // área, é das "Outras peças".
  function addPeca(area = '') {
    setPecas([...listaPecas, { id: gerarId(), descricao: '', quantidade: '1', ...(area ? { area } : {}) }])
  }
  function editarPeca(pid, campo, valor) {
    setPecas(listaPecas.map(p => p.id === pid ? { ...p, [campo]: valor } : p))
  }
  function removerPeca(pid) {
    setPecas(listaPecas.filter(p => p.id !== pid))
  }

  // O que vai para a OS em qualquer salvamento
  function montarDados(estado, avaliacao) {
    return {
      diagnosticoItens: estado.diagItens,
      falhasScanner: estado.scanner,
      observacoesTecnicas: estado.parecer,
      pecasNecessarias: estado.listaPecas.filter(p => String(p.descricao || '').trim()),
      // Só grava a avaliação quando alguém mexeu nela: OS antiga não ganha
      // um objeto vazio só por ter sido salva.
      ...(avaliacao ? {
        avaliacao: { ...avaliacao, extras: (avaliacao.extras || []).filter(e => String(e.texto || '').trim()) },
      } : {}),
    }
  }
  function dadosDoDiagnostico() {
    return montarDados({ diagItens, scanner, parecer, listaPecas }, avaliacaoLocal)
  }

  // ── Fotos da avaliação ──
  // A foto grava NA HORA, junto com o resto da tela: o reparador não perde a
  // foto se sair sem clicar em Salvar.
  function gravarComFotos(estado, itemId, fotosDoItem) {
    const avaliacao = { ...estado.aval, fotos: { ...(estado.aval.fotos || {}), [itemId]: fotosDoItem } }
    salvarDiagnostico(os.id, montarDados(estado, avaliacao))
    limparRascunho()
  }
  function escolherFoto(itemId, origem) {
    alvoFoto.current = itemId
    ;(origem === 'galeria' ? inputGaleria : inputCamera).current?.click()
  }
  async function receberFotos(e) {
    const itemId = alvoFoto.current
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (!itemId || arquivos.length === 0) return
    const jaTem = (aval.fotos?.[itemId] || []).length
    const vagas = MAX_FOTOS_POR_ITEM - jaTem
    if (vagas <= 0) return
    if (arquivos.length > vagas) {
      alert(`Cada item aceita até ${MAX_FOTOS_POR_ITEM} fotos. Vou enviar só ${vagas === 1 ? 'a primeira' : `as ${vagas} primeiras`}.`)
    }
    setEnviandoFoto(itemId)
    const novas = []
    for (const arquivo of arquivos.slice(0, vagas)) {
      try {
        const blob = await comprimirImagem(arquivo)
        const url = await uploadFoto(blob, `fotos/ordens/${os.id}/avaliacao-${itemId}-${gerarId()}.jpg`)
        novas.push({ id: gerarId(), url, em: new Date().toLocaleString('pt-BR') })
      } catch (err) {
        console.error('Erro ao enviar foto da avaliação:', err)
        alert(`Não foi possível enviar "${arquivo.name}".\n\n` + motivoDoErroDeFoto(err))
      }
    }
    setEnviandoFoto(null)
    if (novas.length === 0) return
    const estado = ultimo.current
    gravarComFotos(estado, itemId, [...(estado.aval.fotos?.[itemId] || []), ...novas])
  }
  function removerFoto(itemId, fotoId) {
    if (!confirm('Apagar esta foto da avaliação?')) return
    const estado = { diagItens, scanner, parecer, listaPecas, aval }
    gravarComFotos(estado, itemId, (aval.fotos?.[itemId] || []).filter(f => f.id !== fotoId))
  }
  const fotosDe = (i) => (
    <FotosDoItem item={i} enviando={enviandoFoto === i.id} ocupado={enviandoFoto !== null}
      onCamera={() => escolherFoto(i.id, 'camera')} onGaleria={() => escolherFoto(i.id, 'galeria')}
      onRemover={fotoId => removerFoto(i.id, fotoId)} />
  )
  const servicoDe = (i) => (
    <ServicoAFazer item={i} valor={aval.ajustes?.[i.id]?.servico} onMudar={v => ajustar(i.id, { servico: v })} />
  )

  // Uma linha que o reparador preenche: OK / Atenção / Trocar, o que foi
  // visto, o serviço e as fotos. Serve para os itens da lista e para os que
  // ele digitou (que ganham o nome com lápis e lixeira).
  const linhaItem = (i, area) => {
    const marcado = i.status === ATENCAO || i.status === PROBLEMA
    // As medições da injeção moram em `diagnosticoItens`; o item digitado na
    // área A não é medição e mora em `avaliacao.itens`, como os outros.
    const medicao = area.fonte === 'diagnostico' && !i.foraDaLista
    return (
      <div key={i.id} className={`px-4 py-3 ${i.foraDaLista ? 'bg-primary-50/40' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            {i.label}{i.unidade ? <span className="text-slate-400 font-normal"> ({i.unidade})</span> : ''}
            {i.foraDaLista && (
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 whitespace-nowrap">fora da lista</span>
            )}
          </p>
          {i.foraDaLista && (
            <span className="flex gap-0.5 flex-shrink-0 -mt-1">
              <button type="button" aria-label="Mudar o nome do item" title="Mudar o nome" onClick={() => renomearItemFora(i)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Pencil size={13} /></button>
              <button type="button" aria-label="Tirar este item" title="Tirar este item" onClick={() => removerItemFora(i)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
            </span>
          )}
        </div>
        <div className="flex gap-2 mt-1.5 items-center">
          {medicao && (
            <input value={i.valor || ''} placeholder="valor"
              onChange={e => mudarMedicao(i.id, { value: e.target.value.toUpperCase() })}
              className="w-24 border-b border-slate-300 px-1 py-1 text-sm uppercase focus:outline-none focus:border-primary-400 bg-transparent" />
          )}
          <BotoesStatus valor={i.verificado ? i.status : null}
            onEscolher={s => medicao ? statusMedicao(i.id, s) : statusItem(i.id, s)} />
        </div>
        {marcado && (
          <>
            <p className="text-[10px] font-bold uppercase text-slate-400 mt-2 mb-0.5">O que foi visto</p>
            <input value={i.nota || ''} placeholder="Ex.: pastilhas com 2 mm"
              onChange={e => medicao ? mudarMedicao(i.id, { nota: e.target.value }) : notaItem(i.id, e.target.value)}
              className={`w-full rounded-lg text-xs px-2.5 py-2 border focus:outline-none ${
                i.status === PROBLEMA ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
              }`} />
            {servicoDe(i)}
          </>
        )}
        {i.verificado && fotosDe(i)}
      </div>
    )
  }

  // Uma linha de peça: nome, quantidade e lixeira. A mesma nas áreas e em
  // "Outras peças".
  const linhaPeca = (p) => (
    <div key={p.id} className="flex items-center gap-2">
      <input value={p.descricao || ''} autoFocus={!p.descricao}
        onChange={e => editarPeca(p.id, 'descricao', e.target.value.toUpperCase())}
        placeholder="Nome da peça..."
        className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase bg-white focus:outline-none focus:ring-2 focus:ring-orange-300" />
      <input value={p.quantidade} inputMode="decimal"
        onChange={e => editarPeca(p.id, 'quantidade', e.target.value)}
        aria-label="Quantidade"
        className="w-14 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-orange-300" />
      <button type="button" onClick={() => removerPeca(p.id)} aria-label="Remover peça"
        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
        <Trash2 size={16} />
      </button>
    </div>
  )

  // No fim de cada área: as peças que o reparador viu que vai precisar ali.
  // Na OS elas aparecem separadas por área, para quem faz o orçamento.
  const pecasDaArea = (area) => {
    const daArea = listaPecas.filter(p => p.area === area.id)
    const preenchidas = daArea.filter(p => String(p.descricao || '').trim()).length
    return (
      <div className="px-4 py-3 bg-slate-50/70">
        <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1">
          <Package size={12} />Peças desta área{preenchidas > 0 && ` (${preenchidas})`}
        </p>
        {daArea.length > 0 && <div className="space-y-1.5 mb-2">{daArea.map(linhaPeca)}</div>}
        <button type="button" onClick={() => addPeca(area.id)}
          className="w-full flex items-center justify-center gap-1 py-1.5 border-2 border-dashed border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:border-orange-300 hover:text-primary-600 transition-colors">
          <Plus size={13} /> Adicionar peça
        </button>
      </div>
    )
  }

  // No fim de cada área: o botão para lançar um defeito que não está na lista.
  const novoItemDaArea = (area) => (
    novoItem?.area === area.id ? (
      <div className="px-4 py-3 bg-primary-50/40">
        <p className="text-[10px] font-bold uppercase text-primary-600 mb-1">Item que não está na lista</p>
        <div className="flex gap-2">
          <input autoFocus value={novoItem.label} placeholder="Nome do item (ex.: roda fônica)"
            onChange={e => setNovoItem({ ...novoItem, label: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') adicionarItemFora(); if (e.key === 'Escape') setNovoItem(null) }}
            className="flex-1 min-w-0 rounded-lg text-sm px-2.5 py-2 border border-orange-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300" />
          <button type="button" onClick={adicionarItemFora} disabled={!novoItem.label.trim()}
            className="px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold disabled:opacity-40">Adicionar</button>
          <button type="button" aria-label="Cancelar" onClick={() => setNovoItem(null)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={15} /></button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">Vale só para este carro. Depois é só marcar OK, Atenção ou Trocar.</p>
      </div>
    ) : (
      <div className="px-3 py-2">
        <button type="button" onClick={() => setNovoItem({ area: area.id, label: '' })}
          className="w-full py-2 border-2 border-dashed border-orange-200 rounded-lg text-xs font-semibold text-primary-600 hover:bg-primary-50 transition-colors">
          + Item fora da lista
        </button>
      </div>
    )
  )

  function limparRascunho() {
    setItens(null); setFalhasScanner(null); setConclusao(null); setPecas(null); setAvaliacaoLocal(null)
  }

  function voltar() {
    if (pendente && !confirm('Há alterações não salvas no diagnóstico.\n\nSair mesmo assim?')) return
    navigate('/oficina/diagnostico')
  }

  function salvarProgresso() {
    setSalvando(true)
    salvarDiagnostico(os.id, dadosDoDiagnostico())
    limparRascunho()
    setSalvo(true)
    setTimeout(() => { setSalvando(false); setSalvo(false) }, 2000)
  }

  function concluir() {
    if (recomendacoes.length === 0 && !parecer.trim()
      && !confirm('Nenhuma recomendação e nenhuma observação.\n\nÉ daqui que o escritório monta o orçamento. Finalizar assim mesmo?')) return
    if (completa && resumo.verificados < resumo.total
      && !confirm(`Avaliação completa com ${resumo.total - resumo.verificados} item(ns) ainda sem verificar.\n\nEles vão sair como "não verificado" no papel do cliente. Finalizar assim mesmo?`)) return
    if (!confirm('Finalizar o diagnóstico?\n\nO veículo vai para "Aguardando Aprovação" e a recepção fala com o cliente.')) return
    setSalvando(true)
    finalizarDiagnostico(os.id, dadosDoDiagnostico())
    limparRascunho()
    setTimeout(() => navigate('/oficina/diagnostico'), 300)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl lg:max-w-none mx-auto space-y-5">

      <div className="flex items-center gap-3">
        <button onClick={voltar} aria-label="Voltar"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <Car size={15} className="text-slate-400" />
            {nomeVeiculo(veiculo, os)}
            {(veiculo?.placa || os.veiculoPlaca) && (
              <span className="font-mono text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {veiculo?.placa || os.veiculoPlaca}
              </span>
            )}
            {pendente && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                <AlertTriangle size={11} /> Não salvo
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><User size={11} /> {cliente?.nome || os.clienteNome || '—'}</span>
            {/* Sem telefone aqui: o reparador não liga para cliente — contato é papel
                da recepção, que vê o número na OS e no cadastro. */}
            <span className="flex items-center gap-1"><Clock size={11} /> {os.dataEntrada || os.data}</span>
          </div>
          {/* O que o cliente veio fazer, marcado na entrada. */}
          {tipo && (
            <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${tipo.etiqueta}`}>
              {tipo.rotulo} · {tipo.tempo}
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[os.status] || 'bg-slate-100 text-slate-600'}`}>
          {os.status}
        </span>
      </div>

      {/* No celular, um bloco embaixo do outro na ordem de uso: o carro, a
          avaliação por áreas, e por último o que o reparador escreve (scanner,
          peças, observações). No computador: à esquerda o carro e a escrita;
          à direita a avaliação, que é o miolo do trabalho. */}
      <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-3 lg:items-start">

          <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-start-1 lg:row-start-1">
            <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Car size={14} /> Dados do Veículo &amp; Contexto
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 gap-4 mb-4 text-sm">
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Veículo/Modelo</span>
                <span className="font-bold text-slate-800">{nomeVeiculo(veiculo, os)}</span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Placa</span>
                <span className="font-bold text-slate-800 uppercase tracking-wider">{veiculo?.placa || os.veiculoPlaca || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Motor</span>
                <span className="text-slate-600">{veiculo?.motor || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                  <Fuel size={10} /> Combustível
                </span>
                <span className="text-slate-600">{os.combustivel || veiculo?.combustivel || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                  <Gauge size={10} /> Km Entrada
                </span>
                <span className="text-slate-600">{os.kmEntrada || (os.kmIlegivel ? 'não deu para ler' : '—')}</span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Última Manutenção</span>
                <span className="text-slate-600">{os.ultimaRevisao || '—'}</span>
              </div>
            </div>

            {luzes.length > 0 && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
                <span className="block text-red-600 text-[10px] font-bold mb-2 uppercase flex items-center gap-1">
                  <AlertTriangle size={11} /> Luzes de Alerta no Painel (Reportado):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {luzes.map(luz => (
                    <span key={luz}
                      className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-bold">
                      {luz}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="block text-amber-600 text-[10px] font-bold mb-1 uppercase flex items-center gap-1">
                <MessageSquare size={10} /> Relato do Cliente:
              </span>
              <p className="text-slate-600 italic text-sm leading-relaxed">
                "{os.relatoCliente || os.descricaoProblema || 'Sem relato registrado.'}"
              </p>
            </div>

            {os.fotos?.length > 0 && (
              <button onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
                className="mt-3 w-full flex items-center justify-center gap-2 border border-cyan-200 text-cyan-700 py-2 rounded-xl text-sm font-medium hover:bg-cyan-50 transition-colors">
                <Camera size={15} /> Ver as {os.fotos.length} foto(s) da entrada
              </button>
            )}
          </div>

        {/* ── A avaliação por áreas ── */}
        <div className="space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">O que vai ser avaliado</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'queixa', rotulo: 'Só a queixa' },
                { id: 'completa', rotulo: 'Avaliação completa' },
              ].map(m => (
                <button key={m.id} type="button" onClick={() => mudarAval(a => ({ ...a, modo: m.id }))}
                  className={`py-2 rounded-lg border text-sm transition-colors ${
                    aval.modo === m.id ? 'border-2 border-primary-500 bg-primary-50 font-bold text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  {m.rotulo}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {completa ? 'Completa: todas as áreas entram no papel do cliente.' : 'Só a queixa: abra as áreas que interessam ao defeito.'}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span><strong>{resumo.verificados}</strong> de {resumo.total} itens verificados</span>
                <span>
                  {resumo.problema > 0 && <><strong className="text-red-600">{resumo.problema}</strong> trocar</>}
                  {resumo.problema > 0 && resumo.atencao > 0 && ' · '}
                  {resumo.atencao > 0 && <><strong className="text-amber-600">{resumo.atencao}</strong> atenção</>}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 transition-all" style={{ width: `${resumo.total ? Math.round(resumo.verificados / resumo.total * 100) : 0}%` }} />
              </div>
            </div>
          </div>

          {AREAS.map(area => {
            const daArea = todosItens.filter(i => i.area === area.id)
            const r = resumoDaArea(daArea)
            const aberta = abertas.has(area.id)
            // Com a área fechada, o cabeçalho avisa que ela tem peça pedida.
            const nPecas = pecasPreenchidas.filter(p => p.area === area.id).length
            return (
              <div key={area.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button type="button" onClick={() => alternarArea(area.id)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left ${aberta ? 'bg-slate-50 border-b border-slate-100' : ''}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-slate-800 text-white text-[11px] flex-shrink-0">{area.id}</span>
                    {area.nome}
                  </span>
                  <span className={`flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${r.cor}`}>
                    {r.texto}
                    {nPecas > 0 && <span className="text-primary-600">· {nPecas} {nPecas === 1 ? 'peça' : 'peças'}</span>}
                    {aberta ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </span>
                </button>

                {aberta && area.fonte === 'vistoria' && (
                  <div className="divide-y divide-slate-100">
                    <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50">
                      Vem da vistoria de entrada.
                      {podeVistoria && (
                        <button type="button" onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
                          className="ml-1 font-semibold text-primary-600 hover:underline">Editar na vistoria</button>
                      )}
                    </p>
                    {daArea.filter(i => !i.foraDaLista).map(i => (
                      <div key={i.id} className="px-4 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-700">{i.label}{i.nota && <span className="block text-xs text-slate-500 italic">{i.nota}</span>}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            !i.verificado ? 'border-slate-200 text-slate-400'
                              : i.status === PROBLEMA ? 'bg-red-50 border-red-300 text-red-700'
                                : i.status === ATENCAO ? 'bg-amber-50 border-amber-300 text-amber-700'
                                  : 'bg-green-50 border-green-300 text-green-700'
                          }`}>
                            {!i.verificado ? '—' : i.status === PROBLEMA ? 'Problema' : i.status === ATENCAO ? 'Atenção' : 'OK'}
                          </span>
                        </div>
                        {/* A situação vem da vistoria, mas o serviço e a foto
                            são da avaliação. */}
                        {(i.status === ATENCAO || i.status === PROBLEMA) && servicoDe(i)}
                        {i.verificado && fotosDe(i)}
                      </div>
                    ))}
                    {/* O que o reparador digitou na área H é dele, não da
                        vistoria: esse ele marca aqui. */}
                    {daArea.filter(i => i.foraDaLista).map(i => linhaItem(i, area))}
                    {novoItemDaArea(area)}
                    {pecasDaArea(area)}
                  </div>
                )}

                {aberta && area.fonte !== 'vistoria' && (
                  <div className="divide-y divide-slate-100">
                    {daArea.map(i => linhaItem(i, area))}
                    {novoItemDaArea(area)}
                    {pecasDaArea(area)}
                  </div>
                )}
              </div>
            )
          })}

          <div className="bg-white border-2 border-primary-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-800">O que recomendamos fazer</p>
            <p className="text-[11px] text-slate-400 mb-3">
              Montado sozinho com o que foi marcado Atenção ou Trocar. Ajuste a urgência e o serviço.
            </p>

            {recomendacoes.length === 0 && (aval.extras || []).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-3">Nada marcado como Atenção ou Trocar ainda.</p>
            )}

            <div className="space-y-2">
              {recomendacoes.filter(rec => rec.automatica).map(rec => (
                <div key={rec.chave} className="border border-slate-200 rounded-xl p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-slate-700 mt-1.5 w-4">{rec.area}</span>
                    {/* O serviço é o MESMO texto do campo "Serviço a fazer" do
                        item: mudar aqui muda lá. Duas linhas: no celular uma
                        linha só cortava a frase no meio. */}
                    <div className="flex-1 min-w-0">
                      <textarea rows={2} value={aval.ajustes?.[rec.itemId]?.servico ?? ''}
                        placeholder="Serviço a fazer (ex.: trocar…)"
                        onChange={e => ajustar(rec.itemId, { servico: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-orange-300" />
                      {rec.servico
                        ? rec.encontrado && <p className="text-[11px] text-slate-500 italic mt-0.5">Encontrado: {rec.encontrado}</p>
                        : <p className="text-[10px] text-slate-400 mt-0.5">Sem serviço escrito, sai assim: {rec.texto}</p>}
                    </div>
                    <button type="button" title="Não recomendar" onClick={() => ajustar(rec.itemId, { removida: true })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <BotoesUrgencia valor={rec.urgencia} onEscolher={u => ajustar(rec.itemId, { urgencia: u })} />
                </div>
              ))}
              {/* As escritas à mão ficam num bloco próprio, na ordem em que
                  foram criadas: se entrassem na lista ordenada acima, a linha
                  pularia de lugar enquanto a pessoa digita. */}
              {(aval.extras || []).map(e => (
                <div key={e.id} className="border border-dashed border-primary-300 rounded-xl p-2.5">
                  <div className="flex items-start gap-2">
                    <select value={e.area || ''} onChange={ev => mudarExtra(e.id, { area: ev.target.value })}
                      className="border border-slate-200 rounded-lg px-1 py-1.5 text-xs w-14">
                      <option value="">—</option>
                      {AREAS.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
                    </select>
                    <textarea rows={2} value={e.texto || ''} placeholder="Escreva a recomendação..."
                      onChange={ev => mudarExtra(e.id, { texto: ev.target.value })}
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                    <button type="button" title="Apagar" onClick={() => removerExtra(e.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                  <BotoesUrgencia valor={e.urgencia || 'recomendado'} onEscolher={u => mudarExtra(e.id, { urgencia: u })} />
                </div>
              ))}
            </div>

            {naoRecomendados.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-2">
                Marcados mas sem recomendação:{' '}
                {naoRecomendados.map((i, k) => (
                  <span key={i.id}>
                    {k > 0 && ', '}
                    {i.label}{' '}
                    <button type="button" onClick={() => ajustar(i.id, { removida: false })}
                      className="inline-flex items-center gap-0.5 text-primary-600 font-semibold hover:underline">
                      <RotateCcw size={10} />voltar
                    </button>
                  </span>
                ))}
              </p>
            )}

            <button type="button" onClick={addExtra}
              className="w-full mt-3 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs font-medium text-slate-500 hover:border-primary-300 hover:text-primary-600 transition-colors">
              + Adicionar recomendação
            </button>
          </div>
        </div>

        <div className="space-y-5 lg:space-y-3 lg:col-start-1 lg:row-start-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-bold text-slate-600 uppercase mb-2">
              Falhas do Scanner
            </label>
            <textarea
              rows={3}
              value={scanner}
              onChange={e => setFalhasScanner(e.target.value)}
              placeholder="Códigos de falha (DTC) ou leituras do scanner..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div>
              {/* As peças de cada área ficam dentro da área (lá em cima). Aqui
                  só o que não é de nenhuma — e as lançadas antes de existir a
                  separação por área. */}
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-600 uppercase">
                  Outras peças <span className="font-normal normal-case text-xs text-slate-400">(o que não é de nenhuma área)</span>
                </label>
                {pecasPreenchidas.length > 0 && (
                  <span className="text-xs text-slate-400 whitespace-nowrap">{pecasPreenchidas.length} peça(s) no total</span>
                )}
              </div>

              {outrasPecas.length > 0 && (
                <div className="space-y-2 mb-2">{outrasPecas.map(linhaPeca)}</div>
              )}

              <button onClick={() => addPeca()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-500 py-2.5 rounded-lg text-sm font-medium hover:border-orange-300 hover:text-primary-600 transition-colors">
                <Plus size={15} /> Adicionar peça
              </button>
              <p className="text-xs text-slate-400 mt-2">
                Só a lista do que o serviço precisa — quem coloca preço é o administrativo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 uppercase mb-1">
                Observações gerais <span className="font-normal normal-case text-slate-400">(opcional)</span>
              </label>
              <p className="text-xs text-slate-400 mb-2">
                O que não cabe em nenhuma área. As recomendações saem das áreas.
              </p>
              <textarea rows={3} value={parecer}
                onChange={e => setConclusao(e.target.value)}
                placeholder="Ex.: cliente relatou que o problema começou depois de abastecer em posto diferente..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
            </div>
          </div>
        </div>
      </div>

      {/* O reparador só salva e finaliza. Quem imprime a avaliação para o
          cliente é o escritório, no botão "Avaliação técnica" da OS. */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1 pb-6 items-stretch sm:items-center lg:gap-2 lg:px-3 lg:pt-1.5 lg:pb-1.5 lg:bg-slate-100 lg:border lg:border-slate-300 lg:rounded">
        <span className="hidden lg:flex items-center gap-2 flex-1 text-[11px] text-slate-600 tabular-nums">
          <span><strong className="font-medium">{resumo.verificados}</strong> de {resumo.total} itens</span>
          {recomendacoes.length > 0 && <span>· {recomendacoes.length} recomendação(ões)</span>}
          {pecasPreenchidas.length > 0 && <span>· {pecasPreenchidas.length} peça(s)</span>}
          {pendente && <span className="text-amber-700 font-medium">· alterações não salvas</span>}
        </span>
        <button onClick={salvarProgresso} disabled={salvando || !pendente}
          className="flex items-center justify-center gap-2 border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 px-5 py-3 lg:px-4 lg:py-1.5 rounded-xl text-sm lg:text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save size={16} /> {salvo ? 'Salvo!' : salvando ? 'Salvando...' : 'Salvar Diagnóstico'}
        </button>

        {naFaseDiagnostico && (
          <button onClick={concluir} disabled={salvando}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 lg:px-4 lg:py-1.5 rounded-xl text-sm lg:text-xs font-semibold transition-colors disabled:opacity-50">
            <CheckCircle2 size={16} /> Finalizar Diagnóstico
          </button>
        )}

        {podeVerOS && (
          <button onClick={() => navigate(`/ordens-servico/${encodeURIComponent(os.id)}`)}
            className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-3 lg:px-4 lg:py-1.5 rounded-xl text-sm lg:text-xs font-semibold transition-colors sm:ml-auto">
            <FileText size={16} /> Ver OS
          </button>
        )}
      </div>

      {/* Os seletores das fotos da avaliação. Com o capture abre direto a
          câmera; sem ele, o celular abre a galeria. */}
      <input ref={inputCamera} type="file" accept={ACEITA_IMAGEM} capture="environment"
        onChange={receberFotos} className="hidden" />
      <input ref={inputGaleria} type="file" accept={ACEITA_IMAGEM} multiple
        onChange={receberFotos} className="hidden" />
    </div>
  )
}

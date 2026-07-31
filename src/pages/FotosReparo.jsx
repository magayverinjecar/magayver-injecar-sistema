import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, ImagePlus, Trash2, Loader2, Car, User, Wrench,
  X, ZoomIn, ChevronLeft, ChevronRight, Save, CheckCircle2, Copy, Check, MessageCircle,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { uploadFoto } from '../supabase'
import { comprimirImagem } from '../utils/imagem'
import {
  CATEGORIAS_REPARO, MOMENTO_REPARO, fotosDaEntrada, fotosDoReparo, linkVistoria,
} from '../utils/vistoria'
import gerarId from '../utils/id'

// Registro do serviço executado: peça que saiu, peça que entrou, antes e depois.
// Fica separado das fotos de entrada porque prova outra coisa — e porque o link
// da vistoria que o cliente recebe não pode misturar os dois momentos.
export default function FotosReparo() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const { ordens, getCliente, getVeiculo, salvarVistoria, carregando } = useApp()

  const os = ordens.find(o => o.id === osId)

  const [fotos, setFotos] = useState(null)
  const [categoria, setCategoria] = useState('Peça removida')
  const [enviando, setEnviando] = useState(false)
  const [ampliada, setAmpliada] = useState(null)
  const [confirmarExcluir, setConfirmarExcluir] = useState(null)
  const [salvo, setSalvo] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const inputRef = useRef(null)
  const inputGaleriaRef = useRef(null)

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando...</p>
    </div>
  )

  if (!os) return (
    <div className="p-6 text-center">
      <p className="text-slate-500">Veículo não encontrado.</p>
      <button onClick={() => navigate('/oficina/meus-servicos')} className="mt-3 text-primary-500 text-sm">← Voltar</button>
    </div>
  )

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  const modelo = nomeVeiculo(veiculo, os)
  const placa = veiculo?.placa || os.veiculoPlaca || ''

  const todas = fotos ?? os.fotos ?? []
  const doReparo = fotosDoReparo(todas)
  const daEntrada = fotosDaEntrada(todas)

  // Grava na hora — o reparador não perde foto se sair sem clicar em salvar
  function persistir(novasFotos) {
    setFotos(novasFotos)
    salvarVistoria(os.id, { fotos: novasFotos, inspecaoVisual: os.inspecaoVisual || [] })
  }

  async function adicionar(e) {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (arquivos.length === 0) return
    setEnviando(true)
    const novas = []
    for (const arquivo of arquivos) {
      try {
        const blob = await comprimirImagem(arquivo)
        const caminho = `fotos/ordens/${os.id}/reparo-${gerarId()}.jpg`
        const url = await uploadFoto(blob, caminho)
        novas.push({
          id: gerarId(), url, categoria,
          momento: MOMENTO_REPARO,
          timestamp: new Date().toLocaleString('pt-BR'),
        })
      } catch (err) {
        console.error('Erro ao enviar foto:', err)
        alert(`Não foi possível enviar "${arquivo.name}". Verifique a conexão e tente de novo.`)
      }
    }
    if (novas.length > 0) persistir([...todas, ...novas])
    setEnviando(false)
  }

  function remover(fotoId) {
    persistir(todas.filter(f => f.id !== fotoId))
    setConfirmarExcluir(null)
  }

  function navegar(direcao) {
    const idx = doReparo.findIndex(f => f.id === ampliada.id)
    const novo = idx + direcao
    if (novo >= 0 && novo < doReparo.length) setAmpliada(doReparo[novo])
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkVistoria(os.id)).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    })
  }

  // Mesmo link da vistoria: o cliente abre e vê a chegada do veículo e o
  // serviço executado em blocos separados.
  function enviarLink() {
    const url = linkVistoria(os.id)
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    const texto = `*Magayver Injecar*\nOlá ${cliente?.nome || ''}! Seguem as fotos do serviço executado no seu ${modelo}${placa ? ` (${placa})` : ''}, incluindo as peças substituídas.\n\nPara acessar, informe o número cadastrado:\n${url}`
    const href = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(href, '_blank')
  }

  function concluir() {
    salvarVistoria(os.id, { fotos: todas, inspecaoVisual: os.inspecaoVisual || [] })
    setSalvo(true)
    setTimeout(() => { setSalvo(false); navigate('/oficina/meus-servicos') }, 700)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      {ampliada && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setAmpliada(null)}>
          <button onClick={() => setAmpliada(null)} aria-label="Fechar"
            className="absolute top-4 right-4 z-10 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><X size={24} /></button>
          {doReparo.findIndex(f => f.id === ampliada.id) > 0 && (
            <button onClick={e => { e.stopPropagation(); navegar(-1) }} aria-label="Anterior"
              className="absolute left-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronLeft size={28} /></button>
          )}
          <img src={ampliada.url} alt={ampliada.categoria} className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          {doReparo.findIndex(f => f.id === ampliada.id) < doReparo.length - 1 && (
            <button onClick={e => { e.stopPropagation(); navegar(1) }} aria-label="Próxima"
              className="absolute right-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronRight size={28} /></button>
          )}
          <div className="absolute bottom-4 flex items-center gap-3 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full">
            <span className="font-medium">{ampliada.categoria}</span>
            {ampliada.timestamp && <><span>·</span><span>{ampliada.timestamp}</span></>}
            <span>·</span>
            <span>{doReparo.findIndex(f => f.id === ampliada.id) + 1} / {doReparo.length}</span>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/oficina/meus-servicos')} aria-label="Voltar"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mt-0.5"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <Wrench size={15} className="text-orange-500" />
            Fotos do reparo
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><Car size={11} /> {modelo}</span>
            {placa && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{placa}</span>}
            <span className="flex items-center gap-1"><User size={11} /> {cliente?.nome || os.clienteNome || '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={copiarLink} title="Copiar link das fotos"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${
              linkCopiado ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {linkCopiado ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
            <span className="hidden sm:inline">{linkCopiado ? 'Copiado!' : 'Copiar Link'}</span>
          </button>
          <button onClick={enviarLink} disabled={doReparo.length === 0}
            title={doReparo.length === 0 ? 'Tire ao menos uma foto antes de enviar' : 'Enviar as fotos ao cliente'}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
            <MessageCircle size={15} />
            <span className="hidden sm:inline">Enviar Link</span>
          </button>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
        <p className="text-sm text-orange-900">
          Registre a peça que saiu, a peça nova e o serviço feito. É o que prova ao cliente
          que o reparo foi executado.
        </p>
        {daEntrada.length > 0 && (
          <p className="text-xs text-orange-700 mt-1.5">
            As {daEntrada.length} foto(s) da vistoria de entrada ficam separadas e não se misturam aqui.
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={categoria} onChange={e => setCategoria(e.target.value)}
            aria-label="Tipo da foto"
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
            {CATEGORIAS_REPARO.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => inputRef.current?.click()} disabled={enviando}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            {enviando
              ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              : <><Camera size={16} /> Tirar foto</>}
          </button>
          {/* Sem o capture, o celular abre o seletor com a galeria — o campo da
              câmera pula direto para ela e não deixava buscar foto já tirada. */}
          <button onClick={() => inputGaleriaRef.current?.click()} disabled={enviando}
            className="flex items-center justify-center gap-2 border border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <ImagePlus size={16} /> Galeria
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple capture="environment"
            onChange={adicionar} className="hidden" />
          <input ref={inputGaleriaRef} type="file" accept="image/*" multiple
            onChange={adicionar} className="hidden" />
        </div>

        {doReparo.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-center">
            <Camera size={30} className="text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Nenhuma foto do reparo ainda</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Fotografe a peça antes de descartar — depois não dá para voltar atrás.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {doReparo.map(f => (
              <div key={f.id}
                className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in"
                onClick={() => setAmpliada(f)}>
                <img src={f.url} alt={f.categoria} className="w-full h-full object-cover" />
                <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none">
                  {f.categoria}
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <ZoomIn size={18} className="text-white" />
                  {confirmarExcluir === f.id ? (
                    <>
                      <button onClick={e => { e.stopPropagation(); remover(f.id) }}
                        className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Apagar</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmarExcluir(null) }}
                        className="px-2.5 py-1.5 bg-white/20 text-white rounded-lg text-xs font-bold">Cancelar</button>
                    </>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmarExcluir(f.id) }} aria-label="Remover foto"
                      className="p-2 bg-red-600 text-white rounded-full"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
        <button onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors mr-auto">
          <Camera size={16} /> Fotos de entrada
          {daEntrada.length > 0 && (
            <span className="text-xs bg-slate-100 px-1.5 rounded-full">{daEntrada.length}</span>
          )}
        </button>
        {salvo && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 size={13} /> Salvo
          </span>
        )}
        <button onClick={concluir} disabled={enviando}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Save size={15} /> Concluir registro
        </button>
      </div>
    </div>
  )
}

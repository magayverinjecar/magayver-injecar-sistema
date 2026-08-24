import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, Trash2, CheckCircle2, AlertTriangle,
  Save, User, Clock, Car, X, ZoomIn, ChevronLeft, ChevronRight,
  Copy, Check, Stethoscope, Wrench, ImagePlus,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { uploadFoto, motivoDoErroDeFoto } from '../supabase'
import { comprimirImagem } from '../utils/imagem'
import {
  CATEGORIAS_FOTO, normalizarInspecao, linkVistoria,
  MOMENTO_ENTRADA, fotosDaEntrada, fotosDoReparo,
} from '../utils/vistoria'
import gerarId from '../utils/id'

// Um item da vistoria: três estados que alternam ao clicar de novo, e um campo
// de observação que aparece só depois de marcar algo.
function InspecaoItem({ item, onUpdate }) {
  const [nota, setNota] = useState(item.nota || '')

  function handleStatus(novoStatus) {
    const final = item.status === novoStatus ? undefined : novoStatus
    onUpdate(item.id, final, nota)
  }

  function handleNotaBlur() {
    if (nota !== item.nota) onUpdate(item.id, item.status, nota)
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="font-semibold text-slate-700 text-sm">{item.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => handleStatus('ok')} title="OK" aria-label={`${item.label}: OK`}
            className={`p-2 rounded-lg border transition-all ${
              item.status === 'ok'
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-green-400 hover:text-green-500'
            }`}>
            <CheckCircle2 size={18} />
          </button>
          <button onClick={() => handleStatus('warning')} title="Atenção" aria-label={`${item.label}: Atenção`}
            className={`p-2 rounded-lg border transition-all ${
              item.status === 'warning'
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-500'
            }`}>
            <AlertTriangle size={18} />
          </button>
          <button onClick={() => handleStatus('issue')} title="Problema" aria-label={`${item.label}: Problema`}
            className={`p-2 rounded-lg border transition-all ${
              item.status === 'issue'
                ? 'bg-red-500 border-red-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-500'
            }`}>
            <X size={18} />
          </button>
        </div>
      </div>

      {item.status && (
        <div className="mt-3">
          <input type="text" placeholder="Adicionar observação (opcional)..."
            value={nota} onChange={e => setNota(e.target.value)} onBlur={handleNotaBlur}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 transition-colors" />
          <p className="text-[10px] text-slate-400 mt-1 text-right">Clique fora para salvar a observação.</p>
        </div>
      )}
    </div>
  )
}

// Vistoria de entrada feita pelo reparador. Mostra só o necessário para o
// serviço — nada de valores da OS, para quem não tem acesso a preços.
export default function VistoriaEntrada() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const { ordens, getCliente, getVeiculo, salvarVistoria, carregando } = useApp()

  const os = ordens.find(o => o.id === osId)

  const [fotos, setFotos] = useState(null)
  const [inspecao, setInspecao] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [categoriaAtual, setCategoriaAtual] = useState('Outros')
  const [uploading, setUploading] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [confirmarExcluir, setConfirmarExcluir] = useState(null)
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
      <button onClick={() => navigate('/oficina/fotos')} className="mt-3 text-primary-500 text-sm">← Voltar</button>
    </div>
  )

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  const modelo = nomeVeiculo(veiculo, os)
  const placa = veiculo?.placa || os.veiculoPlaca || ''

  // Todas as fotos da OS (o array é um só), mas esta tela só mostra e mexe nas
  // de entrada — as do reparo têm tela própria e não podem se misturar aqui.
  const todasFotos = fotos ?? os.fotos ?? []
  const listaFotos = fotosDaEntrada(todasFotos)
  const listaInspecao = inspecao ?? normalizarInspecao(os.inspecaoVisual)
  const inspecaoDone = listaInspecao.filter(i => i.status !== undefined).length
  const fotosPorCat = CATEGORIAS_FOTO.map(cat => ({ cat, lista: listaFotos.filter(f => f.categoria === cat) }))

  // Grava na hora, como era antes — o reparador não perde trabalho se sair sem
  // clicar em salvar. O array de fotos da OS é único: esta tela mexe só nas de
  // entrada, então as do reparo são reanexadas para não serem apagadas.
  function persistir(novasFotosEntrada, novaInspecao) {
    const completo = [...fotosDoReparo(todasFotos), ...novasFotosEntrada]
    setFotos(completo)
    setInspecao(novaInspecao)
    salvarVistoria(os.id, { fotos: completo, inspecaoVisual: novaInspecao })
  }

  function abrirUpload(cat) {
    setCategoriaAtual(cat)
    setTimeout(() => inputRef.current?.click(), 10)
  }

  // Sem o capture, o celular abre o seletor com a galeria — o campo da câmera
  // pula direto para ela e não deixava buscar uma foto já tirada.
  function abrirGaleria(cat) {
    setCategoriaAtual(cat)
    setTimeout(() => inputGaleriaRef.current?.click(), 10)
  }

  async function handleFile(e) {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    setUploading(categoriaAtual)
    try {
      const blob = await comprimirImagem(file)
      const caminho = `fotos/ordens/${os.id}/${gerarId()}.jpg`
      const url = await uploadFoto(blob, caminho)
      const nova = {
        id: gerarId(), url, categoria: categoriaAtual,
        momento: MOMENTO_ENTRADA,
        timestamp: new Date().toLocaleString('pt-BR'),
      }
      persistir([...listaFotos, nova], listaInspecao)
    } catch (err) {
      console.error('Erro ao enviar imagem:', err)
      alert(motivoDoErroDeFoto(err))
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  function removerFoto(fotoId) {
    persistir(listaFotos.filter(f => f.id !== fotoId), listaInspecao)
  }

  function atualizarInspecao(itemId, status, nota) {
    persistir(listaFotos, listaInspecao.map(i => i.id === itemId ? { ...i, status, nota } : i))
  }

  function navegarFoto(direcao) {
    const idx = listaFotos.findIndex(f => f.id === fotoAmpliada.id)
    const novo = idx + direcao
    if (novo >= 0 && novo < listaFotos.length) setFotoAmpliada(listaFotos[novo])
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkVistoria(os.id)).then(() => {
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    })
  }

  // O envio por WhatsApp saiu desta tela: abria a conversa com o número do
  // cliente no aparelho de qualquer reparador. Quem envia o link é a recepção,
  // pelo botão "Enviar fotos" da OS. Aqui fica só o "Copiar Link".

  function salvar() {
    setSalvando(true)
    salvarVistoria(os.id, {
      fotos: [...fotosDoReparo(todasFotos), ...listaFotos],
      inspecaoVisual: listaInspecao,
    })
    setTimeout(() => { setSalvando(false); navigate('/oficina/fotos') }, 500)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">

      {fotoAmpliada && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setFotoAmpliada(null)}>
          <button onClick={() => setFotoAmpliada(null)} aria-label="Fechar"
            className="absolute top-4 right-4 z-10 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
            <X size={24} />
          </button>
          {listaFotos.findIndex(f => f.id === fotoAmpliada.id) > 0 && (
            <button onClick={e => { e.stopPropagation(); navegarFoto(-1) }} aria-label="Foto anterior"
              className="absolute left-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
              <ChevronLeft size={28} />
            </button>
          )}
          <img src={fotoAmpliada.url || fotoAmpliada.dataUrl} alt="Foto ampliada"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          {listaFotos.findIndex(f => f.id === fotoAmpliada.id) < listaFotos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); navegarFoto(1) }} aria-label="Próxima foto"
              className="absolute right-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors">
              <ChevronRight size={28} />
            </button>
          )}
          <div className="absolute bottom-4 flex items-center gap-3 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full">
            <span className="font-medium">{fotoAmpliada.categoria}</span>
            {fotoAmpliada.timestamp && <><span>·</span><span>{fotoAmpliada.timestamp}</span></>}
            <span>·</span>
            <span>{listaFotos.findIndex(f => f.id === fotoAmpliada.id) + 1} / {listaFotos.length}</span>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/oficina/fotos')} aria-label="Voltar"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <Car size={15} className="text-slate-400" />
            {modelo}
            {placa && (
              <span className="font-mono text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{placa}</span>
            )}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><User size={11} /> {cliente?.nome || os.clienteNome || '—'}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {(os.dataEntrada || os.data || '').split(' ')[0]}</span>
            <span className="text-slate-300">·</span>
            <span>{listaFotos.length} foto(s)</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={copiarLink} title="Copiar link da vistoria"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${
              linkCopiado ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {linkCopiado ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
            <span className="hidden sm:inline">{linkCopiado ? 'Copiado!' : 'Copiar Link'}</span>
          </button>
        </div>
      </div>

      {os.relatoCliente && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="block text-amber-600 text-[10px] font-bold mb-1 uppercase">Relato do Cliente:</span>
          <p className="text-slate-600 italic text-sm leading-relaxed">"{os.relatoCliente}"</p>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      <input ref={inputGaleriaRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Camera size={14} className="text-cyan-500" />
          <h3 className="text-sm font-semibold text-slate-700">Fotos do Veículo</h3>
          <span className="ml-auto text-xs text-slate-400">{listaFotos.length} foto(s)</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {fotosPorCat.map(({ cat, lista }) => (
              <div key={cat} className={cat === 'Outros' ? 'col-span-2 sm:col-span-1' : ''}>
                <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  {cat}
                  {lista.length > 1 && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">{lista.length}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {lista.map((foto, idx) => (
                    <div key={foto.id}
                      className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in"
                      onClick={() => setFotoAmpliada(foto)}>
                      <img src={foto.url || foto.dataUrl} alt={`${cat} ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                        {cat}
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button onClick={e => { e.stopPropagation(); setFotoAmpliada(foto) }} aria-label="Ampliar"
                          className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-colors shadow-lg">
                          <ZoomIn size={16} />
                        </button>
                        {confirmarExcluir === foto.id ? (
                          <>
                            <button onClick={e => { e.stopPropagation(); removerFoto(foto.id); setConfirmarExcluir(null) }}
                              className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-500 transition-colors shadow-lg">
                              Apagar
                            </button>
                            <button onClick={e => { e.stopPropagation(); setConfirmarExcluir(null) }}
                              className="px-2.5 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-xs font-bold hover:bg-white/30 transition-colors shadow-lg">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setConfirmarExcluir(foto.id) }} aria-label="Remover foto"
                            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors shadow-lg">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {(cat === 'Outros' || lista.length === 0) && (
                    <div className={`w-full aspect-video rounded-xl border-2 border-dashed flex transition-all ${
                      uploading === cat
                        ? 'border-cyan-400 bg-cyan-50 items-center justify-center'
                        : 'border-slate-200'
                    }`}>
                      {uploading === cat ? (
                        <span className="text-xs font-bold text-cyan-600 uppercase">Processando...</span>
                      ) : (
                        <>
                          <button onClick={() => abrirUpload(cat)}
                            className="flex-1 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-l-[10px] transition-colors">
                            <Camera size={20} />
                            <span className="text-[10px] font-bold uppercase">Tirar foto</span>
                          </button>
                          <div className="w-px bg-slate-200 my-2" />
                          <button onClick={() => abrirGaleria(cat)}
                            className="flex-1 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-r-[10px] transition-colors">
                            <ImagePlus size={20} />
                            <span className="text-[10px] font-bold uppercase">Galeria</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-700">Vistoria do Veículo</h3>
          <span className="ml-auto text-xs text-slate-400">{inspecaoDone}/{listaInspecao.length} itens</span>
        </div>
        <div className="p-4 space-y-2">
          {listaInspecao.map(item => (
            <InspecaoItem key={item.id} item={item} onUpdate={atualizarInspecao} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pb-6">
        <button onClick={() => navigate(`/oficina/diagnostico/${encodeURIComponent(os.id)}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
          <Stethoscope size={16} /> Diagnóstico
        </button>
        <button onClick={() => navigate(`/oficina/reparo/${encodeURIComponent(os.id)}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors mr-auto">
          <Wrench size={16} /> Fotos do reparo
          {fotosDoReparo(todasFotos).length > 0 && (
            <span className="text-xs bg-orange-100 px-1.5 rounded-full">{fotosDoReparo(todasFotos).length}</span>
          )}
        </button>
        <button onClick={() => navigate('/oficina/fotos')}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
          Cancelar
        </button>
        <button onClick={salvar} disabled={salvando}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Save size={16} />
          {salvando ? 'Salvando...' : 'Salvar Fotos e Vistoria'}
        </button>
      </div>
    </div>
  )
}

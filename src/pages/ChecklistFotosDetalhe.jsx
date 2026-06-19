import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, Trash2, CheckCircle2, AlertTriangle,
  Save, User, Clock, Car, X, ZoomIn, ChevronLeft, ChevronRight, MessageCircle
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { uploadFoto } from '../supabase'

// ─── Constantes iguais ao original ───────────────────────────
const CATEGORIAS = [
  'Frente', 'Traseira', 'Lateral Esq.', 'Lateral Dir.',
  'Painel', 'Motor', 'Chassi', 'Teto', 'Interior', 'Rodas', 'Outros',
]

const INSPECAO_ITENS = [
  { id: 'farois',     label: 'Faróis (alto/baixo)' },
  { id: 'lanternas',  label: 'Lanternas traseiras' },
  { id: 'pisca',      label: 'Pisca-alerta e setas' },
  { id: 'luz_re',     label: 'Luz de ré' },
  { id: 'luz_freio',  label: 'Luz de freio' },
  { id: 'limpadores', label: 'Limpadores de para-brisa' },
  { id: 'lavadores',  label: 'Lavadores de para-brisa' },
  { id: 'ar_cond',    label: 'Ar-condicionado' },
  { id: 'vidros',     label: 'Vidros elétricos' },
  { id: 'buzina',     label: 'Buzina' },
]

// ─── Compressão de imagem (igual ao original — 70% JPEG, max 1280) ───────────
function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = ev => {
      const img = new Image()
      img.src = ev.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1280
        let w = img.width, h = img.height
        if (w > h) {
          if (w > MAX) { h = h * MAX / w; w = MAX }
        } else {
          if (h > MAX) { w = w * MAX / h; h = MAX }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (blob) resolve(blob)
          else reject(new Error('Erro na compressão'))
        }, 'image/jpeg', 0.7) // 70% — igual ao original
      }
    }
    reader.onerror = err => reject(err)
  })
}

// ─── Item de vistoria (igual ao InspectionItemRow do original) ───────────────
function InspecaoItem({ item, onUpdate }) {
  const [nota, setNota] = useState(item.nota || '')

  function handleStatus(novoStatus) {
    // Toggle: clicar no mesmo status remove (undefined)
    const final = item.status === novoStatus ? undefined : novoStatus
    onUpdate(item.id, final, nota)
  }

  function handleNotaBlur() {
    if (nota !== item.nota) {
      onUpdate(item.id, item.status, nota)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="font-semibold text-slate-700 text-sm">{item.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => handleStatus('ok')} title="OK"
            className={`p-2 rounded-lg border transition-all ${
              item.status === 'ok'
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-green-400 hover:text-green-500'
            }`}>
            <CheckCircle2 size={18} />
          </button>
          <button onClick={() => handleStatus('warning')} title="Atenção"
            className={`p-2 rounded-lg border transition-all ${
              item.status === 'warning'
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-500'
            }`}>
            <AlertTriangle size={18} />
          </button>
          <button onClick={() => handleStatus('issue')} title="Problema"
            className={`p-2 rounded-lg border transition-all ${
              item.status === 'issue'
                ? 'bg-red-500 border-red-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-500'
            }`}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Campo de nota — aparece quando qualquer status é selecionado (igual ao original) */}
      {item.status && (
        <div className="mt-3">
          <input
            type="text"
            placeholder="Adicionar observação (opcional)..."
            value={nota}
            onChange={e => setNota(e.target.value)}
            onBlur={handleNotaBlur}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 transition-colors"
          />
          <p className="text-[10px] text-slate-400 mt-1 text-right">
            Clique fora para salvar a observação.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function ChecklistFotosDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { checklists, setChecklists } = useApp()

  const ck = checklists.find(c => String(c.id) === id)

  const [fotos, setFotos] = useState(() => ck?.fotos || [])
  const [inspecao, setInspecao] = useState(() =>
    ck?.inspecaoVisual?.length > 0
      ? ck.inspecaoVisual
      : INSPECAO_ITENS.map(i => ({ ...i, status: undefined, nota: '' }))
  )
  const [salvando, setSalvando] = useState(false)
  const [categoriaAtual, setCategoriaAtual] = useState('Outros')
  const [uploading, setUploading] = useState(null)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const inputRef = useRef(null)

  const todasFotos = fotos

  function abrirFoto(foto) {
    setFotoAmpliada(foto)
  }

  function fecharFoto() {
    setFotoAmpliada(null)
  }

  function navegarFoto(direcao) {
    const idx = todasFotos.findIndex(f => f.id === fotoAmpliada.id)
    const novo = idx + direcao
    if (novo >= 0 && novo < todasFotos.length) setFotoAmpliada(todasFotos[novo])
  }

  if (!ck) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Checklist não encontrado.</p>
        <button onClick={() => navigate('/checklist/fotos')} className="mt-3 text-primary-500 text-sm">
          ← Voltar
        </button>
      </div>
    )
  }

  function abrirUpload(cat) {
    setCategoriaAtual(cat)
    setTimeout(() => inputRef.current?.click(), 10)
  }

  function salvarNoContexto(novasFotos, novaInspecao) {
    setChecklists(prev => prev.map(c =>
      c.id === ck.id
        ? { ...c, fotos: novasFotos, inspecaoVisual: novaInspecao }
        : c
    ))
  }

  async function handleFile(e) {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    setUploading(categoriaAtual)
    try {
      const blob = await comprimirImagem(file)
      const caminho = `fotos/checklists/${ck.id}/${Date.now()}.jpg`
      const url = await uploadFoto(blob, caminho)
      const novaFoto = {
        id: Date.now() + Math.random(),
        url,
        categoria: categoriaAtual,
        timestamp: new Date().toLocaleString('pt-BR'),
      }
      const novasFotos = [...fotos, novaFoto]
      setFotos(novasFotos)
      salvarNoContexto(novasFotos, inspecao)
    } catch {
      alert('Erro ao enviar imagem.')
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  function removerFoto(fotoId) {
    const novasFotos = fotos.filter(f => f.id !== fotoId)
    setFotos(novasFotos)
    salvarNoContexto(novasFotos, inspecao)
  }

  function atualizarInspecao(itemId, status, nota) {
    const novaInspecao = inspecao.map(i =>
      i.id === itemId ? { ...i, status, nota } : i
    )
    setInspecao(novaInspecao)
    salvarNoContexto(fotos, novaInspecao)
  }

  function salvar() {
    setSalvando(true)
    salvarNoContexto(fotos, inspecao)
    setTimeout(() => { setSalvando(false); navigate('/checklist/fotos') }, 500)
  }

  const fotosPorCat = CATEGORIAS.map(cat => ({
    cat, lista: fotos.filter(f => f.categoria === cat),
  }))

  const inspecaoDone = inspecao.filter(i => i.status !== undefined).length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Lightbox ── */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={fecharFoto}
        >
          {/* Fechar */}
          <button
            onClick={fecharFoto}
            className="absolute top-4 right-4 z-10 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Anterior */}
          {todasFotos.findIndex(f => f.id === fotoAmpliada.id) > 0 && (
            <button
              onClick={e => { e.stopPropagation(); navegarFoto(-1) }}
              className="absolute left-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Imagem */}
          <img
            src={fotoAmpliada.url || fotoAmpliada.dataUrl}
            alt="Foto ampliada"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* Próxima */}
          {todasFotos.findIndex(f => f.id === fotoAmpliada.id) < todasFotos.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); navegarFoto(1) }}
              className="absolute right-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* Info */}
          <div className="absolute bottom-4 flex items-center gap-3 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full">
            <span className="font-medium">{fotoAmpliada.categoria}</span>
            {fotoAmpliada.timestamp && <><span>·</span><span>{fotoAmpliada.timestamp}</span></>}
            <span>·</span>
            <span>{todasFotos.findIndex(f => f.id === fotoAmpliada.id) + 1} / {todasFotos.length}</span>
          </div>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/checklist/fotos')}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <Car size={15} className="text-slate-400" />
            {ck.veiculoModelo || '—'}
            {ck.veiculoPlaca && (
              <span className="font-mono text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {ck.veiculoPlaca}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><User size={11} /> {ck.clienteNome}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {ck.criadoEm?.split(' ')[0]}</span>
            <span className="text-slate-300">·</span>
            <span>{fotos.length} foto(s)</span>
          </div>
        </div>
        <button
          onClick={() => {
            const url = `${window.location.origin}/vistoria/${ck.id}`
            const tel = (ck.clienteTelefone || '').replace(/\D/g, '')
            const texto = `Olá ${ck.clienteNome || ''}! Segue o link para visualizar as fotos e a vistoria do seu veículo ${ck.veiculoModelo || ''} (${ck.veiculoPlaca || ''}):\n\n${url}\n\n_Magayver Injecar_`
            const href = tel
              ? `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`
              : `https://wa.me/?text=${encodeURIComponent(texto)}`
            window.open(href, '_blank')
          }}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap"
        >
          <MessageCircle size={15} />
          <span className="hidden sm:inline">Enviar Link para Cliente</span>
          <span className="sm:hidden">WhatsApp</span>
        </button>
      </div>

      {/* Input de arquivo oculto — 1 por vez, igual ao original */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {/* ── Fotos por categoria (grid 2/3/4 igual ao original) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Camera size={14} className="text-cyan-500" />
          <h3 className="text-sm font-semibold text-slate-700">Fotos do Veículo</h3>
          <span className="ml-auto text-xs text-slate-400">{fotos.length} foto(s)</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {fotosPorCat.map(({ cat, lista }) => (
              <div key={cat} className={cat === 'Outros' ? 'col-span-2 sm:col-span-1' : ''}>
                {/* Título da categoria */}
                <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  {cat}
                  {lista.length > 1 && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">
                      {lista.length}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Fotos existentes */}
                  {lista.map((foto, idx) => (
                    <div key={foto.id}
                      className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in"
                      onClick={() => abrirFoto(foto)}>
                      <img src={foto.url || foto.dataUrl} alt={`${cat} ${idx + 1}`}
                        className="w-full h-full object-cover" />
                      {/* Badge de categoria */}
                      <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                        {cat}
                      </div>
                      {/* Botões ao hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button onClick={e => { e.stopPropagation(); abrirFoto(foto) }}
                          className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-colors shadow-lg">
                          <ZoomIn size={16} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); removerFoto(foto.id) }}
                          className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors shadow-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Botão adicionar (vazio ou "Outros") */}
                  {(cat === 'Outros' || lista.length === 0) && (
                    <button onClick={() => abrirUpload(cat)}
                      disabled={uploading === cat}
                      className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
                        uploading === cat
                          ? 'border-cyan-400 bg-cyan-50'
                          : 'border-slate-200 hover:border-cyan-400 hover:bg-cyan-50 text-slate-400 hover:text-cyan-600'
                      }`}>
                      {uploading === cat ? (
                        <span className="text-xs font-bold text-cyan-600 uppercase">Processando...</span>
                      ) : (
                        <>
                          <Camera size={22} />
                          <span className="text-[11px] font-bold uppercase">
                            {lista.length > 0 ? 'Adicionar Mais' : 'Adicionar Foto'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vistoria do Veículo (igual ao InspectionItemRow do original) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-700">Vistoria do Veículo</h3>
          <span className="ml-auto text-xs text-slate-400">
            {inspecaoDone}/{inspecao.length} itens
          </span>
        </div>
        <div className="p-4 space-y-2">
          {inspecao.map(item => (
            <InspecaoItem key={item.id} item={item} onUpdate={atualizarInspecao} />
          ))}
        </div>
      </div>

      {/* ── Botões ── */}
      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => navigate('/checklist/fotos')}
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

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  Car, User, Clock, Camera, CheckCircle2, AlertTriangle,
  X, ChevronLeft, ChevronRight, ZoomIn, Phone, Loader2
} from 'lucide-react'

function row2item(row) {
  const numId = Number(row.id)
  const id = Number.isFinite(numId) && String(numId) === row.id ? numId : row.id
  return { id, ...row.data }
}

const STATUS_BADGE = {
  ok:      { label: 'OK',       cls: 'bg-green-100 text-green-700 border-green-200' },
  warning: { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  issue:   { label: 'Problema', cls: 'bg-red-100 text-red-700 border-red-200' },
}

export default function VistoriaCliente() {
  const { id } = useParams()

  const [ck, setCk] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Verificação de telefone
  const [telefone, setTelefone] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroTelefone, setErroTelefone] = useState('')

  const [fotoAmpliada, setFotoAmpliada] = useState(null)

  useEffect(() => {
    async function carregar() {
      if (!id) { setErro('Link inválido.'); setCarregando(false); return }
      const { data, error } = await supabase
        .from('checklists').select('id, data').eq('id', id)
      if (error || !data?.length) {
        setErro('Vistoria não encontrada. Peça à oficina um novo link.')
        setCarregando(false)
        return
      }
      setCk(row2item(data[0]))
      setCarregando(false)
    }
    carregar()
  }, [id])

  // Mesma lógica da ClienteAssinatura
  function verificarTelefone(e) {
    e.preventDefault()
    setErroTelefone('')
    const input = telefone.replace(/\D/g, '')
    const stored = (ck?.clienteTelefone || '').replace(/\D/g, '')

    if (!stored) { setAutenticado(true); return }

    if (input.length < 8) {
      setErroTelefone('Digite pelo menos 8 dígitos.')
      return
    }

    if (input === stored || stored.endsWith(input)) {
      setAutenticado(true)
    } else {
      setErroTelefone('Número não confere com o cadastrado. Tente novamente.')
    }
  }

  const fotos = ck?.fotos || []
  const inspecao = ck?.inspecaoVisual || []

  function navegarFoto(direcao) {
    const idx = fotos.findIndex(f => f.id === fotoAmpliada.id)
    const novo = idx + direcao
    if (novo >= 0 && novo < fotos.length) setFotoAmpliada(fotos[novo])
  }

  // ── Loading ──
  if (carregando) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
    </div>
  )

  // ── Erro ──
  if (erro) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center border-l-4 border-red-500">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Link Inválido</h1>
        <p className="text-slate-400">{erro}</p>
      </div>
    </div>
  )

  // ── Verificação de telefone ──
  if (!autenticado) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
        <div className="bg-orange-600 p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-1">Fotos e Vistoria</h1>
          <p className="text-orange-100 text-sm">Magayver Injecar</p>
        </div>
        <div className="p-8">
          <div className="mb-6 text-center">
            <p className="text-slate-300">
              Olá, <strong className="text-white">{ck?.clienteNome?.split(' ')[0] || 'Cliente'}</strong>
            </p>
            {(ck?.veiculoModelo || ck?.veiculoPlaca) && (
              <p className="text-xs text-slate-500 mt-1">
                {ck.veiculoModelo}
                {ck.veiculoPlaca ? ` · ${ck.veiculoPlaca}` : ''}
              </p>
            )}
          </div>

          <form onSubmit={verificarTelefone} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Confirme seu Telefone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => {
                    const val = e.target.value
                    if (val.replace(/\D/g, '').length <= 11) setTelefone(val)
                  }}
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                  required
                  className="w-full pl-10 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Digite o número de WhatsApp ou telefone informado no cadastro.
              </p>
            </div>

            {erroTelefone && (
              <div className="p-3 bg-red-900/20 text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-900/30">
                <AlertTriangle size={16} /> {erroTelefone}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors active:scale-95"
            >
              Acessar Fotos e Vistoria
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  // ── Conteúdo autenticado ──
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Lightbox */}
      {fotoAmpliada && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setFotoAmpliada(null)}>
          <button onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><X size={24} /></button>
          {fotos.findIndex(f => f.id === fotoAmpliada.id) > 0 && (
            <button onClick={e => { e.stopPropagation(); navegarFoto(-1) }} className="absolute left-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronLeft size={28} /></button>
          )}
          <img src={fotoAmpliada.url || fotoAmpliada.dataUrl} alt="Foto ampliada" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          {fotos.findIndex(f => f.id === fotoAmpliada.id) < fotos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); navegarFoto(1) }} className="absolute right-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronRight size={28} /></button>
          )}
          <div className="absolute bottom-4 flex items-center gap-3 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full">
            <span className="font-medium">{fotoAmpliada.categoria}</span>
            {fotoAmpliada.timestamp && <><span>·</span><span>{fotoAmpliada.timestamp}</span></>}
            <span>·</span>
            <span>{fotos.findIndex(f => f.id === fotoAmpliada.id) + 1} / {fotos.length}</span>
          </div>
        </div>
      )}

      {/* Header da oficina */}
      <div className="bg-slate-900 text-white px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Car size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">Magayver Injecar</p>
          <p className="text-xs text-slate-400 leading-tight">Vistoria do Veículo</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Info do veículo */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Car size={20} className="text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-800">
                {ck.veiculoModelo || '—'}
                {ck.veiculoPlaca && (
                  <span className="ml-2 font-mono text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {ck.veiculoPlaca}
                  </span>
                )}
              </h1>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                {ck.clienteNome && <span className="flex items-center gap-1"><User size={11} />{ck.clienteNome}</span>}
                {ck.criadoEm && <span className="flex items-center gap-1"><Clock size={11} />{ck.criadoEm?.split(' ')[0]}</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">
              <Camera size={11} /> Somente visualização
            </span>
            <span>{fotos.length} foto(s) · {inspecao.filter(i => i.status).length} item(ns) vistoriado(s)</span>
          </div>
        </div>

        {/* Fotos */}
        {fotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Camera size={14} className="text-cyan-500" />
              <h2 className="text-sm font-semibold text-slate-700">Fotos do Veículo</h2>
              <span className="ml-auto text-xs text-slate-400">{fotos.length} foto(s)</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {fotos.map((foto, idx) => (
                  <div key={foto.id || idx} className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in"
                    onClick={() => setFotoAmpliada(foto)}>
                    <img src={foto.url || foto.dataUrl} alt={foto.categoria} className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                      {foto.categoria}
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-full shadow-lg">
                        <ZoomIn size={18} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {fotos.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
            Nenhuma foto registrada nesta vistoria.
          </div>
        )}

        {/* Vistoria visual */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500" />
            <h2 className="text-sm font-semibold text-slate-700">Checklist Visual</h2>
            <span className="ml-auto text-xs text-slate-400">{inspecao.filter(i => i.status).length} item(ns)</span>
          </div>
          <div className="divide-y divide-slate-50">
            {inspecao.map(item => {
              const badge = STATUS_BADGE[item.status]
              return (
                <div key={item.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                    {badge ? (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${badge.cls}`}>
                        {item.status === 'ok' && <CheckCircle2 size={11} />}
                        {item.status === 'warning' && <AlertTriangle size={11} />}
                        {item.status === 'issue' && <X size={11} />}
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 flex-shrink-0">—</span>
                    )}
                  </div>
                  {item.nota && badge && (
                    <p className="text-xs text-slate-500 italic mt-1">"{item.nota}"</p>
                  )}
                </div>
              )
            })}
            {inspecao.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Nenhum item de vistoria registrado.</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          Documento gerado por Magayver Injecar · sistema.magayverinjecar.com
        </p>
      </div>
    </div>
  )
}

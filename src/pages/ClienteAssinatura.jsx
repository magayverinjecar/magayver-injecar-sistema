import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { CheckCircle, AlertTriangle, Phone, Eraser, Loader2 } from 'lucide-react'

// ─── Canvas de assinatura (igual ao PainelAssinatura do ChecklistNovo) ──────
function PainelAssinatura({ onSave, onClear }) {
  const canvasRef = useRef(null)
  const [desenhando, setDesenhando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function coords(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if (e.touches) return {
      x: (e.touches[0].clientX - rect.left) * sx,
      y: (e.touches[0].clientY - rect.top) * sy,
    }
    return {
      x: (e.nativeEvent?.offsetX ?? e.clientX - rect.left) * sx,
      y: (e.nativeEvent?.offsetY ?? e.clientY - rect.top) * sy,
    }
  }

  function iniciar(e) {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = coords(e)
    ctx.beginPath(); ctx.moveTo(x, y)
    setDesenhando(true)
  }

  function desenhar(e) {
    e.preventDefault()
    if (!desenhando) return
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = coords(e)
    ctx.lineTo(x, y); ctx.stroke()
    setTemAssinatura(true)
  }

  function parar(e) {
    e?.preventDefault()
    if (!desenhando) return
    setDesenhando(false)
    onSave(canvasRef.current.toDataURL('image/png'))
  }

  function limpar() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
    onClear()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full bg-white rounded-xl overflow-hidden border-2 border-dashed border-slate-400 shadow-inner">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full cursor-crosshair touch-none block"
          onMouseDown={iniciar} onMouseMove={desenhar}
          onMouseUp={parar} onMouseLeave={parar}
          onTouchStart={iniciar} onTouchMove={desenhar} onTouchEnd={parar}
        />
        {!temAssinatura && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-300 text-base select-none">Assine aqui</p>
          </div>
        )}
        <button type="button" onClick={limpar}
          className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-colors">
          <Eraser size={16} />
        </button>
      </div>
      <p className="text-[11px] text-slate-400">Desenhe sua assinatura na área acima</p>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function ClienteAssinatura() {
  const { id } = useParams()

  const [checklist, setChecklist] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Verificação por telefone
  const [telefone, setTelefone] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroTelefone, setErroTelefone] = useState('')

  // Assinatura e envio
  const [assinatura, setAssinatura] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    async function carregar() {
      if (!id) { setErro('Link inválido ou expirado.'); setCarregando(false); return }
      const { data, error } = await supabase
        .from('checklists').select('id, data').eq('id', id)
      if (error || !data?.length) {
        setErro('Checklist não encontrado. Peça à oficina um link atualizado.')
        setCarregando(false)
        return
      }
      const ck = { id: data[0].id, ...data[0].data }
      setChecklist(ck)
      if (ck.assinatura) setSucesso(true)
      setCarregando(false)
    }
    carregar()
  }, [id])

  function verificarTelefone(e) {
    e.preventDefault()
    setErroTelefone('')
    const input = telefone.replace(/\D/g, '')
    const stored = (checklist?.clienteTelefone || '').replace(/\D/g, '')

    // Se não tem telefone cadastrado, libera direto
    if (!stored) { setAutenticado(true); return }

    // Aceita: número completo, 8 últimos dígitos ou 4 últimos dígitos
    if (
      input === stored ||
      (stored.length >= 8 && stored.slice(-8) === input.slice(-8)) ||
      (stored.length >= 4 && stored.slice(-4) === input.slice(-4))
    ) {
      setAutenticado(true)
    } else {
      setErroTelefone('Número não confere com o cadastro. Tente novamente.')
    }
  }

  async function confirmar() {
    if (!assinatura || !checklist) return
    setEnviando(true)
    try {
      const { id: ckId, ...rest } = checklist
      const dataAtualizado = { ...rest, assinatura, assinaturaTempo: Date.now() }
      const { error } = await supabase
        .from('checklists')
        .upsert({ id: String(ckId), data: dataAtualizado })
      if (error) throw error
      setSucesso(true)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar assinatura. Tente novamente.')
    } finally {
      setEnviando(false)
    }
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

  // ── Sucesso ──
  if (sucesso) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center border border-slate-700">
        <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Tudo Certo!</h1>
        <p className="text-slate-300 mb-6">
          Sua autorização foi recebida com sucesso.<br />
          A equipe <strong className="text-orange-400">Magayver Injecar</strong> agradece.
        </p>
        <p className="text-xs text-slate-500">Você pode fechar esta janela agora.</p>
      </div>
    </div>
  )

  // ── Verificação de telefone ──
  if (!autenticado) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
        <div className="bg-orange-600 p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-1">Autorização de Serviço</h1>
          <p className="text-orange-100 text-sm">Magayver Injecar</p>
        </div>
        <div className="p-8">
          <div className="mb-6 text-center">
            <p className="text-slate-300">
              Olá, <strong className="text-white">{checklist?.clienteNome?.split(' ')[0] || 'Cliente'}</strong>
            </p>
            {(checklist?.veiculoModelo || checklist?.veiculoPlaca) && (
              <p className="text-xs text-slate-500 mt-1">
                {checklist.veiculoModelo}
                {checklist.veiculoPlaca ? ` · ${checklist.veiculoPlaca}` : ''}
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
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(XX) XXXXX-XXXX"
                  required
                  className="w-full pl-10 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Digite o número informado no cadastro.</p>
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
              Acessar Autorização
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  // ── Tela de assinatura ──
  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-slate-950 p-6 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">Autorização de Diagnóstico</h1>
          <p className="text-xs text-slate-400 mt-1">
            {checklist.clienteNome}
            {(checklist.veiculoModelo || checklist.veiculoPlaca) &&
              ` · ${checklist.veiculoModelo || ''} ${checklist.veiculoPlaca ? `(${checklist.veiculoPlaca})` : ''}`
            }
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Texto legal (igual ao original) */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 text-sm text-slate-300 leading-relaxed text-justify space-y-2">
            <p>
              <strong className="text-white">Autorizo a Magayver Injecar</strong> a realizar o diagnóstico
              técnico eletrônico (injeção eletrônica e sistemas eletrônicos) do meu veículo.
            </p>
            <p>Declaro que recebi informações claras sobre o serviço (CDC art. 6°, III).</p>
            <p>
              Estou ciente de que o diagnóstico é um serviço cobrado, mesmo que a causa identificada
              seja mecânica (serviço mecânico não realizado pela oficina).
            </p>
            <p>
              Qualquer reparo e/ou troca de peças somente será feito mediante orçamento prévio
              e autorização expressa do cliente (CDC arts. 39, VI e 40).
            </p>
          </div>

          {/* Pad de assinatura */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wide text-center">
              Assine Abaixo
            </label>
            <PainelAssinatura
              onSave={data => setAssinatura(data)}
              onClear={() => setAssinatura(null)}
            />
            {assinatura && (
              <p className="text-center text-xs text-green-400 font-medium flex items-center justify-center gap-1">
                <CheckCircle size={14} /> Assinatura capturada
              </p>
            )}
          </div>

          {/* Botão confirmar */}
          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={confirmar}
              disabled={!assinatura || enviando}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg active:scale-95"
            >
              {enviando
                ? <><Loader2 className="animate-spin" size={20} /> Confirmando...</>
                : <><CheckCircle size={20} /> Confirmar Autorização</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, uploadAssinatura } from '../supabase'
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
      {/* Branco fixo: no modo escuro a classe bg-white vira #1e293b, a mesma cor
          do traço — o cliente assinaria sem enxergar o que está desenhando. */}
      <div style={{ backgroundColor: '#ffffff' }}
        className="relative w-full rounded-xl overflow-hidden border-2 border-dashed border-slate-400 shadow-inner">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full cursor-crosshair touch-none block"
          onMouseDown={iniciar} onMouseMove={desenhar}
          onMouseUp={parar} onMouseLeave={parar}
          onTouchStart={iniciar} onTouchMove={desenhar} onTouchEnd={parar}
        />
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${temAssinatura ? 'opacity-0' : 'opacity-100'}`} translate="no">
          <p className="text-slate-300 text-base select-none">Assine aqui</p>
        </div>
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
  const [erro] = useState(id ? '' : 'Link inválido ou expirado.')

  // Verificação por telefone
  const [telefone, setTelefone] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroTelefone, setErroTelefone] = useState('')
  const [verificando, setVerificando] = useState(false)

  // Assinatura e envio
  const [assinatura, setAssinatura] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')

  // Nao ha mais nada para carregar antes do telefone.
  //
  // Antes esta tela baixava a OS inteira ao abrir e SO DEPOIS perguntava o
  // telefone, para decidir se mostrava. Ou seja: a conferencia era enfeite —
  // quem abrisse o link e olhasse o trafego via tudo sem digitar nada. E
  // cliente sem telefone cadastrado abria direto, para qualquer um que
  // recebesse o link encaminhado.
  //
  // Agora quem confere e o servidor, e o dado so sai do banco depois de o
  // telefone bater. E o mesmo caminho que continuara funcionando quando as
  // tabelas deixarem de ser legiveis por quem nao tem login.

  const MENSAGEM_DO_ERRO = {
    'telefone-curto': 'Digite pelo menos 8 dígitos.',
    'telefone-nao-confere': 'Número não confere com o cadastrado. Tente novamente.',
    'nao-encontrada': 'Registro não encontrado. Peça à oficina um link atualizado.',
    'sem-telefone': 'Seu telefone não está no cadastro da oficina. Entre em contato com a oficina para liberar a assinatura.',
  }

  async function verificarTelefone(e) {
    e.preventDefault()
    setErroTelefone('')
    const input = telefone.replace(/\D/g, '')
    if (input.length < 8) { setErroTelefone(MENSAGEM_DO_ERRO['telefone-curto']); return }

    setVerificando(true)
    try {
      const { data, error } = await supabase.rpc('os_do_cliente', { p_id: id, p_tel: input })
      if (error) throw error
      if (!data?.ok) {
        setErroTelefone(MENSAGEM_DO_ERRO[data?.erro] || 'Não consegui abrir este link. Fale com a oficina.')
        return
      }
      const os = { id: data.id, ...data.os }
      setChecklist(os)
      if (os.assinatura) setSucesso(true)
      setAutenticado(true)
    } catch (err) {
      console.error('[assinatura] falha ao abrir a OS:', err)
      setErroTelefone('Não consegui falar com o servidor. Verifique a internet e tente de novo.')
    } finally {
      setVerificando(false)
    }
  }

  async function confirmar() {
    if (!assinatura || !checklist) return
    setEnviando(true)
    setErroEnvio('')
    try {
      const ckId = String(checklist.id)
      // A rubrica vira arquivo no Storage e a linha guarda só a URL — o base64
      // embutido inflava a tabela. Se o upload falhar, salva embutida como
      // antes: a assinatura do cliente nunca se perde por causa de otimização.
      let assinaturaFinal = assinatura
      try {
        assinaturaFinal = await uploadAssinatura(assinatura, `${ckId.replace(/[^A-Za-z0-9_-]/g, '-')}-${Date.now()}`)
      } catch (e) { console.error('[assinatura] upload falhou, salvando embutida:', e) }

      // Grava pela mesma funcao que conferiu o telefone. Antes esta tela lia e
      // escrevia a tabela direto — o que so funcionava porque o banco estava
      // aberto para qualquer visitante. E a conferencia ficava no navegador,
      // onde nao vale nada.
      const digitos = telefone.replace(/\D/g, '')
      const { data, error } = await supabase.rpc('assinar_os', {
        p_id: ckId, p_tel: digitos, p_assinatura: assinaturaFinal, p_tempo: Date.now(),
      })
      if (error) throw error
      if (!data?.ok) {
        // "Ja assinada" nao e falha: o cliente ja cumpriu a parte dele. Pode
        // acontecer quando ele volta no link antigo depois de assinar.
        if (data?.erro === 'ja-assinada') { setSucesso(true); return }
        setErroEnvio(MENSAGEM_DO_ERRO[data?.erro] || 'Não consegui salvar a assinatura. Fale com a oficina.')
        return
      }
      setSucesso(true)
    } catch (err) {
      console.error(err)
      setErroEnvio('Erro ao salvar assinatura. Verifique sua conexão e tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

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
              <p className="text-xs text-slate-500 mt-1">Digite o número informado no cadastro.</p>
            </div>

            {erroTelefone && (
              <div className="p-3 bg-red-900/20 text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-900/30">
                <AlertTriangle size={16} /> {erroTelefone}
              </div>
            )}

            <button
              type="submit"
              disabled={verificando}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors active:scale-95"
            >
              {verificando ? 'Conferindo…' : 'Acessar Autorização'}
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
          <div className="pt-4 border-t border-slate-700 space-y-3">
            {erroEnvio && (
              <div className="p-3 bg-red-900/20 text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-900/30">
                <AlertTriangle size={16} /> {erroEnvio}
              </div>
            )}
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

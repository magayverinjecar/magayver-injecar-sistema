import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import gerarId from '../utils/id'
import {
  ArrowLeft, ArrowRight, Check, User, Car, AlertTriangle,
  PenTool, Search, Eraser, Smartphone, Link, MessageSquare, Copy, Save
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase, uploadAssinatura } from '../supabase'

const DASHBOARD_LIGHTS = [
  'Injeção (Check Engine)', 'Bateria / Alternador', 'Pressão de Óleo',
  'Freio / Fluido', 'Temperatura Motor', 'ABS', 'Airbag (SRS)',
  'EPC (Aceleração)', 'Direção Assistida', 'Controle Estabilidade (ESP)',
  'Pressão Pneus (TPMS)', 'Câmbio / Transmissão', 'Filtro de Partículas',
  'Imobilizador (Code)', 'Pastilha de Freio', 'Pré-aquecimento (Velas)',
]

const COMBUSTIVEIS = ['Gasolina', 'Etanol', 'Diesel', 'Misturado']

// A recepção registra dados e defeito. As fotos e a vistoria de entrada são
// feitas depois pelo reparador, no login dele, na tela Fotos e Vistoria.
const PASSOS = [
  { num: 1, label: 'Cliente',    icon: User },
  { num: 2, label: 'Veículo',    icon: Car },
  { num: 3, label: 'Problema',   icon: AlertTriangle },
  { num: 4, label: 'Assinatura', icon: PenTool },
]
const ULTIMO_PASSO = PASSOS.length

function formatTelefone(v) {
  const raw = v.replace(/\D/g, '').slice(0, 11)
  if (raw.length > 10) return raw.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (raw.length > 6)  return raw.replace(/^(\d{2})(\d{4,5})(\d+)/, '($1) $2-$3')
  if (raw.length > 2)  return raw.replace(/^(\d{2})(\d+)/, '($1) $2')
  return raw
}

function formatPlaca(v) {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length <= 3) return raw
  return raw.slice(0, 3) + '-' + raw.slice(3, 7)
}

function formatCep(v) {
  const raw = v.replace(/\D/g, '').slice(0, 8)
  if (raw.length > 5) return raw.slice(0, 5) + '-' + raw.slice(5)
  return raw
}

function Campo({ label, obrigatorio, erro, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}{obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !erro && <p className="text-slate-400 text-xs mt-1">{hint}</p>}
      {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}
    </div>
  )
}

function CampoInput({ label, obrigatorio, erro, hint, ...inputProps }) {
  return (
    <Campo label={label} obrigatorio={obrigatorio} erro={erro} hint={hint}>
      <input
        className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all
          ${erro ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
        {...inputProps}
      />
    </Campo>
  )
}

function PainelAssinatura({ onSave, onClear, assinaturaInicial }) {
  const canvasRef = useRef(null)
  const [desenhando, setDesenhando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(!!assinaturaInicial)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (assinaturaInicial) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = assinaturaInicial
    }
  }, [])

  function coords(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const sx = canvasRef.current.width / rect.width
    const sy = canvasRef.current.height / rect.height
    if (e.touches) return {
      x: (e.touches[0].clientX - rect.left) * sx,
      y: (e.touches[0].clientY - rect.top) * sy,
    }
    return { x: e.nativeEvent.offsetX * sx, y: e.nativeEvent.offsetY * sy }
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
    e.preventDefault()
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
      {/* Branco fixo — ver comentário em ClienteAssinatura: no modo escuro o
          fundo ficaria da mesma cor do traço. */}
      <div style={{ backgroundColor: '#ffffff' }}
        className="relative w-full border-2 border-dashed border-slate-300 rounded-xl overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef} width={600} height={200}
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
          <Eraser size={14} />
        </button>
      </div>
      <p className="text-xs text-slate-400">Use o mouse ou o dedo para assinar</p>
    </div>
  )
}

export default function NovaEntrada() {
  const { clientes, veiculos, setClientes, setVeiculos, novaOrdem, veiculosPorCliente } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [passo, setPasso] = useState(1)
  const [erros, setErros] = useState({})
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Rascunho local
  const RASCUNHO_KEY = 'nova-entrada-rascunho'
  const rascunhoRef = useRef(null)

  const [buscaCliente, setBuscaCliente] = useState('')
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [clienteId, setClienteId] = useState(null)
  const [docType, setDocType] = useState('CPF')
  const [cliente, setCliente] = useState({
    nome: '', telefone: '', telefone2: '', cpfCnpj: '',
    email: '', endereco: '', numero: '', bairro: '', cidadeEstado: '', cep: '',
  })

  const [veiculoId, setVeiculoId] = useState(null)
  const [veiculo, setVeiculo] = useState({
    modelo: '', placa: '', motor: '', cor: '', ano: '',
    kmEntrada: '', ultimaRevisao: '', numCondutores: '', combustivel: 'Gasolina',
  })
  const [luzesPainel, setLuzesPainel] = useState([])
  const [relatoCliente, setRelatoCliente] = useState('')
  const [assinatura, setAssinatura] = useState(null)


  // Restaurar rascunho do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RASCUNHO_KEY)
      if (saved) {
        const d = JSON.parse(saved)
        if (d.cliente) setCliente(d.cliente)
        if (d.veiculo) setVeiculo(d.veiculo)
        if (d.clienteId) setClienteId(d.clienteId)
        if (d.veiculoId) setVeiculoId(d.veiculoId)
        if (d.luzesPainel) setLuzesPainel(d.luzesPainel)
        if (d.relatoCliente) setRelatoCliente(d.relatoCliente)
        if (d.buscaCliente) setBuscaCliente(d.buscaCliente)
      }
    } catch {}
  }, [])

  // Auto-save local a cada 2s
  useEffect(() => {
    if (!cliente.nome.trim() && !veiculo.placa.trim()) return
    clearTimeout(rascunhoRef.current)
    rascunhoRef.current = setTimeout(() => {
      try {
        localStorage.setItem(RASCUNHO_KEY, JSON.stringify({
          cliente, veiculo, clienteId, veiculoId, luzesPainel, relatoCliente, buscaCliente,
        }))
      } catch {}
    }, 2000)
    return () => clearTimeout(rascunhoRef.current)
  }, [cliente, veiculo, clienteId, veiculoId, luzesPainel, relatoCliente, buscaCliente])

  const clientesFiltrados = clientes.filter(c =>
    buscaCliente.trim().length >= 2 &&
    (c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()) ||
     c.telefone?.includes(buscaCliente))
  )

  function selecionarCliente(c) {
    setClienteId(c.id)
    setCliente({
      nome: c.nome || '', telefone: c.telefone || '', telefone2: c.telefone2 || '',
      cpfCnpj: c.cpfCnpj || '', email: c.email || '',
      endereco: c.endereco || '', numero: c.numero || '',
      bairro: c.bairro || '', cidadeEstado: c.cidadeEstado || '', cep: c.cep || '',
    })
    setBuscaCliente(c.nome)
    setMostrarDropdown(false)
    setVeiculoId(null)
    setVeiculo({ modelo: '', placa: '', motor: '', cor: '', ano: '', kmEntrada: '', ultimaRevisao: '', numCondutores: '', combustivel: 'Gasolina' })
  }

  function selecionarVeiculo(v) {
    setVeiculoId(v.id)
    setVeiculo({
      modelo: `${v.marca || ''} ${v.modelo || ''}`.trim(),
      placa: v.placa || '', motor: v.motor || '', cor: v.cor || '',
      ano: v.ano || '', kmEntrada: '', ultimaRevisao: '',
      numCondutores: '', combustivel: v.combustivel || 'Gasolina',
    })
  }

  function handleDocumento(v) {
    setCliente(p => ({ ...p, cpfCnpj: v }))
    const raw = v.replace(/\D/g, '')
    if (raw.length === 11 || raw.length === 14) {
      const encontrado = clientes.find(c => c.cpfCnpj?.replace(/\D/g, '') === raw)
      if (encontrado) selecionarCliente(encontrado)
    }
  }

  async function buscarCep(cepFmt) {
    const raw = cepFmt.replace(/\D/g, '')
    if (raw.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setCliente(p => ({
          ...p,
          endereco: (data.logradouro || '').toUpperCase(),
          bairro: (data.bairro || '').toUpperCase(),
          cidadeEstado: data.localidade && data.uf
            ? `${data.localidade}/${data.uf}`.toUpperCase()
            : p.cidadeEstado,
        }))
      }
    } catch {}
    setBuscandoCep(false)
  }

  function toggleLuz(luz) {
    setLuzesPainel(p => p.includes(luz) ? p.filter(l => l !== luz) : [...p, luz])
  }

  // Link de assinatura: salva dados mínimos da OS no supabase para o link funcionar
  const [osIdParaLink, setOsIdParaLink] = useState(null)
  async function prepararLink() {
    let id = osIdParaLink
    if (!id) {
      id = 'DRAFT-' + gerarId()
      setOsIdParaLink(id)
    }
    const { error } = await supabase.from('ordens').upsert({
      id: String(id),
      data: {
        clienteNome: cliente.nome,
        clienteTelefone: cliente.telefone,
        veiculoModelo: veiculo.modelo,
        veiculoPlaca: veiculo.placa,
        status: 'Recepção',
        rascunho: true,
      }
    })
    if (error) throw error
    return id
  }

  async function enviarWhatsApp() {
    try {
      const id = await prepararLink()
      const fone = cliente.telefone.replace(/\D/g, '')
      const primeiroNome = cliente.nome.split(' ')[0]
      const link = `${window.location.origin}/assinar/${id}`
      const msg = `Olá ${primeiroNome}, por favor assine a autorização de serviço para o veículo ${veiculo.modelo} (${veiculo.placa}) neste link: ${link}`
      window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (e) {
      console.error('[prepararLink]', e)
      alert('Não foi possível preparar o link. Verifique sua conexão e tente novamente.')
    }
  }

  async function copiarLink() {
    try {
      const id = await prepararLink()
      const link = `${window.location.origin}/assinar/${id}`
      await navigator.clipboard.writeText(link)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2500)
    } catch (e) {
      console.error('[prepararLink]', e)
      alert('Não foi possível preparar o link. Verifique sua conexão e tente novamente.')
    }
  }

  // No computador tudo está na tela ao mesmo tempo, então a conferência é de
  // tudo; no celular, só do passo em que a pessoa está.
  function validar(tudo = false) {
    const e = {}
    if (tudo || passo === 1) {
      if (!cliente.nome.trim()) e.nome = 'Nome obrigatório'
      if (!cliente.telefone.trim()) e.telefone = 'Telefone obrigatório'
    }
    if (tudo || passo === 2) {
      if (!veiculo.modelo.trim()) e.modelo = 'Modelo obrigatório'
      if (!veiculo.placa.trim()) e.placa = 'Placa obrigatória'
    }
    setErros(e)
    return Object.keys(e).length === 0
  }

  // O que ainda falta, dito no rodapé em vez de barrar o caminho. A recepção
  // preenche na ordem da conversa — o cliente fala a placa antes do CPF —,
  // então travar por campo vazio atrapalha mais do que ajuda.
  const faltando = [
    !cliente.nome.trim() && 'nome',
    !cliente.telefone.trim() && 'telefone',
    !veiculo.modelo.trim() && 'modelo',
    !veiculo.placa.trim() && 'placa',
  ].filter(Boolean)

  function proximo() {
    if (validar()) { setPasso(p => p + 1); setErros({}) }
  }
  function anterior() { setPasso(p => p - 1); setErros({}) }

  async function finalizar() {
    if (!validar(true)) {
      alert('Faltam dados obrigatórios: ' + faltando.join(', ') + '.')
      return
    }
    clearTimeout(rascunhoRef.current)

    // O cliente pode ter assinado pelo celular enquanto a recepção ainda
    // digitava. Essa assinatura fica gravada no rascunho do link e precisa vir
    // junto — antes ela era apagada com o rascunho e o cliente assinava à toa.
    let assinaturaFinal = assinatura
    let assinaturaTempoFinal = assinatura ? Date.now() : null
    if (osIdParaLink) {
      try {
        const { data } = await supabase.from('ordens')
          .select('data').eq('id', String(osIdParaLink)).maybeSingle()
        if (!assinaturaFinal && data?.data?.assinatura) {
          assinaturaFinal = data.data.assinatura
          assinaturaTempoFinal = data.data.assinaturaTempo || Date.now()
        }
      } catch (e) {
        console.error('[finalizar] não consegui ler o rascunho do link:', e)
      }
    }
    // Rubrica desenhada aqui na recepção vira arquivo no Storage (a do link já
    // chega como URL). Se o upload falhar, segue embutida — nunca se perde.
    if (assinaturaFinal && String(assinaturaFinal).startsWith('data:')) {
      try { assinaturaFinal = await uploadAssinatura(assinaturaFinal, `entrada-${Date.now()}`) }
      catch (e) { console.error('[assinatura] upload falhou, salvando embutida:', e) }
    }

    let cId = clienteId
    if (!cId) {
      const novo = { id: gerarId(), ...cliente }
      setClientes(prev => [novo, ...prev])
      cId = novo.id
    } else {
      setClientes(prev => prev.map(c => c.id === cId ? { ...c, ...cliente } : c))
    }

    let vId = veiculoId
    if (!vId) {
      const parts = veiculo.modelo.trim().split(' ')
      const novoV = {
        id: gerarId(), clienteId: cId,
        marca: parts[0] || '', modelo: parts.slice(1).join(' ') || veiculo.modelo,
        placa: veiculo.placa, cor: veiculo.cor, ano: veiculo.ano,
        motor: veiculo.motor, combustivel: veiculo.combustivel,
      }
      setVeiculos(prev => [novoV, ...prev])
      vId = novoV.id
    }

    const osId = novaOrdem({
      clienteId: cId,
      veiculoId: vId,
      kmEntrada: veiculo.kmEntrada,
      descricaoProblema: relatoCliente,
      status: 'Recepção',
      luzesPainel,
      relatoCliente,
      assinatura: assinaturaFinal || null,
      assinaturaTempo: assinaturaTempoFinal,
      atendente: currentUser?.nome || '',
      ultimaRevisao: veiculo.ultimaRevisao,
      numCondutores: veiculo.numCondutores,
      combustivel: veiculo.combustivel,
      // Guarda o texto como foi digitado — o cadastro separa em marca+modelo e
      // a exibição perdia a marca ("GOL TESTE" virava "TESTE").
      veiculoModelo: veiculo.modelo.trim(),
      veiculoPlaca: veiculo.placa,
      clienteNome: cliente.nome,
    })
    // `novaOrdem` devolve null quando se recusa a numerar: leitura
    // incompleta numeraria por cima de uma OS que ja existe.
    if (!osId) return

    // O cliente costuma abrir o link do WhatsApp depois que a recepção já
    // finalizou. Apagar o rascunho matava o link ("Registro não encontrado"):
    // agora ele vira um ponteiro para a OS de verdade e o link continua valendo.
    if (osIdParaLink) {
      // O retorno era descartado com `.then(() => {})`: sem catch, sem olhar o
      // erro. Se este ponteiro nao gravasse, o link que o cliente JA recebeu no
      // WhatsApp continuava apontando para o rascunho descartado — ele assinava
      // um registro morto e ninguem via nada, nem no console.
      const { error: erroPonteiro } = await supabase.from('ordens').upsert({
        id: String(osIdParaLink),
        data: { rascunho: true, redirectPara: osId },
      }).select('id')
      if (erroPonteiro) {
        console.error('[NovaEntrada] ponteiro do link de assinatura nao gravou:', erroPonteiro)
        alert('A entrada foi salva, mas o link de assinatura que voce ja enviou pode nao funcionar.\n\nAbra a OS e envie o link novamente.')
      }
    }

    localStorage.removeItem(RASCUNHO_KEY)
    navigate(`/ordens-servico/${encodeURIComponent(osId)}`)
  }

  const veiculosCliente = clienteId ? veiculosPorCliente(clienteId) : []

  return (
    <div className="p-6 max-w-2xl lg:max-w-none mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Nova Entrada de Veículo</h2>
          <p className="text-sm text-slate-500">Atendente: {currentUser?.nome || '—'}</p>
        </div>
      </div>

      {/* A trilha de passos é do celular: no computador tudo aparece de uma
          vez, então numerar etapas só ocuparia espaço. */}
      <div className="flex items-center mb-7 lg:hidden">
        {PASSOS.map((p, idx) => {
          const ativo = passo === p.num
          const concluido = passo > p.num
          const Icon = p.icon
          return (
            <div key={p.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  concluido ? 'bg-green-500 text-white' :
                  ativo ? 'bg-primary-500 text-white ring-4 ring-primary-100' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {concluido ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span className={`text-[10px] font-semibold ${ativo ? 'text-primary-500' : 'text-slate-400'}`}>{p.label}</span>
              </div>
              {idx < PASSOS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full ${passo > p.num ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Modelo A: no computador as quatro seções ficam à vista, cliente e
          veículo lado a lado — a recepção preenche na ordem que a conversa dá.
          No celular continua um passo por vez, que é o que cabe na mão. */}
      {/* Modelo de FAIXAS: cada seção ocupa a largura inteira e fica baixa,
          porque os campos se espalham na horizontal em vez de empilhar. As
          duas colunas de antes cortavam no monitor e sobrava rolagem. */}
      <div className="lg:space-y-2">

        <div className={`bg-white border border-slate-200 rounded-2xl p-6 space-y-5 ${passo === 1 ? '' : 'hidden'} lg:block lg:p-4`}>
          <div>
            <h3 className="text-xl lg:text-sm lg:font-semibold text-slate-800 mb-0.5">Dados do Cliente</h3>
            <p className="text-sm text-slate-400 lg:hidden">Identificação e contato para cadastro</p>
          </div>

            <div className="relative lg:mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Buscar cliente existente</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input type="text" placeholder="Nome ou telefone..."
                  value={buscaCliente}
                  onChange={e => { setBuscaCliente(e.target.value); setMostrarDropdown(true); setClienteId(null) }}
                  onFocus={() => setMostrarDropdown(true)}
                  onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              {mostrarDropdown && clientesFiltrados.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {clientesFiltrados.map(c => (
                    <button key={c.id} onMouseDown={() => selecionarCliente(c)}
                      className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <p className="font-medium text-sm text-slate-800">{c.nome}</p>
                      <p className="text-xs text-slate-400">{c.telefone}{c.cpfCnpj ? ' · ' + c.cpfCnpj : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-12 gap-4 lg:gap-2">
              {/* No computador a linha vira: buscar · documento · nome ·
                  telefone · telefone 2 — a ordem em que a recepção pergunta. */}
              <div className="col-span-12 sm:col-span-4 lg:col-span-2 lg:order-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Documento</label>
                  <div className="flex gap-1">
                    {['CPF', 'CNPJ'].map(t => (
                      <button key={t} type="button"
                        onClick={() => { setDocType(t); setCliente(p => ({ ...p, cpfCnpj: '' })) }}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${docType === t ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <input value={cliente.cpfCnpj} onChange={e => handleDocumento(e.target.value)}
                  placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div className="col-span-12 sm:col-span-8 lg:col-span-4 lg:order-3">
                <CampoInput label="Nome Completo" obrigatorio erro={erros.nome}
                  value={cliente.nome} onChange={e => setCliente(p => ({ ...p, nome: e.target.value.toUpperCase() }))} placeholder="NOME DO CLIENTE" />
              </div>
              <div className="col-span-4 sm:col-span-3 lg:col-span-2 lg:order-6">
                <CampoInput label="CEP" hint={buscandoCep ? '🔍 Buscando...' : ''}
                  value={cliente.cep} onChange={e => { const v = formatCep(e.target.value); setCliente(p => ({ ...p, cep: v })); buscarCep(v) }}
                  placeholder="00000-000" inputMode="numeric" />
              </div>
              <div className="col-span-8 sm:col-span-7 lg:col-span-3 lg:order-7">
                <CampoInput label="Logradouro (Rua)" value={cliente.endereco}
                  onChange={e => setCliente(p => ({ ...p, endereco: e.target.value.toUpperCase() }))} placeholder="RUA DAS FLORES" />
              </div>
              <div className="col-span-2 lg:col-span-1 lg:order-8">
                <CampoInput label="Nº" value={cliente.numero}
                  onChange={e => setCliente(p => ({ ...p, numero: e.target.value }))} placeholder="123" />
              </div>
              <div className="col-span-6 lg:col-span-2 lg:order-9">
                <CampoInput label="Bairro" value={cliente.bairro}
                  onChange={e => setCliente(p => ({ ...p, bairro: e.target.value.toUpperCase() }))} placeholder="CENTRO" />
              </div>
              <div className="col-span-6 lg:col-span-2 lg:order-10">
                <CampoInput label="Cidade/UF" value={cliente.cidadeEstado}
                  onChange={e => setCliente(p => ({ ...p, cidadeEstado: e.target.value.toUpperCase() }))} placeholder="SÃO PAULO/SP" />
              </div>
              <div className="col-span-6 lg:col-span-2 lg:order-4">
                <CampoInput label="Telefone 1" obrigatorio erro={erros.telefone}
                  value={cliente.telefone} onChange={e => setCliente(p => ({ ...p, telefone: formatTelefone(e.target.value) }))}
                  placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
              <div className="col-span-6 lg:col-span-2 lg:order-5">
                <CampoInput label="Telefone 2" value={cliente.telefone2}
                  onChange={e => setCliente(p => ({ ...p, telefone2: formatTelefone(e.target.value) }))}
                  placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
              <div className="col-span-12 lg:col-span-2 lg:order-11">
                <CampoInput label="Email" value={cliente.email}
                  onChange={e => setCliente(p => ({ ...p, email: e.target.value.toLowerCase() }))}
                  placeholder="email@exemplo.com" type="email" inputMode="email" />
              </div>
            </div>
        </div>

        <div className={`bg-white border border-slate-200 rounded-2xl p-6 space-y-5 ${passo === 2 ? '' : 'hidden'} lg:block lg:p-4 mt-0 lg:mt-0`}>
          <div>
            <h3 className="text-xl lg:text-sm lg:font-semibold text-slate-800 mb-0.5">Ficha do Veículo</h3>
            <p className="text-sm text-slate-400 lg:hidden">Características e estado no recebimento</p>
          </div>
            {veiculosCliente.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-2">Veículos de {cliente.nome.split(' ')[0]}:</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {veiculosCliente.map(v => (
                    <button key={v.id} onClick={() => selecionarVeiculo(v)}
                      className={`border rounded-xl px-3 py-2.5 text-left transition-all ${
                        veiculoId === v.id ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <p className="text-sm font-semibold text-slate-800">{v.marca} {v.modelo}</p>
                      <p className="text-xs text-slate-500">{v.placa || 'Sem placa'} · {v.ano}</p>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">ou preencha abaixo</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-12 gap-4 lg:gap-2">
              <div className="col-span-12 sm:col-span-4 lg:col-span-3">
                <CampoInput label="Modelo do Veículo" obrigatorio erro={erros.modelo}
                  value={veiculo.modelo} onChange={e => setVeiculo(p => ({ ...p, modelo: e.target.value.toUpperCase() }))} placeholder="GOL G5 1.6" />
              </div>
              <div className="col-span-6 sm:col-span-4 lg:col-span-2">
                <CampoInput label="Placa" obrigatorio erro={erros.placa}
                  value={veiculo.placa} onChange={e => setVeiculo(p => ({ ...p, placa: formatPlaca(e.target.value) }))} placeholder="ABC-1234" maxLength={8} />
              </div>
              <div className="col-span-6 sm:col-span-4 lg:col-span-1">
                <CampoInput label="Motor" value={veiculo.motor}
                  onChange={e => setVeiculo(p => ({ ...p, motor: e.target.value.toUpperCase() }))} placeholder="1.6 16V" />
              </div>
              <div className="col-span-6 sm:col-span-3 lg:col-span-1">
                <CampoInput label="Cor" value={veiculo.cor}
                  onChange={e => setVeiculo(p => ({ ...p, cor: e.target.value.toUpperCase() }))} placeholder="PRATA" />
              </div>
              <div className="col-span-6 sm:col-span-3 lg:col-span-1">
                <CampoInput label="Ano/Modelo" value={veiculo.ano}
                  onChange={e => setVeiculo(p => ({ ...p, ano: e.target.value }))} placeholder="2010/2011" />
              </div>
              <div className="col-span-6 sm:col-span-3 lg:col-span-1">
                <CampoInput label="Km Atual (Painel)" value={veiculo.kmEntrada}
                  onChange={e => setVeiculo(p => ({ ...p, kmEntrada: e.target.value }))} placeholder="120.000" inputMode="numeric" />
              </div>
              <div className="col-span-6 sm:col-span-3 lg:col-span-1">
                <CampoInput label="Condutores" value={veiculo.numCondutores}
                  onChange={e => setVeiculo(p => ({ ...p, numCondutores: e.target.value }))} placeholder="1" inputMode="numeric" />
              </div>
              <div className="col-span-12 lg:col-span-2">
                <CampoInput label="Última Manutenção" value={veiculo.ultimaRevisao}
                  onChange={e => setVeiculo(p => ({ ...p, ultimaRevisao: e.target.value }))} placeholder="Data ou Km" />
              </div>
              <div className="col-span-12 lg:col-span-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 lg:mb-1">Combustível Utilizado (No Tanque)</label>
                <div className="flex gap-2">
                  {COMBUSTIVEIS.map(c => (
                    <button key={c} onClick={() => setVeiculo(p => ({ ...p, combustivel: c }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        veiculo.combustivel === c ? 'bg-primary-500 text-white border-primary-500' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="col-span-12 lg:col-span-8">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 lg:mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  Luzes Acesas no Painel (Check Visual)
                  {luzesPainel.length > 0 && (
                    <span className="ml-1 text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">{luzesPainel.length}</span>
                  )}
                </label>
                {/* Oito por linha no computador: as 16 luzes cabem em duas
                    linhas em vez de quatro. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 lg:gap-1">
                  {DASHBOARD_LIGHTS.map(luz => {
                    const ativo = luzesPainel.includes(luz)
                    return (
                      <button key={luz} onClick={() => toggleLuz(luz)}
                        className={`py-2 lg:py-1 px-2 lg:px-1 rounded-lg border text-[11px] lg:text-[10px] font-bold uppercase transition-all text-center leading-tight ${
                          ativo ? 'bg-red-500/20 border-red-500 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}>{luz}</button>
                    )
                  })}
                </div>
              </div>
            </div>
        </div>

        <div className={`bg-white border border-slate-200 rounded-2xl p-6 space-y-5 ${passo === 3 ? '' : 'hidden'} lg:block lg:p-4 lg:mt-3`}>
          <div>
            <h3 className="text-xl lg:text-sm lg:font-semibold text-slate-800 mb-0.5">Motivo da Entrada</h3>
            <p className="text-sm text-slate-400 lg:hidden">Relato do cliente para orientação do reparador</p>
          </div>
            <textarea rows={10} value={relatoCliente}
              onChange={e => setRelatoCliente(e.target.value.toUpperCase())}
              placeholder="DESCREVA O DEFEITO RELATADO OU SERVIÇO SOLICITADO..."
              className="w-full lg:h-24 border border-slate-200 rounded-xl px-4 py-3.5 lg:px-2 lg:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none uppercase leading-relaxed" />
        </div>

        {/* No computador o termo, o envio do link e a assinatura ficam lado a
            lado: o texto jurídico rola dentro da própria caixa em vez de
            empurrar a assinatura para fora da tela. */}
        <div className={`bg-white border border-slate-200 rounded-2xl p-6 space-y-5 ${passo === 4 ? '' : 'hidden'} lg:block lg:p-4 lg:space-y-0`}>
          <div className="text-center lg:text-left mb-2 lg:mb-1">
            <h3 className="text-xl lg:text-sm lg:font-semibold text-slate-800 mb-1 lg:mb-0">Autorização de Entrada</h3>
          </div>
          <div className="lg:grid lg:grid-cols-12 lg:gap-2 lg:items-start">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 lg:p-2 lg:col-span-5 text-sm lg:text-[11px] text-slate-600 leading-relaxed text-justify lg:h-28 lg:overflow-y-auto">
              "Autorizo a <strong>Magayver Injecar</strong> a realizar o diagnóstico técnico eletrônico
              (injeção eletrônica e sistemas eletrônicos) do meu veículo. Declaro que recebi informações
              claras sobre o serviço (CDC art. 6°, III). Estou ciente de que o diagnóstico é um serviço
              cobrado, mesmo que a causa identificada seja mecânica (serviço mecânico não realizado pela
              oficina). Qualquer reparo e/ou troca de peças somente será feito mediante orçamento prévio
              e autorização expressa do cliente (CDC arts. 39, VI e 40)."
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 lg:p-2 lg:col-span-3">
              <h4 className="font-bold text-slate-700 mb-2 lg:mb-1 lg:text-xs flex items-center gap-2">
                <Smartphone size={16} className="text-green-600" /> Assinatura Remota (Cliente)
              </h4>
              <p className="text-xs text-slate-500 mb-3">Envie um link para o cliente assinar pelo próprio celular.</p>
              <div className="flex flex-col gap-2">
                <button onClick={enviarWhatsApp} disabled={!cliente.telefone}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <MessageSquare size={16} /> Enviar no WhatsApp
                </button>
                <button onClick={copiarLink}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Link size={16} /> {linkCopiado ? '✓ Copiado!' : 'Copiar Link'}
                </button>
              </div>
            </div>
            <div className="relative flex items-center lg:hidden">
              <div className="flex-grow border-t border-slate-200" />
              <span className="mx-4 text-xs text-slate-400 uppercase font-bold">ou assinar abaixo</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>
            <div className="lg:col-span-4">
            <PainelAssinatura onSave={data => setAssinatura(data)} onClear={() => setAssinatura(null)} assinaturaInicial={null} />
            {!assinatura && (
              <p className="text-center text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg lg:py-1">
                A assinatura é opcional, mas recomendada para autorização formal.
              </p>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Computador: uma barra só, com o que falta à esquerda e o botão de
          gravar à direita — sem passo nenhum para percorrer. */}
      <div className="hidden lg:flex items-center justify-between gap-4 mt-3 px-3 py-2 bg-slate-100 border border-slate-300 rounded text-[11px] text-slate-600">
        <span>
          {faltando.length > 0
            ? <>Faltam: <strong className="font-medium text-amber-700">{faltando.join(', ')}</strong></>
            : <span className="text-green-700">Tudo preenchido{!assinatura && ' — falta só a assinatura, que é opcional'}</span>}
        </span>
        <button onClick={finalizar}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-1.5 rounded text-xs font-semibold transition-colors">
          <Check size={14} /> Registrar Entrada
        </button>
      </div>

      {/* Celular: os passos de sempre. */}
      <div className="flex lg:hidden items-center justify-between mt-5 gap-2 flex-wrap">
        <button onClick={anterior} disabled={passo === 1}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ArrowLeft size={16} /> Anterior
        </button>
        {passo < ULTIMO_PASSO ? (
          <button onClick={proximo}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            Próximo <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={finalizar}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Check size={16} /> Registrar Entrada
          </button>
        )}
      </div>
    </div>
  )
}

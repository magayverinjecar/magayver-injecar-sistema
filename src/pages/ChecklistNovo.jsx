import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, User, Car, AlertTriangle,
  PenTool, Search, Eraser, Smartphone, Link, MessageSquare, Copy, Save
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

// ─── Constantes (iguais ao original) ─────────────────────────
const DASHBOARD_LIGHTS = [
  'Injeção (Check Engine)', 'Bateria / Alternador', 'Pressão de Óleo',
  'Freio / Fluido', 'Temperatura Motor', 'ABS', 'Airbag (SRS)',
  'EPC (Aceleração)', 'Direção Assistida', 'Controle Estabilidade (ESP)',
  'Pressão Pneus (TPMS)', 'Câmbio / Transmissão', 'Filtro de Partículas',
  'Imobilizador (Code)', 'Pastilha de Freio', 'Pré-aquecimento (Velas)',
]

const COMBUSTIVEIS = ['Gasolina', 'Etanol', 'Diesel', 'Misturado']

const PASSOS = [
  { num: 1, label: 'Cliente',    icon: User },
  { num: 2, label: 'Veículo',    icon: Car },
  { num: 3, label: 'Problema',   icon: AlertTriangle },
  { num: 4, label: 'Assinatura', icon: PenTool },
]

// ─── Formatadores ─────────────────────────────────────────────
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

// ─── Campo reutilizável ───────────────────────────────────────
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

// ─── Canvas de assinatura (igual ao original) ─────────────────
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
      <div className="relative w-full bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden shadow-inner">
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

// ─── Componente principal ─────────────────────────────────────
export default function ChecklistNovo() {
  const { clientes, veiculos, setClientes, setVeiculos, checklists, setChecklists, gerarNumeroChecklist, veiculosPorCliente } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const ckEditar = location.state?.editar || null

  const [ckIdNovo] = useState(() => Date.now())

  const [passo, setPasso] = useState(1)
  const [erros, setErros] = useState({})
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // '' | 'salvando' | 'salvo'
  const saveTimerRef = useRef(null)
  const draftSavedRef = useRef(false)

  // ── PASSO 1 — Cliente (igual step 0 do original) ─────────────
  const [buscaCliente, setBuscaCliente] = useState(ckEditar?.clienteNome || '')
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [clienteId, setClienteId] = useState(ckEditar?.clienteId || null)
  const [docType, setDocType] = useState('CPF')
  const [cliente, setCliente] = useState(() => ckEditar ? {
    nome: ckEditar.clienteNome || '',
    telefone: ckEditar.clienteTelefone || '',
    telefone2: ckEditar.clienteTelefone2 || '',
    cpfCnpj: ckEditar.clienteCpfCnpj || '',
    email: ckEditar.clienteEmail || '',
    endereco: '', numero: '', bairro: '', cidadeEstado: '', cep: '',
  } : {
    nome: '', telefone: '', telefone2: '', cpfCnpj: '',
    email: '', endereco: '', numero: '', bairro: '', cidadeEstado: '', cep: '',
  })

  // Restaurar endereço completo ao editar
  useEffect(() => {
    if (ckEditar?.clienteId) {
      const c = clientes.find(x => x.id === ckEditar.clienteId)
      if (c) setCliente(prev => ({
        ...prev,
        endereco: c.endereco || '',
        numero: c.numero || '',
        bairro: c.bairro || '',
        cidadeEstado: c.cidadeEstado || '',
        cep: c.cep || '',
      }))
    }
  }, [])

  // ── PASSO 2 — Veículo (igual step 1 do original) ─────────────
  const [veiculoId, setVeiculoId] = useState(ckEditar?.veiculoId || null)
  const [veiculo, setVeiculo] = useState(() => ckEditar ? {
    modelo: ckEditar.veiculoModelo || '',
    placa: ckEditar.veiculoPlaca || '',
    motor: ckEditar.veiculoMotor || '',
    cor: ckEditar.veiculoCor || '',
    ano: ckEditar.veiculoAno || '',
    kmEntrada: ckEditar.kmEntrada || '',
    ultimaRevisao: ckEditar.ultimaRevisao || '',
    numCondutores: ckEditar.numCondutores || '',
    combustivel: ckEditar.combustivel || 'Gasolina',
  } : {
    modelo: '', placa: '', motor: '', cor: '', ano: '',
    kmEntrada: '', ultimaRevisao: '', numCondutores: '', combustivel: 'Gasolina',
  })
  const [luzesPainel, setLuzesPainel] = useState(ckEditar?.luzesPainel || [])

  // ── PASSO 3 — Problema (igual step 2 do original) ────────────
  const [relatoCliente, setRelatoCliente] = useState(ckEditar?.relatoCliente || '')

  // ── PASSO 4 — Assinatura (igual step 3 do original) ──────────
  const [assinatura, setAssinatura] = useState(ckEditar?.assinatura || null)

  // ── Auto-save ────────────────────────────────────────────────
  const getDadosAtuais = useCallback(() => ({
    clienteId,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefone,
    clienteTelefone2: cliente.telefone2,
    clienteCpfCnpj: cliente.cpfCnpj,
    clienteEmail: cliente.email,
    clienteEndereco: [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidadeEstado].filter(Boolean).join(', '),
    veiculoId,
    veiculoModelo: veiculo.modelo,
    veiculoPlaca: veiculo.placa,
    veiculoCor: veiculo.cor,
    veiculoAno: veiculo.ano,
    veiculoMotor: veiculo.motor,
    kmEntrada: veiculo.kmEntrada,
    ultimaRevisao: veiculo.ultimaRevisao,
    numCondutores: veiculo.numCondutores,
    combustivel: veiculo.combustivel,
    luzesPainel,
    relatoCliente,
    assinatura,
  }), [cliente, veiculo, clienteId, veiculoId, luzesPainel, relatoCliente, assinatura])

  useEffect(() => {
    if (!cliente.nome.trim() && !veiculo.placa.trim()) return
    clearTimeout(saveTimerRef.current)
    setSaveStatus('salvando')
    saveTimerRef.current = setTimeout(() => {
      const dados = getDadosAtuais()
      if (ckEditar) {
        setChecklists(prev => prev.map(c => c.id === ckEditar.id ? { ...c, ...dados } : c))
      } else {
        setChecklists(prev => {
          const jaExiste = prev.find(c => c.id === ckIdNovo)
          if (jaExiste) return prev.map(c => c.id === ckIdNovo ? { ...c, ...dados } : c)
          draftSavedRef.current = true
          return [{ id: ckIdNovo, numero: gerarNumeroChecklist(), status: 'Rascunho', criadoEm: new Date().toLocaleString('pt-BR'), ...dados, fotos: [], inspecaoVisual: [], diagnostico: [], observacoesTecnicas: '', tecnicoId: null, tecnicoNome: '', diagnosticadoEm: null, osId: null, atendente: currentUser?.nome || '' }, ...prev]
        })
        draftSavedRef.current = true
      }
      setSaveStatus('salvo')
      setTimeout(() => setSaveStatus(''), 2500)
    }, 800)
    return () => clearTimeout(saveTimerRef.current)
  }, [cliente, veiculo, clienteId, veiculoId, luzesPainel, relatoCliente, assinatura])

  // ── Busca de cliente ─────────────────────────────────────────
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

  // Busca por documento (auto-preenche quando CPF/CNPJ completo)
  function handleDocumento(v) {
    setCliente(p => ({ ...p, cpfCnpj: v }))
    const raw = v.replace(/\D/g, '')
    if (raw.length === 11 || raw.length === 14) {
      const encontrado = clientes.find(c => c.cpfCnpj?.replace(/\D/g, '') === raw)
      if (encontrado) selecionarCliente(encontrado)
    }
  }

  // CEP → ViaCEP
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
    } catch { /* sem internet */ }
    setBuscandoCep(false)
  }

  function toggleLuz(luz) {
    setLuzesPainel(p => p.includes(luz) ? p.filter(l => l !== luz) : [...p, luz])
  }

  // ── Salva rascunho no Supabase para o link remoto ser válido ────
  async function salvarRascunho() {
    if (ckEditar) return
    await supabase.from('checklists').upsert({
      id: String(ckIdNovo),
      data: {
        clienteNome: cliente.nome,
        clienteTelefone: cliente.telefone,
        veiculoModelo: veiculo.modelo,
        veiculoPlaca: veiculo.placa,
        status: 'Aguardando diagnóstico',
      }
    })
  }

  // ── Link de assinatura remota ────────────────────────────────
  async function enviarWhatsApp() {
    await salvarRascunho()
    const fone = cliente.telefone.replace(/\D/g, '')
    const primeiroNome = cliente.nome.split(' ')[0]
    const ckId = ckEditar?.id || ckIdNovo
    const link = `${window.location.origin}/assinar/${ckId}`
    const msg = `Olá ${primeiroNome}, por favor assine a autorização de serviço para o veículo ${veiculo.modelo} (${veiculo.placa}) neste link: ${link}`
    window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function copiarLink() {
    await salvarRascunho()
    const ckId = ckEditar?.id || ckIdNovo
    const link = `${window.location.origin}/assinar/${ckId}`
    await navigator.clipboard.writeText(link)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2500)
  }

  // ── Validação ────────────────────────────────────────────────
  function validar() {
    const e = {}
    if (passo === 1) {
      if (!cliente.nome.trim()) e.nome = 'Nome obrigatório'
      if (!cliente.telefone.trim()) e.telefone = 'Telefone obrigatório'
    }
    if (passo === 2) {
      if (!veiculo.modelo.trim()) e.modelo = 'Modelo obrigatório'
      if (!veiculo.placa.trim()) e.placa = 'Placa obrigatória'
    }
    setErros(e)
    return Object.keys(e).length === 0
  }

  function proximo() { if (validar()) { setPasso(p => p + 1); setErros({}) } }
  function anterior() { setPasso(p => p - 1); setErros({}) }

  // Salva o que foi alterado até agora sem exigir todos os passos (modo edição)
  function salvarRapido() {
    if (!ckEditar) return
    setChecklists(prev => prev.map(c => c.id === ckEditar.id ? {
      ...c,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      clienteTelefone2: cliente.telefone2,
      clienteCpfCnpj: cliente.cpfCnpj,
      clienteEmail: cliente.email,
      clienteEndereco: [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidadeEstado].filter(Boolean).join(', '),
      veiculoModelo: veiculo.modelo,
      veiculoPlaca: veiculo.placa,
      veiculoCor: veiculo.cor,
      veiculoAno: veiculo.ano,
      veiculoMotor: veiculo.motor,
      kmEntrada: veiculo.kmEntrada,
      ultimaRevisao: veiculo.ultimaRevisao,
      numCondutores: veiculo.numCondutores,
      combustivel: veiculo.combustivel,
      luzesPainel,
      relatoCliente,
    } : c))
    navigate('/checklist/gerenciar')
  }

  // ── Finalizar ────────────────────────────────────────────────
  function finalizar() {
    const agora = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    let cId = clienteId
    if (!cId) {
      const novo = { id: Date.now(), ...cliente }
      setClientes(prev => [novo, ...prev])
      cId = novo.id
    } else {
      setClientes(prev => prev.map(c => c.id === cId ? { ...c, ...cliente } : c))
    }

    let vId = veiculoId
    if (!vId) {
      const parts = veiculo.modelo.trim().split(' ')
      const novoV = {
        id: Date.now() + 1,
        clienteId: cId,
        marca: parts[0] || '',
        modelo: parts.slice(1).join(' ') || veiculo.modelo,
        placa: veiculo.placa,
        cor: veiculo.cor,
        ano: veiculo.ano,
        motor: veiculo.motor,
        combustivel: veiculo.combustivel,
      }
      setVeiculos(prev => [novoV, ...prev])
      vId = novoV.id
    }

    const dadosEntrada = {
      clienteId: cId,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      clienteTelefone2: cliente.telefone2,
      clienteCpfCnpj: cliente.cpfCnpj,
      clienteEmail: cliente.email,
      clienteEndereco: [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidadeEstado].filter(Boolean).join(', '),
      veiculoId: vId,
      veiculoInfo: `${veiculo.modelo}${veiculo.placa ? ' · ' + veiculo.placa : ''}`,
      veiculoModelo: veiculo.modelo,
      veiculoPlaca: veiculo.placa,
      veiculoCor: veiculo.cor,
      veiculoAno: veiculo.ano,
      veiculoMotor: veiculo.motor,
      kmEntrada: veiculo.kmEntrada,
      ultimaRevisao: veiculo.ultimaRevisao,
      numCondutores: veiculo.numCondutores,
      combustivel: veiculo.combustivel,
      luzesPainel,
      relatoCliente,
      falhasScanner: '',   // preenchido pelo reparador no diagnóstico
      assinatura,
      assinaturaTempo: assinatura ? Date.now() : null,
      atendente: currentUser?.nome || '',
    }

    if (ckEditar) {
      setChecklists(prev => prev.map(c => c.id === ckEditar.id ? { ...c, ...dadosEntrada, status: 'Aguardando diagnóstico' } : c))
    } else if (draftSavedRef.current) {
      // rascunho já existe pelo auto-save, só atualiza
      setChecklists(prev => prev.map(c => c.id === ckIdNovo ? { ...c, ...dadosEntrada, status: 'Aguardando diagnóstico' } : c))
    } else {
      setChecklists(prev => [{
        id: ckIdNovo,
        numero: gerarNumeroChecklist(),
        status: 'Aguardando diagnóstico',
        criadoEm: agora,
        ...dadosEntrada,
        fotos: [], inspecaoVisual: [], diagnostico: [],
        observacoesTecnicas: '',
        tecnicoId: null, tecnicoNome: '',
        diagnosticadoEm: null, osId: null,
      }, ...prev])
    }
    navigate('/checklist/gerenciar')
  }

  const veiculosCliente = clienteId ? veiculosPorCliente(clienteId) : []

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/checklist/gerenciar')}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {ckEditar ? 'Editar Entrada' : 'Nova Entrada'}
          </h2>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            {ckEditar
              ? `Editando ${ckEditar.numero} — ${ckEditar.veiculoPlaca || ''}`
              : `Atendente: ${currentUser?.nome || '—'}`}
            {saveStatus === 'salvando' && <span className="text-xs text-amber-500 animate-pulse">● Salvando...</span>}
            {saveStatus === 'salvo' && <span className="text-xs text-green-500">✓ Salvo</span>}
          </p>
        </div>
      </div>

      {/* Indicador de passos */}
      <div className="flex items-center mb-7">
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
                <span className={`text-[10px] font-semibold ${ativo ? 'text-primary-500' : 'text-slate-400'}`}>
                  {p.label}
                </span>
              </div>
              {idx < PASSOS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full ${passo > p.num ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">

        {/* ══ PASSO 1: CLIENTE (= step 0 do original) ══ */}
        {passo === 1 && (
          <>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-0.5">Dados do Cliente</h3>
              <p className="text-sm text-slate-400">Identificação e contato para cadastro</p>
            </div>

            {/* Busca de cliente existente */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Buscar cliente existente
              </label>
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

            <div className="grid grid-cols-12 gap-4">
              {/* Documento com toggle CPF/CNPJ */}
              <div className="col-span-12 sm:col-span-4">
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
                <input
                  value={cliente.cpfCnpj}
                  onChange={e => handleDocumento(e.target.value)}
                  placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div className="col-span-12 sm:col-span-8">
                <CampoInput label="Nome Completo" obrigatorio erro={erros.nome}
                  value={cliente.nome}
                  onChange={e => setCliente(p => ({ ...p, nome: e.target.value.toUpperCase() }))}
                  placeholder="NOME DO CLIENTE" />
              </div>

              {/* CEP + auto-preenchimento */}
              <div className="col-span-4 sm:col-span-3">
                <CampoInput label="CEP" hint={buscandoCep ? '🔍 Buscando...' : ''}
                  value={cliente.cep}
                  onChange={e => { const v = formatCep(e.target.value); setCliente(p => ({ ...p, cep: v })); buscarCep(v) }}
                  placeholder="00000-000" inputMode="numeric" />
              </div>
              <div className="col-span-8 sm:col-span-7">
                <CampoInput label="Logradouro (Rua)"
                  value={cliente.endereco}
                  onChange={e => setCliente(p => ({ ...p, endereco: e.target.value.toUpperCase() }))}
                  placeholder="RUA DAS FLORES" />
              </div>
              <div className="col-span-2">
                <CampoInput label="Nº"
                  value={cliente.numero}
                  onChange={e => setCliente(p => ({ ...p, numero: e.target.value }))}
                  placeholder="123" />
              </div>

              <div className="col-span-6">
                <CampoInput label="Bairro"
                  value={cliente.bairro}
                  onChange={e => setCliente(p => ({ ...p, bairro: e.target.value.toUpperCase() }))}
                  placeholder="CENTRO" />
              </div>
              <div className="col-span-6">
                <CampoInput label="Cidade/UF"
                  value={cliente.cidadeEstado}
                  onChange={e => setCliente(p => ({ ...p, cidadeEstado: e.target.value.toUpperCase() }))}
                  placeholder="SÃO PAULO/SP" />
              </div>

              <div className="col-span-6">
                <CampoInput label="Telefone 1" obrigatorio erro={erros.telefone}
                  value={cliente.telefone}
                  onChange={e => setCliente(p => ({ ...p, telefone: formatTelefone(e.target.value) }))}
                  placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
              <div className="col-span-6">
                <CampoInput label="Telefone 2"
                  value={cliente.telefone2}
                  onChange={e => setCliente(p => ({ ...p, telefone2: formatTelefone(e.target.value) }))}
                  placeholder="(00) 00000-0000" inputMode="tel" />
              </div>

              <div className="col-span-12">
                <CampoInput label="Email"
                  value={cliente.email}
                  onChange={e => setCliente(p => ({ ...p, email: e.target.value.toLowerCase() }))}
                  placeholder="email@exemplo.com" type="email" inputMode="email" />
              </div>
            </div>
          </>
        )}

        {/* ══ PASSO 2: VEÍCULO (= step 1 do original) ══ */}
        {passo === 2 && (
          <>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-0.5">Ficha do Veículo</h3>
              <p className="text-sm text-slate-400">Características e estado no recebimento</p>
            </div>

            {/* Veículos existentes */}
            {veiculosCliente.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-2">
                  Veículos de {cliente.nome.split(' ')[0]}:
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {veiculosCliente.map(v => (
                    <button key={v.id} onClick={() => selecionarVeiculo(v)}
                      className={`border rounded-xl px-3 py-2.5 text-left transition-all ${
                        veiculoId === v.id
                          ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-100'
                          : 'border-slate-200 hover:border-slate-300'
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

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-4">
                <CampoInput label="Modelo do Veículo" obrigatorio erro={erros.modelo}
                  value={veiculo.modelo}
                  onChange={e => setVeiculo(p => ({ ...p, modelo: e.target.value.toUpperCase() }))}
                  placeholder="GOL G5 1.6" />
              </div>
              <div className="col-span-6 sm:col-span-4">
                <CampoInput label="Placa" obrigatorio erro={erros.placa}
                  value={veiculo.placa}
                  onChange={e => setVeiculo(p => ({ ...p, placa: formatPlaca(e.target.value) }))}
                  placeholder="ABC-1234" maxLength={8} />
              </div>
              <div className="col-span-6 sm:col-span-4">
                <CampoInput label="Motor"
                  value={veiculo.motor}
                  onChange={e => setVeiculo(p => ({ ...p, motor: e.target.value.toUpperCase() }))}
                  placeholder="1.6 16V" />
              </div>

              <div className="col-span-6 sm:col-span-3">
                <CampoInput label="Cor"
                  value={veiculo.cor}
                  onChange={e => setVeiculo(p => ({ ...p, cor: e.target.value.toUpperCase() }))}
                  placeholder="PRATA" />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <CampoInput label="Ano/Modelo"
                  value={veiculo.ano}
                  onChange={e => setVeiculo(p => ({ ...p, ano: e.target.value }))}
                  placeholder="2010/2011" />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <CampoInput label="Km Atual (Painel)"
                  value={veiculo.kmEntrada}
                  onChange={e => setVeiculo(p => ({ ...p, kmEntrada: e.target.value }))}
                  placeholder="120.000" inputMode="numeric" />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <CampoInput label="Condutores"
                  value={veiculo.numCondutores}
                  onChange={e => setVeiculo(p => ({ ...p, numCondutores: e.target.value }))}
                  placeholder="1" inputMode="numeric" />
              </div>

              <div className="col-span-12">
                <CampoInput label="Última Manutenção"
                  value={veiculo.ultimaRevisao}
                  onChange={e => setVeiculo(p => ({ ...p, ultimaRevisao: e.target.value }))}
                  placeholder="Data ou Km" />
              </div>

              {/* Combustível */}
              <div className="col-span-12">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Combustível Utilizado (No Tanque)
                </label>
                <div className="flex gap-2">
                  {COMBUSTIVEIS.map(c => (
                    <button key={c} onClick={() => setVeiculo(p => ({ ...p, combustivel: c }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        veiculo.combustivel === c
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Luzes do painel — igual ao original (no step de veículo) */}
              <div className="col-span-12">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  Luzes Acesas no Painel (Check Visual)
                  {luzesPainel.length > 0 && (
                    <span className="ml-1 text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                      {luzesPainel.length}
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {DASHBOARD_LIGHTS.map(luz => {
                    const ativo = luzesPainel.includes(luz)
                    return (
                      <button key={luz} onClick={() => toggleLuz(luz)}
                        className={`py-2 px-2 rounded-lg border text-[11px] font-bold uppercase transition-all text-center ${
                          ativo
                            ? 'bg-red-500/20 border-red-500 text-red-600'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}>
                        {luz}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ PASSO 3: PROBLEMA (= step 2 do original — só relato) ══ */}
        {passo === 3 && (
          <>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-0.5">Motivo da Entrada</h3>
              <p className="text-sm text-slate-400">Relato do cliente para orientação do reparador</p>
            </div>

            <textarea
              rows={10}
              value={relatoCliente}
              onChange={e => setRelatoCliente(e.target.value.toUpperCase())}
              placeholder="DESCREVA O DEFEITO RELATADO OU SERVIÇO SOLICITADO..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none uppercase leading-relaxed"
            />
          </>
        )}

        {/* ══ PASSO 4: ASSINATURA (= step 3 do original) ══ */}
        {passo === 4 && (
          <>
            <div className="text-center mb-2">
              <h3 className="text-xl font-bold text-slate-800 mb-1">Autorização de Entrada</h3>
            </div>

            {/* Texto legal igual ao original */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 leading-relaxed text-justify">
              "Autorizo a <strong>Magayver Injecar</strong> a realizar o diagnóstico técnico eletrônico
              (injeção eletrônica e sistemas eletrônicos) do meu veículo. Declaro que recebi informações
              claras sobre o serviço (CDC art. 6°, III). Estou ciente de que o diagnóstico é um serviço
              cobrado, mesmo que a causa identificada seja mecânica (serviço mecânico não realizado pela
              oficina). Qualquer reparo e/ou troca de peças somente será feito mediante orçamento prévio
              e autorização expressa do cliente (CDC arts. 39, VI e 40)."
            </div>

            {/* Opção 1 — Assinatura remota */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Smartphone size={16} className="text-green-600" />
                Assinatura Remota (Cliente)
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Envie um link para o cliente assinar pelo próprio celular.
              </p>
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

            {/* Divisor */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="mx-4 text-xs text-slate-400 uppercase font-bold">ou assinar abaixo</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            {/* Opção 2 — Assinatura local */}
            <div>
              <PainelAssinatura
                onSave={data => setAssinatura(data)}
                onClear={() => setAssinatura(null)}
                assinaturaInicial={ckEditar?.assinatura || null}
              />
            </div>

            {!assinatura && (
              <p className="text-center text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                A assinatura é opcional, mas recomendada para autorização formal.
              </p>
            )}
          </>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between mt-5 gap-2 flex-wrap">
        <button onClick={anterior} disabled={passo === 1}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ArrowLeft size={16} /> Anterior
        </button>

        <div className="flex items-center gap-2">
          {/* Botão "Salvar Agora" — aparece em TODOS os passos durante edição */}
          {ckEditar && (
            <button onClick={salvarRapido}
              className="flex items-center gap-2 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Save size={16} /> Salvar Agora
            </button>
          )}

          {passo < 4 ? (
            <button onClick={proximo}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Próximo <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={finalizar}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Check size={16} /> {ckEditar ? 'Salvar Alterações' : 'Finalizar e Liberar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Car, User, Clock, Gauge, Fuel, AlertTriangle,
  MessageSquare, Save, CheckCircle2, FileText, Activity, Printer
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

// ─── Itens de diagnóstico (iguais ao INITIAL_CHECKLIST do original) ─────────
const DIAGNOSTICO_ITENS = [
  { id: 'bateria',          label: 'Bateria' },
  { id: 'compressao',       label: 'Compressão Relativa' },
  { id: 'af_alcool',        label: 'Porcentagem de Alcool (AF)' },
  { id: 'pressao_coletor',  label: 'Pressão do Coletor' },
  { id: 'pressao_bomba',    label: 'Pressão / Vazão da Bomba' },
  { id: 'valvula_canister', label: 'Válvula do Canister' },
  { id: 'entrada_ar',       label: 'Entrada de Ar Falsa' },
  { id: 'ignicao',          label: 'Ignição nos Cilindros' },
  { id: 'sonda_pre',        label: 'Sonda Pré Catalisador' },
  { id: 'sonda_pos',        label: 'Sonda Pós Catalisador' },
  { id: 'eficiencia_cat',   label: 'Eficiência Catalítica' },
  { id: 'sincronismo',      label: 'Sincronismo do Motor' },
]

export default function ChecklistDiagnosticoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { checklists, setChecklists, novaOrdem } = useApp()
  const { currentUser } = useAuth()

  const ck = checklists.find(c => String(c.id) === id)

  const [diagnostico, setDiagnostico] = useState(() =>
    ck?.diagnostico?.length > 0
      ? ck.diagnostico
      : DIAGNOSTICO_ITENS.map(i => ({ ...i, valor: '' }))
  )
  const [falhasScanner, setFalhasScanner] = useState(() => ck?.falhasScanner || '')
  const [salvando, setSalvando] = useState(false)

  if (!ck) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Checklist não encontrado.</p>
        <button onClick={() => navigate('/checklist/diagnostico')}
          className="mt-3 text-primary-500 text-sm">
          ← Voltar
        </button>
      </div>
    )
  }

  function setValorItem(itemId, valor) {
    setDiagnostico(prev => prev.map(i => i.id === itemId ? { ...i, valor } : i))
  }

  // Validação: mínimo 6 itens preenchidos (igual ao original)
  function validarMinimo6() {
    const preenchidos = diagnostico.filter(i => i.valor.trim() !== '').length
    if (preenchidos < 6) {
      alert('Para concluir o diagnóstico, é necessário preencher pelo menos 6 itens do checklist técnico.')
      return false
    }
    return true
  }

  function salvarProgresso() {
    setSalvando(true)
    setChecklists(prev => prev.map(c => c.id === ck.id ? {
      ...c,
      diagnostico,
      falhasScanner,
      status: 'Em diagnóstico',
      tecnicoId: currentUser?.id || null,
      tecnicoNome: currentUser?.nome || '',
    } : c))
    setTimeout(() => setSalvando(false), 600)
  }

  function concluir() {
    if (!validarMinimo6()) return
    setSalvando(true)
    setChecklists(prev => prev.map(c => c.id === ck.id ? {
      ...c,
      diagnostico,
      falhasScanner,
      status: 'Diagnóstico concluído',
      tecnicoId: currentUser?.id || null,
      tecnicoNome: currentUser?.nome || '',
      diagnosticadoEm: new Date().toLocaleString('pt-BR'),
    } : c))
    setTimeout(() => { setSalvando(false); navigate('/checklist/diagnostico') }, 600)
  }

  function abrirOS() {
    if (ck.osId) { navigate(`/ordens-servico/${ck.osId}`); return }
    const novaOs = novaOrdem({
      clienteId: ck.clienteId,
      clienteNome: ck.clienteNome,
      veiculoId: ck.veiculoId,
      veiculoInfo: `${ck.veiculoModelo || ''} ${ck.veiculoPlaca || ''}`.trim(),
      descricao: ck.relatoCliente || '',
      checklistId: ck.id,
    })
    if (novaOs?.id) {
      setChecklists(prev => prev.map(c => c.id === ck.id ? { ...c, osId: novaOs.id } : c))
      navigate(`/ordens-servico/${novaOs.id}`)
    }
  }

  const luzes = ck.luzesPainel || []

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/checklist/diagnostico')}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
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
            {ck.clienteTelefone && <span>{ck.clienteTelefone}</span>}
            <span className="flex items-center gap-1"><Clock size={11} /> {ck.criadoEm}</span>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
          ck.status === 'Diagnóstico concluído' ? 'bg-green-100 text-green-700' :
          ck.status === 'Em diagnóstico'        ? 'bg-blue-100 text-blue-700' :
                                                  'bg-amber-100 text-amber-700'
        }`}>
          {ck.status}
        </span>
      </div>

      {/* ── Resumo do Veículo & Contexto (igual ao original) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Car size={14} /> Dados do Veículo & Contexto
        </h3>

        {/* Mini-grid igual ao original */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Veículo/Modelo</span>
            <span className="font-bold text-slate-800">{ck.veiculoModelo || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Placa</span>
            <span className="font-bold text-slate-800 uppercase tracking-wider">{ck.veiculoPlaca || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Motor</span>
            <span className="text-slate-600">{ck.veiculoMotor || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Fuel size={10} /> Combustível
            </span>
            <span className="text-slate-600">{ck.combustivel || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Gauge size={10} /> Km Entrada
            </span>
            <span className="text-slate-600">{ck.kmEntrada || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Última Manutenção</span>
            <span className="text-slate-600">{ck.ultimaRevisao || '—'}</span>
          </div>
        </div>

        {/* Luzes do painel (igual ao original — badges de alerta) */}
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

        {/* Relato do cliente (igual ao original — bloco de citação) */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <span className="block text-amber-600 text-[10px] font-bold mb-1 uppercase flex items-center gap-1">
            <MessageSquare size={10} /> Relato do Cliente:
          </span>
          <p className="text-slate-600 italic text-sm leading-relaxed">
            "{ck.relatoCliente || 'Sem relato registrado.'}"
          </p>
        </div>
      </div>

      {/* ── Título da seção técnica ── */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-0.5">Checklist Técnico</h3>
        <p className="text-sm text-slate-400">Preencha os parâmetros técnicos (Mecânico/Técnico)</p>
      </div>

      {/* ── 12 Itens em grid 2 colunas (igual ao original — só label + input uppercase) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {diagnostico.map(item => (
          <div key={item.id}
            className="bg-white border border-slate-200 hover:border-primary-300 rounded-xl p-3 transition-colors group">
            <label className="block text-xs font-bold text-slate-400 uppercase group-hover:text-primary-500 transition-colors mb-1.5">
              {item.label}
            </label>
            <input
              type="text"
              value={item.valor}
              onChange={e => setValorItem(item.id, e.target.value.toUpperCase())}
              placeholder="Digite o valor/obs..."
              className="w-full border-b border-slate-200 px-1 py-1 text-sm text-slate-800 focus:outline-none focus:border-primary-400 uppercase transition-colors bg-transparent"
            />
          </div>
        ))}
      </div>

      {/* ── Falhas do Scanner (ABAIXO dos itens, igual ao original) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <label className="block text-sm font-bold text-slate-600 uppercase mb-2">
          Falhas do Scanner
        </label>
        <textarea
          rows={4}
          value={falhasScanner}
          onChange={e => setFalhasScanner(e.target.value)}
          placeholder="Códigos de falha (DTC) ou leituras do scanner..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
        />
      </div>

      {/* ── Botões de ação (igual ao original: Salvar + Finalizar) ── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1 pb-6">
        <button onClick={salvarProgresso} disabled={salvando}
          className="flex items-center justify-center gap-2 border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Diagnóstico'}
        </button>

        <button onClick={concluir} disabled={salvando}
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          <CheckCircle2 size={16} /> Finalizar Diagnóstico
        </button>

        <button onClick={abrirOS}
          className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors sm:ml-auto">
          <FileText size={16} /> {ck.osId ? 'Ver OS' : 'Abrir OS'}
        </button>
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Car, AlertTriangle, MessageSquare, Eye,
  Wrench, CheckCircle2, ClipboardList, Save, FileText, Clock,
  Camera, Trash2, Phone, Mail, MapPin, Fuel, Gauge, PenTool,
  ImagePlus
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

// ─── Constantes ───────────────────────────────────────────────
const DIAGNOSTICO_ITENS = [
  { id: 'bateria',          label: 'Bateria',                    unidade: 'V' },
  { id: 'compressao',       label: 'Compressão Relativa',        unidade: '%' },
  { id: 'af_alcool',        label: 'Porcentagem de Álcool (AF)', unidade: '%' },
  { id: 'pressao_coletor',  label: 'Pressão do Coletor',         unidade: 'kPa' },
  { id: 'pressao_bomba',    label: 'Pressão / Vazão da Bomba',   unidade: 'bar' },
  { id: 'valvula_canister', label: 'Válvula do Canister',        unidade: '' },
  { id: 'entrada_ar',       label: 'Entrada de Ar Falsa',        unidade: '' },
  { id: 'ignicao',          label: 'Ignição nos Cilindros',      unidade: '' },
  { id: 'sonda_pre',        label: 'Sonda Pré Catalisador',      unidade: 'V' },
  { id: 'sonda_pos',        label: 'Sonda Pós Catalisador',      unidade: 'V' },
  { id: 'eficiencia_cat',   label: 'Eficiência Catalítica',      unidade: '%' },
  { id: 'sincronismo',      label: 'Sincronismo do Motor',       unidade: '' },
]

const INSPECAO_ITENS = [
  { id: 'farois',    label: 'Faróis (alto/baixo)' },
  { id: 'lanternas', label: 'Lanternas traseiras' },
  { id: 'pisca',     label: 'Pisca-alerta e setas' },
  { id: 'luz_re',    label: 'Luz de ré' },
  { id: 'luz_freio', label: 'Luz de freio' },
  { id: 'limpadores',label: 'Limpadores de para-brisa' },
  { id: 'lavadores', label: 'Lavadores de para-brisa' },
  { id: 'ar_cond',   label: 'Ar-condicionado' },
  { id: 'vidros',    label: 'Vidros elétricos' },
  { id: 'buzina',    label: 'Buzina' },
]

const STATUS_DIAG = {
  normal:   { label: 'Normal',   cls: 'bg-green-100 text-green-700 border-green-300' },
  atencao:  { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  problema: { label: 'Problema', cls: 'bg-red-100 text-red-700 border-red-300' },
}

const STATUS_INSP = {
  ok:       { label: 'OK',       cls: 'bg-green-100 text-green-700' },
  atencao:  { label: 'Atenção',  cls: 'bg-amber-100 text-amber-700' },
  problema: { label: 'Problema', cls: 'bg-red-100 text-red-700' },
}

const STATUS_CK = {
  'Aguardando diagnóstico': { cor: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  'Em diagnóstico':         { cor: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  'Diagnóstico concluído':  { cor: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

const CATEGORIAS_FOTO = ['Frente', 'Traseira', 'Lateral D.', 'Lateral E.', 'Interior', 'Motor', 'Detalhe', 'Outro']

// ─── Bloco seção ──────────────────────────────────────────────
function Secao({ icone: Icon, titulo, cor = 'text-slate-500', badge, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Icon size={14} className={cor} /> {titulo}
        </h3>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────
export default function ChecklistDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { checklists, setChecklists, novaOrdem } = useApp()
  const { currentUser } = useAuth()

  const ck = checklists.find(c => String(c.id) === id)

  const [diagnostico, setDiagnostico] = useState(() =>
    ck?.diagnostico?.length > 0
      ? ck.diagnostico
      : DIAGNOSTICO_ITENS.map(i => ({ ...i, value: '', status: 'normal' }))
  )
  const [inspecao, setInspecao] = useState(() =>
    ck?.inspecaoVisual?.length > 0
      ? ck.inspecaoVisual
      : INSPECAO_ITENS.map(i => ({ ...i, status: 'ok', nota: '' }))
  )
  const [fotos, setFotos] = useState(() => ck?.fotos || [])
  const [categoriaFoto, setCategoriaFoto] = useState('Frente')
  const [obsTenicas, setObsTecnicas] = useState(ck?.observacoesTecnicas || '')
  const [salvando, setSalvando] = useState(false)

  const inputFotoRef = useRef(null)

  if (!ck) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <p className="text-slate-600 font-medium">Checklist não encontrado.</p>
        <button onClick={() => navigate('/checklist')} className="mt-4 text-primary-500 text-sm">
          ← Voltar para a lista
        </button>
      </div>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────
  function setValorDiag(itemId, field, value) {
    setDiagnostico(prev => prev.map(d => d.id === itemId ? { ...d, [field]: value } : d))
  }

  function setStatusInsp(itemId, status) {
    setInspecao(prev => prev.map(i => i.id === itemId ? { ...i, status } : i))
  }

  function adicionarFoto(e) {
    const arquivos = Array.from(e.target.files)
    arquivos.forEach(arquivo => {
      const reader = new FileReader()
      reader.onload = ev => {
        const novaFoto = {
          id: Date.now() + Math.random(),
          dataUrl: ev.target.result,
          categoria: categoriaFoto,
          timestamp: new Date().toLocaleString('pt-BR'),
        }
        setFotos(prev => [...prev, novaFoto])
      }
      reader.readAsDataURL(arquivo)
    })
    e.target.value = ''
  }

  function removerFoto(fotoId) {
    setFotos(prev => prev.filter(f => f.id !== fotoId))
  }

  function salvar(novoStatus) {
    setSalvando(true)
    const agora = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    setChecklists(prev => prev.map(c => c.id === ck.id ? {
      ...c,
      diagnostico,
      inspecaoVisual: inspecao,
      fotos,
      observacoesTecnicas: obsTenicas,
      status: novoStatus || c.status,
      tecnicoId: currentUser?.id || null,
      tecnicoNome: currentUser?.nome || '',
      diagnosticadoEm: agora,
    } : c))
    setTimeout(() => setSalvando(false), 600)
  }

  function criarOS() {
    salvar('Diagnóstico concluído')
    const problemas = diagnostico
      .filter(d => d.status !== 'normal' || d.value)
      .map(d => `${d.label}: ${d.value || '—'} (${STATUS_DIAG[d.status]?.label})`)
      .join('\n')

    const descricao = [
      ck.relatoCliente ? `Relato: ${ck.relatoCliente}` : '',
      ck.falhasScanner ? `Scanner: ${ck.falhasScanner}` : '',
      problemas ? `\nDiagnóstico:\n${problemas}` : '',
    ].filter(Boolean).join('\n')

    const osId = novaOrdem({
      clienteId: ck.clienteId,
      veiculoId: ck.veiculoId,
      kmEntrada: ck.kmEntrada,
      descricaoProblema: ck.relatoCliente || '',
      diagnostico: descricao,
      observacoes: obsTenicas,
      status: 'Aberta',
    })

    setChecklists(prev => prev.map(c => c.id === ck.id ? { ...c, osId } : c))
    navigate(`/ordens-servico/${osId}`)
  }

  const statusCfg = STATUS_CK[ck.status] || STATUS_CK['Aguardando diagnóstico']
  const concluido = ck.status === 'Diagnóstico concluído'
  const jaTemOS = !!ck.osId

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/checklist')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">{ck.numero}</h2>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.cor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {ck.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Clock size={12} /> {ck.criadoEm}
            </p>
          </div>
        </div>

        {jaTemOS && (
          <button onClick={() => navigate(`/ordens-servico/${ck.osId}`)}
            className="flex items-center gap-2 border border-primary-300 text-primary-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors">
            <FileText size={15} /> Ver OS {ck.osId}
          </button>
        )}
      </div>

      {/* ── Dados do Cliente ── */}
      <Secao icone={User} titulo="Dados do Cliente">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Nome</p>
            <p className="font-semibold text-slate-800">{ck.clienteNome || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Telefone</p>
            <p className="text-slate-700">{ck.clienteTelefone || '—'}
              {ck.clienteTelefone2 && <span className="text-slate-400 ml-2">{ck.clienteTelefone2}</span>}
            </p>
          </div>
          {ck.clienteCpfCnpj && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">CPF/CNPJ</p>
              <p className="text-slate-700">{ck.clienteCpfCnpj}</p>
            </div>
          )}
          {ck.clienteEmail && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">E-mail</p>
              <p className="text-slate-700">{ck.clienteEmail}</p>
            </div>
          )}
          {ck.clienteEndereco && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Endereço</p>
              <p className="text-slate-700">{ck.clienteEndereco}</p>
            </div>
          )}
        </div>
      </Secao>

      {/* ── Dados do Veículo ── */}
      <Secao icone={Car} titulo="Dados do Veículo">
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Veículo</p>
            <p className="font-semibold text-slate-800">{ck.veiculoModelo || ck.veiculoInfo || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Placa</p>
            <p className="text-slate-700 font-mono font-semibold">{ck.veiculoPlaca || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Cor / Ano</p>
            <p className="text-slate-700">{ck.veiculoCor || '—'} · {ck.veiculoAno || '—'}</p>
          </div>
          {ck.veiculoMotor && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Motor</p>
              <p className="text-slate-700">{ck.veiculoMotor}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">KM Entrada</p>
            <p className="text-slate-700">{ck.kmEntrada || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Combustível</p>
            <p className="text-slate-700">{ck.combustivel || '—'}</p>
          </div>
          {ck.ultimaRevisao && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Última Revisão</p>
              <p className="text-slate-700">{ck.ultimaRevisao}</p>
            </div>
          )}
        </div>
      </Secao>

      {/* ── Assinatura ── */}
      {ck.assinatura && (
        <Secao icone={PenTool} titulo="Assinatura do Cliente"
          badge={<span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Assinado</span>}>
          <img src={ck.assinatura} alt="Assinatura do cliente"
            className="max-h-24 border border-slate-200 rounded-lg bg-white p-2" />
        </Secao>
      )}

      {/* ── Relato / Problema ── */}
      {(ck.relatoCliente || ck.falhasScanner || ck.luzesPainel?.length > 0) && (
        <Secao icone={MessageSquare} titulo="Relato do Cliente">
          <div className="space-y-3">
            {ck.relatoCliente && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Queixa</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{ck.relatoCliente}</p>
              </div>
            )}
            {ck.falhasScanner && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Falhas / Scanner</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3">{ck.falhasScanner}</p>
              </div>
            )}
            {ck.luzesPainel?.length > 0 && (
              <div>
                <p className="text-xs text-amber-600 uppercase tracking-wide font-medium mb-2">Luzes do Painel ({ck.luzesPainel.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {ck.luzesPainel.map(l => (
                    <span key={l} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">⚠ {l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Secao>
      )}

      {/* ── FOTOS E VISTORIA ── */}
      <Secao icone={Camera} titulo="Fotos e Vistoria" cor="text-cyan-500"
        badge={fotos.length > 0 && <span className="text-xs text-cyan-600 font-semibold bg-cyan-50 px-2 py-0.5 rounded-full">{fotos.length} foto(s)</span>}>
        <div className="space-y-4">
          {/* Upload de fotos */}
          {!concluido && (
            <div className="flex items-center gap-3">
              <select value={categoriaFoto} onChange={e => setCategoriaFoto(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200">
                {CATEGORIAS_FOTO.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={() => inputFotoRef.current?.click()}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                <ImagePlus size={15} /> Adicionar Foto
              </button>
              <input ref={inputFotoRef} type="file" accept="image/*" multiple
                onChange={adicionarFoto} className="hidden" capture="environment" />
            </div>
          )}

          {/* Grid de fotos */}
          {fotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {fotos.map(foto => (
                <div key={foto.id} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[4/3]">
                  <img src={foto.dataUrl} alt={foto.categoria} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <span className="text-white text-xs font-semibold bg-black/40 px-2 py-0.5 rounded-full w-fit">{foto.categoria}</span>
                    {!concluido && (
                      <button onClick={() => removerFoto(foto.id)}
                        className="self-end p-1.5 bg-red-500 text-white rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-center">
              <Camera size={28} className="text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Nenhuma foto adicionada</p>
              <p className="text-xs text-slate-300 mt-0.5">Adicione fotos do veículo para registro</p>
            </div>
          )}

          {/* Inspeção visual */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Eye size={14} className="text-slate-500" /> Inspeção Visual
            </p>
            <div className="space-y-1">
              {inspecao.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <div className="flex gap-1.5">
                    {Object.entries(STATUS_INSP).map(([key, { label, cls }]) => (
                      <button key={key}
                        onClick={() => !concluido && setStatusInsp(item.id, key)}
                        disabled={concluido}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all disabled:cursor-not-allowed ${
                          item.status === key ? cls + ' border-transparent' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Secao>

      {/* ── DIAGNÓSTICO TÉCNICO ── */}
      <Secao icone={Wrench} titulo="Diagnóstico Técnico" cor="text-primary-500"
        badge={
          concluido
            ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Concluído · {ck.tecnicoNome || ''}</span>
            : ck.tecnicoNome
              ? <span className="text-xs text-blue-600 font-medium">{ck.tecnicoNome} · {ck.diagnosticadoEm}</span>
              : null
        }>
        <div className="space-y-3">
          {diagnostico.map(item => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center pb-2 border-b border-slate-50 last:border-0">
              <div className="col-span-4">
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                {item.unidade && <p className="text-xs text-slate-400">{item.unidade}</p>}
              </div>
              <div className="col-span-4">
                <input type="text" placeholder="Valor medido..."
                  value={item.value}
                  onChange={e => setValorDiag(item.id, 'value', e.target.value)}
                  disabled={concluido}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-slate-50 disabled:text-slate-400" />
              </div>
              <div className="col-span-4 flex gap-1.5">
                {Object.entries(STATUS_DIAG).map(([key, { label, cls }]) => (
                  <button key={key}
                    onClick={() => !concluido && setValorDiag(item.id, 'status', key)}
                    disabled={concluido}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:cursor-not-allowed ${
                      item.status === key ? cls : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Observações Técnicas</label>
            <textarea rows={3} value={obsTenicas} onChange={e => setObsTecnicas(e.target.value)}
              disabled={concluido}
              placeholder="Conclusão do diagnóstico, serviços recomendados, peças necessárias..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none disabled:bg-slate-50 disabled:text-slate-400" />
          </div>
        </div>
      </Secao>

      {/* ── Ações ── */}
      {!concluido && (
        <div className="flex items-center gap-3 justify-end pb-4">
          <button onClick={() => salvar('Em diagnóstico')}
            className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar Progresso'}
          </button>

          <button onClick={() => salvar('Diagnóstico concluído')}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <CheckCircle2 size={15} /> Concluir Diagnóstico
          </button>

          {!jaTemOS && (
            <button onClick={criarOS}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <ClipboardList size={15} /> Abrir Ordem de Serviço
            </button>
          )}
        </div>
      )}

      {concluido && !jaTemOS && (
        <div className="flex justify-end pb-4">
          <button onClick={criarOS}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <ClipboardList size={15} /> Abrir Ordem de Serviço
          </button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, Receipt, MessageCircle, FileText, Trash2, Plus, ChevronDown, X, Camera, Lock, ZoomIn, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Banknote, Smartphone, CreditCard, ArrowRightLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { STATUS_OS, statusColor } from './OrdensServico'
import { imprimirOS } from '../utils/print'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

const MODELOS_IMPRESSAO = [
  { id: 'termica80', nome: 'Térmica 80mm (cupom)', desc: 'Impressoras térmicas 80mm — fonte grande, alto contraste' },
  { id: 'termica58', nome: 'Térmica 58mm (cupom estreito)', desc: 'Impressoras térmicas 58mm — fonte compacta, sem bordas' },
  { id: 'a4det', nome: 'A4 Detalhado (completo)', desc: 'Folha A4 com cabeçalho, assinaturas e PIX' },
  { id: 'a4comp', nome: 'A4 Compacto (1 página)', desc: 'A4 enxuto — apenas dados essenciais' },
  { id: 'a5', nome: 'A5 Resumido (meia folha)', desc: 'Metade de A4 — economia de papel' },
]

const ABAS = ['Dados', 'Orçamento', 'Fotos e Vistoria', 'Histórico']

export default function OrdemDetalhe() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const {
    ordens, checklists, getCliente, getVeiculo, getFuncionario, funcionarios, servicos, estoque,
    atualizarOrdem, adicionarItemOrdem, removerItemOrdem, editarItemOrdem, mudarStatusOrdem,
    excluirOrdem, totalOrdem, caixaTurno, registrarVendaCaixa, pagarOrdem, reabrirOrdem,
  } = useApp()

  const os = ordens.find(o => o.id === osId)
  const [aba, setAba] = useState('Dados')
  const [modalEditar, setModalEditar] = useState(false)
  const [modalItem, setModalItem] = useState(false)
  const [menuImpressao, setMenuImpressao] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [pgtos, setPgtos] = useState([])
  const [modalReabrir, setModalReabrir] = useState(false)
  const [editandoItem, setEditandoItem] = useState(null)
  const [taxaPct, setTaxaPct] = useState('10')

  if (!os) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">OS não encontrada.</p>
        <button onClick={() => navigate('/ordens-servico')} className="mt-3 text-primary-500 text-sm">Voltar para lista</button>
      </div>
    )
  }

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  const mecanico = os.mecanicoId ? getFuncionario(os.mecanicoId) : null
  const total = totalOrdem(os)

  function gerarOrcamento() {
    // leva os dados da OS para a tela de Orçamento
    navigate('/orcamentos', { state: { fromOS: { clienteId: os.clienteId, veiculoId: os.veiculoId, itens: os.itens } } })
  }

  function whatsapp() {
    const tel = (cliente?.telefone || '').replace(/\D/g, '')
    const texto = `Olá ${cliente?.nome || ''}! Sobre a OS ${os.id} do veículo ${veiculo?.placa || ''}: status atual *${os.status}*. Total: ${fmt(total)}.`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  function imprimir(modelo) {
    setMenuImpressao(false)
    imprimirOS(os, cliente, veiculo, mecanico, total, modelo)
  }

  async function onUploadFoto(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const file of files) {
      try {
        const blob = await comprimirImagem(file)
        const caminho = `fotos/ordens/${os.id}/${Date.now()}.jpg`
        const url = await uploadFoto(blob, caminho)
        adicionarFotoOrdem(os.id, url)
      } catch {
        alert('Erro ao enviar imagem.')
      }
    }
  }

  // Checklist vinculado pela placa do veículo (mais recente primeiro)
  const placaVeiculo = (veiculo?.placa || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const checklistsVeiculo = (checklists || [])
    .filter(c => placaVeiculo && (c.veiculoPlaca || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === placaVeiculo)
    .sort((a, b) => Number(b.id) - Number(a.id))
  const ckVistoria = checklistsVeiculo[0] || null
  const fotosChecklist = ckVistoria?.fotos || []
  const vistoriaItens = ckVistoria?.inspecaoVisual || []

  function navegarFoto(direcao) {
    const idx = fotosChecklist.findIndex(f => f.id === fotoAmpliada.id)
    const novo = idx + direcao
    if (novo >= 0 && novo < fotosChecklist.length) setFotoAmpliada(fotosChecklist[novo])
  }

  function excluir() {
    if (confirm(`Excluir a OS ${os.id}? Esta ação não pode ser desfeita.`)) {
      excluirOrdem(os.id)
      navigate('/ordens-servico')
    }
  }

  const FORMAS_PGTO = [
    { label: 'PIX', icon: Smartphone },
    { label: 'Dinheiro', icon: Banknote },
    { label: 'Cartão Débito', icon: CreditCard },
    { label: 'Cartão Crédito', icon: CreditCard },
    { label: 'Transferência', icon: ArrowRightLeft },
    { label: 'Boleto', icon: FileText },
  ]

  function addPgto() {
    const soma = pgtos.reduce((s, p) => s + pNum(p.valor), 0)
    const restante = Math.max(0, total - soma)
    setPgtos(ps => [...ps, { id: Date.now(), forma: 'PIX', valor: restante.toFixed(2).replace('.', ','), recebimento: 'na_hora', parcelas: '1' }])
  }

  function removePgto(id) {
    setPgtos(ps => ps.filter(p => p.id !== id))
  }

  function updatePgto(id, field, value) {
    setPgtos(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function confirmarFinalizar(comImprimir) {
    const somaPgtos = pgtos.reduce((s, p) => s + pNum(p.valor), 0)
    if (Math.abs(somaPgtos - total) > 0.01) {
      alert(`A soma dos pagamentos (${fmt(somaPgtos)}) deve ser igual ao total da OS (${fmt(total)}).`)
      return
    }
    mudarStatusOrdem(os.id, 'Concluída')
    pagarOrdem(os.id)
    if (caixaTurno) {
      registrarVendaCaixa({
        total,
        pagamentos: pgtos.map(p => {
          const isC = p.forma === 'Cartão Débito' || p.forma === 'Cartão Crédito'
          const pg = { forma: p.forma, valor: String(pNum(p.valor)) }
          if (isC) pg.recebimento = p.recebimento
          if (p.forma === 'Cartão Crédito' && Number(p.parcelas) > 1) pg.parcelas = Number(p.parcelas)
          return pg
        }),
        clienteNome: cliente?.nome || 'Cliente',
        osId: os.id,
      })
    }
    setModalFinalizar(false)
    if (comImprimir) {
      setTimeout(() => imprimirOS(os, cliente, veiculo, mecanico, total, 'a4det'), 300)
    }
  }

  function confirmarReabrir() {
    reabrirOrdem(os.id)
    setModalReabrir(false)
  }

  function aplicarTaxaItem(item) {
    const pct = parseFloat(taxaPct) || 0
    if (!pct) return
    editarItemOrdem(os.id, item.id, { valorUnitario: (pNum(item.valorUnitario) * (1 + pct / 100)).toFixed(2).replace('.', ',') })
  }

  function aplicarTaxaTodos() {
    const pct = parseFloat(taxaPct) || 0
    if (!pct || !os.itens?.length) return
    os.itens.forEach(item => {
      editarItemOrdem(os.id, item.id, { valorUnitario: (pNum(item.valorUnitario) * (1 + pct / 100)).toFixed(2).replace('.', ',') })
    })
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/ordens-servico')} className="mt-1 text-slate-400 hover:text-slate-600"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">OS {os.id}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[os.status] || 'bg-slate-100 text-slate-600'}`}>{os.status}</span>
            </div>
            <p className="text-sm text-slate-500">{cliente?.nome || '—'} • {veiculo ? `${veiculo.placa} ${veiculo.modelo}` : '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap">
          <button onClick={() => setModalEditar(true)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap flex-shrink-0"><Pencil size={14} />Editar</button>
          <button onClick={() => imprimir('a4det')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap flex-shrink-0"><Printer size={14} />Nota de Serviço</button>
          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuImpressao(v => !v)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"><Receipt size={14} />Recibo<ChevronDown size={14} /></button>
            {menuImpressao && (
              <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Escolha o modelo de impressão</p>
                {MODELOS_IMPRESSAO.map(m => (
                  <button key={m.id} onClick={() => imprimir(m.id)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-50">
                    <p className="text-sm font-medium text-slate-700">{m.nome}</p>
                    <p className="text-xs text-slate-400">{m.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={whatsapp} className="flex items-center gap-1.5 border border-green-200 text-green-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors whitespace-nowrap flex-shrink-0"><MessageCircle size={14} />WhatsApp</button>
          <button onClick={gerarOrcamento} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap flex-shrink-0"><FileText size={14} />Gerar Orçamento</button>
          {os.status !== 'Concluída' && os.status !== 'Cancelada' && (
            <button onClick={() => { setPgtos([{ id: 1, forma: 'PIX', valor: total.toFixed(2).replace('.', ','), recebimento: 'na_hora', parcelas: '1' }]); setModalFinalizar(true) }} className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <CheckCircle2 size={14} />Finalizar OS
            </button>
          )}
          {os.status === 'Concluída' && (
            <button onClick={() => setModalReabrir(true)} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0">
              <ArrowRightLeft size={14} />Reabrir OS
            </button>
          )}
          <button onClick={excluir} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"><Trash2 size={14} />Excluir</button>
        </div>
      </div>

      {/* Alterar status */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Alterar Status:</label>
        <select value={os.status} onChange={e => mudarStatusOrdem(os.id, e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          {STATUS_OS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Abas */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${aba === a ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {a}
          </button>
        ))}
      </div>

      {/* ===== DADOS ===== */}
      {aba === 'Dados' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Informações</h3>
            <Linha label="Data Entrada" valor={os.dataEntrada || os.data} />
            <Linha label="Data Conclusão" valor={os.dataConclusao || '—'} />
            <Linha label="KM Entrada" valor={os.kmEntrada || '—'} />
            <Linha label="Mecânico Responsável" valor={mecanico?.nome || '—'} />
            {os.descricaoProblema && <div className="pt-3 mt-1 border-t border-slate-50"><p className="text-xs text-slate-400 mb-1">Descrição do Problema</p><p className="text-sm text-slate-600">{os.descricaoProblema}</p></div>}
            {os.diagnostico && <div className="pt-3 mt-2 border-t border-slate-50"><p className="text-xs text-slate-400 mb-1">Diagnóstico</p><p className="text-sm text-slate-600">{os.diagnostico}</p></div>}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Cliente / Veículo</h3>
            <Linha label="Cliente" valor={cliente?.nome || '—'} />
            <Linha label="Telefone" valor={cliente?.telefone || '—'} />
            <Linha label="Veículo" valor={veiculo ? `${veiculo.placa} - ${veiculo.modelo}` : '—'} />
            <Linha label="Ano/Cor" valor={veiculo ? `${veiculo.ano || '—'} / ${veiculo.cor || '—'}` : '—'} />
          </div>
        </div>
      )}

      {/* ===== ORÇAMENTO ===== */}
      {aba === 'Orçamento' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-slate-800">Itens / Orçamento</h3>
              <p className="text-sm text-slate-500">Total: {fmt(total)}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Acréscimo:</span>
                <input type="number" value={taxaPct} onChange={e => setTaxaPct(e.target.value)} min="0" max="100" step="0.5"
                  className="w-12 text-sm text-right focus:outline-none bg-transparent font-semibold text-amber-800" />
                <span className="text-sm font-semibold text-amber-700">%</span>
                <button onClick={aplicarTaxaTodos}
                  className="text-xs px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium transition-colors whitespace-nowrap">
                  Todos
                </button>
              </div>
              <button onClick={() => setModalItem(true)} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Plus size={15} />Adicionar</button>
            </div>
          </div>
          {(!os.itens || os.itens.length === 0) ? (
            <p className="text-center text-sm text-slate-400 py-10">Nenhum item adicionado</p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-y border-slate-100 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 font-semibold">Item</th>
                  <th className="text-center py-2 font-semibold">Qtd</th>
                  <th className="text-right py-2 font-semibold">Valor Un.</th>
                  <th className="text-right py-2 font-semibold">Desc.</th>
                  <th className="text-right py-2 font-semibold">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {os.itens.map(it => (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <span className="text-sm text-slate-700">{it.descricao} </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${it.tipo === 'servico' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{it.tipo === 'servico' ? 'serviço' : 'peça'}</span>
                      {it.tipo === 'servico' && it.mecanicoId && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">{getFuncionario(it.mecanicoId)?.nome || ''}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center text-sm text-slate-600">{it.quantidade}</td>
                    <td className="py-2.5 text-right text-sm text-slate-600">{fmt(pNum(it.valorUnitario))}</td>
                    <td className="py-2.5 text-right text-sm text-slate-500">{pNum(it.desconto) > 0 ? fmt(pNum(it.desconto)) : '—'}</td>
                    <td className="py-2.5 text-right text-sm font-semibold text-slate-700">{fmt(pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto))}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => aplicarTaxaItem(it)} title={`+${taxaPct}%`} className="p-1 rounded hover:bg-amber-50 text-slate-300 hover:text-amber-500 text-xs font-bold transition-colors">%</button>
                        <button onClick={() => setEditandoItem({ ...it, quantidade: String(it.quantidade), valorUnitario: String(it.valorUnitario), desconto: String(it.desconto || '0'), mecanicoId: it.mecanicoId || '' })} className="p-1 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400"><Pencil size={14} /></button>
                        <button onClick={() => removerItemOrdem(os.id, it.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100">
                  <td colSpan={4} className="py-3 text-right text-sm font-semibold text-slate-600">Total</td>
                  <td className="py-3 text-right font-bold text-slate-800">{fmt(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ===== FOTOS E VISTORIA (read-only do checklist) ===== */}
      {aba === 'Fotos e Vistoria' && (
        <>
          {/* Lightbox */}
          {fotoAmpliada && (
            <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setFotoAmpliada(null)}>
              <button onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><X size={24} /></button>
              {fotosChecklist.findIndex(f => f.id === fotoAmpliada.id) > 0 && (
                <button onClick={e => { e.stopPropagation(); navegarFoto(-1) }} className="absolute left-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronLeft size={28} /></button>
              )}
              <img src={fotoAmpliada.url || fotoAmpliada.dataUrl} alt="Foto ampliada" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
              {fotosChecklist.findIndex(f => f.id === fotoAmpliada.id) < fotosChecklist.length - 1 && (
                <button onClick={e => { e.stopPropagation(); navegarFoto(1) }} className="absolute right-4 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"><ChevronRight size={28} /></button>
              )}
              <div className="absolute bottom-4 text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full flex items-center gap-2">
                <span className="font-medium">{fotoAmpliada.categoria}</span>
                <span>·</span>
                <span>{fotosChecklist.findIndex(f => f.id === fotoAmpliada.id) + 1} / {fotosChecklist.length}</span>
              </div>
            </div>
          )}

          {!ckVistoria ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
              <Camera size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-600">Nenhum checklist vinculado</p>
              <p className="text-sm text-slate-400 mt-1">Crie um checklist para este veículo em <strong>Fotos e Vistoria</strong>.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Fotos */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Camera size={15} className="text-cyan-500" />
                  <h3 className="font-semibold text-slate-800">Fotos do Veículo</h3>
                  <span className="ml-auto text-xs text-slate-400">{fotosChecklist.length} foto(s)</span>
                  <span className="text-xs text-slate-300 flex items-center gap-1"><Lock size={11} />Somente leitura</span>
                </div>
                {fotosChecklist.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">Nenhuma foto registrada no checklist</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {fotosChecklist.map(f => (
                      <div key={f.id}
                        className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in"
                        onClick={() => setFotoAmpliada(f)}>
                        <img src={f.url || f.dataUrl} alt={f.categoria} className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none">{f.categoria}</div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn size={22} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vistoria */}
              {vistoriaItens.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={15} className="text-green-500" />
                    <h3 className="font-semibold text-slate-800">Vistoria do Veículo</h3>
                    <span className="ml-auto text-xs text-slate-400">
                      {vistoriaItens.filter(i => i.status).length}/{vistoriaItens.length} itens
                    </span>
                  </div>
                  <div className="space-y-2">
                    {vistoriaItens.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-sm text-slate-700">{item.label}</span>
                        <div className="flex items-center gap-2">
                          {item.nota && <span className="text-xs text-slate-400 italic max-w-[120px] truncate">{item.nota}</span>}
                          {item.status === 'ok' && <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg"><CheckCircle2 size={13} />OK</span>}
                          {item.status === 'warning' && <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><AlertTriangle size={13} />Atenção</span>}
                          {item.status === 'issue' && <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-lg"><X size={13} />Problema</span>}
                          {!item.status && <span className="text-xs text-slate-300">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== HISTÓRICO ===== */}
      {aba === 'Histórico' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Histórico</h3>
          {(!os.historico || os.historico.length === 0) ? (
            <p className="text-sm text-slate-400">Sem histórico</p>
          ) : (
            <div className="space-y-3">
              {os.historico.map(h => (
                <div key={h.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5"></div>
                  <div>
                    <p className="text-sm text-slate-700">{h.texto}</p>
                    <p className="text-xs text-slate-400">{h.data}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalEditar && <ModalEditar os={os} funcionarios={funcionarios} onClose={() => setModalEditar(false)} onSalvar={d => { atualizarOrdem(os.id, d); setModalEditar(false) }} />}
      {modalItem && <ModalAdicionarItem servicos={servicos} estoque={estoque} funcionarios={funcionarios} onClose={() => setModalItem(false)} onAdd={item => { adicionarItemOrdem(os.id, item); setModalItem(false) }} />}

      {/* Modal Finalizar OS */}
      {modalFinalizar && (() => {
        const somaPgtos = pgtos.reduce((s, p) => s + pNum(p.valor), 0)
        const restante = total - somaPgtos
        const valido = Math.abs(restante) < 0.01
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalFinalizar(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <h3 className="font-semibold text-slate-800">Finalizar OS {os.id}</h3>
                <button onClick={() => setModalFinalizar(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total da OS</span>
                  <span className="text-xl font-bold text-primary-600">{fmt(total)}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Formas de Pagamento</label>
                    <button type="button" onClick={addPgto} className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700">
                      <Plus size={13} />Adicionar
                    </button>
                  </div>

                  {pgtos.map(pg => {
                    const isC = pg.forma === 'Cartão Débito' || pg.forma === 'Cartão Crédito'
                    return (
                      <div key={pg.id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <select value={pg.forma} onChange={e => updatePgto(pg.id, 'forma', e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                            {FORMAS_PGTO.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
                          </select>
                          <div className="flex items-center border border-slate-200 rounded-lg bg-white px-2">
                            <span className="text-xs text-slate-400">R$</span>
                            <input
                              type="text"
                              value={pg.valor}
                              onChange={e => updatePgto(pg.id, 'valor', e.target.value)}
                              className="w-24 py-2 text-sm font-medium text-right focus:outline-none bg-transparent"
                              placeholder="0,00"
                            />
                          </div>
                          {pgtos.length > 1 && (
                            <button type="button" onClick={() => removePgto(pg.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        {isC && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => updatePgto(pg.id, 'recebimento', 'na_hora')}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pg.recebimento === 'na_hora' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              Na hora
                            </button>
                            <button type="button" onClick={() => updatePgto(pg.id, 'recebimento', '1_dia_util')}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pg.recebimento === '1_dia_util' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              1 dia útil
                            </button>
                          </div>
                        )}

                        {pg.forma === 'Cartão Crédito' && (
                          <div className="space-y-1">
                            <div className="grid grid-cols-6 gap-1">
                              {['1','2','3','4','5','6','7','8','9','10','11','12'].map(p => (
                                <button key={p} type="button" onClick={() => updatePgto(pg.id, 'parcelas', p)}
                                  className={`py-1 rounded border text-xs font-medium transition-colors ${pg.parcelas === p ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                  {p}x
                                </button>
                              ))}
                            </div>
                            {Number(pg.parcelas) > 1 && (
                              <p className="text-xs text-slate-400 text-center">
                                {pg.parcelas}x de {fmt(pNum(pg.valor) / Number(pg.parcelas))}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {pgtos.length > 1 && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${valido ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    <span>{valido ? '✓ Valores conferem' : 'Restante a distribuir'}</span>
                    {!valido && <span>{fmt(Math.abs(restante))}</span>}
                  </div>
                )}

                {!caixaTurno && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
                    <AlertTriangle size={14} />
                    Caixa fechado — o valor será lançado no financeiro mas não no caixa.
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => confirmarFinalizar(false)} disabled={!valido}
                    className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Confirmar
                  </button>
                  <button type="button" onClick={() => confirmarFinalizar(true)} disabled={!valido}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                    <Printer size={15} />Confirmar e Imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Editar Item */}
      {editandoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditandoItem(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Editar Item</h3>
              <button onClick={() => setEditandoItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input value={editandoItem.descricao} onChange={e => setEditandoItem(i => ({ ...i, descricao: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input type="number" value={editandoItem.quantidade} onChange={e => setEditandoItem(i => ({ ...i, quantidade: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unit.</label>
                  <input value={editandoItem.valorUnitario} onChange={e => setEditandoItem(i => ({ ...i, valorUnitario: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desconto</label>
                  <input value={editandoItem.desconto} onChange={e => setEditandoItem(i => ({ ...i, desconto: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              {editandoItem.tipo === 'servico' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reparador</label>
                  <select value={editandoItem.mecanicoId || ''} onChange={e => setEditandoItem(i => ({ ...i, mecanicoId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Sem reparador</option>
                    {funcionarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditandoItem(null)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={() => { editarItemOrdem(os.id, editandoItem.id, { descricao: editandoItem.descricao, quantidade: Number(editandoItem.quantidade) || 1, valorUnitario: editandoItem.valorUnitario, desconto: editandoItem.desconto, mecanicoId: editandoItem.tipo === 'servico' ? (editandoItem.mecanicoId || null) : null }); setEditandoItem(null) }}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reabrir OS */}
      {modalReabrir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalReabrir(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Reabrir OS {os.id}</h3>
              <button onClick={() => setModalReabrir(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">Atenção: estorno será feito</p>
                  <p className="text-xs mt-0.5 text-amber-700">O lançamento financeiro e a venda do caixa desta OS serão removidos. A OS voltará para <strong>Em Andamento</strong>.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModalReabrir(false)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarReabrir}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Confirmar Reabertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Linha({ label, valor }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700 text-right">{valor}</span>
    </div>
  )
}

function ModalBase({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function ModalEditar({ os, funcionarios, onClose, onSalvar }) {
  const [f, setF] = useState({
    kmEntrada: os.kmEntrada || '',
    mecanicoId: os.mecanicoId || '',
    dataEntrada: os.dataEntradaISO || '',
    dataConclusao: os.dataConclusaoISO || '',
    descricaoProblema: os.descricaoProblema || '',
    diagnostico: os.diagnostico || '',
    observacoes: os.observacoes || '',
    anotacoesInternas: os.anotacoesInternas || '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <ModalBase title={`Editar OS ${os.id}`} onClose={onClose}>
      <div className="space-y-3">
        <Campo label="KM de Entrada"><input value={f.kmEntrada} onChange={e => set('kmEntrada', e.target.value)} className="inp" /></Campo>
        <Campo label="Mecânico Responsável">
          <select value={f.mecanicoId} onChange={e => set('mecanicoId', e.target.value)} className="inp">
            <option value="">Nenhum</option>
            {funcionarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data de Entrada"><input type="datetime-local" value={f.dataEntrada} onChange={e => set('dataEntrada', e.target.value)} className="inp" /></Campo>
          <Campo label="Data de Conclusão"><input type="datetime-local" value={f.dataConclusao} onChange={e => set('dataConclusao', e.target.value)} className="inp" /></Campo>
        </div>
        <Campo label="Descrição do Problema"><textarea rows={2} value={f.descricaoProblema} onChange={e => set('descricaoProblema', e.target.value)} className="inp resize-none" /></Campo>
        <Campo label="Diagnóstico"><textarea rows={2} value={f.diagnostico} onChange={e => set('diagnostico', e.target.value)} className="inp resize-none" /></Campo>
        <Campo label="Observações"><textarea rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} className="inp resize-none" /></Campo>
        <Campo label={<span className="flex items-center gap-1"><Lock size={12} />Anotações internas <span className="text-slate-400 font-normal">(não saí impresso na OS)</span></span>}>
          <textarea rows={2} value={f.anotacoesInternas} onChange={e => set('anotacoesInternas', e.target.value)} placeholder="Ex: nº do pedido de peças, fornecedor, prazos internos..." className="inp resize-none" />
        </Campo>
        <button onClick={() => {
          const extra = {}
          if (f.dataEntrada) { extra.dataEntradaISO = f.dataEntrada; extra.dataEntrada = new Date(f.dataEntrada).toLocaleDateString('pt-BR') }
          if (f.dataConclusao) { extra.dataConclusaoISO = f.dataConclusao; extra.dataConclusao = new Date(f.dataConclusao).toLocaleDateString('pt-BR') }
          onSalvar({ ...f, mecanicoId: f.mecanicoId ? Number(f.mecanicoId) : null, ...extra })
        }} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Salvar</button>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #f97316}`}</style>
    </ModalBase>
  )
}

function Campo({ label, children }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>{children}</div>
}

function ModalAdicionarItem({ servicos, estoque, funcionarios, onClose, onAdd }) {
  const [modo, setModo] = useState('cadastrado') // 'cadastrado' | 'avulso'
  const [tipo, setTipo] = useState('servico')
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnitario, setValorUnitario] = useState('')
  const [desconto, setDesconto] = useState('0')
  const [mecanicoId, setMecanicoId] = useState('')

  const lista = tipo === 'servico'
    ? servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))
    : estoque.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(busca.toLowerCase()))

  function trocarModo(m) {
    setModo(m)
    setSelId('')
    setBusca('')
    setDescricao('')
    setValorUnitario('')
  }

  function selecionar(item) {
    setSelId(item.id)
    setDescricao(tipo === 'servico' ? item.nome : `${item.nome}${item.codigo ? ` (${item.codigo})` : ''}`)
    setValorUnitario(item.preco)
  }

  function adicionar() {
    if (!descricao.trim()) return
    onAdd({
      tipo,
      produtoId: tipo === 'peca' ? selId : null,
      servicoId: tipo === 'servico' ? selId : null,
      descricao,
      quantidade: Number(quantidade) || 1,
      valorUnitario,
      desconto,
      mecanicoId: tipo === 'servico' && mecanicoId ? Number(mecanicoId) : null,
    })
  }

  return (
    <ModalBase title="Adicionar Item" onClose={onClose}>
      <div className="space-y-3">

        {/* Toggle Cadastrado / Avulso */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button type="button" onClick={() => trocarModo('cadastrado')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'cadastrado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Do Cadastro
          </button>
          <button type="button" onClick={() => trocarModo('avulso')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'avulso' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Avulso
          </button>
        </div>

        <Campo label="Tipo">
          <select value={tipo} onChange={e => { setTipo(e.target.value); setSelId(''); setBusca(''); setDescricao(''); setValorUnitario(''); setMecanicoId('') }} className="inp">
            <option value="servico">Serviço</option>
            <option value="peca">Peça</option>
          </select>
        </Campo>

        {modo === 'cadastrado' && (
          <Campo label={tipo === 'servico' ? 'Serviço cadastrado' : 'Produto do estoque'}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tipo === 'servico' ? 'Pesquisar serviço...' : 'Pesquisar produto...'} className="inp mb-1" />
            <div className="border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
              {lista.map(item => (
                <button key={item.id} onClick={() => selecionar(item)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${selId === item.id ? 'bg-primary-500 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
                  <span>{item.nome}{tipo === 'peca' && item.codigo ? ` (${item.codigo})` : ''}</span>
                  <span className={selId === item.id ? 'text-white' : 'text-slate-400'}>{fmt(pNum(item.preco))}</span>
                </button>
              ))}
              {lista.length === 0 && <p className="text-xs text-slate-400 px-3 py-2">Nada encontrado.</p>}
            </div>
          </Campo>
        )}

        <Campo label="Descrição *"><input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder={modo === 'avulso' ? 'Descreva o serviço ou peça...' : ''} className="inp" /></Campo>
        {tipo === 'servico' && (
          <Campo label="Reparador">
            <select value={mecanicoId} onChange={e => setMecanicoId(e.target.value)} className="inp">
              <option value="">Sem reparador</option>
              {(funcionarios || []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Campo>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Quantidade"><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="inp" /></Campo>
          <Campo label="Valor Unitário"><input value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} placeholder="0,00" className="inp" /></Campo>
          <Campo label="Desconto (R$)"><input value={desconto} onChange={e => setDesconto(e.target.value)} className="inp" /></Campo>
        </div>
        <button onClick={adicionar} disabled={!descricao.trim()} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Adicionar</button>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #f97316}`}</style>
    </ModalBase>
  )
}

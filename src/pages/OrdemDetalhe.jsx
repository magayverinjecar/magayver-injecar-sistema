import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, Receipt, MessageCircle, FileText, Trash2, Plus, ChevronDown, X, Camera, Lock } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { STATUS_OS, statusColor } from './OrdensServico'
import { imprimirOS } from '../utils/print'
import { uploadFoto } from '../supabase'

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
        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX } }
        else { if (h > MAX) { w = w * MAX / h; h = MAX } }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Erro')), 'image/jpeg', 0.7)
      }
    }
    reader.onerror = reject
  })
}

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }

const MODELOS_IMPRESSAO = [
  { id: 'termica80', nome: 'Térmica 80mm (cupom)', desc: 'Impressoras térmicas 80mm — fonte grande, alto contraste' },
  { id: 'termica58', nome: 'Térmica 58mm (cupom estreito)', desc: 'Impressoras térmicas 58mm — fonte compacta, sem bordas' },
  { id: 'a4det', nome: 'A4 Detalhado (completo)', desc: 'Folha A4 com cabeçalho, assinaturas e PIX' },
  { id: 'a4comp', nome: 'A4 Compacto (1 página)', desc: 'A4 enxuto — apenas dados essenciais' },
  { id: 'a5', nome: 'A5 Resumido (meia folha)', desc: 'Metade de A4 — economia de papel' },
]

const ABAS = ['Dados', 'Orçamento', 'Checklist', 'Fotos', 'Histórico']

export default function OrdemDetalhe() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const {
    ordens, getCliente, getVeiculo, getFuncionario, funcionarios, servicos, estoque,
    atualizarOrdem, adicionarItemOrdem, removerItemOrdem, mudarStatusOrdem,
    adicionarFotoOrdem, removerFotoOrdem, excluirOrdem, totalOrdem,
  } = useApp()

  const os = ordens.find(o => o.id === osId)
  const [aba, setAba] = useState('Dados')
  const [modalEditar, setModalEditar] = useState(false)
  const [modalItem, setModalItem] = useState(false)
  const [menuImpressao, setMenuImpressao] = useState(false)
  const fileRef = useRef(null)

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

  function excluir() {
    if (confirm(`Excluir a OS ${os.id}? Esta ação não pode ser desfeita.`)) {
      excluirOrdem(os.id)
      navigate('/ordens-servico')
    }
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

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModalEditar(true)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Pencil size={14} />Editar</button>
          <button onClick={() => imprimir('a4det')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Printer size={14} />Nota de Serviço</button>
          <div className="relative">
            <button onClick={() => setMenuImpressao(v => !v)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Receipt size={14} />Recibo<ChevronDown size={14} /></button>
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
          <button onClick={whatsapp} className="flex items-center gap-1.5 border border-green-200 text-green-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"><MessageCircle size={14} />WhatsApp</button>
          <button onClick={gerarOrcamento} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><FileText size={14} />Gerar Orçamento</button>
          <button onClick={excluir} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Trash2 size={14} />Excluir</button>
        </div>
      </div>

      {/* Alterar status */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Alterar Status:</label>
        <select value={os.status} onChange={e => mudarStatusOrdem(os.id, e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          {STATUS_OS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Abas */}
      <div className="border-b border-slate-200 flex gap-1">
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${aba === a ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {a === 'Checklist' || a === 'Fotos' ? `${a}` : a}
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800">Itens / Orçamento</h3>
              <p className="text-sm text-slate-500">Total: {fmt(total)}</p>
            </div>
            <button onClick={() => setModalItem(true)} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Plus size={15} />Adicionar</button>
          </div>
          {(!os.itens || os.itens.length === 0) ? (
            <p className="text-center text-sm text-slate-400 py-10">Nenhum item adicionado</p>
          ) : (
            <table className="w-full">
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
                    </td>
                    <td className="py-2.5 text-center text-sm text-slate-600">{it.quantidade}</td>
                    <td className="py-2.5 text-right text-sm text-slate-600">{fmt(pNum(it.valorUnitario))}</td>
                    <td className="py-2.5 text-right text-sm text-slate-500">{pNum(it.desconto) > 0 ? fmt(pNum(it.desconto)) : '—'}</td>
                    <td className="py-2.5 text-right text-sm font-semibold text-slate-700">{fmt(pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto))}</td>
                    <td className="py-2.5 text-right"><button onClick={() => removerItemOrdem(os.id, it.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"><Trash2 size={14} /></button></td>
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
          )}
        </div>
      )}

      {/* ===== CHECKLIST (em breve) ===== */}
      {aba === 'Checklist' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
          <Lock size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-600">Checklist em breve</p>
          <p className="text-sm text-slate-400 mt-1">Será integrado ao AutoCheck Pro.</p>
        </div>
      )}

      {/* ===== FOTOS ===== */}
      {aba === 'Fotos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Camera size={16} className="text-slate-400" />Fotos ({(os.fotos || []).length})</h3>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Plus size={15} />Adicionar</button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onUploadFoto} />
          </div>
          {(!os.fotos || os.fotos.length === 0) ? (
            <p className="text-center text-sm text-slate-400 py-10">Nenhuma foto adicionada</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {os.fotos.map(f => (
                <div key={f.id} className="relative group rounded-lg overflow-hidden border border-slate-100">
                  <img src={f.url} alt="" className="w-full h-32 object-cover" />
                  <button onClick={() => removerFotoOrdem(os.id, f.id)} className="absolute top-1 right-1 bg-black/50 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
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
      {modalItem && <ModalAdicionarItem servicos={servicos} estoque={estoque} onClose={() => setModalItem(false)} onAdd={item => { adicionarItemOrdem(os.id, item); setModalItem(false) }} />}
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

function ModalAdicionarItem({ servicos, estoque, onClose, onAdd }) {
  const [tipo, setTipo] = useState('servico')
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnitario, setValorUnitario] = useState('')
  const [desconto, setDesconto] = useState('0')

  const lista = tipo === 'servico'
    ? servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))
    : estoque.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(busca.toLowerCase()))

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
    })
  }

  return (
    <ModalBase title="Adicionar Item" onClose={onClose}>
      <div className="space-y-3">
        <Campo label="Tipo">
          <select value={tipo} onChange={e => { setTipo(e.target.value); setSelId(''); setBusca('') }} className="inp">
            <option value="servico">Serviço</option>
            <option value="peca">Peça</option>
          </select>
        </Campo>
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
        <Campo label="Descrição *"><input value={descricao} onChange={e => setDescricao(e.target.value)} className="inp" /></Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Quantidade"><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="inp" /></Campo>
          <Campo label="Valor Unitário"><input value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} className="inp" /></Campo>
          <Campo label="Desconto (R$)"><input value={desconto} onChange={e => setDesconto(e.target.value)} className="inp" /></Campo>
        </div>
        <button onClick={adicionar} disabled={!descricao.trim()} className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Adicionar</button>
      </div>
      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #f97316}`}</style>
    </ModalBase>
  )
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Lock, ClipboardList, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import TelaCadastro from '../components/TelaCadastro'

const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'

function foto(os) {
  return {
    kmEntrada: os?.kmEntrada || '',
    mecanicoId: os?.mecanicoId || '',
    dataEntrada: os?.dataEntradaISO || '',
    dataConclusao: os?.dataConclusaoISO || '',
    descricaoProblema: os?.descricaoProblema || '',
    diagnostico: os?.diagnostico || '',
    observacoes: os?.observacoes || '',
    anotacoesInternas: os?.anotacoesInternas || '',
  }
}

// Correção dos dados da OS, em tela.
//
// São oito campos, quatro deles textos longos (problema, diagnóstico,
// observações, anotações internas). Num popup eles ficavam com duas linhas de
// altura cada e rolando dentro da caixa — justo os campos onde se escreve o que
// aconteceu com o carro. Em tela cabem lado a lado, com altura de verdade.
export default function OrdemEditar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ordens, funcionarios, atualizarOrdem } = useApp()

  const os = ordens.find(o => String(o.id) === String(id))

  const [f, setF] = useState(() => foto(os))
  const [carregadoDe, setCarregadoDe] = useState(os ? os.id : null)
  // As OS chegam do banco depois da primeira pintura: sem isto, abrir por link
  // direto pegaria a ficha em branco e salvar apagaria o que estava escrito.
  if (os && carregadoDe !== os.id) {
    setCarregadoDe(os.id)
    setF(foto(os))
  }

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const sujo = os ? JSON.stringify(f) !== JSON.stringify(foto(os)) : false
  const voltarPara = `/ordens-servico/${encodeURIComponent(id)}`

  function salvar() {
    const extra = {}
    if (f.dataEntrada) {
      extra.dataEntradaISO = f.dataEntrada
      extra.dataEntrada = new Date(f.dataEntrada).toLocaleDateString('pt-BR')
    }
    if (f.dataConclusao) {
      extra.dataConclusaoISO = f.dataConclusao
      extra.dataConclusao = new Date(f.dataConclusao).toLocaleDateString('pt-BR')
    }
    atualizarOrdem(os.id, { ...f, mecanicoId: f.mecanicoId ? Number(f.mecanicoId) : null, ...extra })
  }

  if (!os && ordens.length > 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <ClipboardList size={30} className="text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Ordem de serviço não encontrada.</p>
        <button onClick={() => navigate('/ordens-servico')}
          className="mt-4 inline-flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          <ArrowLeft size={15} /> Voltar à lista
        </button>
      </div>
    )
  }

  return (
    <TelaCadastro
      titulo={`Editar OS ${id}`}
      subtitulo="Corrige os dados da ficha. Peças e serviços continuam sendo lançados na tela da OS."
      voltarPara={voltarPara}
      sujo={sujo}
      erro=""
      rotuloSalvar="Salvar alterações"
      rotuloLimpo="Nada alterado"
      onSalvar={salvar}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div>
          <label className={ROTULO}>KM de Entrada</label>
          <input value={f.kmEntrada} onChange={e => set('kmEntrada', e.target.value)} inputMode="numeric" className={INP} />
        </div>
        <div>
          <label className={ROTULO}>Mecânico Responsável</label>
          <select value={f.mecanicoId} onChange={e => set('mecanicoId', e.target.value)} className={INP}>
            <option value="">Nenhum</option>
            {funcionarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={ROTULO}>Data de Entrada</label>
          <input type="datetime-local" value={f.dataEntrada} onChange={e => set('dataEntrada', e.target.value)} className={INP} />
        </div>
        <div>
          <label className={ROTULO}>Data de Conclusão</label>
          <input type="datetime-local" value={f.dataConclusao} onChange={e => set('dataConclusao', e.target.value)} className={INP} />
        </div>

        {/* Os quatro textos longos, dois a dois e com altura de verdade — era
            aqui que o popup mais apertava. */}
        <div className="lg:col-span-2">
          <label className={ROTULO}>Descrição do Problema</label>
          <textarea rows={5} value={f.descricaoProblema} onChange={e => set('descricaoProblema', e.target.value)} className={`${INP} resize-none`} />
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Diagnóstico</label>
          <textarea rows={5} value={f.diagnostico} onChange={e => set('diagnostico', e.target.value)} className={`${INP} resize-none`} />
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Observações</label>
          <textarea rows={4} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} className={`${INP} resize-none`} />
        </div>
        <div className="lg:col-span-2">
          <label className={`${ROTULO} flex items-center gap-1`}>
            <Lock size={12} />Anotações internas
            <span className="text-slate-400 font-normal">(não sai impresso na OS)</span>
          </label>
          <textarea rows={4} value={f.anotacoesInternas} onChange={e => set('anotacoesInternas', e.target.value)}
            placeholder="Ex: nº do pedido de peças, fornecedor, prazos internos..." className={`${INP} resize-none`} />
        </div>
      </div>
    </TelaCadastro>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Car, User, Clock, Gauge, Fuel, AlertTriangle,
  MessageSquare, Save, CheckCircle2, FileText, Camera, Plus, Trash2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { useAuth } from '../context/AuthContext'
import gerarId from '../utils/id'
import { statusColor } from './OrdensServico'
import {
  DIAGNOSTICO_ITENS, normalizarDiagnostico, contarPreenchidos,
} from '../utils/diagnostico'

// Tela de diagnóstico do reparador. Traz tudo que ele precisa para trabalhar —
// veículo, contexto, relato do cliente — sem depender de acesso à OS, onde
// ficam valores e financeiro.
export default function OficinaDiagnosticoDetalhe() {
  const { id } = useParams()
  const osId = decodeURIComponent(id)
  const navigate = useNavigate()
  const {
    ordens, getCliente, getVeiculo, carregando,
    salvarDiagnostico, finalizarDiagnostico,
  } = useApp()
  const { temPermissao } = useAuth()

  const os = ordens.find(o => o.id === osId)
  const podeVerOS = temPermissao('ordens-servico')

  const [itens, setItens] = useState(null)
  const [falhasScanner, setFalhasScanner] = useState(null)
  const [conclusao, setConclusao] = useState(null)
  const [pecas, setPecas] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const diagItens = itens ?? normalizarDiagnostico(os?.diagnosticoItens)
  const scanner = falhasScanner ?? os?.falhasScanner ?? ''
  const parecer = conclusao ?? os?.observacoesTecnicas ?? ''
  const listaPecas = pecas ?? os?.pecasNecessarias ?? []
  const pendente = itens !== null || falhasScanner !== null || conclusao !== null || pecas !== null

  useEffect(() => {
    if (!pendente) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendente])

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando...</p>
    </div>
  )

  if (!os) return (
    <div className="p-6 text-center">
      <p className="text-slate-500">Veículo não encontrado.</p>
      <button onClick={() => navigate('/oficina/diagnostico')} className="mt-3 text-primary-500 text-sm">← Voltar</button>
    </div>
  )

  const cliente = getCliente(os.clienteId)
  const veiculo = getVeiculo(os.veiculoId)
  const luzes = os.luzesPainel || []
  const preenchidos = contarPreenchidos(diagItens)
  // Depois de aprovado o carro já saiu da fase de diagnóstico: a tela vira
  // consulta, para o reparador reler o laudo enquanto executa o serviço.
  const naFaseDiagnostico = ['Recepção', 'Em Diagnóstico', 'Diagnóstico'].includes(os.status)

  function setValorItem(itemId, valor) {
    setItens(diagItens.map(i => i.id === itemId ? { ...i, value: valor } : i))
  }

  function addPeca() {
    setPecas([...listaPecas, { id: gerarId(), descricao: '', quantidade: '1' }])
  }

  function editarPeca(pid, campo, valor) {
    setPecas(listaPecas.map(p => p.id === pid ? { ...p, [campo]: valor } : p))
  }

  function removerPeca(pid) {
    setPecas(listaPecas.filter(p => p.id !== pid))
  }

  // O que vai para a OS em qualquer salvamento
  function dadosDoDiagnostico() {
    return {
      diagnosticoItens: diagItens,
      falhasScanner: scanner,
      observacoesTecnicas: parecer,
      pecasNecessarias: listaPecas.filter(p => p.descricao.trim()),
    }
  }

  function limparRascunho() {
    setItens(null); setFalhasScanner(null); setConclusao(null); setPecas(null)
  }

  function voltar() {
    if (pendente && !confirm('Há alterações não salvas no diagnóstico.\n\nSair mesmo assim?')) return
    navigate('/oficina/diagnostico')
  }

  function salvarProgresso() {
    setSalvando(true)
    salvarDiagnostico(os.id, dadosDoDiagnostico())
    limparRascunho()
    setSalvo(true)
    setTimeout(() => { setSalvando(false); setSalvo(false) }, 2000)
  }

  function concluir() {
    if (!parecer.trim() && !confirm('A conclusão do diagnóstico está em branco.\n\nÉ ela que o administrativo usa para montar o orçamento. Finalizar assim mesmo?')) return
    if (!confirm('Finalizar o diagnóstico?\n\nO veículo vai para "Aguardando Aprovação" e a recepção fala com o cliente.')) return
    setSalvando(true)
    finalizarDiagnostico(os.id, dadosDoDiagnostico())
    limparRascunho()
    setTimeout(() => navigate('/oficina/diagnostico'), 300)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      <div className="flex items-center gap-3">
        <button onClick={voltar} aria-label="Voltar"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <Car size={15} className="text-slate-400" />
            {nomeVeiculo(veiculo, os)}
            {(veiculo?.placa || os.veiculoPlaca) && (
              <span className="font-mono text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {veiculo?.placa || os.veiculoPlaca}
              </span>
            )}
            {pendente && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                <AlertTriangle size={11} /> Não salvo
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><User size={11} /> {cliente?.nome || os.clienteNome || '—'}</span>
            {/* Sem telefone aqui: o reparador não liga para cliente — contato é papel
                da recepção, que vê o número na OS e no cadastro. */}
            <span className="flex items-center gap-1"><Clock size={11} /> {os.dataEntrada || os.data}</span>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[os.status] || 'bg-slate-100 text-slate-600'}`}>
          {os.status}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Car size={14} /> Dados do Veículo &amp; Contexto
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Veículo/Modelo</span>
            <span className="font-bold text-slate-800">{nomeVeiculo(veiculo, os)}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Placa</span>
            <span className="font-bold text-slate-800 uppercase tracking-wider">{veiculo?.placa || os.veiculoPlaca || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Motor</span>
            <span className="text-slate-600">{veiculo?.motor || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Fuel size={10} /> Combustível
            </span>
            <span className="text-slate-600">{os.combustivel || veiculo?.combustivel || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Gauge size={10} /> Km Entrada
            </span>
            <span className="text-slate-600">{os.kmEntrada || '—'}</span>
          </div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Última Manutenção</span>
            <span className="text-slate-600">{os.ultimaRevisao || '—'}</span>
          </div>
        </div>

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

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <span className="block text-amber-600 text-[10px] font-bold mb-1 uppercase flex items-center gap-1">
            <MessageSquare size={10} /> Relato do Cliente:
          </span>
          <p className="text-slate-600 italic text-sm leading-relaxed">
            "{os.relatoCliente || os.descricaoProblema || 'Sem relato registrado.'}"
          </p>
        </div>

        {os.fotos?.length > 0 && (
          <button onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-cyan-200 text-cyan-700 py-2 rounded-xl text-sm font-medium hover:bg-cyan-50 transition-colors">
            <Camera size={15} /> Ver as {os.fotos.length} foto(s) da entrada
          </button>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-0.5">Checklist Técnico</h3>
        <p className="text-sm text-slate-400">
          Preencha os parâmetros técnicos (Mecânico/Técnico)
          <span className={preenchidos > 0 ? 'text-green-600 font-medium' : ''}>
            {' '}· {preenchidos} de {DIAGNOSTICO_ITENS.length} preenchido(s)
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {diagItens.map(item => (
          <div key={item.id}
            className="bg-white border border-slate-200 hover:border-primary-300 rounded-xl p-3 transition-colors group">
            <label className="block text-xs font-bold text-slate-400 uppercase group-hover:text-primary-500 transition-colors mb-1.5">
              {item.label}{item.unidade ? ` (${item.unidade})` : ''}
            </label>
            <input
              type="text"
              value={item.value || ''}
              onChange={e => setValorItem(item.id, e.target.value.toUpperCase())}
              placeholder="Digite o valor/obs..."
              className="w-full border-b border-slate-200 px-1 py-1 text-sm text-slate-800 focus:outline-none focus:border-primary-400 uppercase transition-colors bg-transparent"
            />
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <label className="block text-sm font-bold text-slate-600 uppercase mb-2">
          Falhas do Scanner
        </label>
        <textarea
          rows={4}
          value={scanner}
          onChange={e => setFalhasScanner(e.target.value)}
          placeholder="Códigos de falha (DTC) ou leituras do scanner..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-600 uppercase mb-1">
            Conclusão do Diagnóstico
          </label>
          <p className="text-xs text-slate-400 mb-2">
            O que o veículo tem e o que precisa ser feito. É a partir daqui que o orçamento é montado.
          </p>
          <textarea rows={4} value={parecer}
            onChange={e => setConclusao(e.target.value)}
            placeholder="Ex.: Bomba de combustível com pressão baixa. Necessário substituir a bomba e o filtro..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-slate-600 uppercase">
              Peças Necessárias
            </label>
            {listaPecas.length > 0 && (
              <span className="text-xs text-slate-400">{listaPecas.length} peça(s)</span>
            )}
          </div>

          {listaPecas.length > 0 && (
            <div className="space-y-2 mb-2">
              {listaPecas.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <input value={p.descricao} autoFocus={!p.descricao}
                    onChange={e => editarPeca(p.id, 'descricao', e.target.value.toUpperCase())}
                    placeholder="Nome da peça..."
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <input value={p.quantidade} inputMode="decimal"
                    onChange={e => editarPeca(p.id, 'quantidade', e.target.value)}
                    aria-label="Quantidade"
                    className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <button onClick={() => removerPeca(p.id)} aria-label="Remover peça"
                    className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={addPeca}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-500 py-2.5 rounded-lg text-sm font-medium hover:border-primary-300 hover:text-primary-600 transition-colors">
            <Plus size={15} /> Adicionar peça
          </button>
          <p className="text-xs text-slate-400 mt-2">
            Só a lista do que o serviço precisa — quem coloca preço é o administrativo.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-1 pb-6 items-stretch sm:items-center">
        <button onClick={salvarProgresso} disabled={salvando || !pendente}
          className="flex items-center justify-center gap-2 border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Save size={16} /> {salvo ? 'Salvo!' : salvando ? 'Salvando...' : 'Salvar Diagnóstico'}
        </button>

        {naFaseDiagnostico && (
          <button onClick={concluir} disabled={salvando}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
            <CheckCircle2 size={16} /> Finalizar Diagnóstico
          </button>
        )}

        {podeVerOS && (
          <button onClick={() => navigate(`/ordens-servico/${encodeURIComponent(os.id)}`)}
            className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors sm:ml-auto">
            <FileText size={16} /> Ver OS
          </button>
        )}
      </div>
    </div>
  )
}

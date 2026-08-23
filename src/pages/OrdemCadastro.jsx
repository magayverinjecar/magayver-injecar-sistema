import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import TelaCadastro from '../components/TelaCadastro'

const VAZIO = { clienteId: '', veiculoId: '', kmEntrada: '', mecanicoId: '', descricaoProblema: '' }
const RASCUNHO_KEY = 'nova-os-rascunho'
const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'

// Abertura de OS em tela.
//
// O rascunho no localStorage veio junto do popup e continua valendo: abrir uma
// OS é a coisa que mais é interrompida no balcão (o telefone toca no meio), e
// perder o que já foi digitado é o que fazia a recepção anotar no papel antes.
export default function OrdemCadastro() {
  const navigate = useNavigate()
  const { novaOrdem, clientes, veiculosPorCliente, funcionarios, checklists } = useApp()

  const [form, setForm] = useState(VAZIO)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [temRascunho, setTemRascunho] = useState(false)
  const [erro, setErro] = useState('')
  const buscaRef = useRef(null)

  // Restaura o rascunho uma vez, ao abrir a tela.
  const [restaurou, setRestaurou] = useState(false)
  if (!restaurou) {
    setRestaurou(true)
    try {
      const salvo = localStorage.getItem(RASCUNHO_KEY)
      const draft = salvo ? JSON.parse(salvo) : null
      if (draft?.form?.clienteId || draft?.buscaCliente) {
        setForm(draft.form || VAZIO)
        setBuscaCliente(draft.buscaCliente || '')
        setTemRascunho(true)
      }
    } catch { /* rascunho corrompido nao pode impedir de abrir OS */ }
  }

  // Grava o rascunho a cada mudança.
  useEffect(() => {
    try { localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ form, buscaCliente })) } catch { /* cota cheia */ }
  }, [form, buscaCliente])

  const veiculosDoCliente = form.clienteId ? veiculosPorCliente(Number(form.clienteId)) : []
  const clientesOrdenados = [...clientes].sort((a, b) => b.id - a.id)
  const clientesFiltrados = clientesOrdenados.filter(c =>
    !buscaCliente.trim() || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  const faltando = [
    !form.clienteId && 'cliente',
    !form.veiculoId && 'veículo',
  ].filter(Boolean).join(' e ')
  const sujo = JSON.stringify(form) !== JSON.stringify(VAZIO) || !!buscaCliente

  function selecionarCliente(c) {
    setForm(f => ({ ...f, clienteId: String(c.id), veiculoId: '', descricaoProblema: '', kmEntrada: '' }))
    setBuscaCliente(c.nome)
    setDropdownAberto(false)
  }

  function limparRascunho() {
    localStorage.removeItem(RASCUNHO_KEY)
    setForm(VAZIO)
    setBuscaCliente('')
    setTemRascunho(false)
  }

  function salvar() {
    if (faltando) { setErro('Escolha o cliente e o veículo antes de abrir a OS.'); return false }
    const id = novaOrdem({
      clienteId: Number(form.clienteId),
      veiculoId: Number(form.veiculoId),
      kmEntrada: form.kmEntrada,
      mecanicoId: form.mecanicoId ? Number(form.mecanicoId) : null,
      descricaoProblema: form.descricaoProblema,
    })
    // `novaOrdem` devolve null quando se recusa a numerar: leitura incompleta
    // numeraria por cima de uma OS que já existe.
    if (!id) {
      setErro('Não consegui numerar a OS agora — a lista ainda não chegou inteira do servidor. Tente de novo em alguns segundos.')
      return false
    }
    localStorage.removeItem(RASCUNHO_KEY)
    // Abre a OS recém-criada em vez de voltar para a lista: quem acabou de
    // abrir vai lançar item nela agora.
    navigate(`/ordens-servico/${encodeURIComponent(id)}`)
    return false   // a navegacao ja foi feita aqui
  }

  return (
    <TelaCadastro
      titulo="Nova Ordem de Serviço"
      subtitulo="Escolhendo o veículo, o relato e o km do último checklist dele entram sozinhos."
      voltarPara="/ordens-servico"
      sujo={sujo}
      faltando={faltando}
      erro={erro}
      rotuloSalvar="Criar OS"
      onSalvar={salvar}
    >
      {temRascunho && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg mb-4">
          <span>Rascunho restaurado automaticamente</span>
          <button onClick={limparRascunho} className="font-semibold underline hover:text-amber-900 ml-2">Limpar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <label className={ROTULO}>Cliente *</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input ref={buscaRef} type="text" placeholder="Buscar por nome..."
              value={buscaCliente}
              onChange={e => { setBuscaCliente(e.target.value); setDropdownAberto(true); setForm(f => ({ ...f, clienteId: '', veiculoId: '' })) }}
              onFocus={() => setDropdownAberto(true)}
              onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
              className={`${INP} pl-8`} />
          </div>
          {dropdownAberto && (
            <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
              {clientesFiltrados.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum cliente encontrado</p>
              ) : (
                clientesFiltrados.map((c, idx) => (
                  <button key={c.id} onMouseDown={() => selecionarCliente(c)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                      {c.telefone && <p className="text-xs text-slate-400">{c.telefone}</p>}
                    </div>
                    {idx === 0 && <span className="text-[10px] bg-primary-50 text-primary-500 font-bold px-1.5 py-0.5 rounded">Recente</span>}
                  </button>
                ))
              )}
            </div>
          )}
          {form.clienteId && <p className="text-xs text-green-600 mt-1">✓ Cliente selecionado</p>}
        </div>

        <div className="lg:col-span-2">
          <label className={ROTULO}>Veículo *</label>
          <select value={form.veiculoId} disabled={!form.clienteId}
            onChange={e => {
              const vId = e.target.value
              // O último checklist daquele veículo já traz o relato e o km:
              // digitar de novo é retrabalho e fonte de divergência.
              const ck = checklists
                .filter(c => String(c.veiculoId) === vId && c.relatoCliente)
                .sort((a, b) => b.id - a.id)[0]
              setForm(f => ({ ...f, veiculoId: vId, descricaoProblema: ck?.relatoCliente || f.descricaoProblema, kmEntrada: ck?.kmEntrada || f.kmEntrada }))
            }}
            className={`${INP} disabled:bg-slate-50 disabled:text-slate-400`}>
            <option value="">{form.clienteId ? 'Selecione' : 'Selecione o cliente primeiro'}</option>
            {veiculosDoCliente.map(v => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}
          </select>
        </div>

        <div>
          <label className={ROTULO}>KM de Entrada</label>
          <input value={form.kmEntrada} onChange={e => setForm(f => ({ ...f, kmEntrada: e.target.value }))}
            inputMode="numeric" className={INP} />
        </div>

        <div className="lg:col-span-3">
          <label className={ROTULO}>Mecânico Responsável</label>
          <select value={form.mecanicoId} onChange={e => setForm(f => ({ ...f, mecanicoId: e.target.value }))} className={INP}>
            <option value="">Nenhum</option>
            {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>

        <div className="lg:col-span-4">
          <label className={ROTULO}>Descrição do Problema</label>
          <textarea value={form.descricaoProblema} onChange={e => setForm(f => ({ ...f, descricaoProblema: e.target.value }))}
            rows={4} className={`${INP} resize-none`} />
        </div>
      </div>
    </TelaCadastro>
  )
}

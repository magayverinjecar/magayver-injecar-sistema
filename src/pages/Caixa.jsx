import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, ShoppingCart, ArrowDownCircle, ArrowUpCircle, Clock, Printer, Pencil, Trash2, X, Plus, Banknote, Landmark, Check, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { imprimirReciboCaixa } from '../utils/print'
import { resumoDoTurno, divergenciaGaveta, FORMA_DINHEIRO } from '../utils/caixa'
import { parseValorBR } from '../utils/numero'

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Dentro de coluna de dinheiro o "R$" sai: o cabeçalho já diz a moeda, e o
// prefixo repetido em toda linha dá larguras diferentes — é ele que impede a
// coluna de alinhar na vírgula, que é o que se confere de cima para baixo.
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Parser unico em utils/numero.js — cada tela tinha a propria copia, e a
// versao antiga lia "1.500" como 1,5.
const pNum = parseValorBR

// Como a venda foi paga já está gravada em cada pagamento — só não aparecia na
// lista. Para saber se aquela venda entrou na gaveta ou caiu no banco era
// preciso trocar para a aba Movimentos e caçar pelo nome do cliente.
const formasDaVenda = (v) => [...new Set((v.pagamentos || []).map(p => p.forma).filter(Boolean))].join(' · ')


export default function Caixa() {
  const { caixaTurno, caixaCarregado, abrirCaixa, registrarSangria, registrarReforco, fecharCaixa, setCaixaTurno, excluirVendaCaixa } = useApp()
  const navigate = useNavigate()

  const [modalAbrir, setModalAbrir] = useState(false)
  const [saldoInicial, setSaldoInicial] = useState('')
  const [modalMov, setModalMov] = useState(null) // 'sangria' | 'reforco'
  const [movValor, setMovValor] = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [movForma, setMovForma] = useState('Dinheiro')
  const [editMov, setEditMov] = useState(null) // movimento sendo editado
  const [modalFechar, setModalFechar] = useState(false)
  const [contagem, setContagem] = useState({})
  const [justificativa, setJustificativa] = useState('')
  const [bancoConferido, setBancoConferido] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [aba, setAba] = useState('vendas')

  // ===== AINDA CARREGANDO =====
  // O turno vem do banco depois do resto. Mostrar "Nenhum turno aberto" antes
  // da resposta chegar é convite para alguém clicar em "Abrir Caixa" — e abrir
  // um turno novo sobrescreve o do dia, com as vendas todas, porque a gravação
  // substitui a linha inteira.
  if (!caixaCarregado && !caixaTurno) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400">
        Carregando o caixa…
      </div>
    )
  }

  // ===== SEM TURNO =====
  if (!caixaTurno) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Caixa</h2>
          <button onClick={() => navigate('/caixa/historico')} className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Clock size={15} />Histórico
          </button>
        </div>

        <div className="flex items-center justify-center py-16">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center max-w-md">
            <DollarSign size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">Nenhum turno aberto</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Abra um turno para começar a registrar vendas e recebimentos.</p>
            <button onClick={() => { setSaldoInicial(''); setModalAbrir(true) }} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} />Abrir Caixa
            </button>
          </div>
        </div>

        {modalAbrir && (
          <ModalBase title="Abrir Turno de Caixa" onClose={() => setModalAbrir(false)}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Saldo inicial (dinheiro em caixa)</label>
            {/* type="text" e nao "number": o campo e de DINHEIRO, e no Brasil
            se digita "100,50". O input numerico do navegador REJEITA a
            virgula em silencio — o valor fica vazio, o botao continua
            travado e ninguem entende o porque. E o `parseValorBR` que le
            isto ja aceita virgula, ponto, "R$" e espaco. */}
            <input type="text" inputMode="decimal" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)} placeholder="0,00"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" autoFocus />
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setModalAbrir(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              {/* Espera a confirmacao: `abrirCaixa` agora confere no servidor se ja
                  existe turno aberto antes de criar um novo. Fechar o modal
                  antes esconderia a recusa. */}
              <button onClick={async () => {
                setAbrindo(true)
                const res = await abrirCaixa(saldoInicial)
                setAbrindo(false)
                if (res?.ok) setModalAbrir(false)
              }} disabled={abrindo} className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">{abrindo ? 'Abrindo…' : 'Abrir Caixa'}</button>
            </div>
          </ModalBase>
        )}
      </div>
    )
  }

  // ===== COM TURNO ABERTO =====
  const t = caixaTurno
  const entradas = t.vendas.reduce((s, v) => s + (v.recebido || 0), 0)
    + t.movimentos.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0)
  const saidas = t.movimentos.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0)

  // lista combinada de movimentos: pagamentos das vendas (entrada) + sangrias/reforços
  const movimentosCompletos = [
    // A chave precisa da venda e da posição: pagamento vindo de OS não tem id
    // próprio, e todos viravam a mesma chave ("pundefined") — o React podia
    // duplicar ou sumir com linhas do extrato do turno.
    ...t.vendas.flatMap((v, vi) =>
      (v.pagamentos || [])
        .filter(p => p.forma !== 'Pagar Depois')
        .map((p, pi) => ({
          id: `p-${v.id ?? vi}-${p.id ?? pi}`,
          tipo: 'entrada',
          forma: p.forma,
          valor: pNum(p.valor),
          taxa: pNum(p.taxa),
          motivo: v.clienteNome && v.clienteNome !== 'Consumidor' ? v.clienteNome : 'venda_avulsa',
          hora: v.hora,
        }))
    ),
    ...t.movimentos.map((m, mi) => ({
      id: `m-${m.id ?? mi}`,
      // Guardado à parte: a chave de renderização ganhou prefixo, e recortá-la
      // com slice para achar o movimento original é frágil demais para algo que
      // apaga dinheiro do turno.
      idOriginal: m.id,
      tipo: m.tipo,
      forma: m.forma || 'Dinheiro',
      valor: m.valor,
      taxa: 0,
      motivo: m.motivo || '—',
      hora: m.hora,
    })),
  ].sort((a, b) => b.hora.localeCompare(a.hora))

  // Somas do RODAPÉ de cada lista — só o que está na tela, nada além disso.
  // São propositalmente separadas do `resumo`: aquele responde "onde o dinheiro
  // está" (gaveta ou banco) e é o que fecha o caixa; estas respondem "o que
  // essa lista aqui somou", que é a conferência de olho, linha por linha.
  const vendasTotal = t.vendas.reduce((s, v) => s + (Number(v.total) || 0), 0)
  const vendasRecebido = t.vendas.reduce((s, v) => s + (Number(v.recebido) || 0), 0)
  // O que foi vendido e ainda não entrou: é o "pagar depois" do dia somado, o
  // número que some quando ninguém olha a coluna Status uma por uma.
  const vendasEmAberto = vendasTotal - vendasRecebido
  const vendasPendentes = t.vendas.filter(v => v.status !== 'Paga').length

  const movEntradas = movimentosCompletos.filter(m => m.tipo !== 'sangria').reduce((s, m) => s + (Number(m.valor) || 0), 0)
  const movSaidas = movimentosCompletos.filter(m => m.tipo === 'sangria').reduce((s, m) => s + (Number(m.valor) || 0), 0)
  // Taxa da maquininha: aparece solta em cada linha, mas o que interessa é o
  // tanto que o dia inteiro deixou na adquirente.
  const movTaxas = movimentosCompletos.reduce((s, m) => s + (Number(m.taxa) || 0), 0)

  // Gaveta e banco são coisas diferentes: o dinheiro em espécie se conta, o
  // que caiu na conta se confere contra o extrato.
  const resumo = resumoDoTurno(t)

  const cards = [
    { label: 'Saldo Inicial', value: fmt(t.saldoInicial), cor: 'text-slate-800', sub: '' },
    { label: 'Entradas', value: fmt(entradas), cor: 'text-green-600', icon: ArrowUpCircle, ic: 'text-green-500' },
    { label: 'Saídas', value: fmt(saidas), cor: 'text-red-500', icon: ArrowDownCircle, ic: 'text-red-400' },
    { label: 'Dinheiro na gaveta', value: fmt(resumo.gaveta.esperado), cor: 'text-slate-800',
      sub: `+ ${fmt(resumo.banco.total)} em banco` },
  ]

  function abrirMov(tipo) { setModalMov(tipo); setMovValor(''); setMovMotivo(''); setMovForma('Dinheiro') }
  function confirmarMov() {
    if (!movValor) return
    if (modalMov === 'sangria') registrarSangria(movValor, movMotivo, movForma)
    else registrarReforco(movValor, movMotivo, movForma)
    setModalMov(null)
  }

  function abrirFechar() {
    setContagem({}); setJustificativa(''); setBancoConferido(false); setModalFechar(true)
  }
  async function confirmarFechar() {
    // Conta-se só a espécie. O que caiu no banco é conferido contra o extrato,
    // não digitado de volta: digitar o número que o sistema já sabe sempre bate
    // e não confere nada — era isso que deixava a divergência sem sentido.
    const contadoGaveta = pNum(contagem[FORMA_DINHEIRO])
    const divergencia = divergenciaGaveta(contadoGaveta, resumo.gaveta.esperado)
    if (Math.abs(divergencia) >= 0.01 && !justificativa.trim()) {
      alert(`A gaveta está ${divergencia < 0 ? 'faltando' : 'sobrando'} ${fmt(Math.abs(divergencia))}.\n\nEscreva o que aconteceu antes de fechar — é esse registro que permite investigar depois.`)
      return
    }
    // Fechar o caixa é operação crítica: espera a confirmação do banco antes de
    // fechar o modal. Fechar antes deixava a pessoa achando que o dia foi
    // gravado enquanto o fechamento podia estar só na memória do navegador.
    setFechando(true)
    const res = await fecharCaixa(
      { [FORMA_DINHEIRO]: contagem[FORMA_DINHEIRO] || '0' },
      justificativa,
      resumo.gaveta.esperado,
      contadoGaveta,
      { conferenciaSeparada: true, banco: resumo.banco, bancoConferido, semForma: resumo.semForma },
    )
    setFechando(false)
    if (res?.ok) setModalFechar(false)
  }

  function excluirVenda(id) {
    if (confirm('Excluir esta venda do turno?\n\nA receita e a taxa de cartão dela saem também do Financeiro.')) {
      excluirVendaCaixa(id)
    }
  }

  function abrirEditMov(mov) {
    setEditMov({ ...mov })
  }

  function salvarEditMov() {
    if (!editMov?.valor) return
    setCaixaTurno(prev => ({
      ...prev,
      movimentos: prev.movimentos.map(m =>
        String(m.id) === String(editMov.id)
          // A forma passou a ser editável: sem isso não havia como corrigir uma
          // sangria que saiu marcada como dinheiro mas foi paga por PIX — e ela
          // ficava para sempre descontando de uma gaveta que não perdeu nada.
          ? { ...m, valor: pNum(editMov.valor), motivo: editMov.motivo, forma: editMov.forma || m.forma }
          : m
      ),
    }))
    setEditMov(null)
  }

  function excluirMov(id) {
    if (confirm('Excluir este movimento?')) {
      setCaixaTurno(prev => ({ ...prev, movimentos: prev.movimentos.filter(m => String(m.id) !== String(id)) }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Caixa</h2>
          <p className="text-xs text-slate-400">Turno aberto em {t.dataAbertura} {t.horaAbertura}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/caixa/nova-venda')} className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <ShoppingCart size={15} />Nova Venda
          </button>
          <button onClick={() => abrirMov('sangria')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <ArrowDownCircle size={15} />Sangria
          </button>
          <button onClick={() => abrirMov('reforco')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <ArrowUpCircle size={15} />Reforço
          </button>
          <button onClick={() => navigate('/caixa/historico')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Clock size={15} />Histórico
          </button>
          <button onClick={abrirFechar} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <X size={15} />Fechar Caixa
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, cor, icon: Icon, ic }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              {Icon && <Icon size={14} className={ic} />}
              <p className="text-sm text-slate-500">{label}</p>
            </div>
            <p className={`text-xl font-bold ${cor}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setAba('vendas')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Vendas ({t.vendas.length})</button>
        <button onClick={() => setAba('movimentos')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'movimentos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Movimentos ({movimentosCompletos.length})</button>
      </div>

      {/* Vendas */}
      {aba === 'vendas' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {t.vendas.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">Nenhuma venda neste turno</p>
          ) : (<>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total (R$)</th>
                  {/* Forma de pagamento só no computador: no celular a linha já
                      está no limite, e lá a venda se abre no recibo. */}
                  <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Forma</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hora</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {t.vendas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{v.numero}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{v.clienteNome || 'Consumidor'}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700 tabular-nums">{fmtNum(v.total)}</td>
                    <td className="hidden lg:table-cell px-5 py-3.5 text-sm text-slate-500">
                      {formasDaVenda(v) || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${v.status === 'Paga' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{v.hora}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => imprimirReciboCaixa(v)} className="flex items-center gap-1 text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-1 rounded transition-colors"><Printer size={12} />Recibo</button>
                        <button onClick={() => excluirVenda(v.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Rodapé de sistema: fecha a lista com quanto o turno vendeu e
                quanto de fato entrou. A diferença entre os dois é o que saiu
                daqui sem pagar — hoje só dá para saber somando a coluna Status
                venda por venda. */}
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              <span>
                {t.vendas.length} {t.vendas.length === 1 ? 'venda' : 'vendas'}
                {vendasPendentes > 0 && (
                  <span className="ml-2 text-yellow-700">· {vendasPendentes} {vendasPendentes === 1 ? 'pendente' : 'pendentes'}</span>
                )}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                <span>Vendido: <strong className="font-medium">{fmt(vendasTotal)}</strong></span>
                <span>Recebido: <strong className="font-medium">{fmt(vendasRecebido)}</strong></span>
                {vendasEmAberto >= 0.01 && (
                  <span className="text-yellow-700">Em aberto: <strong className="font-medium">{fmt(vendasEmAberto)}</strong></span>
                )}
              </span>
            </div>
          </>)}
        </div>
      )}

      {/* Movimentos */}
      {aba === 'movimentos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {movimentosCompletos.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-12">Nenhuma movimentação neste turno</p>
          ) : (<>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Forma</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor (R$)</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Hora</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movimentosCompletos.map(m => {
                  const cor = m.tipo === 'sangria' ? 'bg-red-100 text-red-700' : m.tipo === 'reforco' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  const editavel = m.tipo === 'sangria' || m.tipo === 'reforco'
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${cor}`}>
                          {m.tipo === 'reforco' ? 'reforço' : m.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-700">{m.forma}</td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-700 tabular-nums">
                        {fmtNum(m.valor)}
                        {m.taxa > 0 && <span className="text-red-500 text-xs"> (−{fmtNum(m.taxa)})</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{m.motivo}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{m.hora}</td>
                      <td className="px-5 py-3.5">
                        {editavel && (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => abrirEditMov({ id: m.idOriginal, valor: String(m.valor), motivo: m.motivo, tipo: m.tipo, forma: m.forma })}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => excluirMov(m.idOriginal)}
                              className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Rodapé de sistema: entrou, saiu e quanto a maquininha levou. A
                taxa está pingada linha a linha e ninguém soma sete parênteses
                de cabeça — aqui ela vira um número só. */}
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              <span>
                {movimentosCompletos.length} {movimentosCompletos.length === 1 ? 'lançamento' : 'lançamentos'}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                <span className="text-green-700">Entradas: <strong className="font-medium">{fmt(movEntradas)}</strong></span>
                <span className="text-red-600">Saídas: <strong className="font-medium">{fmt(movSaidas)}</strong></span>
                {movTaxas >= 0.01 && (
                  <span title="Taxa da maquininha — já vem descontada do que cai na conta">
                    Taxas: <strong className="font-medium">{fmt(movTaxas)}</strong>
                  </span>
                )}
              </span>
            </div>
          </>)}
        </div>
      )}

      {/* Modais Sangria/Reforço */}
      {modalMov && (
        <ModalBase title={modalMov === 'sangria' ? 'Registrar Sangria' : 'Registrar Reforço'} onClose={() => setModalMov(null)}>
          <label className="block text-sm font-medium text-slate-700 mb-1">Forma</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {['Dinheiro', 'PIX', 'Transferência', 'Cartão Débito', 'Cartão Crédito', 'Boleto'].map(f => (
              <button key={f} type="button" onClick={() => setMovForma(f)}
                className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${movForma === f ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
          <input type="text" inputMode="decimal" value={movValor} onChange={e => setMovValor(e.target.value)} placeholder="0,00"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3" autoFocus />
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
          <textarea value={movMotivo} onChange={e => setMovMotivo(e.target.value)} rows={2} placeholder="Informe o motivo..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setModalMov(null)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button onClick={confirmarMov} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Confirmar</button>
          </div>
        </ModalBase>
      )}

      {/* Modal Editar Sangria/Reforço */}
      {editMov && (
        <ModalBase title={editMov.tipo === 'sangria' ? 'Editar Sangria' : 'Editar Reforço'} onClose={() => setEditMov(null)}>
          <label className="block text-sm font-medium text-slate-700 mb-1">Forma</label>
          <div className="grid grid-cols-3 gap-2 mb-1">
            {['Dinheiro', 'PIX', 'Transferência', 'Cartão Débito', 'Cartão Crédito', 'Boleto'].map(f => (
              <button key={f} type="button" onClick={() => setEditMov(v => ({ ...v, forma: f }))}
                className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${editMov.forma === f ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Só o que for <strong>Dinheiro</strong> entra na contagem da gaveta. O resto é conferido pelo extrato.
          </p>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
          <input type="text" inputMode="decimal" value={editMov.valor} onChange={e => setEditMov(v => ({ ...v, valor: e.target.value }))}
            placeholder="0,00" autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3" />
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
          <textarea value={editMov.motivo} onChange={e => setEditMov(v => ({ ...v, motivo: e.target.value }))} rows={2}
            placeholder="Informe o motivo..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setEditMov(null)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button onClick={salvarEditMov} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
          </div>
        </ModalBase>
      )}

      {/* Modal Fechar Caixa */}
      {modalFechar && (
        <ModalBase title="Fechar Caixa" onClose={() => setModalFechar(false)}>
          {(() => {
            const contado = pNum(contagem[FORMA_DINHEIRO])
            const temContagem = (contagem[FORMA_DINHEIRO] ?? '') !== ''
            const div = divergenciaGaveta(contado, resumo.gaveta.esperado)
            const bate = Math.abs(div) < 0.01
            return (
              <div className="space-y-5">
                {/* GAVETA — a única coisa que se conta */}
                <div>
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Banknote size={15} className="text-green-600" />Dinheiro na gaveta
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 mb-3">
                    Conte só as notas e moedas. Cartão e PIX não passam pela gaveta.
                  </p>

                  <div className="bg-slate-50 rounded-lg px-3 py-2.5 space-y-1 text-sm mb-3">
                    <div className="flex justify-between"><span className="text-slate-500">Saldo inicial</span><span className="tabular-nums text-slate-600">{fmt(resumo.gaveta.inicial)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Entrou em espécie</span><span className="tabular-nums text-green-600">+ {fmt(resumo.gaveta.entradas)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Saiu em espécie</span><span className="tabular-nums text-red-500">− {fmt(resumo.gaveta.saidas)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-semibold">
                      <span className="text-slate-700">Deveria ter</span><span className="tabular-nums text-slate-800">{fmt(resumo.gaveta.esperado)}</span>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-700 mb-1">Quanto você contou?</label>
                  <input type="text" inputMode="decimal" autoFocus
                    value={contagem[FORMA_DINHEIRO] || ''}
                    onChange={e => setContagem(c => ({ ...c, [FORMA_DINHEIRO]: e.target.value }))}
                    placeholder="0,00"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />

                  {temContagem && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between ${
                      bate ? 'bg-green-50 text-green-700 border border-green-200'
                           : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <span>{bate ? '✓ A gaveta bate' : div < 0 ? 'Está faltando' : 'Está sobrando'}</span>
                      {!bate && <span className="tabular-nums font-bold">{fmt(Math.abs(div))}</span>}
                    </div>
                  )}
                </div>

                {/* BANCO — confere-se contra o extrato, não se digita */}
                {resumo.banco.linhas.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <Landmark size={15} className="text-blue-600" />Já caiu no banco
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 mb-2">
                      Confira no extrato e no app da maquininha. Valores de cartão já vêm com a taxa descontada.
                    </p>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {resumo.banco.linhas.map(l => (
                        <div key={l.forma} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-slate-600">{l.forma}</span>
                          <span className="tabular-nums font-medium text-slate-800">{fmt(l.liquido)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2 text-sm bg-slate-50 font-semibold">
                        <span className="text-slate-700">Total</span>
                        <span className="tabular-nums text-slate-800">{fmt(resumo.banco.total)}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setBancoConferido(v => !v)}
                      className={`mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        bancoConferido ? 'border-green-300 bg-green-50 text-green-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${bancoConferido ? 'bg-green-600' : 'bg-slate-200'}`}>
                        {bancoConferido && <Check size={11} className="text-white" />}
                      </span>
                      Confiro que esses valores bateram com o extrato
                    </button>
                  </div>
                )}

                {resumo.semForma > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      {fmt(resumo.semForma)} entrou em vendas antigas que não guardaram a forma de pagamento.
                      Não dá para saber se está na gaveta ou no banco — confira à parte.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    O que aconteceu? {!bate && temContagem && <span className="text-red-500">*</span>}
                  </label>
                  <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={2}
                    placeholder={bate ? 'Opcional...' : 'Obrigatório quando a gaveta não bate'}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                </div>

                <div className="flex gap-3 justify-end">
                  <button onClick={() => setModalFechar(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button onClick={confirmarFechar} disabled={!temContagem || fechando}
                    className="bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    {fechando ? 'Gravando…' : 'Fechar Caixa'}
                  </button>
                </div>
              </div>
            )
          })()}
        </ModalBase>
      )}
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

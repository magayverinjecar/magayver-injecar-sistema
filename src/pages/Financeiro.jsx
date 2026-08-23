import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, DollarSign, CalendarDays, Plus, Trash2, CheckCircle2, Package, X, Banknote, CreditCard, Smartphone, ArrowRightLeft, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import Modal from '../components/ui/Modal'
import PainelCartoes from '../components/PainelCartoes'
import PontoDeEquilibrio from '../components/PontoDeEquilibrio'
import DRE from '../components/DRE'
import SeletorMaquina from '../components/ui/SeletorMaquina'
import SeletorPeriodo from '../components/ui/SeletorPeriodo'
import { ehCartao, maquinaPadrao } from '../utils/cartao'
import { intervaloDe, periodoAnteriorDe, resumirFinanceiro, dentroDoPeriodo, variacao } from '../utils/periodo'
import { parseValorBR } from '../utils/numero'

const vazio = { descricao: '', tipo: 'receita', valor: '' }

const VAZIO_BOLETO = { descricao: '', categoria: 'Equipamento', valor: '', parcelas: '1', vencimento: '' }
const CATEGORIAS_BOLETO = ['Equipamento', 'Aluguel', 'Energia / Água', 'Telefone / Internet', 'Serviço Terceiro', 'Imposto / Taxa', 'Outro']
const PARCELAS_OPCOES = ['1', '2', '3', '4', '5', '6', '10', '12']

const FORMAS = [
  { label: 'PIX',            icon: Smartphone },
  { label: 'Dinheiro',       icon: Banknote },
  { label: 'Cartão Débito',  icon: CreditCard },
  { label: 'Cartão Crédito', icon: CreditCard },
  { label: 'Transferência',  icon: ArrowRightLeft },
  { label: 'Boleto',         icon: CalendarDays },
]

function diasVencimento(dataStr) {
  if (!dataStr) return null
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const venc = new Date(dataStr + 'T00:00:00')
  return Math.ceil((venc - hoje) / 86400000)
}

function alertaVenc(vencimento) {
  const dias = diasVencimento(vencimento)
  let cls = 'text-slate-400'
  let label = vencimento ? new Date(vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'
  if (dias !== null) {
    if (dias < 0)       { cls = 'text-red-500 font-semibold'; label = `Vencido há ${Math.abs(dias)}d` }
    else if (dias === 0){ cls = 'text-amber-500 font-semibold'; label = 'Vence hoje!' }
    else if (dias <= 3) { cls = 'text-amber-500'; label = `${new Date(vencimento + 'T00:00:00').toLocaleDateString('pt-BR')} (${dias}d)` }
  }
  return { cls, label }
}

// Comparação com o período anterior.
//
// Em despesa subir é notícia ruim: a seta é a mesma, mas a cor tem de inverter,
// senão "despesas +30%" sai em verde como se fosse conquista.
function Variacao({ atual, anterior, subirEhBom = true, rotulo }) {
  const v = variacao(atual, anterior)
  if (v == null) {
    return <p className="text-xs text-slate-400 mt-1.5">sem base no período anterior</p>
  }
  if (Math.abs(v) < 0.5) {
    return <p className="text-xs text-slate-400 mt-1.5">estável vs {rotulo}</p>
  }
  const subiu = v > 0
  const Icone = subiu ? ArrowUpRight : ArrowDownRight
  const cor = subiu === subirEhBom ? 'text-green-600' : 'text-red-500'
  return (
    <p className={`text-xs mt-1.5 flex items-center gap-1 ${cor}`}>
      <Icone size={13} className="flex-shrink-0" />
      <span className="font-semibold tabular-nums">{Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>
      <span className="text-slate-400 font-normal truncate">vs {rotulo}</span>
    </p>
  )
}

export default function Financeiro() {
  const {
    financeiro, setFinanceiro, adicionarLancamento,
    getCliente,
    compras, atualizarCompra,
    caixaTurno, registrarSangria,
    aReceber, diasEmAberto, registrarQuitacaoVenda, config,
  } = useApp()
  const navigate = useNavigate()

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [aba, setAba] = useState('lancamentos')

  const [modalBoleto, setModalBoleto] = useState(null)
  const [formaPagamento, setFormaPagamento] = useState('PIX')
  const [baixando, setBaixando] = useState(false)
  const [modalReceber, setModalReceber] = useState(null)
  const [formaRecebimento, setFormaRecebimento] = useState('PIX')
  const [maquinaRecebimento, setMaquinaRecebimento] = useState(null)
  const [valorRecebimento, setValorRecebimento] = useState('')
  const [recebendo, setRecebendo] = useState(false)

  const [modalNovoBoleto, setModalNovoBoleto] = useState(false)
  const [formBoleto, setFormBoleto] = useState(VAZIO_BOLETO)

  // Recorte de período — começa no mês corrente, que é a pergunta do dia a dia.
  const [periodo, setPeriodo] = useState('mes')
  const [datas, setDatas] = useState({ de: '', ate: '' })

  const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  // Parser unico em utils/numero.js — cada tela tinha a propria copia, e a
// versao antiga lia "1.500" como 1,5.
const pNum = parseValorBR

  const intervalo = useMemo(() => intervaloDe(periodo, datas), [periodo, datas])
  const anterior = useMemo(() => periodoAnteriorDe(periodo, datas), [periodo, datas])
  const resumo = useMemo(() => resumirFinanceiro(financeiro, intervalo), [financeiro, intervalo])
  const resumoAnterior = useMemo(
    () => (anterior ? resumirFinanceiro(financeiro, anterior) : null),
    [financeiro, anterior],
  )
  const lucro = resumo.lucro

  // Lançamentos já realizados dentro do período (pendente é boleto em aberto e
  // vive na aba "A Pagar", não na lista de movimento).
  const lancamentosDoPeriodo = useMemo(
    () => financeiro.filter(l => !l.pendente && dentroDoPeriodo(l.data, intervalo)),
    [financeiro, intervalo],
  )

  // Base do "(de N)" no rodapé: todo lançamento já realizado, sem recorte
  // nenhum. Serve para o rodapé avisar que o período está escondendo coisa —
  // sem isso, "12 lançamentos" parece ser tudo o que a oficina já lançou.
  const totalRealizados = financeiro.filter(l => !l.pendente).length

  // Parcelas ainda não pagas de qualquer compra.
  //
  // Não filtra por `recebida` de propósito: na prática as compras são cadastradas
  // com as parcelas e pagas direto por aqui, sem passar pelo "Confirmar
  // Recebimento". Exigir `recebida` esvaziaria a lista inteira de contas a pagar.
  const contasAPagar = compras
    .filter(c => c.parcelas?.length > 0)
    .flatMap(c =>
      (c.parcelas || [])
        .filter(p => !p.pago)
        .map(p => ({
          tipo: 'compra',
          parcelaId: p.id,
          compraId: c.id,
          compraNumero: c.numero,
          fornecedor: c.fornecedorNome || 'Fornecedor',
          parcela: (c.parcelas || []).indexOf(p) + 1,
          totalParcelas: c.parcelas.length,
          valor: pNum(p.valor),
          vencimento: p.vencimento || '',
        }))
    )

  // Boletos avulsos pendentes (equipamentos, etc.)
  const boletosAvulsos = financeiro
    .filter(f => f.pendente && f.avulso && f.tipo === 'despesa')
    .map(f => ({
      tipo: 'avulso',
      id: f.id,
      descricao: f.descricao,
      categoria: f.categoria || 'Outro',
      valor: pNum(f.valor),
      vencimento: f.vencimento || '',
    }))

  // Lista unificada ordenada por vencimento
  const todasContasAPagar = [...contasAPagar, ...boletosAvulsos].sort((a, b) => {
    if (!a.vencimento) return 1
    if (!b.vencimento) return -1
    return a.vencimento.localeCompare(b.vencimento)
  })

  const totalAPagar = todasContasAPagar.reduce((s, p) => s + p.valor, 0)

  // Recorte do que já venceu, só para o rodapé. O total a pagar sozinho não
  // diferencia a conta que vence semana que vem da que está atrasada há um mês,
  // e é a atrasada que muda o dia. Soma exatamente o que está na lista.
  const vencidas = todasContasAPagar.filter(p => {
    const d = diasVencimento(p.vencimento)
    return d !== null && d < 0
  })
  const totalVencido = vencidas.reduce((s, p) => s + p.valor, 0)

  // Mesma pergunta do outro lado: quanto do que se tem a receber já passou de
  // 30 dias — que é onde a própria lista já pinta de vermelho.
  const receberVencido = aReceber.itens
    .filter(i => (diasEmAberto(i) ?? 0) >= 30)
    .reduce((s, i) => s + (Number(i.saldo) || 0), 0)

  function abrirModalBoleto(p) {
    setFormaPagamento('PIX')
    setModalBoleto(p)
  }

  // Cliente voltou e pagou o que ficou devendo numa venda de balcão.
  function abrirRecebimento(item) {
    if (!caixaTurno) {
      alert('Abra o caixa antes de receber.\n\nO dinheiro precisa entrar no turno de hoje, senão o fechamento não bate.')
      return
    }
    setFormaRecebimento('PIX')
    setMaquinaRecebimento(maquinaPadrao(config)?.id ?? null)
    setValorRecebimento(item.saldo.toFixed(2).replace('.', ','))
    setModalReceber(item)
  }

  function confirmarRecebimento() {
    if (!modalReceber || recebendo) return
    const valor = pNum(valorRecebimento)
    if (valor <= 0) { alert('Informe o valor recebido.'); return }
    if (valor > modalReceber.saldo + 0.01) {
      alert(`O valor não pode passar do que está em aberto (${fmt(modalReceber.saldo)}).`)
      return
    }
    setRecebendo(true)
    try {
      const pg = { forma: formaRecebimento, valor: String(valor) }
      if (ehCartao(formaRecebimento)) { pg.maquinaId = maquinaRecebimento; pg.parcelas = 1 }
      // Recebimento parcial é permitido: o que sobrar continua em aberto.
      registrarQuitacaoVenda({ ...modalReceber, saldo: valor }, [pg])
      setModalReceber(null)
    } finally {
      setTimeout(() => setRecebendo(false), 800)
    }
  }

  function confirmarBaixa() {
    if (!modalBoleto) return
    // Dois cliques rápidos geravam dois lançamentos e duas sangrias.
    if (baixando) return
    setBaixando(true)

    try {
      if (!caixaTurno) {
        if (!confirm('O caixa está fechado. O pagamento será registrado no financeiro, mas não será descontado do caixa. Deseja continuar?')) return
      }

      if (modalBoleto.tipo === 'avulso') {
        // Boleto avulso: marca como pago no financeiro
        setFinanceiro(prev => prev.map(f =>
          f.id === modalBoleto.id ? { ...f, pendente: false, formaPagamento } : f
        ))
        if (caixaTurno) {
          // A forma precisa ir junto: sem ela toda baixa virava sangria em
          // dinheiro, mesmo paga por PIX, e a gaveta ficava devendo um dinheiro
          // que nunca saiu de lá.
          registrarSangria(modalBoleto.valor, `Pagto: ${modalBoleto.descricao}`, formaPagamento)
        }
        setModalBoleto(null)
        return
      }

      // Parcela de compra — a despesa entra UMA vez só.
      //
      // Existem dois caminhos na prática: quem passa por "Confirmar Recebimento"
      // (que já lança a despesa de cada parcela) e quem cadastra a compra e vem
      // direto dar baixa aqui. Antes, o primeiro caminho lançava duas vezes e a
      // compra parcelada entrava no resultado pelo dobro do que custou.
      //
      // Agora a baixa procura a despesa daquela parcela: se já existe, só
      // registra como e quando foi paga; se não existe, é ela quem lança.
      const { parcelaId, compraId, compraNumero, fornecedor, valor, parcela, totalParcelas } = modalBoleto
      const descricao = `${fornecedor} ${compraNumero} — Parcela ${parcela}/${totalParcelas}`
      const hoje = new Date().toLocaleDateString('pt-BR')
      const jaLancada = financeiro.some(f => f.compraId === compraId && f.parcelaId === parcelaId)

      if (jaLancada) {
        setFinanceiro(prev => prev.map(f =>
          f.compraId === compraId && f.parcelaId === parcelaId
            ? { ...f, formaPagamento, pagoEm: hoje }
            : f
        ))
      } else {
        adicionarLancamento({
          descricao,
          tipo: 'despesa',
          categoria: 'Compra de peças',
          valor: valor.toFixed(2).replace('.', ','),
          formaPagamento,
          compraId,
          // Sem isto, uma segunda baixa da mesma parcela lançaria de novo.
          parcelaId,
          pagoEm: hoje,
        })
      }

      if (caixaTurno) {
        registrarSangria(valor, `Pagto boleto: ${descricao}`, formaPagamento)
      }

      const compra = compras.find(c => c.id === compraId)
      if (compra) {
        const novasParcelas = (compra.parcelas || []).map(p =>
          p.id === parcelaId ? { ...p, pago: true, formaPagamento, pagoEm: new Date().toLocaleDateString('pt-BR') } : p
        )
        atualizarCompra(compraId, { parcelas: novasParcelas })
      }

      setModalBoleto(null)
    } finally {
      setTimeout(() => setBaixando(false), 800)
    }
  }

  function salvarBoleto() {
    if (!formBoleto.descricao.trim() || !formBoleto.valor || !formBoleto.vencimento) return
    const total = pNum(formBoleto.valor)
    const nParcelas = parseInt(formBoleto.parcelas) || 1
    const valorParcela = total / nParcelas
    const hoje2 = new Date().toLocaleDateString('pt-BR')

    const novas = []
    for (let i = 0; i < nParcelas; i++) {
      const venc = new Date(formBoleto.vencimento + 'T12:00:00')
      venc.setMonth(venc.getMonth() + i)
      const y = venc.getFullYear()
      const m = String(venc.getMonth() + 1).padStart(2, '0')
      const d = String(venc.getDate()).padStart(2, '0')
      novas.push({
        id: gerarId(),
        tipo: 'despesa',
        avulso: true,
        pendente: true,
        descricao: nParcelas > 1 ? `${formBoleto.descricao} (${i + 1}/${nParcelas})` : formBoleto.descricao,
        categoria: formBoleto.categoria,
        valor: valorParcela.toFixed(2).replace('.', ','),
        vencimento: `${y}-${m}-${d}`,
        data: hoje2,
      })
    }

    setFinanceiro(prev => [...novas, ...prev])
    setFormBoleto(VAZIO_BOLETO)
    setModalNovoBoleto(false)
  }

  function excluirBoletoAvulso(id) {
    if (confirm('Excluir este boleto?')) setFinanceiro(prev => prev.filter(f => f.id !== id))
  }

  function salvar() {
    if (!form.descricao.trim() || !form.valor) return
    adicionarLancamento(form)
    setForm(vazio)
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir lançamento?')) setFinanceiro(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Período — manda nos três primeiros cards e na lista de lançamentos */}
      <SeletorPeriodo
        periodo={periodo}
        datas={datas}
        onChange={(chave, novasDatas) => { setPeriodo(chave); setDatas(novasDatas) }}
      />

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Receitas', nota: intervalo.rotulo, valor: fmt(resumo.receitas),
            icon: TrendingUp, cor: 'text-green-600', bg: 'bg-green-50',
            atual: resumo.receitas, base: resumoAnterior?.receitas, subirEhBom: true,
          },
          {
            label: 'Despesas', nota: intervalo.rotulo, valor: fmt(resumo.despesas),
            icon: TrendingDown, cor: 'text-red-500', bg: 'bg-red-50',
            atual: resumo.despesas, base: resumoAnterior?.despesas, subirEhBom: false,
          },
          {
            label: 'Lucro Líquido', nota: intervalo.rotulo, valor: fmt(lucro),
            icon: DollarSign, cor: lucro >= 0 ? 'text-primary-600' : 'text-red-600', bg: 'bg-primary-50',
            atual: lucro, base: resumoAnterior?.lucro, subirEhBom: true,
          },
          {
            // Saldo em aberto, não movimento: filtrar por período daria a
            // impressão de que a dívida some quando se olha para outro mês.
            label: 'A Pagar', nota: 'posição atual — não muda com o período', valor: fmt(totalAPagar),
            icon: CalendarDays, cor: 'text-orange-500', bg: 'bg-orange-50',
            badge: todasContasAPagar.length, semComparacao: true,
          },
        ].map(({ label, nota, valor, icon: Icon, cor, bg, badge, atual, base, subirEhBom, semComparacao }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-[11px] text-slate-400 truncate">{nota}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center relative flex-shrink-0`}>
                <Icon size={18} className={cor} />
                {badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge}</span>}
              </div>
            </div>
            <p className={`text-xl font-bold tabular-nums ${cor}`}>{valor}</p>
            {!semComparacao && anterior && (
              <Variacao atual={atual} anterior={base} subirEhBom={subirEhBom} rotulo={anterior.rotulo} />
            )}
            {!semComparacao && !anterior && (
              <p className="text-xs text-slate-400 mt-1.5">acumulado — sem período anterior para comparar</p>
            )}
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          { key: 'lancamentos', label: 'Lançamentos' },
          { key: 'dre',         label: 'DRE' },
          { key: 'apagar',      label: `A Pagar${todasContasAPagar.length ? ` (${todasContasAPagar.length})` : ''}` },
          { key: 'devedores',   label: `A Receber${aReceber.itens.length ? ` (${aReceber.itens.length})` : ''}` },
          { key: 'cartoes',     label: 'Cartões' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setAba(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Ponto de equilíbrio — segue o mesmo período escolhido lá em cima.
          Fica acima da lista porque responde a pergunta que o dono faz antes de
          olhar lançamento nenhum: o mês pagou as contas fixas ou não? */}
      {aba === 'lancamentos' && <PontoDeEquilibrio intervalo={intervalo} />}

      {/* DRE — segue o mesmo período e a mesma comparação dos cards do topo, por
          isso recebe `intervalo`/`anterior` em vez de ter o próprio seletor: dois
          seletores na mesma tela diriam coisas diferentes sobre os mesmos números. */}
      {aba === 'dre' && <DRE intervalo={intervalo} anterior={anterior} />}

      {/* Lançamentos */}
      {aba === 'lancamentos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800">Lançamentos</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {lancamentosDoPeriodo.length} lançamento{lancamentosDoPeriodo.length === 1 ? '' : 's'} · {intervalo.rotulo}
              </p>
            </div>
            <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
              <Plus size={14} />Novo
            </button>
          </div>
          {/* Cabeçalho de coluna, só no computador: é ele que diz que a coluna
              da direita é dinheiro — por isso as linhas param de repetir "R$".
              O vão de 21px no fim é do tamanho da lixeira da linha; sem ele o
              rótulo ficaria adiantado em relação aos valores que descreve. */}
          {lancamentosDoPeriodo.length > 0 && (
            <div className="hidden lg:flex items-center justify-between gap-4 px-5 py-1 bg-slate-100 border-b border-slate-300 text-[11px] font-medium text-slate-600">
              <span>Descrição</span>
              <span className="flex items-center gap-3">
                <span>Valor (R$)</span>
                <span className="w-[21px]" aria-hidden="true" />
              </span>
            </div>
          )}
          <div className="divide-y divide-slate-50">
            {lancamentosDoPeriodo.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">Nenhum lançamento em {intervalo.rotulo}.</p>
            )}
            {lancamentosDoPeriodo.map(l => (
              <div key={l.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <div>
                    <p className="text-sm text-slate-700">{l.descricao}</p>
                    <p className="text-xs text-slate-400">
                      {l.data}
                      {/* A categoria já vem gravada no lançamento (compra de
                          peças, taxa de cartão, aluguel...) e até aqui não
                          aparecia em tela nenhuma. É a resposta de "para onde
                          foi o dinheiro" sem precisar abrir nada. */}
                      {l.categoria && <span className="hidden lg:inline ml-2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-medium">{l.categoria}</span>}
                      {l.formaPagamento && <span className="ml-2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-medium">{l.formaPagamento}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* A largura fixa é só do computador: no celular ela roubava
                      espaço da descrição, que é o que se lê primeiro lá. */}
                  <span className={`lg:min-w-[6.5rem] text-right whitespace-nowrap text-sm font-semibold tabular-nums ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {/* O "R$" sobrevive só no celular, onde não há cabeçalho de
                        coluna dizendo o que é aquele número. */}
                    {l.tipo === 'receita' ? '+' : '−'} <span className="lg:hidden">R$ </span>{l.valor}
                  </span>
                  <button onClick={() => excluir(l.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Rodapé de sistema: a conta do que está na tela. Repete os números
              dos cards de propósito — quem desceu até o fim da lista não vê mais
              o topo, e é aqui que se confere se o que foi lançado fecha. */}
          {lancamentosDoPeriodo.length > 0 && (
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              {/* O cabeçalho do card já diz quantos lançamentos e o período —
                  repetir aqui só ocupa linha. O rodapé conta o que o cabeçalho
                  não conta: quanto sobrou de filtro. */}
              <span>
                {lancamentosDoPeriodo.length !== totalRealizados
                  ? `${lancamentosDoPeriodo.length} de ${totalRealizados} lançamentos`
                  : `${lancamentosDoPeriodo.length} ${lancamentosDoPeriodo.length === 1 ? 'lançamento' : 'lançamentos'}`}
              </span>
              {/* Os MESMOS nomes dos cards do topo. Chamar de "Entradas" aqui o
                  que lá em cima se chama "Receitas" faz o dono conferir dois
                  números achando que são coisas diferentes. */}
              <span className="flex items-center gap-4 tabular-nums">
                <span>Receitas: <strong className="font-medium text-green-700">{fmt(resumo.receitas)}</strong></span>
                <span>Despesas: <strong className="font-medium text-red-600">{fmt(resumo.despesas)}</strong></span>
                <span>Lucro líquido: <strong className={`font-medium ${lucro < 0 ? 'text-red-600' : 'text-slate-700'}`}>{fmt(lucro)}</strong></span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* A Pagar */}
      {aba === 'apagar' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Boletos / Contas a Pagar</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Parcelas de compras e boletos avulsos pendentes — posição de hoje, não segue o período escolhido
              </p>
            </div>
            <button
              onClick={() => setModalNovoBoleto(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus size={14} />Boleto Avulso
            </button>
          </div>

          {todasContasAPagar.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-slate-400">Nenhum boleto pendente.</p>
              <p className="text-xs text-slate-300">Use "+ Boleto Avulso" para cadastrar equipamentos, aluguel e outros.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {todasContasAPagar.map((p, idx) => {
                const { cls: alertaCls, label: alertaLabel } = alertaVenc(p.vencimento)

                if (p.tipo === 'avulso') {
                  return (
                    <div key={`av-${p.id}`} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.descricao}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{p.categoria}</span>
                            {p.vencimento && (
                              <span className={alertaCls}>
                                · <CalendarDays size={10} className="inline" /> {alertaLabel}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-orange-600 text-right tabular-nums">{fmt(p.valor)}</span>
                        <button onClick={() => abrirModalBoleto(p)}
                          className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                          <CheckCircle2 size={12} />Dar Baixa
                        </button>
                        <button onClick={() => excluirBoletoAvulso(p.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                }

                // Compra parcela
                return (
                  <div key={`cp-${idx}`} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Package size={16} className="text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {p.fornecedor}
                          <span className="ml-1.5 text-xs text-slate-400 font-normal">{p.compraNumero}</span>
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                          Parcela {p.parcela}/{p.totalParcelas}
                          {p.vencimento && (
                            <span className={alertaCls}>
                              · <CalendarDays size={10} className="inline" /> {alertaLabel}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold text-orange-600 text-right tabular-nums">{fmt(p.valor)}</span>
                      <button onClick={() => abrirModalBoleto(p)}
                        className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        <CheckCircle2 size={12} />Dar Baixa
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Rodapé de sistema: quantas contas e quanto some da conta bancária
              se tudo for pago. O atrasado vem separado porque é ele que define
              a ordem em que se paga. */}
          {todasContasAPagar.length > 0 && (
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              <span>
                {todasContasAPagar.length} {todasContasAPagar.length === 1 ? 'conta' : 'contas'}
                {vencidas.length > 0 && (
                  <span className="ml-2 text-red-600">· {vencidas.length} {vencidas.length === 1 ? 'vencida' : 'vencidas'}</span>
                )}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                {totalVencido > 0 && (
                  <span>Vencido: <strong className="font-medium text-red-600">{fmt(totalVencido)}</strong></span>
                )}
                <span>Total a pagar: <strong className="font-medium">{fmt(totalAPagar)}</strong></span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Cartões — quanto a adquirência está custando */}
      {aba === 'cartoes' && <PainelCartoes intervalo={intervalo} />}

      {/* A Receber — OS concluída não paga + venda de balcão com saldo aberto */}
      {aba === 'devedores' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-800">A Receber</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Serviços concluídos e vendas de balcão em aberto — mais antigos primeiro.
                É a posição de hoje: não segue o período escolhido lá em cima.
              </p>
            </div>
            {aReceber.total > 0 && (
              <span className="text-lg font-bold text-orange-600 tabular-nums">{fmt(aReceber.total)}</span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {aReceber.itens.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">Ninguém devendo. Tudo recebido!</p>
            )}
            {aReceber.itens.map(item => {
              const cliente = getCliente(item.clienteId)
              const dias = diasEmAberto(item)
              const nome = cliente?.nome || item.clienteNome || '—'
              // Vermelho a partir de um mês: é quando a cobrança costuma
              // deixar de ser lembrete e virar prejuízo.
              const corIdade = dias == null ? 'text-slate-400'
                : dias >= 30 ? 'text-red-500 font-semibold'
                : dias >= 15 ? 'text-amber-600' : 'text-slate-400'
              return (
                <div key={`${item.origem}-${item.id}`} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">{item.numero}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        item.origem === 'os' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                      }`}>
                        {item.origem === 'os' ? 'OS' : 'Balcão'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{nome}</p>
                    <p className="text-xs text-slate-400">
                      {item.data}
                      {dias != null && <span className={`ml-1.5 ${corIdade}`}>· há {dias} dia{dias === 1 ? '' : 's'}</span>}
                      {item.quitadoParcial > 0 && (
                        <span className="ml-1.5 text-green-600">· já pagou {fmt(item.quitadoParcial)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-orange-600 text-right tabular-nums">{fmt(item.saldo)}</p>
                    {item.origem === 'os' ? (
                      // O valor da OS é lançado na própria OS, que é onde o
                      // fluxo de pagamento e entrega existe.
                      <button onClick={() => navigate(`/ordens-servico/${encodeURIComponent(item.id)}`)}
                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        Receber
                      </button>
                    ) : (
                      <button onClick={() => abrirRecebimento(item)}
                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        Receber
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Rodapé de sistema: quantos devedores e quanto está na rua. O
              recorte de 30 dias é o mesmo que a lista já pinta de vermelho —
              essa é a parte que costuma virar prejuízo se ninguém ligar. */}
          {aReceber.itens.length > 0 && (
            <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
              <span>
                {aReceber.itens.length} {aReceber.itens.length === 1 ? 'cobrança' : 'cobranças'}
              </span>
              <span className="flex items-center gap-4 tabular-nums">
                {receberVencido > 0 && (
                  <span>Há mais de 30 dias: <strong className="font-medium text-red-600">{fmt(receberVencido)}</strong></span>
                )}
                <span>Total a receber: <strong className="font-medium">{fmt(aReceber.total)}</strong></span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Modal Dar Baixa */}
      {modalBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalBoleto(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Dar Baixa</h3>
              <button onClick={() => setModalBoleto(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
                {modalBoleto.tipo === 'avulso' ? (
                  <>
                    <p className="text-xs text-slate-400">{modalBoleto.categoria}</p>
                    <p className="text-sm font-semibold text-slate-800">{modalBoleto.descricao}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">Fornecedor</p>
                    <p className="text-sm font-semibold text-slate-800">{modalBoleto.fornecedor} <span className="font-normal text-slate-400">{modalBoleto.compraNumero}</span></p>
                    <p className="text-xs text-slate-400">Parcela {modalBoleto.parcela}/{modalBoleto.totalParcelas}</p>
                  </>
                )}
                <p className="text-base font-bold text-orange-600 pt-1">{fmt(modalBoleto.valor)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Como foi pago?</label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS.map(({ label, icon: Icon }) => (
                    <button key={label} onClick={() => setFormaPagamento(label)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        formaPagamento === label ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      <Icon size={15} />{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModalBoleto(null)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmarBaixa} disabled={baixando}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <CheckCircle2 size={15} />{baixando ? 'Registrando…' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Boleto Avulso */}
      {modalNovoBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalNovoBoleto(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Novo Boleto / Conta a Pagar</h3>
                <p className="text-xs text-slate-400 mt-0.5">Equipamento, aluguel, serviço ou qualquer conta avulsa</p>
              </div>
              <button onClick={() => setModalNovoBoleto(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input
                  value={formBoleto.descricao}
                  onChange={e => setFormBoleto(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Compressor de ar, Aluguel junho..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select
                  value={formBoleto.categoria}
                  onChange={e => setFormBoleto(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {CATEGORIAS_BOLETO.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$) *</label>
                  <input
                    value={formBoleto.valor}
                    onChange={e => setFormBoleto(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
                  <select
                    value={formBoleto.parcelas}
                    onChange={e => setFormBoleto(f => ({ ...f, parcelas: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {PARCELAS_OPCOES.map(p => <option key={p} value={p}>{p === '1' ? 'À vista' : `${p}x`}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formBoleto.parcelas === '1' ? 'Data de Vencimento *' : 'Vencimento 1ª Parcela *'}
                </label>
                <input
                  type="date"
                  value={formBoleto.vencimento}
                  onChange={e => setFormBoleto(f => ({ ...f, vencimento: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {parseInt(formBoleto.parcelas) > 1 && formBoleto.valor && (
                  <p className="text-xs text-slate-400 mt-1">
                    {formBoleto.parcelas}x de {fmt(pNum(formBoleto.valor) / parseInt(formBoleto.parcelas))} — demais parcelas geradas automaticamente (+1 mês cada)
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModalNovoBoleto(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvarBoleto}
                disabled={!formBoleto.descricao.trim() || !formBoleto.valor || !formBoleto.vencimento}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Plus size={15} />Cadastrar Boleto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Receber venda de balcão em aberto */}
      {modalReceber && (
        <Modal title={`Receber — venda ${modalReceber.numero}`} onClose={() => setModalReceber(null)}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-sm font-semibold text-slate-800">{modalReceber.clienteNome}</p>
              <p className="text-xs text-slate-400">Venda de {modalReceber.data}</p>
              <p className="text-base font-bold text-orange-600 pt-1">Em aberto: {fmt(modalReceber.saldo)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor recebido agora</label>
              <input value={valorRecebimento} onChange={e => setValorRecebimento(e.target.value)}
                inputMode="decimal" placeholder="0,00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p className="text-xs text-slate-400 mt-1">
                Pode receber só uma parte — o restante continua em aberto na lista.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Como pagou?</label>
              <div className="grid grid-cols-2 gap-2">
                {FORMAS.map(({ label, icon: Icon }) => (
                  <button key={label} onClick={() => {
                      setFormaRecebimento(label)
                      if (ehCartao(label) && !maquinaRecebimento) setMaquinaRecebimento(maquinaPadrao(config)?.id ?? null)
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      formaRecebimento === label ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    <Icon size={15} />{label}
                  </button>
                ))}
              </div>
            </div>

            {ehCartao(formaRecebimento) && (
              <SeletorMaquina
                forma={formaRecebimento}
                valor={valorRecebimento}
                parcelas={1}
                maquinaId={maquinaRecebimento}
                onSelecionar={setMaquinaRecebimento}
              />
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalReceber(null)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmarRecebimento} disabled={recebendo}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <CheckCircle2 size={15} />{recebendo ? 'Registrando…' : 'Confirmar Recebimento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Novo Lançamento */}
      {modal && (
        <Modal title="Novo Lançamento" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <div className="flex gap-2">
                {['receita', 'despesa'].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${form.tipo === t ? (t === 'receita' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do lançamento"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$) *</label>
              <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

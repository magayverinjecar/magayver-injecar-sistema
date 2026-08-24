import { useRef, useState, useMemo } from 'react'
import { Plus, X, Search, Check, AlertTriangle } from 'lucide-react'
import { parseValorBR } from '../utils/numero'
import { pecaAtiva } from '../utils/pecas'
import { historicoDePreco, conferirPiso, DIFICULDADES } from '../utils/precoHistorico'

// Painel de lançar item — embutido no quadro de itens, não em popup.
//
// O modal antigo era estreito: a lista tinha 4 linhas visíveis e o nome do
// produto saía cortado (`truncate`). Buscando "filtro" entre dezenas de peças,
// o usuário via quatro nomes pela metade e não conseguia escolher.
// Aqui a lista é longa, o nome quebra em vez de cortar, e as colunas mostram
// código, estoque, custo e venda — o que a pessoa precisa para decidir.
//
// O painel fica ABERTO depois de adicionar: um orçamento real tem vários itens
// e reabrir o popup a cada peça era o que mais custava tempo.

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pNum = parseValorBR
// Quantidade aceita vírgula ("1,5" litros de óleo) — Number() sozinho daria NaN
function parseQtd(v) { const n = pNum(v); return n > 0 ? n : 1 }

const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-xs font-medium text-slate-600 mb-1'

// Colunas do desktop. No celular vira cartão empilhado (ver comentário na linha).
const COLS_PECA = 'sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_6rem] sm:items-center sm:gap-2'
const COLS_SERV = 'sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_5rem_6rem] sm:items-center sm:gap-2'

export default function PainelAdicionarItem({
  servicos = [],
  estoque = [],
  // Quantas unidades da peça já estão RESERVADAS em OS antes da aprovação
  // (pecaId → número). Disponível = saldo − reservadas. Quem não passa, não
  // tem reserva (montagem de kit).
  reservadoDe = () => 0,
  funcionarios = [],
  onAdd,
  onFechar,
  desabilitado = false,
  mostrarReparador = true,
  // Serviço não entra sem reparador. Nasce DESLIGADO: quem liga é a OS.
  //
  // O orçamento não liga porque lá ninguém sabe ainda quem vai pegar o carro, e
  // o kit não liga porque é molde. Quem cobra as duas pontas é a trava de
  // conclusão em utils/reparador.js — nenhum serviço vira número sem dono.
  exigirReparador = false,
  // Orçamentos tem o botão "+ Criar novo" e o formulário de cadastro rápido;
  // eles entram por aqui para as duas telas usarem o mesmo painel.
  acaoCadastro = null,
  formularioNovo = null,
  // Quando o formulário de cadastro rápido está aberto, a lista some.
  esconderLista = false,
  // Registro recém-cadastrado pela tela de fora — o painel já o seleciona.
  selecaoExterna = null,
  tipoInicial = 'servico',
  modoInicial = 'cadastrado',
  // --- PRECIFICACAO POR DIFICULDADE (Orcamento e OS) ---
  // Nascem desligadas: quem ja usa este painel continua vendo o de sempre.
  //
  // A oficina nao cobra por hora nem por tabela fixa — cobra por dificuldade
  // tecnica, carro a carro. O que o sistema pode fazer e devolver, no segundo
  // da decisao, quanto ela JA cobrou por aquele servico. Sao 285 OS que ja
  // existem e nunca foram lidas de volta.
  ordens = null,          // para montar a referencia de preco
  modeloAtual = '',       // o carro desta OS/orcamento
  ignorarOS = null,       // a propria OS nao entra na sua referencia
  custoHora = null,       // piso: custo fixo por hora de bancada
  getModeloDaOS = null,   // (os) => texto do carro
  onTrocarTipo,
  onTrocarModo,
  textoBotao = 'Adicionar',
  // --- Montagem de KIT (Estoque > Kits) ---
  // As três opções abaixo nascem desligadas: quem já usa este painel na OS e no
  // Orçamento continua vendo exatamente o mesmo painel de antes.
  //
  // O kit é um molde, não uma venda: a peça pode estar zerada hoje e chegar na
  // semana que vem. Bloquear aqui impediria montar o "Kit Polo TSI" justamente
  // quando ele é mais necessário.
  permitirSemEstoque = false,
  // O kit não congela preço (ele vem do cadastro na hora de aplicar), então
  // valor unitário e desconto não fazem sentido enquanto se monta o molde.
  esconderPrecos = false,
  // Sem "Avulso": item de kit sem vínculo com o cadastro entraria por R$ 0,00
  // toda vez que o kit fosse aplicado.
  permitirAvulso = true,
}) {
  const [modo, setModo] = useState(modoInicial)   // 'cadastrado' | 'avulso'
  const [tipo, setTipo] = useState(tipoInicial)   // 'servico' | 'peca'
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnitario, setValorUnitario] = useState('')
  // Horas e dificuldade so existem para servico. Horas e OPCIONAL: sem ela o
  // painel funciona como sempre funcionou — ela e o que permite conferir se o
  // preco cobre o tempo de bancada, e o que alimenta o historico depois.
  const [horas, setHoras] = useState('')
  const [dificuldade, setDificuldade] = useState(null)
  const [custoAvulso, setCustoAvulso] = useState('')
  const [desconto, setDesconto] = useState('0')
  const [mecanicoId, setMecanicoId] = useState('')
  const [ultimaExterna, setUltimaExterna] = useState(null)
  const refBusca = useRef(null)

  // Ajuste durante a renderização (padrão do React, sem efeito colateral):
  // quem cadastrou uma peça/serviço na hora já vê o item escolhido aqui.
  if (selecaoExterna && selecaoExterna !== ultimaExterna) {
    setUltimaExterna(selecaoExterna)
    setSelId(selecaoExterna.id)
    setDescricao(tipo === 'servico'
      ? selecaoExterna.nome
      : `${selecaoExterna.nome}${selecaoExterna.codigo ? ` (${selecaoExterna.codigo})` : ''}`)
    setValorUnitario(selecaoExterna.preco)
  }

  const alvo = busca.toLowerCase()
  // Mesma regra de busca de sempre: serviço por nome, peça por nome OU código.
  const lista = tipo === 'servico'
    ? servicos.filter(s => s.nome.toLowerCase().includes(alvo))
    // Peça desativada (juntada em outra, ou fora de linha) não pode ser
    // lançada de novo — mas continua existindo no histórico e no extrato.
    : estoque.filter(p => pecaAtiva(p) && ((p.nome || '').toLowerCase().includes(alvo) || (p.codigo || '').toLowerCase().includes(alvo)))

  function limparItem() {
    setSelId('')
    setDescricao('')
    setValorUnitario('')
    setCustoAvulso('')
    setQuantidade('1')
    setDesconto('0')
    setHoras('')
    setDificuldade(null)
  }

  function trocarModo(m) {
    setModo(m)
    setBusca('')
    limparItem()
    onTrocarModo?.(m)
  }

  function trocarTipo(t) {
    setTipo(t)
    setBusca('')
    setMecanicoId('')
    limparItem()
    onTrocarTipo?.(t)
  }

  function selecionar(item) {
    setSelId(item.id)
    setDescricao(tipo === 'servico' ? item.nome : `${item.nome}${item.codigo ? ` (${item.codigo})` : ''}`)
    setValorUnitario(item.preco)
  }

  // Peça do estoque: saldo físico, o que outras OS já reservaram, e o que
  // sobra para prometer. Serviço ou peça avulsa não tem limite.
  const produtoSel = tipo === 'peca' && selId !== ''
    ? estoque.find(p => p.id === selId)
    : null
  const saldoFisico = produtoSel ? Number(produtoSel.estoque) || 0 : null
  const reservadas = produtoSel ? reservadoDe(produtoSel.id) : 0
  const disponivel = saldoFisico !== null ? saldoFisico - reservadas : null
  const qtdPedida = parseQtd(quantidade)
  const semEstoque = disponivel !== null && qtdPedida > disponivel
  // Falta de peça AVISA, não bloqueia — decisão do bloco 02: antes da
  // aprovação o item só reserva, e reservar mais do que tem é situação real
  // (peça a comprar). Bloquear empurrava a equipe para o "Avulso", que some
  // do estoque. Saldo negativo, se acontecer, aparece em vermelho no Estoque.
  const semValor = pNum(valorUnitario) <= 0

  // Custo só existe para peça AVULSA. Na peça do cadastro quem congela o custo
  // é o adicionarItemOrdem (busca o precoCusto do estoque) — mandar daqui
  // duplicaria a responsabilidade e os dois números podiam divergir.
  const pedeCusto = modo === 'avulso' && tipo === 'peca'
  const custoNum = pNum(custoAvulso)
  const vendaNum = pNum(valorUnitario)
  const temMargem = pedeCusto && custoNum > 0 && vendaNum > 0
  const lucroUn = temMargem ? vendaNum - custoNum : 0
  const margemPct = temMargem ? (lucroUn / vendaNum) * 100 : 0

  function adicionar() {
    if (!descricao.trim()) return
    // O botão já está desabilitado; isto é a segunda tranca, para o Enter e
    // qualquer caminho que não passe pelo clique.
    if (faltaReparador) return
    // Kit não tem preço para conferir — o preço só existe quando ele é aplicado.
    if (!esconderPrecos && semValor && !confirm('Este item está sem valor. Adicionar mesmo assim por R$ 0,00?')) return
    const item = {
      tipo,
      produtoId: tipo === 'peca' ? selId : null,
      servicoId: tipo === 'servico' ? selId : null,
      descricao: descricao.toUpperCase(),
      quantidade: qtdPedida,
      valorUnitario,
      desconto,
      mecanicoId: tipo === 'servico' && mecanicoId ? Number(mecanicoId) : null,
      // Guardados so quando preenchidos: item antigo nao ganha campo vazio, e
      // o historico de amanha nasce de quem preencheu hoje.
      ...(tipo === 'servico' && pNum(horas) > 0 ? { horas } : {}),
      ...(tipo === 'servico' && dificuldade ? { dificuldade } : {}),
    }
    // Peça comprada na hora: sem isto a margem da OS fica incompleta e o CMV
    // sai por baixo. Só vai quando o dono realmente digitou o custo.
    if (pedeCusto && custoNum > 0) item.custoUnitario = custoAvulso
    onAdd(item)
    // Fica aberto para o próximo item: limpa o lançamento, mantém tipo/modo e
    // o reparador escolhido (normalmente é o mesmo em vários serviços).
    limparItem()
    setBusca('')
    refBusca.current?.focus()
  }

  // Falta o reparador obrigatório? Só vale para serviço, e só onde o campo
  // aparece — exigir um campo escondido travaria a tela sem dizer por quê.
  const faltaReparador = exigirReparador && tipo === 'servico' && mostrarReparador && !mecanicoId
  const podeAdicionar = !desabilitado && !!descricao.trim() && !faltaReparador

  // O que a oficina ja cobrou por este servico. So calcula quando ha um
  // servico escolhido e a tela passou as ordens — nas outras (kit) fica nulo.
  const referencia = useMemo(() => {
    if (tipo !== 'servico' || !ordens || !descricao.trim()) return null
    const r = historicoDePreco(ordens, {
      servicoId: selId || null,
      descricao,
      modeloAtual,
      modeloDaOS: getModeloDaOS || (() => ''),
      ignorarOS,
    })
    return r.total > 0 ? r : null
  }, [tipo, ordens, descricao, selId, modeloAtual, getModeloDaOS, ignorarOS])

  // A regua: nao e o metodo de preco, e a conferencia. Sem horas ou sem custo
  // da hora ela nao aparece — inventar um piso seria pior que nao ter.
  const piso = useMemo(
    () => (tipo === 'servico' ? conferirPiso({ valor: valorUnitario, horas, custoHora }) : null),
    [tipo, valorUnitario, horas, custoHora],
  )

  // Quantas colunas a linha de números ocupa no desktop. Sem isto, esconder os
  // preços deixaria o botão "Adicionar" perdido no meio de colunas vazias.
  const mostraHoras = tipo === 'servico' && !!ordens && !esconderPrecos
  const colunasNumeros = 1 + (pedeCusto ? 1 : 0) + (esconderPrecos ? 0 : 2) + (mostraHoras ? 1 : 0) + 1
  const gridNumeros = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6' }[colunasNumeros]

  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50 p-3 sm:p-4 space-y-3">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Plus size={15} className="text-primary-500" />Adicionar item
        </h4>
        <button type="button" onClick={onFechar}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg px-2 py-1 transition-colors">
          <X size={13} />Fechar
        </button>
      </div>

      {/* Do Cadastro / Avulso  ·  Serviço / Peça */}
      <div className={`grid grid-cols-1 ${permitirAvulso ? 'sm:grid-cols-2' : ''} gap-2`}>
        {permitirAvulso && (
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg">
            <button type="button" onClick={() => trocarModo('cadastrado')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'cadastrado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Do Cadastro
            </button>
            <button type="button" onClick={() => trocarModo('avulso')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modo === 'avulso' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Avulso
            </button>
          </div>
        )}
        <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg">
          <button type="button" onClick={() => trocarTipo('servico')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tipo === 'servico' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Serviço
          </button>
          <button type="button" onClick={() => trocarTipo('peca')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tipo === 'peca' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Peça
          </button>
        </div>
      </div>

      {/* Busca + lista */}
      {modo === 'cadastrado' && (
        <div>
          <div className="flex items-end justify-between gap-2 mb-1">
            <label className={`${ROTULO} mb-0`} htmlFor="painel-busca-item">
              {tipo === 'servico' ? 'Serviço cadastrado' : 'Produto do estoque'}
            </label>
            {acaoCadastro}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input id="painel-busca-item" ref={refBusca} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={tipo === 'servico' ? 'Nome do serviço' : 'Nome ou código da peça'}
              className={`${INP} pl-9`} />
          </div>

          {formularioNovo}

          {!esconderLista && (
            <div className="mt-1.5 border border-slate-200 rounded-lg bg-white overflow-hidden">
              {/* Cabeçalho das colunas — só no desktop, no celular vira cartão */}
              <div className={`hidden ${tipo === 'peca' ? COLS_PECA : COLS_SERV} px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
                {tipo === 'peca' ? (
                  <>
                    <span>Produto</span>
                    <span>Código</span>
                    <span className="text-right">Estoque</span>
                    <span className="text-right">Custo</span>
                    <span className="text-right">Venda</span>
                  </>
                ) : (
                  <>
                    <span>Serviço</span>
                    <span>Categoria</span>
                    <span className="text-right">Tempo</span>
                    <span className="text-right">Preço</span>
                  </>
                )}
              </div>

              {/* ~9 linhas visíveis; o resto rola. O nome NÃO é truncado. */}
              <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100">
                {lista.map(item => {
                  const sel = selId === item.id
                  const emEstoque = Number(item.estoque) || 0
                  const reservItem = reservadoDe(item.id)
                  const dispItem = emEstoque - reservItem
                  const corEstoque = dispItem > 0 ? 'text-green-600' : 'text-red-500'
                  return (
                    <button key={item.id} type="button" onClick={() => selecionar(item)}
                      className={`w-full text-left px-3 py-2 transition-colors ${tipo === 'peca' ? COLS_PECA : COLS_SERV} ${sel ? 'bg-primary-50 ring-1 ring-inset ring-primary-500' : 'hover:bg-slate-50'}`}>

                      <span className="flex items-start gap-1.5 text-sm font-medium text-slate-800 break-words">
                        {sel && <Check size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />}
                        <span className="break-words">{item.nome}</span>
                      </span>

                      {/* Celular: os dados viram uma linha de rótulos embaixo do nome */}
                      <span className="sm:hidden mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {tipo === 'peca' ? (
                          <>
                            {item.codigo && <span className="font-mono">{item.codigo}</span>}
                            <span className={`font-medium ${corEstoque}`}>{emEstoque > 0 ? `${emEstoque} un.` : 'sem estoque'}{reservItem > 0 ? ` · ${reservItem} reserv.` : ''}</span>
                            {pNum(item.precoCusto) > 0 && <span className="tabular-nums">custo {fmt(pNum(item.precoCusto))}</span>}
                            <span className="tabular-nums font-semibold text-slate-700">venda {fmt(pNum(item.preco))}</span>
                          </>
                        ) : (
                          <>
                            {item.categoria && <span>{item.categoria}</span>}
                            {item.tempo && <span>⏱ {item.tempo}</span>}
                            <span className="tabular-nums font-semibold text-slate-700">{fmt(pNum(item.preco))}</span>
                          </>
                        )}
                      </span>

                      {/* Desktop: uma coluna por dado */}
                      {tipo === 'peca' ? (
                        <>
                          <span className="hidden sm:block text-xs font-mono text-slate-500 truncate">{item.codigo || '—'}</span>
                          <span className={`hidden sm:block text-right text-xs font-medium tabular-nums ${corEstoque}`} title={reservItem > 0 ? `${emEstoque} em saldo, ${reservItem} reservadas em OS ainda não aprovadas, ${dispItem} disponíveis` : undefined}>
                            {emEstoque > 0 ? `${emEstoque} un.` : '0 un.'}
                            {reservItem > 0 && <span className="block text-[10px] font-normal text-amber-600">{reservItem} reserv.</span>}
                          </span>
                          <span className="hidden sm:block text-right text-xs text-slate-500 tabular-nums">
                            {pNum(item.precoCusto) > 0 ? fmt(pNum(item.precoCusto)) : '—'}
                          </span>
                          <span className="hidden sm:block text-right text-sm font-semibold text-slate-700 tabular-nums">{fmt(pNum(item.preco))}</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:block text-xs text-slate-500 truncate">{item.categoria || '—'}</span>
                          <span className="hidden sm:block text-right text-xs text-slate-500">{item.tempo || '—'}</span>
                          <span className="hidden sm:block text-right text-sm font-semibold text-slate-700 tabular-nums">{fmt(pNum(item.preco))}</span>
                        </>
                      )}
                    </button>
                  )
                })}
                {lista.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-4 text-center">
                    {busca ? `Nada encontrado para "${busca}".` : 'Nada cadastrado ainda.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Descrição + reparador */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={tipo === 'servico' && mostrarReparador ? '' : 'sm:col-span-2'}>
          <label className={ROTULO} htmlFor="painel-descricao-item">Descrição *</label>
          <input id="painel-descricao-item" value={descricao} onChange={e => setDescricao(e.target.value)}
            spellCheck lang="pt-BR"
            placeholder={modo === 'avulso' ? 'DESCREVA O SERVIÇO OU PEÇA...' : ''}
            className={`${INP} uppercase`} />
        </div>
        {tipo === 'servico' && mostrarReparador && (
          <div>
            <label className={ROTULO} htmlFor="painel-reparador-item">
              Reparador{exigirReparador && ' *'}
            </label>
            <select id="painel-reparador-item" value={mecanicoId} onChange={e => setMecanicoId(e.target.value)}
              className={faltaReparador ? `${INP} border-amber-400 bg-amber-50` : INP}>
              <option value="">{exigirReparador ? '— escolha quem vai fazer —' : 'Sem reparador'}</option>
              {(funcionarios || []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            {/* Botão desabilitado sem dizer o motivo é o que faz a pessoa achar
                que o sistema travou. O motivo fica embaixo do campo que resolve. */}
            {faltaReparador && (
              <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                Obrigatório. Sem dono, o serviço não entra na produtividade de ninguém.
              </p>
            )}
          </div>
        )}
      </div>

      {/* A referencia de preco: o que esta oficina ja cobrou por este servico.
          Nao sugere valor nem trava nada — mostra a faixa praticada no segundo
          em que a pessoa decide. E o que transfere o preco da cabeca do dono
          para o sistema, sem tirar a liberdade de precificar cada carro. */}
      {referencia && (
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs space-y-1">
          <p className="text-slate-500">
            Você já cobrou este serviço <strong className="font-semibold text-slate-700">{referencia.total}×</strong>:
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {referencia.noModelo && (
              <span className="text-slate-600">
                {modeloAtual ? <>em <strong className="font-medium">{String(modeloAtual).split(' ')[0]}</strong></> : 'neste modelo'}
                {' — '}
                <strong className="font-semibold text-slate-800 tabular-nums">
                  {fmt(referencia.noModelo.min)} a {fmt(referencia.noModelo.max)}
                </strong>
                <span className="text-slate-400"> (mediana {fmt(referencia.noModelo.mediana)} · {referencia.noModelo.n}×)</span>
              </span>
            )}
            {referencia.nosOutros && (
              <span className="text-slate-500">
                nos outros carros — <span className="tabular-nums">{fmt(referencia.nosOutros.min)} a {fmt(referencia.nosOutros.max)}</span>
                <span className="text-slate-400"> (mediana {fmt(referencia.nosOutros.mediana)} · {referencia.nosOutros.n}×)</span>
              </span>
            )}
          </div>
          {referencia.ultimas.length > 0 && (
            <p className="text-slate-400">
              Últimas: {referencia.ultimas.slice(0, 3).map(u => `${u.modelo || 'sem carro'} ${fmt(u.valor)}`).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Dificuldade tecnica: e por ela que esta oficina precifica. Tres niveis
          e nao cinco — quem escolhe esta com o cliente na frente, e escala longa
          vira "sempre o do meio". */}
      {tipo === 'servico' && !!ordens && (
        <div>
          <label className={ROTULO}>Dificuldade técnica <span className="font-normal text-slate-400">(opcional)</span></label>
          <div className="grid grid-cols-3 gap-2">
            {DIFICULDADES.map(d => {
              const ativo = dificuldade === d.id
              return (
                <button key={d.id} type="button" title={d.ajuda}
                  onClick={() => setDificuldade(ativo ? null : d.id)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    ativo ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {d.rotulo}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Números + botão na mesma linha */}
      <div className={`grid grid-cols-2 ${gridNumeros} gap-3 sm:items-end`}>
        <div>
          <label className={ROTULO} htmlFor="painel-qtd-item">
            {disponivel !== null ? `Qtd. (${disponivel} disp.)` : 'Quantidade'}
          </label>
          <input id="painel-qtd-item" type="text" inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)}
            className={`${INP} text-right tabular-nums ${semEstoque ? 'border-amber-300 bg-amber-50' : ''}`} />
        </div>
        {pedeCusto && (
          <div>
            <label className={ROTULO} htmlFor="painel-custo-item">Preço de custo (R$)</label>
            <input id="painel-custo-item" value={custoAvulso} onChange={e => setCustoAvulso(e.target.value)}
              placeholder="0,00" className={`${INP} text-right tabular-nums`} />
          </div>
        )}
        {!esconderPrecos && (
          <>
            <div>
              <label className={ROTULO} htmlFor="painel-valor-item">Valor unit. (R$)</label>
              <input id="painel-valor-item" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)}
                placeholder="0,00" className={`${INP} text-right tabular-nums`} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="painel-desc-item">Desconto (R$)</label>
              <input id="painel-desc-item" value={desconto} onChange={e => setDesconto(e.target.value)}
                placeholder="0" className={`${INP} text-right tabular-nums`} />
            </div>
          </>
        )}
        {mostraHoras && (
          <div>
            <label className={ROTULO} htmlFor="painel-horas-item">
              Horas <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input id="painel-horas-item" value={horas} onChange={e => setHoras(e.target.value)}
              inputMode="decimal" placeholder="0,0"
              title="Quanto tempo de bancada este serviço ocupa. Não muda o preço — serve para conferir se ele cobre o custo."
              className={`${INP} text-right tabular-nums`} />
          </div>
        )}
        <button type="button" onClick={adicionar} disabled={!podeAdicionar}
          title={faltaReparador ? 'Escolha o reparador antes de adicionar o serviço' : undefined}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} />{textoBotao}
        </button>
      </div>

      {/* A regua. So avisa — nunca trava: as vezes o servico e feito no custo
          de proposito (cliente antigo, carro que ja esta na oficina, fechar um
          pacote). Travar viraria uma janela que todo mundo aprende a ignorar. */}
      {piso && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${
          piso.abaixoDoPiso
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <strong className="font-semibold tabular-nums">{fmt(piso.porHora)}/hora</strong>
          {piso.abaixoDoPiso
            ? <> — abaixo do custo de {fmt(pNum(custoHora))}/h. Este serviço consome {fmt(piso.custoDoTempo)} de bancada e deixa {fmt(piso.sobra)}.</>
            : <> — sua hora custa {fmt(pNum(custoHora))}. Sobram {fmt(piso.sobra)} depois de pagar o tempo de bancada.</>}
        </p>
      )}

      {/* Peça comprada na hora: sem custo a apuração de margem fica cega */}
      {pedeCusto && (
        <p className="text-xs text-slate-500">
          {temMargem ? (
            <span className={lucroUn >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
              Margem prevista: {fmt(lucroUn)} por unidade ({margemPct.toFixed(0)}%)
            </span>
          ) : (
            'Preço de custo: quanto você pagou nela. Sem isso, a margem desta OS fica incompleta.'
          )}
        </p>
      )}

      {semEstoque && (
        permitirSemEstoque ? (
          // Montando kit: é só um recado. O molde vale para o ano inteiro, o
          // estoque de hoje não.
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Hoje existem {disponivel} desta peça. Ela entra no kit assim mesmo —
              o aviso de falta aparece na hora de aplicar o kit na OS.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Você pediu <strong>{qtdPedida}</strong> e só há <strong>{disponivel}</strong> disponível
              {reservadas > 0 ? <> ({saldoFisico} em saldo, {reservadas} já reservada{reservadas === 1 ? '' : 's'} em OS ainda não aprovadas)</> : null}.
              O item entra mesmo assim — registre a compra da peça em <strong>Compras</strong> para o saldo fechar.
            </span>
          </div>
        )
      )}
    </div>
  )
}

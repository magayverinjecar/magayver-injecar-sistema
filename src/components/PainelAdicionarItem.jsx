import { useRef, useState } from 'react'
import { Plus, X, Search, Check, AlertTriangle } from 'lucide-react'
import { parseValorBR } from '../utils/numero'

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
  funcionarios = [],
  onAdd,
  onFechar,
  desabilitado = false,
  mostrarReparador = true,
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
    : estoque.filter(p => (p.nome || '').toLowerCase().includes(alvo) || (p.codigo || '').toLowerCase().includes(alvo))

  function limparItem() {
    setSelId('')
    setDescricao('')
    setValorUnitario('')
    setCustoAvulso('')
    setQuantidade('1')
    setDesconto('0')
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

  // Peça do estoque: quanto existe hoje. Serviço ou peça avulsa não tem limite.
  const produtoSel = tipo === 'peca' && selId !== ''
    ? estoque.find(p => p.id === selId)
    : null
  const disponivel = produtoSel ? Number(produtoSel.estoque) || 0 : null
  const qtdPedida = parseQtd(quantidade)
  const semEstoque = disponivel !== null && qtdPedida > disponivel
  // Na montagem de kit a falta só INFORMA; na OS e no Orçamento ela BLOQUEIA,
  // como sempre bloqueou.
  const bloqueiaEstoque = semEstoque && !permitirSemEstoque
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
    if (!descricao.trim() || bloqueiaEstoque) return
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

  const podeAdicionar = !desabilitado && !!descricao.trim() && !bloqueiaEstoque

  // Quantas colunas a linha de números ocupa no desktop. Sem isto, esconder os
  // preços deixaria o botão "Adicionar" perdido no meio de colunas vazias.
  const colunasNumeros = 1 + (pedeCusto ? 1 : 0) + (esconderPrecos ? 0 : 2) + 1
  const gridNumeros = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5' }[colunasNumeros]

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
                  const corEstoque = emEstoque > 0 ? 'text-green-600' : 'text-red-500'
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
                            <span className={`font-medium ${corEstoque}`}>{emEstoque > 0 ? `${emEstoque} un.` : 'sem estoque'}</span>
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
                          <span className={`hidden sm:block text-right text-xs font-medium tabular-nums ${corEstoque}`}>
                            {emEstoque > 0 ? `${emEstoque} un.` : '0 un.'}
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
            <label className={ROTULO} htmlFor="painel-reparador-item">Reparador</label>
            <select id="painel-reparador-item" value={mecanicoId} onChange={e => setMecanicoId(e.target.value)} className={INP}>
              <option value="">Sem reparador</option>
              {(funcionarios || []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Números + botão na mesma linha */}
      <div className={`grid grid-cols-2 ${gridNumeros} gap-3 sm:items-end`}>
        <div>
          <label className={ROTULO} htmlFor="painel-qtd-item">
            {disponivel !== null ? `Qtd. (${disponivel} disp.)` : 'Quantidade'}
          </label>
          <input id="painel-qtd-item" type="text" inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)}
            className={`${INP} text-right tabular-nums ${bloqueiaEstoque ? 'border-red-300 bg-red-50' : ''}`} />
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
        <button type="button" onClick={adicionar} disabled={!podeAdicionar}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} />{textoBotao}
        </button>
      </div>

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
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Estoque insuficiente: você pediu {qtdPedida} e existem {disponivel}.
              Registre a entrada em Compras ou lance a peça como <strong>Avulso</strong>.
            </span>
          </div>
        )
      )}
    </div>
  )
}

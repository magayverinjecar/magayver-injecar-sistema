import { useState, useEffect, useRef } from 'react'
import { Save, AlertTriangle, ShieldCheck, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, CreditCard, Power, Timer } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CHECKLIST_PADRAO, itensDoChecklist } from '../utils/conferencia'
import {
  PRAZOS, novaMaquina, maquinasDoConfig, ordenarFaixas,
  problemasDaMaquina, calcularPagamentoCartao, TAXA_MAXIMA_PCT,
} from '../utils/cartao'
import { capacidadeDoConfig, problemasDaCapacidade, avisoDaOcupacao } from '../utils/capacidade'
import { custoFixoMensal, custoDaHora } from '../utils/margem'
import gerarId from '../utils/id'

const DEFAULTS = {
  nome: 'Magayver Injecar',
  cnpj: '',
  telefone: '',
  endereco: '',
  email: '',
  responsavel: 'Magayver Torres',
  politicaPatio: '',
}

export default function Configuracoes() {
  const { config, setConfig } = useApp()
  const [form, setForm] = useState(DEFAULTS)
  const [salvo, setSalvo] = useState(false)
  const inicializado = useRef(false)

  useEffect(() => {
    if (!inicializado.current && config && Object.keys(config).length > 0) {
      setForm(f => ({ ...f, ...config }))
      inicializado.current = true
    }
  }, [config])

  function salvar() {
    // Grava SÓ os campos desta seção. O form recebeu uma cópia do config inteiro
    // ao abrir a tela — incluindo checklist de conferência e maquininhas —, então
    // devolver o form todo ressuscitaria a versão velha dessas listas caso outro
    // aparelho as tenha editado nesse meio tempo.
    const meus = {}
    for (const campo of Object.keys(DEFAULTS)) meus[campo] = form[campo] ?? DEFAULTS[campo]
    setConfig(c => ({ ...c, ...meus }))
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Dados da Oficina</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Oficina</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
            <input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
              <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-0000" className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@oficina.com" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
            <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Política de pátio (sai sozinha na impressão do orçamento)</label>
            <textarea rows={4} value={form.politicaPatio || ''} onChange={e => setForm(f => ({ ...f, politicaPatio: e.target.value }))}
              spellCheck lang="pt-BR"
              placeholder="Ex: Após 24 horas do comunicado, será cobrada diária de pátio de R$ 35,00..."
              className={inp + ' resize-none'} />
            <p className="text-xs text-slate-400 mt-1">
              Aparece em todo orçamento impresso (avulso e da OS) sem precisar digitar. Some no recibo de OS paga e entregue. Deixe vazio para não imprimir.
            </p>
          </div>
          <button onClick={salvar} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />
            {salvo ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      <CapacidadeDaOficina />

      <Maquininhas />

      <ChecklistConferencia />

      <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100">
          <h2 className="font-semibold text-red-600">Zona de Perigo</h2>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600">
              Os dados do sistema agora são armazenados no banco de dados Supabase e não podem ser apagados por aqui.
              Para remover todos os dados, acesse diretamente o painel do Supabase.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Capacidade da oficina — de onde sai o custo da hora.
//
// O custo fixo (aluguel, energia, salário) NÃO entra na margem de cada OS: com
// salário fixo, o mecânico custa o mesmo tendo levado 2 ou 8 horas no carro, e
// ratear isso por serviço daria um número preciso e errado. Mas o custo fixo
// precisa ser recuperado em algum lugar — e o lugar é o PREÇO. É isso que este
// bloco calcula: quanto a hora da oficina precisa render só para pagar a
// estrutura, antes de qualquer lucro.
//
// Ferramenta de precificação, portanto: olha para frente ("quanto cobrar"), não
// para trás ("quanto lucrei naquela OS").
function CapacidadeDaOficina() {
  const { config, setConfig, gastos } = useApp()
  const [edicao, setEdicao] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const cap = edicao ?? capacidadeDoConfig(config)
  const alterado = edicao !== null

  // Sem intervalo, `custoFixoMensal` responde "quanto custa um mês típico": só
  // os gastos fixos recorrentes. É a base certa para o custo da hora, que é uma
  // conta mensal — não a soma do histórico, e não o custo de um mês específico.
  const custoFixo = custoFixoMensal(gastos)
  const { horasVendaveis, custoHora } = custoDaHora({
    custoFixo,
    mecanicos: cap.reparadores,
    horasPorDia: cap.horasPorDia,
    diasUteis: cap.diasUteis,
    ocupacao: cap.ocupacao,
  })
  const faltas = problemasDaCapacidade(cap)
  const aviso = avisoDaOcupacao(cap.ocupacao)

  function mudar(campo, valor) {
    setEdicao(atual => ({ ...(atual ?? capacidadeDoConfig(config)), [campo]: valor }))
  }

  function salvar() {
    setConfig(c => ({ ...c, capacidade: { ...cap } }))
    setEdicao(null)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500'
  const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const num = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  const CAMPOS = [
    { campo: 'reparadores', label: 'Reparadores', dica: 'quem põe a mão no carro', placeholder: '2' },
    { campo: 'horasPorDia', label: 'Horas por dia', dica: 'de bancada, por pessoa', placeholder: '8' },
    { campo: 'diasUteis',   label: 'Dias úteis no mês', dica: 'que a oficina abre', placeholder: '22' },
    { campo: 'ocupacao',    label: 'Ocupação (%)', dica: 'da hora paga, quanto vira hora vendida', placeholder: '70' },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Timer size={17} className="text-emerald-500" />Capacidade da oficina
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Quantas horas a oficina consegue vender por mês. Com isso o sistema calcula quanto a
          hora precisa render só para pagar aluguel, energia e salário — o piso da sua tabela de preço.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CAMPOS.map(({ campo, label, dica, placeholder }) => (
            <div key={campo}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
              <input type="number" min="0" inputMode="numeric"
                value={cap[campo]} onChange={e => mudar(campo, e.target.value)}
                placeholder={placeholder} className={inp} />
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">{dica}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 leading-snug">
          <strong className="text-slate-600">Por que a ocupação não é 100%:</strong> orçamento que não fecha,
          espera de peça e retrabalho consomem hora paga que ninguém fatura — dividir o custo fixo pelas horas
          cheias faria toda a tabela sair barata demais. Na prática fica entre 60% e 80%.
        </p>

        {/* Prévia ao vivo — o efeito em dinheiro do que está sendo digitado.
            Igual à prévia das maquininhas: número solto não denuncia erro. */}
        {faltas.length > 0 ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-snug">
              Falta preencher: {faltas.join(' · ')}. Sem isso não dá para calcular o custo da hora —
              e um valor chutado aqui vira preço errado em toda OS.
            </p>
          </div>
        ) : custoFixo <= 0 ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-snug">
              A oficina consegue vender <strong>{num(horasVendaveis)} horas por mês</strong>, mas nenhum
              gasto fixo recorrente está cadastrado. Cadastre aluguel, energia e salário em
              <strong> Gastos</strong>, com o tipo <strong>"Fixo"</strong> — sem eles o
              custo da hora sairia R$ 0,00, que é um preço que ninguém pode praticar.
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-slate-600">Custo da hora desta oficina</p>
            <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-0.5">{fmt(custoHora)}<span className="text-sm font-normal text-slate-400"> / hora</span></p>
            <p className="text-xs text-slate-500 mt-1.5 leading-snug tabular-nums">
              {fmt(custoFixo)} de custo fixo por mês ÷ {num(horasVendaveis)} horas vendáveis
              ({cap.reparadores} × {cap.horasPorDia}h × {cap.diasUteis} dias × {cap.ocupacao}%).
            </p>
            <p className="text-xs text-slate-400 mt-1.5 leading-snug">
              Cobrar exatamente isso na hora empata a estrutura e não deixa lucro nenhum.
              O que você quer ganhar entra <em>em cima</em> deste valor.
            </p>
          </div>
        )}

        {aviso && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-snug">{aviso}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={salvar} disabled={!alterado}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />{salvo ? 'Salvo!' : 'Salvar capacidade'}
          </button>
          {alterado && (
            <span className="text-xs text-amber-700 flex items-center gap-1 ml-auto">
              <AlertTriangle size={12} /> Não salvo
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Maquininhas de cartão.
//
// A oficina opera mais de uma máquina e elas cobram diferente pelo mesmo
// serviço: uma credita na hora (taxa maior, porque antecipa), outra credita no
// próximo dia útil (taxa menor). Sem esta tabela cadastrada não há de onde
// calcular a taxa, e a receita continua entrando pelo valor cheio — que nunca
// foi o que caiu na conta.
function Maquininhas() {
  const { config, setConfig } = useApp()
  const [edicao, setEdicao] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const lista = edicao ?? maquinasDoConfig(config)
  const alterado = edicao !== null

  // Toda alteração parte do estado anterior, nunca do `lista` deste render:
  // dois cliques rápidos (adicionar faixa duas vezes) leriam a mesma lista velha
  // e o primeiro clique se perderia.
  function editar(fn) {
    setEdicao(prev => fn(prev ?? maquinasDoConfig(config)))
  }

  function mudar(id, dados) {
    editar(atual => atual.map(m => m.id === id ? { ...m, ...dados } : m))
  }

  function mudarMaquina(id, fn) {
    editar(atual => atual.map(m => m.id === id ? fn(m) : m))
  }

  function adicionar() {
    editar(atual => [...atual, novaMaquina('maq-' + gerarId())])
  }

  function remover(id) {
    const m = lista.find(x => x.id === id)
    if (!confirm(`Excluir a máquina "${m?.nome || 'sem nome'}"?\n\nOs pagamentos já registrados guardam o nome dela e continuam intactos.\nSe você só parou de usá-la, prefira desativar — assim ela some das telas de venda sem sumir dos relatórios.`)) return
    editar(atual => atual.filter(x => x.id !== id))
  }

  function mudarFaixa(maqId, faixaId, dados) {
    mudarMaquina(maqId, m => ({
      ...m,
      faixasParcelado: (m.faixasParcelado || []).map(f => f.id === faixaId ? { ...f, ...dados } : f),
    }))
  }

  function addFaixa(maqId) {
    mudarMaquina(maqId, m => {
      const atuais = m.faixasParcelado || []
      const maiorTeto = atuais.reduce((mx, f) => Math.max(mx, Number(f.ate) || 0), 1)
      return { ...m, faixasParcelado: [...atuais, { id: 'fx-' + gerarId(), ate: String(Math.min(maiorTeto + 5, 21)), taxa: '' }] }
    })
  }

  function delFaixa(maqId, faixaId) {
    mudarMaquina(maqId, m => ({
      ...m,
      faixasParcelado: (m.faixasParcelado || []).filter(f => f.id !== faixaId),
    }))
  }

  function salvar() {
    if (lista.some(m => !String(m.nome || '').trim())) {
      alert('Toda máquina precisa de um apelido — é por ele que você vai escolher na hora da venda.')
      return
    }
    // Faixa sem número de parcelas seria descartada silenciosamente na gravação.
    // Melhor barrar aqui do que a pessoa achar que salvou.
    const incompleta = lista.find(m => (m.faixasParcelado || []).some(f => !(Number(f.ate) > 1)))
    if (incompleta) {
      alert(`Na máquina "${incompleta.nome}" há uma faixa de parcelado sem o número de parcelas.\n\nPreencha o "até quantas vezes" ou remova a faixa.`)
      return
    }
    // Taxa fora de escala é quase sempre vírgula errada — "349" no lugar de
    // "3,49". Passando batido, TODA venda no cartão a partir daí grava despesa
    // dez vezes maior e líquido negativo. O aviso âmbar existia, mas aviso não
    // impede ninguém com pressa de clicar em salvar.
    const absurda = lista.find(m => problemasDaMaquina(m).some(p => p.includes('acima de')))
    if (absurda) {
      alert(`A máquina "${absurda.nome}" tem taxa acima de ${TAXA_MAXIMA_PCT}%.\n\nConfira a vírgula: 3,49% é diferente de 349%. Como está, uma venda de R$ 1.000 lançaria milhares de reais de despesa.`)
      return
    }
    const limpas = lista.map(m => ({
      ...m,
      nome: m.nome.trim(),
      faixasParcelado: ordenarFaixas(m.faixasParcelado).map(f => ({ id: f.id, ate: Number(f.ate), taxa: f.taxa })),
    }))
    setConfig(c => ({ ...c, maquinasCartao: limpas }))
    setEdicao(null)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <CreditCard size={17} className="text-violet-500" />Maquininhas de cartão
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Cadastre a taxa de cada máquina uma vez. Na venda o sistema calcula sozinho quanto
          foi de taxa e quanto realmente caiu na conta — digitar a cada venda é erro que ninguém percebe.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {lista.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">
            Nenhuma máquina cadastrada. Enquanto isso, a taxa do cartão não é descontada de nada.
          </p>
        )}

        {lista.map(maq => {
          const problemas = problemasDaMaquina(maq)
          const inativa = maq.ativa === false
          const faixas = maq.faixasParcelado || []
          return (
            <div key={maq.id} className={`border rounded-xl overflow-hidden ${inativa ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200'}`}>
              {/* Cabeçalho: apelido + prazo */}
              <div className="p-4 space-y-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <input value={maq.nome} onChange={e => mudar(maq.id, { nome: e.target.value })}
                    placeholder="Apelido da máquina (ex: Cielo antiga, Stone nova)"
                    className={inp + ' font-medium'} />
                  <button onClick={() => mudar(maq.id, { ativa: inativa })} title={inativa ? 'Reativar' : 'Desativar'}
                    className={`p-2 rounded-lg flex-shrink-0 transition-colors ${inativa ? 'text-slate-400 hover:text-green-600 hover:bg-green-50' : 'text-green-600 hover:bg-slate-100'}`}>
                    <Power size={16} />
                  </button>
                  <button onClick={() => remover(maq.id)} title="Excluir"
                    className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Quando o dinheiro cai na conta</label>
                  <div className="flex gap-2">
                    {Object.entries(PRAZOS).map(([chave, { label }]) => (
                      <button key={chave} onClick={() => mudar(maq.id, { prazo: chave })}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          maq.prazo === chave ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {maq.prazo === 'proximo_dia_util' && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      Venda de sexta vira saldo na segunda. Feriado nacional e carnaval já são pulados automaticamente.
                    </p>
                  )}
                </div>
              </div>

              {/* Taxas */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Débito (%)</label>
                    <input value={maq.taxaDebito} onChange={e => mudar(maq.id, { taxaDebito: e.target.value })}
                      inputMode="decimal" placeholder="1,99" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Crédito à vista (%)</label>
                    <input value={maq.taxaCreditoVista} onChange={e => mudar(maq.id, { taxaCreditoVista: e.target.value })}
                      inputMode="decimal" placeholder="3,49" className={inp} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Crédito parcelado — a taxa sobe conforme as parcelas
                  </label>
                  <div className="space-y-2">
                    {faixas.map(f => (
                      <div key={f.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 flex-shrink-0">até</span>
                        <input type="number" min="2" max="21" value={f.ate}
                          onChange={e => mudarFaixa(maq.id, f.id, { ate: e.target.value })}
                          className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        <span className="text-xs text-slate-400 flex-shrink-0">x cobra</span>
                        <input value={f.taxa} onChange={e => mudarFaixa(maq.id, f.id, { taxa: e.target.value })}
                          inputMode="decimal" placeholder="4,99"
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        <span className="text-xs text-slate-400 flex-shrink-0">%</span>
                        <button onClick={() => delFaixa(maq.id, f.id)} aria-label="Remover faixa"
                          className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addFaixa(maq.id)}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-500 py-2 rounded-lg text-xs font-medium hover:border-slate-300 hover:text-slate-700 transition-colors">
                      <Plus size={13} /> Adicionar faixa
                    </button>
                  </div>
                </div>

                <PreviaMaquina maquina={maq} />

                {problemas.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Falta preencher: {problemas.join(' · ')}. Enquanto isso, a venda nesta máquina sai sem taxa descontada.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <button onClick={adicionar}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-500 py-2.5 rounded-lg text-sm font-medium hover:border-slate-300 hover:text-slate-700 transition-colors">
          <Plus size={15} /> Adicionar maquininha
        </button>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={salvar} disabled={!alterado}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />{salvo ? 'Salvo!' : 'Salvar maquininhas'}
          </button>
          {alterado && (
            <span className="text-xs text-amber-700 flex items-center gap-1 ml-auto">
              <AlertTriangle size={12} /> Não salvo
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Confere o que foi digitado mostrando o efeito em dinheiro: percentual sozinho
// não denuncia um 4,99 digitado como 49,9.
function PreviaMaquina({ maquina }) {
  const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const faixas = ordenarFaixas(maquina.faixasParcelado)
  const casos = [
    { rotulo: 'Débito',          calc: { bruto: 1000, modalidade: 'debito' } },
    { rotulo: 'Crédito à vista', calc: { bruto: 1000, modalidade: 'credito', parcelas: 1 } },
    ...faixas.map(f => ({ rotulo: `Crédito ${f.ate}x`, calc: { bruto: 1000, modalidade: 'credito', parcelas: Number(f.ate) } })),
  ]
  const temAlgumaTaxa = casos.some(c => calcularPagamentoCartao(maquina, c.calc).taxa > 0)
  if (!temAlgumaTaxa) return null

  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5">
      <p className="text-xs font-medium text-slate-600">Confira se digitou certo</p>
      <p className="text-xs text-slate-400 mb-2">
        A taxa é percentual e vale para qualquer valor. Abaixo, o exemplo de uma venda de R$ 1.000:
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {casos.map(({ rotulo, calc }) => {
          const r = calcularPagamentoCartao(maquina, calc)
          if (!(r.taxa > 0)) return null
          return (
            <span key={rotulo} className="text-xs text-slate-600 tabular-nums">
              {rotulo}: <strong className="text-slate-800">{fmt(r.liquido)}</strong>
              <span className="text-red-500"> −{fmt(r.taxa)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Itens que o conferente marca antes de liberar o veículo para o cliente.
// O que já foi conferido guarda o texto do item, então editar aqui não altera
// nenhuma conferência passada.
function ChecklistConferencia() {
  const { config, setConfig } = useApp()
  const [itens, setItens] = useState(null)
  const [salvo, setSalvo] = useState(false)

  const lista = itens ?? itensDoChecklist(config)
  const alterado = itens !== null

  function editar(id, label) {
    setItens(lista.map(i => i.id === id ? { ...i, label } : i))
  }

  function remover(id) {
    const item = lista.find(i => i.id === id)
    if (!confirm(`Remover "${item?.label}" do checklist?\n\nAs conferências já feitas continuam intactas.`)) return
    setItens(lista.filter(i => i.id !== id))
  }

  function adicionar() {
    setItens([...lista, { id: 'item-' + gerarId(), label: '' }])
  }

  function mover(idx, dir) {
    const destino = idx + dir
    if (destino < 0 || destino >= lista.length) return
    const copia = [...lista]
    ;[copia[idx], copia[destino]] = [copia[destino], copia[idx]]
    setItens(copia)
  }

  function restaurar() {
    if (!confirm('Voltar para a lista padrão? Suas alterações neste checklist serão descartadas.')) return
    setItens(CHECKLIST_PADRAO.map(i => ({ ...i })))
  }

  function salvar() {
    const limpos = lista
      .map(i => ({ id: i.id, label: i.label.trim() }))
      .filter(i => i.label)
    if (limpos.length === 0) {
      alert('O checklist precisa ter pelo menos um item.')
      return
    }
    setConfig(c => ({ ...c, checklistConferencia: limpos }))
    setItens(null)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <ShieldCheck size={17} className="text-cyan-500" />Checklist de conferência
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          O conferente marca estes itens antes de liberar o veículo. Nenhum item vem pré-marcado,
          e um item com problema impede a liberação.
        </p>
      </div>

      <div className="p-5 space-y-2">
        {lista.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-5 text-right tabular-nums flex-shrink-0">{idx + 1}</span>
            <input value={item.label} autoFocus={!item.label}
              onChange={e => editar(item.id, e.target.value)}
              placeholder="Descreva o que deve ser conferido..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-0.5 flex-shrink-0">
              <button onClick={() => mover(idx, -1)} disabled={idx === 0} aria-label="Mover para cima"
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronUp size={15} />
              </button>
              <button onClick={() => mover(idx, 1)} disabled={idx === lista.length - 1} aria-label="Mover para baixo"
                className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronDown size={15} />
              </button>
              <button onClick={() => remover(item.id)} aria-label="Remover item"
                className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        <button onClick={adicionar}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-500 py-2.5 rounded-lg text-sm font-medium hover:border-slate-300 hover:text-slate-700 transition-colors">
          <Plus size={15} /> Adicionar item
        </button>

        <div className="flex items-center gap-2 pt-2">
          <button onClick={salvar} disabled={!alterado}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={15} />{salvo ? 'Salvo!' : 'Salvar checklist'}
          </button>
          <button onClick={restaurar}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <RotateCcw size={14} /> Lista padrão
          </button>
          {alterado && (
            <span className="text-xs text-amber-700 flex items-center gap-1 ml-auto">
              <AlertTriangle size={12} /> Não salvo
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

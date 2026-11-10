import { useNavigate } from 'react-router-dom'
import { Search, Plus, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'
import { casaBusca } from '../utils/busca'
import { ordenarPor, proximaOrdem } from '../utils/ordenar'
import {
  SITUACOES_OS, situacaoPorId, naSituacao, posicaoDoStatusOS,
  entradaDaOS, entregaDaOS, dataCurta, intervaloDoPeriodo, noPeriodo, nomeDoPeriodo,
} from '../utils/filtroLista'
import { useFiltrosGuardados } from '../hooks/useFiltrosGuardados'
import { FiltroSituacao, FiltroPeriodo, ThOrdenavel, FaixaOrdem, SeletorOrdem } from '../components/FiltrosDaLista'

export const STATUS_OS = [
  'Recepção', 'Em Diagnóstico', 'Aguardando Aprovação', 'Rejeitada',
  'Aprovado', 'Aguardando Peça', 'Em Execução', 'Em Conferência',
  'Concluída', 'Entregue', 'Cancelada',
]

export const statusColor = {
  'Recepção': 'bg-blue-100 text-blue-700',
  'Em Diagnóstico': 'bg-indigo-100 text-indigo-700',
  'Aguardando Aprovação': 'bg-yellow-100 text-yellow-700',
  'Rejeitada': 'bg-red-100 text-red-700',
  'Aprovado': 'bg-lime-100 text-lime-700',
  'Em Execução': 'bg-orange-100 text-orange-700',
  'Aguardando Peça': 'bg-amber-100 text-amber-700',
  'Em Conferência': 'bg-cyan-100 text-cyan-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Entregue': 'bg-emerald-100 text-emerald-700',
  'Cancelada': 'bg-slate-200 text-slate-600',
  // Compat: status antigos que podem existir em OS já criadas
  'Aberta': 'bg-blue-100 text-blue-700',
  'Diagnóstico': 'bg-indigo-100 text-indigo-700',
  'Aprovada': 'bg-teal-100 text-teal-700',
  'Em Andamento': 'bg-orange-100 text-orange-700',
}

// Duas formas do mesmo número: dentro da coluna de dinheiro o "R$ " some
// (repetido em 40 linhas ele vira ruído, e o cabeçalho já diz o que é);
// no card do celular e no rodapé de totais ele fica, porque ali o número
// aparece sozinho, sem coluna que o explique.
const fmtNum = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (v) => 'R$ ' + fmtNum(v)
// Abrir OS vive em `pages/OrdemCadastro.jsx`, em tela: ficha de abertura nao e
// decisao curta, e o rascunho dela precisa sobreviver a uma atualizacao da
// pagina — coisa que popup nao dava.


// Filtros desta lista. Ficam guardados enquanto a aba estiver aberta: filtrar,
// abrir uma OS e voltar não pode devolver a lista inteira.
const FILTROS_INICIAIS = {
  busca: '', situacao: 'todas', status: 'Todos', mec: 'Todos',
  periodo: 'tudo', de: '', ate: '', campoData: 'entrada',
  ordem: null,   // null = ordem padrão (mexidas por último)
}
const CAMPOS_DATA = [{ id: 'entrada', rotulo: 'entrada' }, { id: 'entrega', rotulo: 'entrega' }]
const ORDEM_PADRAO = 'mexidas por último'

export default function OrdensServico() {
  const { ordens, getCliente, getVeiculo, getFuncionario, funcionarios, totalOrdem } = useApp()
  const navigate = useNavigate()
  const [filtros, mudar] = useFiltrosGuardados('filtros:ordens-servico', FILTROS_INICIAIS)
  const { busca, status: filtroStatus, mec: filtroMec, ordem } = filtros
  const situacao = situacaoPorId(SITUACOES_OS, filtros.situacao)

  // "Pela data de entrega" só faz sentido com um período escolhido; sem
  // período, a coluna e a ordem usam a entrada, como sempre.
  const pelaEntrega = filtros.periodo !== 'tudo' && filtros.campoData === 'entrega'
  const intervalo = intervaloDoPeriodo(filtros)
  const dataDaLinha = (o) => (pelaEntrega ? entregaDaOS(o) : entradaDaOS(o))

  // Tudo menos situação e status: é sobre esta lista que os botões de
  // situação contam quantas OS há em cada uma.
  const base = ordens.filter(o => {
    const cliente = getCliente(o.clienteId)
    const veiculo = getVeiculo(o.veiculoId)
    // Buscar pelo CARRO também: no balcão o cliente é lembrado pelo veículo
    // ("aquele Gol prata"), e quem atende raramente tem a placa na cabeça.
    // `nomeVeiculo` é a mesma função que monta o nome na tela — assim se acha
    // digitando exatamente o que se está lendo, marca ou modelo. A placa acha
    // com ou sem o traço (utils/busca.js).
    if (!casaBusca(busca, [o.id, cliente?.nome, nomeVeiculo(veiculo, o)], [veiculo?.placa, o.veiculoPlaca])) return false
    if (filtroMec === 'sem' ? o.mecanicoId : (filtroMec !== 'Todos' && String(o.mecanicoId) !== filtroMec)) return false
    return noPeriodo(dataDaLinha(o), intervalo)
  })
  const contagem = (s) => (s.status ? base.filter(o => s.status.includes(o.status)).length : base.length)

  const naTela = base
    .filter(o => naSituacao(situacao, o.status) && (filtroStatus === 'Todos' || o.status === filtroStatus))
    .sort((a, b) => {
      // Ordem padrão: mexidas por último. Eventos novos entram no início do
      // histórico — at(0) é o mais recente.
      const tA = a.etapaEm || a.historico?.at(0)?.id || 0
      const tB = b.etapaEm || b.historico?.at(0)?.id || 0
      return tB - tA
    })

  // Colunas que ordenam. 1º clique no sentido mais útil (data: a mais nova;
  // nº e valor: o maior; texto: A→Z), 2º inverte, 3º volta ao padrão.
  const COLS = [
    { campo: 'numero', titulo: 'Nº', tipo: 'numero', vazioNoFim: true, primeira: 'desc', nomes: ['maior primeiro', 'menor primeiro'],
      // Ficha migrada não tem número "#N": vai para o fim.
      valor: o => { const m = String(o.id || '').match(/^#(\d+)$/); return m ? Number(m[1]) : null } },
    { campo: 'cliente', titulo: 'Cliente', tipo: 'texto', nomes: ['A → Z', 'Z → A'], valor: o => getCliente(o.clienteId)?.nome },
    { campo: 'veiculo', titulo: 'Veículo', tipo: 'texto', nomes: ['A → Z', 'Z → A'],
      valor: o => { const n = nomeVeiculo(getVeiculo(o.veiculoId), o); return n === '—' ? '' : n } },
    { campo: 'mecanico', titulo: 'Mecânico', tipo: 'texto', nomes: ['A → Z', 'Z → A'],
      valor: o => (o.mecanicoId ? getFuncionario(o.mecanicoId)?.nome : '') },
    { campo: 'status', titulo: 'Status', tipo: 'numero', vazioNoFim: true, alinha: 'center', nomes: ['na ordem do serviço', 'de trás para frente'],
      valor: o => posicaoDoStatusOS(o.status) },
    { campo: 'valor', titulo: 'Valor', tipo: 'numero', primeira: 'desc', alinha: 'right', nomes: ['maior primeiro', 'menor primeiro'],
      valor: o => totalOrdem(o) },
    { campo: 'data', titulo: 'Data', tipo: 'numero', vazioNoFim: true, primeira: 'desc', nomes: ['mais nova primeiro', 'mais antiga primeiro'],
      valor: dataDaLinha },
  ]
  const tituloDe = (c) => (c.campo === 'data' ? (pelaEntrega ? 'Entrega' : 'Entrada') : c.titulo)
  const colDe = (campo) => COLS.find(c => c.campo === campo)
  const ordenar = (col) => mudar({ ordem: proximaOrdem(ordem, col.campo, col.primeira) })
  const filtradas = ordenarPor(naTela, ordem, Object.fromEntries(COLS.map(c => [c.campo, c])))

  // Números do rodapé. O total é sempre o do que está NA TELA: é filtrando por
  // situação e período que se vê quanto vale cada etapa (quanto está esperando
  // aprovação, quanto foi entregue no mês). Em "Todas" ele soma até cancelada e
  // rejeitada, porque elas continuam na lista — por isso o rodapé diz o filtro.
  const valorFiltradas = filtradas.reduce((s, o) => s + totalOrdem(o), 0)
  const temFiltro = Boolean(busca.trim()) || situacao.id !== 'todas' || filtroStatus !== 'Todos' || filtroMec !== 'Todos' || filtros.periodo !== 'tudo'
  const nomeMec = filtroMec === 'Todos' ? '' : filtroMec === 'sem' ? 'sem mecânico' : funcionarios.find(f => String(f.id) === filtroMec)?.nome
  const nomePeriodo = nomeDoPeriodo(filtros)
  const descricaoFiltro = [
    situacao.status ? situacao.rotulo : '',
    filtroStatus !== 'Todos' ? filtroStatus : '',
    nomeMec,
    nomePeriodo && nomePeriodo + (pelaEntrega ? ' (pela entrega)' : ''),
  ].filter(Boolean).join(' · ')
  const statusDaSituacao = situacao.status ? STATUS_OS.filter(s => situacao.status.includes(s)) : STATUS_OS

  // Limpa o que esconde OS; a ordem escolhida fica.
  const limpar = () => mudar({ busca: '', situacao: 'todas', status: 'Todos', mec: 'Todos', periodo: 'tudo', de: '', ate: '', campoData: 'entrada' })
  const abrir = (o) => navigate(`/ordens-servico/${encodeURIComponent(o.id)}`)
  const SELECT = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço</h2>
        <button onClick={() => navigate('/ordens-servico/nova')} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova OS
        </button>
      </div>

      {/* filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por número, cliente, placa ou carro..." value={busca} onChange={e => mudar({ busca: e.target.value })}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <FiltroSituacao situacoes={SITUACOES_OS} valor={situacao.id} contagem={contagem}
          onMudar={id => mudar({ situacao: id, status: 'Todos' })} />
        <FiltroPeriodo filtros={filtros} onMudar={mudar} campos={CAMPOS_DATA} />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="hidden md:block text-[11px] font-bold uppercase text-slate-400 w-16 flex-shrink-0">Mais</span>
          <select value={filtroStatus} onChange={e => mudar({ status: e.target.value })} className={SELECT}>
            <option value="Todos">{situacao.status ? 'Todos os status desta situação' : 'Todos os status'}</option>
            {statusDaSituacao.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filtroMec} onChange={e => mudar({ mec: e.target.value })} className={SELECT}>
            <option value="Todos">Todos os mecânicos</option>
            {funcionarios.map(f => <option key={f.id} value={String(f.id)}>{f.nome}</option>)}
            <option value="sem">Sem mecânico</option>
          </select>
          <SeletorOrdem cols={COLS} ordem={ordem} padrao={ORDEM_PADRAO} tituloDe={tituloDe}
            onEscolher={o => mudar({ ordem: o })} className="md:hidden" />
          {temFiltro && (
            <button type="button" onClick={limpar} className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
              <X size={13} />Limpar filtros
            </button>
          )}
        </div>
      </div>

      <FaixaOrdem cols={COLS} ordem={ordem} padrao={ORDEM_PADRAO} tituloDe={tituloDe} onVoltar={() => mudar({ ordem: null })} />

      {/* Cards — mobile */}
      <div className="space-y-3 md:hidden">
        {filtradas.length === 0 && <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-slate-100">Nenhuma OS encontrada.</p>}
        {filtradas.map(o => {
          const cliente = getCliente(o.clienteId)
          const veiculo = getVeiculo(o.veiculoId)
          const total = totalOrdem(o)
          const mecanico = o.mecanicoId ? getFuncionario(o.mecanicoId) : null
          return (
            <div key={o.id} onClick={() => abrir(o)} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-semibold text-slate-700">{o.id}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusColor[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{cliente?.nome || '—'}</p>
              {veiculo && <p className="text-sm text-slate-500 mt-0.5">{veiculo.placa} · {nomeVeiculo(veiculo, o)}{mecanico?.nome ? ` · ${mecanico.nome}` : ''}</p>}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">{dataCurta(dataDaLinha(o)) || '—'}</span>
                <span className="text-sm font-bold text-slate-700">{total > 0 ? fmt(total) : '—'}</span>
              </div>
            </div>
          )
        })}
        {filtradas.length > 0 && (
          <p className="text-xs text-slate-500 px-1">
            {filtradas.length} {filtradas.length === 1 ? 'ordem' : 'ordens'}{temFiltro && ` (de ${ordens.length})`} · {fmt(valorFiltradas)}
          </p>
        )}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <ThOrdenavel col={colDe('numero')} ordem={ordem} onOrdenar={ordenar} />
              <ThOrdenavel col={colDe('cliente')} ordem={ordem} onOrdenar={ordenar} />
              <ThOrdenavel col={colDe('veiculo')} ordem={ordem} onOrdenar={ordenar} />
              {/* Quem está com o carro já está gravado na OS e nesta tela até se
                  filtra por ele — mas só aparecia depois de abrir a ordem. Na
                  lista, é o que responde "quem pega esse aí?" sem entrar em nada. */}
              <ThOrdenavel col={colDe('mecanico')} ordem={ordem} onOrdenar={ordenar} className="hidden lg:table-cell" />
              <ThOrdenavel col={colDe('status')} ordem={ordem} onOrdenar={ordenar} />
              <ThOrdenavel col={colDe('valor')} ordem={ordem} onOrdenar={ordenar} />
              <ThOrdenavel col={colDe('data')} ordem={ordem} onOrdenar={ordenar} titulo={tituloDe(colDe('data'))} />
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtradas.map(o => {
              const cliente = getCliente(o.clienteId)
              const veiculo = getVeiculo(o.veiculoId)
              const total = totalOrdem(o)
              const mecanico = o.mecanicoId ? getFuncionario(o.mecanicoId) : null
              return (
                <tr key={o.id} onClick={() => abrir(o)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 text-sm font-mono font-medium text-slate-700">{o.id}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{cliente?.nome || '—'}</td>
                  {/* `nomeVeiculo` e nao `veiculo.modelo`: o cadastro quebra o
                      que a recepcao digitou num campo so ("VOLKSWAGEN GOL G5")
                      em marca + modelo, e mostrar so o modelo deixava a coluna
                      dizendo "G5". Buscar por "gol" achava a OS e a linha nao
                      parecia ter nada com Gol. Agora a busca e a tela leem o
                      mesmo texto. */}
                  <td className="px-5 py-3.5 text-sm text-slate-600">{veiculo ? `${veiculo.placa} ${nomeVeiculo(veiculo, o)}` : '—'}</td>
                  {/* OS sem mecânico é traço apagado, e não vazio: assim a coluna
                      mostra na hora quais ainda não têm dono. */}
                  <td className="hidden lg:table-cell px-5 py-3.5 text-sm text-slate-600">{mecanico?.nome || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700 tabular-nums">{total > 0 ? fmtNum(total) : <span className="text-slate-300">—</span>}</td>
                  {/* A data da entrada (ou da entrega, quando o período filtra
                      por ela) — a mesma que o filtro e a ordem usam. */}
                  <td className="px-5 py-3.5 text-sm text-slate-500 tabular-nums">{dataCurta(dataDaLinha(o)) || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); abrir(o) }} className="text-xs text-primary-500 hover:text-primary-600 font-medium">Abrir</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtradas.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400">Nenhuma OS encontrada.</p>
            {temFiltro && <button type="button" onClick={limpar} className="mt-2 text-xs font-semibold text-primary-600 hover:underline">Limpar filtros</button>}
          </div>
        )}
        {/* Rodapé de sistema: quantas ordens a lista está mostrando e quanto
            elas somam. O "(de N)" existe para ninguém ler o total do filtro
            achando que é o total da oficina. */}
        {filtradas.length > 0 && (
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {filtradas.length} {filtradas.length === 1 ? 'ordem' : 'ordens'}
              {temFiltro && ` (de ${ordens.length})`}
              {descricaoFiltro && <span className="ml-2">· {descricaoFiltro}</span>}
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              <span>Valor somado: <strong className="font-medium">{fmt(valorFiltradas)}</strong></span>
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

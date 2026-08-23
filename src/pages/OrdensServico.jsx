import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { nomeVeiculo } from '../utils/datas'

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

export default function OrdensServico() {
  const { ordens, getCliente, getVeiculo, getFuncionario, funcionarios, totalOrdem } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroMec, setFiltroMec] = useState('Todos')

  const filtradas = ordens.filter(o => {
    const cliente = getCliente(o.clienteId)
    const veiculo = getVeiculo(o.veiculoId)
    const termo = busca.toLowerCase()
    // Buscar pelo CARRO também: no balcão o cliente é lembrado pelo veículo
    // ("aquele Gol prata"), e quem atende raramente tem a placa na cabeça.
    // `nomeVeiculo` é a mesma função que monta o nome na tela — assim se acha
    // digitando exatamente o que se está lendo, marca ou modelo.
    const carro = nomeVeiculo(veiculo, o).toLowerCase()
    const matchBusca = o.id.toLowerCase().includes(termo)
      || (cliente?.nome || '').toLowerCase().includes(termo)
      || (veiculo?.placa || '').toLowerCase().includes(termo)
      || carro.includes(termo)
    const matchStatus = filtroStatus === 'Todos' || o.status === filtroStatus
    const matchMec = filtroMec === 'Todos' || String(o.mecanicoId) === filtroMec
    return matchBusca && matchStatus && matchMec
  }).sort((a, b) => {
    // Eventos novos entram no início do histórico — at(0) é o mais recente.
    const tA = a.etapaEm || a.historico?.at(0)?.id || 0
    const tB = b.etapaEm || b.historico?.at(0)?.id || 0
    return tB - tA
  })

  // Números do rodapé. O total é sempre o do que está NA TELA: é filtrando por
  // status que se vê quanto vale cada etapa (quanto está esperando aprovação,
  // quanto já foi entregue). Em "Todos" ele soma até cancelada e rejeitada,
  // porque elas continuam na lista — por isso o rodapé mostra o filtro junto.
  const valorFiltradas = filtradas.reduce((s, o) => s + totalOrdem(o), 0)
  const temFiltro = Boolean(busca.trim()) || filtroStatus !== 'Todos' || filtroMec !== 'Todos'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço</h2>
        <button onClick={() => navigate('/ordens-servico/nova')} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova OS
        </button>
      </div>

      {/* filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por número, cliente, placa ou carro..." value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="Todos">Todos</option>
          {STATUS_OS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroMec} onChange={e => setFiltroMec(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="Todos">Todos os mecânicos</option>
          {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* Cards — mobile */}
      <div className="space-y-3 md:hidden">
        {filtradas.length === 0 && <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-slate-100">Nenhuma OS encontrada.</p>}
        {filtradas.map(o => {
          const cliente = getCliente(o.clienteId)
          const veiculo = getVeiculo(o.veiculoId)
          const total = totalOrdem(o)
          return (
            <div key={o.id} onClick={() => navigate(`/ordens-servico/${encodeURIComponent(o.id)}`)} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 cursor-pointer active:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-semibold text-slate-700">{o.id}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusColor[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">{cliente?.nome || '—'}</p>
              {veiculo && <p className="text-sm text-slate-500 mt-0.5">{veiculo.placa} · {nomeVeiculo(veiculo, o)}</p>}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">{o.data}</span>
                <span className="text-sm font-bold text-slate-700">{total > 0 ? fmt(total) : '—'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nº</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
              {/* Quem está com o carro já está gravado na OS e nesta tela até se
                  filtra por ele — mas só aparecia depois de abrir a ordem. Na
                  lista, é o que responde "quem pega esse aí?" sem entrar em nada. */}
              <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mecânico</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
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
                <tr key={o.id} onClick={() => navigate(`/ordens-servico/${encodeURIComponent(o.id)}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
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
                  <td className="px-5 py-3.5 text-sm text-slate-500">{o.data}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/ordens-servico/${encodeURIComponent(o.id)}`) }} className="text-xs text-primary-500 hover:text-primary-600 font-medium">Abrir</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Nenhuma OS encontrada.</p>}
        {/* Rodapé de sistema: quantas ordens a lista está mostrando e quanto
            elas somam. O "(de N)" existe para ninguém ler o total do filtro
            achando que é o total da oficina. */}
        {filtradas.length > 0 && (
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {filtradas.length} {filtradas.length === 1 ? 'ordem' : 'ordens'}
              {temFiltro && ` (de ${ordens.length})`}
              {filtroStatus !== 'Todos' && <span className="ml-2">· {filtroStatus}</span>}
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

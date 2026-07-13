import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderOpen, Search, Car, User, Clock, FileText,
  Trash2, PenLine, CheckCircle2, AlertTriangle, Wrench
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

const STATUS_CONFIG = {
  'Aguardando diagnóstico': { cor: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  'Em diagnóstico':         { cor: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  'Diagnóstico concluído':  { cor: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
}

// Ícone SVG do WhatsApp (igual ao original)
function WaIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="14" height="14">
      <path fill="#fff" d="M16 3C9.373 3 4 8.373 4 15c0 2.646.86 5.1 2.33 7.11L4 29l7.14-2.28A12.93 12.93 0 0 0 16 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 22c-1.98 0-3.84-.52-5.44-1.43l-.39-.23-4.24 1.36 1.39-4.13-.25-.4A9.94 9.94 0 0 1 6 15c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10zm5.27-7.29c-.29-.15-1.71-.84-1.97-.94-.26-.1-.45-.15-.64.14-.19.28-.74.94-.91 1.13-.17.19-.33.21-.61.08-.29-.14-1.23-.45-2.34-1.43-.86-.77-1.44-1.72-1.61-2-.17-.28-.02-.43.13-.57.13-.13.29-.34.43-.51.14-.17.18-.29.28-.48.09-.19.05-.36-.02-.51-.07-.15-.62-1.5-.85-2.06-.22-.53-.45-.46-.62-.47-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.36-.26.29-.99.97-.99 2.36 0 1.39 1.02 2.73 1.16 2.92.14.19 2.01 3.08 4.86 4.2.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.11.55-.08 1.68-.67 1.92-1.32.24-.65.24-1.21.17-1.33-.07-.12-.26-.19-.54-.33z" />
    </svg>
  )
}

// Formata placa para busca (ABC-1234)
function formatPlacaBusca(v) {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length <= 3) return raw
  return raw.slice(0, 3) + '-' + raw.slice(3, 7)
}

export default function ChecklistGerenciar() {
  const { checklists, setChecklists, carregando } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [busca, setBusca] = useState('')
  const [modoBusca, setModoBusca] = useState('placa')
  const [confirmarExcluir, setConfirmarExcluir] = useState(null)

  const isAdmin = currentUser?.perfil === 'admin'

  function handleBusca(e) {
    let val = e.target.value
    if (modoBusca === 'placa') val = formatPlacaBusca(val)
    setBusca(val)
  }

  function filtrar(lista) {
    if (!busca.trim()) return lista
    const q = busca.toLowerCase()
    return lista.filter(c =>
      modoBusca === 'placa'
        ? c.veiculoPlaca?.toLowerCase().includes(q)
        : c.clienteNome?.toLowerCase().includes(q)
    )
  }

  function excluir(id) {
    setChecklists(prev => prev.filter(c => c.id !== id))
    setConfirmarExcluir(null)
  }

  const ordenado = [...checklists].sort((a, b) => b.id - a.id)
  const pendentes  = filtrar(ordenado.filter(c => c.status !== 'Diagnóstico concluído'))
  const concluidos = filtrar(ordenado.filter(c => c.status === 'Diagnóstico concluído'))

  // Card de ficha pendente (completo igual ao original)
  function CardPendente({ ck }) {
    const cfg = STATUS_CONFIG[ck.status] || STATUS_CONFIG['Aguardando diagnóstico']
    const fones = [ck.clienteTelefone, ck.clienteTelefone2].filter(Boolean)

    return (
      <div className="relative bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-all">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Modelo + Ano */}
            <h3 className="font-bold text-slate-800 text-base leading-tight">
              {ck.veiculoModelo || '—'}
              {ck.veiculoAno && (
                <span className="text-slate-400 text-sm font-normal ml-1.5">({ck.veiculoAno})</span>
              )}
            </h3>

            {/* Nome do cliente */}
            <p className="font-bold text-slate-700 text-sm mt-1">{ck.clienteNome || '—'}</p>

            {/* Telefones com botão WhatsApp (igual ao original) */}
            <div className="flex flex-col gap-1 mt-1">
              {fones.map((fone, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">{fone}</span>
                  <a
                    href={`https://wa.me/55${fone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Conversar no WhatsApp"
                    className="inline-flex items-center px-2 py-0.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors gap-1">
                    <WaIcon /> WhatsApp
                  </a>
                </div>
              ))}
            </div>

            {/* Linha de infos (OS, Atendente, Placa, Data) */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <FileText size={11} /> {ck.numero || 'N/A'}
              </span>
              {ck.atendente && (
                <span className="flex items-center gap-1">
                  <User size={11} /> Recepção: {ck.atendente}
                </span>
              )}
              {ck.veiculoPlaca && (
                <span className="flex items-center gap-1 font-mono font-semibold text-slate-500">
                  <Car size={11} /> {ck.veiculoPlaca}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={11} /> {ck.criadoEm}
              </span>
            </div>

            {/* Reparador (igual ao original) */}
            {ck.tecnicoNome && (
              <div className="mt-2">
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded">
                  🔧 Reparador: {ck.tecnicoNome}
                </span>
              </div>
            )}
          </div>

          {/* Status badge + ações */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {ck.status}
            </span>

            <div className="flex items-center gap-1 mt-1">
              {/* Editar entrada (wizard) */}
              <button
                onClick={() => navigate('/checklist/novo', { state: { editar: ck } })}
                title="Editar entrada"
                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                <PenLine size={14} />
              </button>

              {/* Ver OS */}
              {ck.osId && (
                <button
                  onClick={() => navigate(`/ordens-servico/${encodeURIComponent(ck.osId)}`)}
                  title="Ver OS"
                  className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                  <FileText size={14} />
                </button>
              )}

              {/* Excluir (admin) */}
              {isAdmin && (
                <button
                  onClick={() => setConfirmarExcluir(ck.id)}
                  title="Excluir ficha"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Card compacto para histórico de concluídos
  function CardConcluido({ ck }) {
    const fones = [ck.clienteTelefone, ck.clienteTelefone2].filter(Boolean)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-slate-700 text-sm block">
            {ck.veiculoModelo}
            {ck.veiculoPlaca && <span className="font-mono font-normal text-slate-400 ml-1.5">— {ck.veiculoPlaca}</span>}
          </span>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-slate-500 text-xs">{ck.clienteNome}</span>
            {fones.map((fone, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-slate-400 text-xs">{fone}</span>
                <a
                  href={`https://wa.me/55${fone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white text-[10px] rounded gap-1">
                  <WaIcon />
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => navigate('/checklist/novo', { state: { editar: ck } })}
            title="Editar"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">
            Editar / Ver
          </button>
          {ck.osId && (
            <button
              onClick={() => navigate(`/ordens-servico/${encodeURIComponent(ck.osId)}`)}
              title="Ver OS"
              className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 px-2.5 py-1 rounded-lg transition-colors">
              OS
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setConfirmarExcluir(ck.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando fichas...</p>
    </div>
  )

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Gerenciar / Editar Fichas</h2>
        <p className="text-sm text-slate-500 mt-0.5">{checklists.length} ficha(s) cadastrada(s)</p>
      </div>

      {/* Busca — com máscara de placa (igual ao original) */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {[
            { key: 'placa', label: 'Buscar por Placa' },
            { key: 'nome',  label: 'Buscar por Nome' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => { setModoBusca(key); setBusca('') }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                modoBusca === key ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={modoBusca === 'placa' ? 'ABC-1234...' : 'Nome do cliente...'}
            value={busca}
            onChange={handleBusca}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
      </div>

      {/* ── Pendentes / Em andamento ── */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
          <Wrench size={14} className="text-amber-500" />
          Veículos na Fila ({pendentes.length})
        </h3>

        {pendentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <FolderOpen size={30} className="text-slate-300 mb-2" />
            <p className="text-slate-500 font-medium text-sm">
              {busca ? 'Nenhum veículo encontrado com este filtro.' : 'Nenhum veículo na fila de espera.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendentes.map(ck => <CardPendente key={ck.id} ck={ck} />)}
          </div>
        )}
      </div>

      {/* ── Histórico (Concluídos) — opacidade reduzida, igual ao original ── */}
      {concluidos.length > 0 && (
        <div className="opacity-60 mt-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} /> Histórico Recente (Concluídos) ({concluidos.length})
          </h3>
          <div className="space-y-2">
            {concluidos.map(ck => <CardConcluido key={ck.id} ck={ck} />)}
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmarExcluir && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Excluir ficha?</p>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarExcluir(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => excluir(confirmarExcluir)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

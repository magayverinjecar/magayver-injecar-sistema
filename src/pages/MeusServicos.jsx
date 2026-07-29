import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, User, Clock, Wrench, Stethoscope, Play, CheckCircle2,
  Package, ClipboardCheck, Inbox, ShieldCheck, Camera, PackageCheck,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { momentoEntrada, nomeVeiculo } from '../utils/datas'

function rotuloTempo(ts) {
  if (!ts) return ''
  const h = (Date.now() - ts) / 3600000
  if (h < 1) return `há ${Math.max(1, Math.round(h * 60))} min`
  if (h < 24) return `há ${Math.round(h)}h`
  return `há ${Math.round(h / 24)} dia(s)`
}

export default function MeusServicos() {
  const {
    ordens, getCliente, getVeiculo, carregando,
    iniciarDiagnostico, iniciarReparo, concluirReparo, marcarAguardandoPeca, pecaChegou,
  } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [ocupado, setOcupado] = useState(null)

  const meuId = currentUser?.id
  const meuNome = currentUser?.nome || 'você'

  function enriquecer(o) {
    const veic = getVeiculo(o.veiculoId)
    const cli = getCliente(o.clienteId)
    // `etapaEm` ficou igual em todas as OS antigas depois da migração; o tempo
    // e a ordem saem do momento real de entrada.
    const entrouEm = momentoEntrada(o)
    return {
      ...o,
      placa: veic?.placa || o.veiculoPlaca || '',
      modelo: nomeVeiculo(veic, o),
      cliente: cli?.nome || o.clienteNome || '—',
      entrouEm,
      tempo: rotuloTempo(entrouEm),
    }
  }

  // Último a entrar primeiro, igual às outras telas da oficina
  const maisRecentePrimeiro = (a, b) => b.entrouEm - a.entrouEm

  const ativas = ordens.filter(o => !o.retirado && !['Entregue', 'Cancelada'].includes(o.status))

  // Carros que estão comigo agora. "Em Conferência" entra aqui porque quem
  // reparou é quem confere — sem isso o carro sumia da tela dele e travava.
  const comigo = ativas
    .filter(o => o.responsavelId != null && o.responsavelId === meuId)
    .filter(o => ['Em Diagnóstico', 'Em Execução', 'Em Conferência'].includes(o.status))
    .map(enriquecer)
    .sort(maisRecentePrimeiro)

  // Carros parados esperando alguém assumir
  const livres = ativas
    .filter(o => ['Recepção', 'Aprovado'].includes(o.status))
    .map(enriquecer)
    .sort(maisRecentePrimeiro)

  // Peças pedidas: as minhas e também as de carro sem dono — se a peça foi
  // pedida antes de alguém assumir, ninguém veria o veículo voltar.
  const esperandoPeca = ativas
    .filter(o => o.status === 'Aguardando Peça')
    .filter(o => o.responsavelId == null || o.responsavelId === meuId)
    .map(enriquecer)
    .sort(maisRecentePrimeiro)

  function agir(id, fn, pergunta) {
    if (ocupado) return
    if (pergunta && !confirm(pergunta)) return
    setOcupado(id)
    fn()
    setTimeout(() => setOcupado(null), 800)
  }

  // O reparador não precisa (nem deve) passar pela OS: a tela de diagnóstico
  // já traz veículo, relato do cliente e o checklist técnico.
  function abrir(os) {
    navigate(`/oficina/diagnostico/${encodeURIComponent(os.id)}`)
  }

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando seus serviços...</p>
    </div>
  )

  function Cabecalho({ os }) {
    return (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold text-slate-700">{os.placa || os.id}</span>
          <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
            <Clock size={11} /> {os.tempo}
          </span>
        </div>
        <p className="text-sm text-slate-700 mt-1 flex items-center gap-1.5">
          <Car size={13} className="text-slate-400 flex-shrink-0" />
          <span className="truncate">{os.modelo}</span>
        </p>
        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
          <User size={11} className="flex-shrink-0" />
          <span className="truncate">{os.cliente}</span>
        </p>
        {os.descricaoProblema && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{os.descricaoProblema}</p>
        )}
      </>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Meus serviços</h2>
          <p className="text-sm text-slate-500 mt-0.5">{meuNome}</p>
        </div>
        <span className="text-sm text-slate-500 flex items-center gap-1.5">
          <Wrench size={15} /> {comigo.length} em andamento
        </span>
      </div>

      {/* ── Livres para pegar ── */}
      <section>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
          Livres para pegar
        </h3>
        {livres.length === 0 ? (
          <p className="text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl py-6 text-center">
            Nenhum veículo esperando
          </p>
        ) : (
          <div className="space-y-2">
            {livres.map(os => {
              const paraDiagnostico = os.status === 'Recepção'
              return (
                <div key={os.id} onClick={() => abrir(os)}
                  className="bg-white border border-amber-200 rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-all">
                  <Cabecalho os={os} />
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      agir(os.id,
                        () => paraDiagnostico ? iniciarDiagnostico(os.id) : iniciarReparo(os.id),
                        `${paraDiagnostico ? 'Iniciar o diagnóstico' : 'Iniciar o reparo'} de ${os.placa || os.modelo}?\n\nVai ficar registrado como ${meuNome}.`)
                    }}
                    disabled={ocupado === os.id}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                    {paraDiagnostico ? <><Stethoscope size={15} /> Vou diagnosticar</> : <><Play size={15} /> Iniciar reparo</>}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Comigo agora ── */}
      <section>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
          Comigo agora
        </h3>
        {comigo.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <Inbox size={26} className="text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Você não está com nenhum veículo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comigo.map(os => {
              const emDiagnostico = os.status === 'Em Diagnóstico'
              const emConferencia = os.status === 'Em Conferência'
              return (
                <div key={os.id} onClick={() => abrir(os)}
                  className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-all ${
                    emConferencia ? 'border-cyan-300 ring-1 ring-cyan-200' : 'border-slate-300'
                  }`}>
                  {emConferencia && (
                    <p className="text-[10px] font-bold text-cyan-700 uppercase tracking-wide mb-1.5">Falta conferir antes de entregar</p>
                  )}
                  <Cabecalho os={os} />
                  {emConferencia ? (
                    <button onClick={e => { e.stopPropagation(); navigate(`/conferencia/${encodeURIComponent(os.id)}`) }}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                      <ShieldCheck size={15} /> Conferir veículo
                    </button>
                  ) : emDiagnostico ? (
                    <button onClick={e => { e.stopPropagation(); abrir(os) }}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                      <ClipboardCheck size={15} /> Continuar diagnóstico
                    </button>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          agir(os.id, () => concluirReparo(os.id),
                            `Concluir o reparo de ${os.placa || os.modelo}?\n\nO veículo vai para conferência.`)
                        }}
                        disabled={ocupado === os.id}
                        className="flex-[2] flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                        <CheckCircle2 size={15} /> Reparo concluído
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const peca = prompt('Qual peça está faltando?')
                          if (peca === null) return
                          agir(os.id, () => marcarAguardandoPeca(os.id, peca))
                        }}
                        disabled={ocupado === os.id}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors">
                        <Package size={15} /> Peça
                      </button>
                    </div>
                  )}
                  {['Em Execução', 'Em Conferência'].includes(os.status) && (
                    <button onClick={e => { e.stopPropagation(); navigate(`/oficina/reparo/${encodeURIComponent(os.id)}`) }}
                      className="mt-2 w-full flex items-center justify-center gap-2 border border-orange-200 text-orange-700 text-sm font-medium py-2.5 rounded-xl hover:bg-orange-50 transition-colors">
                      <Camera size={15} /> Fotos do reparo
                      {os.fotos?.some(f => f.momento === 'reparo') && (
                        <span className="text-xs bg-orange-100 px-1.5 rounded-full">
                          {os.fotos.filter(f => f.momento === 'reparo').length}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Esperando peça ── */}
      {esperandoPeca.length > 0 && (
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
            Esperando peça
          </h3>
          <div className="space-y-2">
            {esperandoPeca.map(os => (
              <div key={os.id} onClick={() => abrir(os)}
                className="bg-white border border-red-200 rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-all">
                <Cabecalho os={os} />
                {os.motivoPeca && (
                  <p className="mt-2 text-xs text-red-700 bg-red-50 px-2.5 py-1.5 rounded-lg">{os.motivoPeca}</p>
                )}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    agir(os.id, () => pecaChegou(os.id),
                      `A peça de ${os.placa || os.modelo} chegou?\n\nO veículo volta para o reparo.`)
                  }}
                  disabled={ocupado === os.id}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                  <PackageCheck size={15} /> A peça chegou
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, User, Clock, Wrench, Stethoscope, Play, CheckCircle2,
  Package, ClipboardCheck, ShieldCheck, Camera, PackageCheck, Search, X,
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
    iniciarDiagnostico, iniciarReparo, concluirReparo, marcarAguardandoPeca, pecaChegou, assumirServico,
  } = useApp()
  const { currentUser, temPermissao } = useAuth()
  const navigate = useNavigate()
  const [ocupado, setOcupado] = useState(null)
  const [verTodosFinalizados, setVerTodosFinalizados] = useState(false)
  const [abaEscolhida, setAbaEscolhida] = useState(null)
  const [busca, setBusca] = useState('')

  // Só quem tem a tela de fotos liberada vê o atalho — senão o botão levava
  // direto para a parede de "sem permissão".
  const podeFotografar = temPermissao('checklist-fotos')
  const irParaFotos = os => navigate(`/oficina/reparo/${encodeURIComponent(os.id)}`)
  const quemFez = os => os.reparadorNome || os.responsavelNome || os.tecnicoNome || ''

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

  // "Em Conferência" conta como trabalho em andamento porque quem reparou é
  // quem confere — sem isso o carro sumia da tela dele e travava.
  const EM_TRABALHO = ['Em Diagnóstico', 'Em Execução', 'Em Conferência']

  const comigo = ativas
    .filter(o => EM_TRABALHO.includes(o.status) && o.responsavelId != null && o.responsavelId === meuId)
    .map(enriquecer)
    .sort(maisRecentePrimeiro)

  // Tudo que está em andamento e não é meu. Inclui de propósito os carros sem
  // responsável: as fichas antigas vieram da migração em "Em Diagnóstico" sem
  // dono e não apareciam em tela nenhuma — 25 veículos invisíveis para todos.
  const emAndamento = ativas
    .filter(o => EM_TRABALHO.includes(o.status) && o.responsavelId !== meuId)
    .map(enriquecer)
    .sort(maisRecentePrimeiro)

  // Serviços já fechados. Servem para consulta e, principalmente, para anexar a
  // foto da peça velha que alguém esqueceu de tirar antes de entregar o carro.
  // São mais de cem: mostra as últimas e abre o resto sob demanda.
  const maisRecenteFechado = (a, b) => (b.etapaEm || b.entrouEm) - (a.etapaEm || a.entrouEm)

  // "Concluída" é carro pronto ainda no pátio, "Entregue" já saiu — separados
  // porque um ainda ocupa vaga e o outro é só consulta.
  const prontos = ordens.filter(o => o.status === 'Concluída').map(enriquecer).sort(maisRecenteFechado)
  const entregues = ordens.filter(o => o.status === 'Entregue').map(enriquecer).sort(maisRecenteFechado)

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

  // Busca casada com placa, modelo, cliente e número da OS. Ignora acento,
  // hífen e espaço para "abc1234" achar "ABC-1234" e "JOAO" achar "João".
  const SEM_ACENTO = /[̀-ͯ]/g
  const limpar = s => String(s || '')
    .normalize('NFD').replace(SEM_ACENTO, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
  const termo = limpar(busca)
  const filtrar = lista => termo
    ? lista.filter(o => limpar(`${o.placa} ${o.modelo} ${o.cliente} ${o.id}`).includes(termo))
    : lista

  // Empilhar tudo numa página só obrigava a rolar até o fim para achar um carro
  // finalizado. Cada grupo vira uma aba com a contagem à mostra.
  const GRUPOS = [
    { id: 'comigo',   label: 'Comigo',        lista: filtrar(comigo) },
    { id: 'andamento', label: 'Em andamento', lista: filtrar(emAndamento) },
    { id: 'livres',   label: 'Livres',        lista: filtrar(livres) },
    { id: 'peca',     label: 'Esperando peça', lista: filtrar(esperandoPeca) },
    { id: 'prontos',  label: 'Prontos',       lista: filtrar(prontos) },
    { id: 'entregues', label: 'Entregues',    lista: filtrar(entregues) },
  ]
  const comResultado = GRUPOS.find(g => g.lista.length > 0)
  const escolhido = GRUPOS.find(g => g.id === abaEscolhida)
  // Abre no primeiro grupo que tem carro, para a tela nunca nascer vazia. Durante
  // a busca pula sozinho para a aba onde o carro está — senão a pessoa digitava a
  // placa certa e via "nenhum resultado" só por estar na aba errada.
  const grupo = (escolhido?.lista.length ? escolhido : null)
    || (termo ? comResultado : null)
    || escolhido
    || comResultado
    || GRUPOS[0]
  const abaAtual = grupo.id
  const totalEncontrado = GRUPOS.reduce((s, g) => s + g.lista.length, 0)

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
    <div className="p-4 md:p-6 max-w-xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Serviços</h2>
          <p className="text-sm text-slate-500 mt-0.5">{meuNome}</p>
        </div>
        <span className="text-sm text-slate-500 flex items-center gap-1.5">
          <Wrench size={15} /> {comigo.length} em andamento
        </span>
      </div>

      {/* Uma busca só, casada com placa, modelo, cliente e número da OS */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por placa, carro, cliente ou nº da OS"
          aria-label="Buscar veículo"
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {busca && (
          <button onClick={() => setBusca('')} aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        )}
      </div>

      {termo && (
        <p className="text-xs text-slate-500 -mt-2">
          {totalEncontrado === 0
            ? <span className="text-slate-400">Nenhum veículo encontrado para "{busca}"</span>
            : <>{totalEncontrado} veículo(s) encontrado(s) — mostrando os de <strong>{grupo.label}</strong></>}
        </p>
      )}

      {/* Menu das abas — rola na horizontal no celular */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {GRUPOS.map(g => (
          <button key={g.id} onClick={() => { setAbaEscolhida(g.id); setVerTodosFinalizados(false) }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 border transition-colors ${
              abaAtual === g.id
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            {g.label}
            <span className={`text-xs px-1.5 rounded-full ${abaAtual === g.id ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>
              {g.lista.length}
            </span>
          </button>
        ))}
      </div>

      {grupo.lista.length === 0 && (
        <p className="text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl py-10 text-center">
          Nenhum veículo em "{grupo.label}"
        </p>
      )}

      {/* ── Em andamento na oficina ── */}
      {abaAtual === 'andamento' && (
        <div className="space-y-2">
          {grupo.lista.map(os => {
            const semDono = os.responsavelId == null
            return (
              <div key={os.id} onClick={() => abrir(os)}
                className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-all ${semDono ? 'border-slate-300' : 'border-slate-200'}`}>
                <Cabecalho os={os} />
                <p className="mt-2 text-xs flex items-center gap-1.5">
                  <Wrench size={12} className="text-slate-400 flex-shrink-0" />
                  {semDono
                    ? <span className="text-slate-400">Sem responsável · {os.status}</span>
                    : <span className="text-slate-600">{os.responsavelNome} · {os.status}</span>}
                </p>
                {/* Carro em andamento sem dono ficava parado sem ninguém poder
                    tocar: aqui qualquer reparador consegue assumir. */}
                {semDono && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      agir(os.id, () => assumirServico(os.id),
                        `Assumir ${os.placa || os.modelo}?\n\nVai ficar registrado como ${meuNome}.`)
                    }}
                    disabled={ocupado === os.id}
                    className="mt-3 w-full flex items-center justify-center gap-2 border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 text-sm font-semibold py-2.5 rounded-xl transition-colors">
                    <Play size={15} /> Assumir este veículo
                  </button>
                )}
                {/* Fotografar a peça não é privilégio de quem está com o carro:
                    quem estiver na bancada na hora precisa conseguir registrar. */}
                {podeFotografar && (
                  <button onClick={e => { e.stopPropagation(); irParaFotos(os) }}
                    className="mt-2 w-full flex items-center justify-center gap-2 border border-orange-200 text-orange-700 hover:bg-orange-50 text-sm font-medium py-2.5 rounded-xl transition-colors">
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

      {/* ── Livres para pegar ── */}
      {abaAtual === 'livres' && (
          <div className="space-y-2">
            {grupo.lista.map(os => {
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

      {/* ── Comigo agora ── */}
      {abaAtual === 'comigo' && (
          <div className="space-y-2">
            {grupo.lista.map(os => {
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

      {/* ── Esperando peça ── */}
      {abaAtual === 'peca' && (
          <div className="space-y-2">
            {grupo.lista.map(os => (
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
      )}

      {/* ── Prontos e Entregues: mesma carta, só muda a lista da aba ── */}
      {(abaAtual === 'prontos' || abaAtual === 'entregues') && (
        <>
          <div className="space-y-2">
            {(verTodosFinalizados ? grupo.lista : grupo.lista.slice(0, 10)).map(os => {
              const autor = quemFez(os)
              const fotosReparo = (os.fotos || []).filter(f => f.momento === 'reparo').length
              return (
                <div key={os.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <Cabecalho os={os} />
                  <p className="mt-2 text-xs flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      os.status === 'Entregue' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'
                    }`}>{os.status}</span>
                    {autor
                      ? <span className="text-slate-600 flex items-center gap-1"><Wrench size={11} />{autor}</span>
                      : <span className="text-slate-400">sem reparador registrado</span>}
                  </p>
                  {podeFotografar && (
                    <button onClick={() => irParaFotos(os)}
                      className="mt-3 w-full flex items-center justify-center gap-2 border border-orange-200 text-orange-700 hover:bg-orange-50 text-sm font-medium py-2.5 rounded-xl transition-colors">
                      <Camera size={15} /> Fotos do reparo
                      {fotosReparo > 0 && <span className="text-xs bg-orange-100 px-1.5 rounded-full">{fotosReparo}</span>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {grupo.lista.length > 10 && (
            <button onClick={() => setVerTodosFinalizados(v => !v)}
              className="w-full border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
              {verTodosFinalizados ? 'Mostrar menos' : `Ver todos os ${grupo.lista.length}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

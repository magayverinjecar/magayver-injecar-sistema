import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Search, User, Clock, Image, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { statusColor } from './OrdensServico'
import { momentoEntrada, dataEntradaLegivel, nomeVeiculo } from '../utils/datas'
import { fotosDaEntrada, fotosDoReparo } from '../utils/vistoria'

// Carro que já saiu não precisa mais de vistoria de entrada
const FORA = ['Entregue', 'Cancelada']

export default function OficinaFotos() {
  const { ordens, getCliente, getVeiculo, carregando } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')

  // A lista do pátio antes da busca fica guardada à parte só para o rodapé do
  // computador poder dizer "12 (de 37)" — sem ela, quem filtra lê o número do
  // filtro achando que é o pátio inteiro.
  const noPatio = ordens
    .filter(o => !FORA.includes(o.status) && !o.retirado)
    .map(o => {
      const veic = getVeiculo(o.veiculoId)
      const cli = getCliente(o.clienteId)
      const fotos = fotosDaEntrada(o.fotos).length
      const fotosReparo = fotosDoReparo(o.fotos).length
      const vistoriado = (o.inspecaoVisual || []).some(i => i.status)
      return {
        ...o,
        placa: veic?.placa || o.veiculoPlaca || '',
        modelo: nomeVeiculo(veic, o),
        cliente: cli?.nome || o.clienteNome || '—',
        fotos,
        fotosReparo,
        vistoriado,
        entrouEm: momentoEntrada(o),
        dataEntradaTexto: dataEntradaLegivel(o),
        // Carro recém-chegado ainda sem registro é o que corre risco
        pendente: fotos === 0 || !vistoriado,
      }
    })

  const lista = noPatio
    .filter(o => {
      if (!busca.trim()) return true
      const q = busca.toLowerCase()
      return o.cliente.toLowerCase().includes(q)
        || o.placa.toLowerCase().includes(q)
        || o.modelo.toLowerCase().includes(q)
    })
    // Último a dar entrada aparece primeiro — é o que acabou de chegar e precisa de foto
    .sort((a, b) => b.entrouEm - a.entrouEm)

  const pendentes = lista.filter(o => o.pendente).length
  // Números do rodapé de sistema: o reparador quer saber quantos carros ainda
  // esperam registro antes de descer para o pátio com o celular na mão.
  const prontos = lista.length - pendentes
  const totalFotos = lista.reduce((s, o) => s + o.fotos, 0)
  const totalReparo = lista.reduce((s, o) => s + o.fotosReparo, 0)

  if (carregando) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3 text-slate-400">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-sm">Carregando...</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl lg:max-w-none mx-auto">
      {/* No computador título e busca dividem a mesma faixa: a lista começa
          logo abaixo, em vez de nascer três blocos para baixo. */}
      <div className="space-y-5 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fotos e Vistoria</h2>
          {/* O rodapé da tabela já dá essa contagem no computador; repetida aqui
              em cima ela só empurra a lista para baixo. */}
          <p className="text-sm text-slate-500 mt-0.5 lg:hidden">
            {pendentes > 0
              ? `${pendentes} veículo(s) sem registro completo`
              : 'Todos os veículos do pátio já têm foto e vistoria'}
          </p>
        </div>

        <div className="relative max-w-sm lg:w-72 lg:flex-shrink-0">
          <Search size={15} className="absolute left-3 top-3 lg:top-1/2 lg:-translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar por placa, cliente ou modelo..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Camera size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Nenhum veículo no pátio</p>
          <p className="text-slate-400 text-sm mt-1">Registre uma nova entrada para começar.</p>
        </div>
      ) : (<>
        {/* Celular: os cartões de sempre. Quem fotografa está no pátio, de pé,
            com o celular na mão — ali o alvo precisa ser grande. */}
        <div className="space-y-2 lg:hidden">
          {lista.map(os => (
            <button key={os.id} onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
              className={`w-full bg-white border rounded-2xl p-4 text-left transition-all flex items-center gap-4 hover:shadow-sm ${
                os.pendente ? 'border-amber-200 hover:border-amber-400' : 'border-slate-200 hover:border-cyan-300'
              }`}>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${os.pendente ? 'bg-amber-50' : 'bg-cyan-50'}`}>
                <Camera size={18} className={os.pendente ? 'text-amber-500' : 'text-cyan-500'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-slate-800 text-sm">{os.modelo}</span>
                  {os.placa && (
                    <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{os.placa}</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[os.status] || 'bg-slate-100 text-slate-500'}`}>
                    {os.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><User size={11} /> {os.cliente}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {os.dataEntradaTexto}</span>
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="flex items-center gap-1.5 text-sm font-semibold justify-end">
                  <Image size={14} className={os.fotos ? 'text-cyan-500' : 'text-amber-500'} />
                  <span className={os.fotos ? 'text-cyan-600' : 'text-amber-600'}>
                    {os.fotos} foto(s)
                  </span>
                </div>
                {os.vistoriado ? (
                  <p className="text-xs text-green-600 flex items-center gap-1 justify-end mt-0.5">
                    <CheckCircle2 size={11} /> Vistoria feita
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1 justify-end mt-0.5">
                    <AlertTriangle size={11} /> Sem vistoria
                  </p>
                )}
                {os.fotosReparo > 0 && (
                  <p className="text-xs text-orange-600 flex items-center gap-1 justify-end mt-0.5">
                    <Wrench size={11} /> {os.fotosReparo} do reparo
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Computador: a mesma fila em tabela larga. O que o cartão conta em
            três alturas — foto, vistoria, reparo — vira coluna, e aí dá para
            descer o olho por uma coluna só e ver quem ainda está sem registro
            sem ler carro por carro. */}
        <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {/* Coluna sem nome: é só o sinal de pendente, para o olho pegar
                    a fileira de amarelo na beirada da tabela. */}
                <th className="px-5 py-3 w-8"></th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Placa</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                {/* Status e Reparo só a partir de 1280: em tela de 1024 as dez
                    colunas não cabiam e a última ficava cortada pela borda.
                    São as duas que menos fazem falta aqui — quem abre esta tela
                    quer saber quem ainda não foi fotografado, não em que pé
                    está o serviço. */}
                <th className="hidden xl:table-cell text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entrada</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fotos</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vistoria</th>
                <th className="hidden xl:table-cell text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reparo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.map(os => (
                <tr key={os.id} onClick={() => navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    {/* O aviso vai num span, e não no ícone: título em <svg> não
                        vira balãozinho no navegador. */}
                    <span title={os.pendente ? 'Ainda falta registro de entrada' : 'Foto e vistoria registradas'}>
                      {os.pendente
                        ? <Camera size={14} className="text-amber-500" />
                        : <CheckCircle2 size={14} className="text-green-500" />}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{os.modelo}</td>
                  {/* Placa e data (mais abaixo) nunca quebram: sem o nowrap,
                      "OAF-8C20" virava duas linhas em tela de 1024 e toda a
                      tabela crescia junto. */}
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-500 whitespace-nowrap">{os.placa || <span className="text-slate-300">—</span>}</td>
                  {/* Nome comprido sai com reticências (o inteiro fica no
                      balãozinho): um "MARCELO AUGUSTO DOS SANTOS NASCIMENTO"
                      por extenso quebra em três linhas e engorda a linha da
                      tabela inteira — e é a linha baixa que deixa a lista ser
                      lida de relance. */}
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    <span className="block truncate max-w-[9rem] xl:max-w-[13rem]" title={os.cliente}>{os.cliente}</span>
                  </td>
                  <td className="hidden xl:table-cell px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusColor[os.status] || 'bg-slate-100 text-slate-600'}`}>{os.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{os.dataEntradaTexto}</td>
                  {/* Zero fotos em amarelo, e não em cinza: é o carro que está na
                      oficina sem prova nenhuma do estado em que chegou. */}
                  <td className={`px-5 py-3.5 text-right text-sm tabular-nums ${os.fotos ? 'text-slate-700' : 'text-amber-600 font-semibold'}`}>
                    {os.fotos}
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    {os.vistoriado
                      ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} />Feita</span>
                      : <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={12} />Falta</span>}
                  </td>
                  {/* Foto do reparo é outra história (o serviço feito), então ela
                      tem coluna própria e não soma com a foto de entrada. */}
                  <td className="hidden xl:table-cell px-5 py-3.5 text-right text-sm text-slate-600 tabular-nums">
                    {os.fotosReparo > 0
                      ? <span className="inline-flex items-center gap-1 text-orange-600"><Wrench size={11} />{os.fotosReparo}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={e => { e.stopPropagation(); navigate(`/oficina/vistoria/${encodeURIComponent(os.id)}`) }}
                      className="text-xs text-primary-500 hover:text-primary-600 font-medium">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Rodapé de sistema: quantos carros estão na tela e, deles, quantos
              ainda esperam registro — a pergunta que traz o reparador a esta
              tela de manhã. */}
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {lista.length} {lista.length === 1 ? 'veículo no pátio' : 'veículos no pátio'}
              {busca.trim() && ` (de ${noPatio.length})`}
              {pendentes > 0 && <span className="ml-2 text-amber-700">· {pendentes} aguardando registro</span>}
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              <span className={prontos === lista.length ? 'text-green-700' : ''}>
                Prontos: <strong className="font-medium">{prontos}</strong>
              </span>
              <span>Fotos de entrada: <strong className="font-medium">{totalFotos}</strong></span>
              <span>Do reparo: <strong className="font-medium">{totalReparo}</strong></span>
            </span>
          </div>
        </div>
      </>)}
    </div>
  )
}

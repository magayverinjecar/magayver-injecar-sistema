import { useState, useMemo } from 'react'
import { Search, Plus, Car, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import Modal from '../components/ui/Modal'
import { momentoEntrada, dataEntradaLegivel, nomeVeiculo } from '../utils/datas'

const vazio = { placa: '', modelo: '', ano: '', cor: '', clienteId: '', km: '' }

export default function Veiculos() {
  const { veiculos, setVeiculos, clientes, getCliente, ordens } = useApp()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)

  // Histórico de cada carro levantado em UMA passada pela lista de OS.
  // Chamar ordensPorVeiculo linha a linha varre a tabela de ordens inteira uma
  // vez por veículo da tela — com a garagem cheia é a lista engasgando à toa.
  const historicoPorVeiculo = useMemo(() => {
    const mapa = new Map()
    for (const o of ordens) {
      const ms = momentoEntrada(o)
      const atual = mapa.get(o.veiculoId)
      if (!atual) { mapa.set(o.veiculoId, { qtd: 1, ms, ultima: o }); continue }
      atual.qtd++
      // A lista de OS não chega em ordem de data: a mais recente é a de maior
      // momento de entrada, que já vem corrigido para as ordens migradas.
      if (ms > atual.ms) { atual.ms = ms; atual.ultima = o }
    }
    return mapa
  }, [ordens])

  const filtrados = veiculos.filter(v => {
    const cliente = getCliente(v.clienteId)
    return (
      // A coluna mostra marca + modelo ("VW GOL"), então a busca tem de achar
      // pelos dois — procurar "VW" e não achar o carro que está escrito "VW GOL"
      // na tela é o tipo de coisa que faz a pessoa desistir do campo de busca.
      nomeVeiculo(v).toLowerCase().includes(busca.toLowerCase()) ||
      (v.modelo || '').toLowerCase().includes(busca.toLowerCase()) ||
      (v.placa || '').toLowerCase().includes(busca.toLowerCase()) ||
      cliente?.nome.toLowerCase().includes(busca.toLowerCase())
    )
  })

  // Números do rodapé, todos tirados do mapa acima — nenhuma varredura nova.
  const totalOrdens = filtrados.reduce((s, v) => s + (historicoPorVeiculo.get(v.id)?.qtd || 0), 0)
  // Carro sem proprietário no cadastro é o que trava a hora de avisar que
  // ficou pronto: está no pátio e ninguém sabe de quem é.
  const semDono = filtrados.filter(v => !getCliente(v.clienteId)).length
  // Cadastro que nunca virou serviço: sobra de digitação ou carro que ainda
  // não voltou. Vale saber quantos são antes de confiar no tamanho da lista.
  const semOS = filtrados.filter(v => !historicoPorVeiculo.has(v.id)).length

  function salvar() {
    if (!form.placa.trim() || !form.modelo.trim()) return
    setVeiculos(prev => [...prev, { ...form, id: gerarId(), clienteId: Number(form.clienteId) || null }])
    setForm(vazio)
    setModal(false)
  }

  function excluir(id) {
    if (confirm('Excluir este veículo?')) setVeiculos(prev => prev.filter(v => v.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar placa, modelo ou cliente..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-72" />
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Veículo
        </button>
      </div>

      {/* Cards — celular e tablet em pé. Continuam iguais: no pátio o dedo
          precisa de alvo grande, e ali card é melhor que linha de tabela. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
        {filtrados.map(v => {
          const cliente = getCliente(v.clienteId)
          const historico = historicoPorVeiculo.get(v.id)
          return (
            <div key={v.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Car size={20} className="text-slate-500" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{v.placa}</span>
                  <button onClick={() => excluir(v.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-slate-800">{v.modelo}</p>
              <p className="text-sm text-slate-400">{v.ano}{v.cor ? ` • ${v.cor}` : ''}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Proprietário</p>
                  <p className="text-xs font-medium text-slate-700">{cliente?.nome || '—'}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">KM atual</p>
                  <p className="text-xs text-slate-600">{v.km || '—'}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">OS realizadas</p>
                  <p className="text-xs font-semibold text-primary-600">{historico?.qtd || 0}</p>
                </div>
              </div>
            </div>
          )
        })}
        {filtrados.length === 0 && <p className="text-sm text-slate-400 py-4">Nenhum veículo encontrado.</p>}
      </div>

      {/* Tabela — computador. O mesmo cadastro em lista: placa embaixo de
          placa, KM embaixo de KM. Em card, três carros por linha, quem procura
          uma placa lê a tela inteira em ziguezague. */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Placa</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículo</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Proprietário</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">KM</th>
              {/* Quando o carro esteve aqui pela última vez já está gravado nas
                  OS dele, mas hoje só aparece abrindo o histórico. É a resposta
                  de "esse aí a gente já mexeu?" com o cliente no telefone. */}
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Última visita</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OS</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrados.map(v => {
              const cliente = getCliente(v.clienteId)
              const historico = historicoPorVeiculo.get(v.id)
              return (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-600">{v.placa || '—'}</td>
                  {/* nomeVeiculo e não v.modelo: os carros cadastrados pela
                      recepção guardam a marca separada, e só o modelo faz o
                      "VW GOL" virar "GOL" na lista. */}
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{nomeVeiculo(v)}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 tabular-nums">{v.ano || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{v.cor || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">{cliente?.nome || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 text-right tabular-nums">{v.km || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 tabular-nums">
                    {historico ? dataEntradaLegivel(historico.ultima) : <span className="text-slate-300">nunca</span>}
                  </td>
                  {/* Zero apagado: a coluna mostra de relance quais cadastros
                      nunca renderam serviço. */}
                  <td className="px-5 py-3.5 text-sm text-right tabular-nums font-medium text-slate-700">
                    {historico ? historico.qtd : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => excluir(v.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum veículo encontrado.</p>}
        {/* Rodapé de sistema: com a busca aberta a lista mente sobre o tamanho
            da garagem, então ele diz quantos apareceram de quantos existem — e
            quanto serviço esse recorte de carros já rendeu. */}
        {filtrados.length > 0 && (
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {filtrados.length} {filtrados.length === 1 ? 'veículo' : 'veículos'}
              {busca && ` (de ${veiculos.length})`}
              {semDono > 0 && (
                <span className="ml-2 text-slate-500" title="Sem proprietário vinculado não dá para avisar o dono nem cobrar">
                  · {semDono} sem dono
                </span>
              )}
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              {semOS > 0 && <span title="Cadastrados, mas nunca atendidos">Sem OS: <strong className="font-medium">{semOS.toLocaleString('pt-BR')}</strong></span>}
              <span>OS: <strong className="font-medium">{totalOrdens.toLocaleString('pt-BR')}</strong></span>
            </span>
          </div>
        )}
      </div>

      {modal && (
        <Modal title="Novo Veículo" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proprietário</label>
              <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Selecione o cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placa *</label>
                <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value }))} placeholder="ABC-1234" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label>
                <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Honda Civic" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ano</label>
                <input value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} placeholder="2020" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cor</label>
                <input value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} placeholder="Prata" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">KM</label>
                <input value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} placeholder="45.000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
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

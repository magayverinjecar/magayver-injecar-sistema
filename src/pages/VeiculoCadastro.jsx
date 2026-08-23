import { useState } from 'react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import TelaCadastro from '../components/TelaCadastro'

const VAZIO = { placa: '', modelo: '', ano: '', cor: '', clienteId: '', km: '' }
const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'

export default function VeiculoCadastro() {
  const { clientes, setVeiculos } = useApp()
  const [form, setForm] = useState({ ...VAZIO })
  const [erro, setErro] = useState('')

  const campo = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const sujo = JSON.stringify(form) !== JSON.stringify(VAZIO)

  const faltando = [
    !form.placa.trim() && 'placa',
    !form.modelo.trim() && 'modelo',
  ].filter(Boolean).join(' e ')

  function salvar() {
    if (faltando) { setErro('Placa e modelo são obrigatórios.'); return false }
    setVeiculos(prev => [...prev, {
      ...form,
      placa: form.placa.trim().toUpperCase(),
      modelo: form.modelo.trim(),
      clienteId: Number(form.clienteId) || null,
      id: gerarId(),
    }])
  }

  return (
    <TelaCadastro
      titulo="Novo Veículo"
      subtitulo="Sem proprietário, o carro fica solto: não aparece na ficha de ninguém."
      voltarPara="/veiculos"
      sujo={sujo}
      faltando={faltando}
      erro={erro}
      rotuloSalvar="Cadastrar veículo"
      onSalvar={salvar}
    >
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="col-span-2">
          <label className={ROTULO}>Proprietário</label>
          <select value={form.clienteId} onChange={campo('clienteId')} className={INP}>
            <option value="">Selecione o cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={ROTULO}>Placa *</label>
          <input value={form.placa} onChange={campo('placa')} placeholder="ABC-1234" className={`${INP} uppercase`} autoFocus />
        </div>
        <div className="col-span-2 lg:col-span-3">
          {/* O modelo é digitado num campo só e o cadastro quebra em marca +
              modelo na primeira palavra. Uma palavra só ("GOL") fica inteira no
              modelo, sem marca — senão a tela mostrava "GOL GOL". */}
          <label className={ROTULO}>Modelo *</label>
          <input value={form.modelo} onChange={campo('modelo')} placeholder="Honda Civic" className={INP} />
        </div>
        <div>
          <label className={ROTULO}>Ano</label>
          <input value={form.ano} onChange={campo('ano')} placeholder="2020" inputMode="numeric" className={INP} />
        </div>
        <div>
          <label className={ROTULO}>Cor</label>
          <input value={form.cor} onChange={campo('cor')} placeholder="Prata" className={INP} />
        </div>
        <div>
          <label className={ROTULO}>KM</label>
          <input value={form.km} onChange={campo('km')} placeholder="45.000" inputMode="numeric" className={INP} />
        </div>
      </div>
    </TelaCadastro>
  )
}

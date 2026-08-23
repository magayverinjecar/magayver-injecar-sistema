import { useState, useEffect } from 'react'
import { Search, Plus, AlertTriangle, Trash2, Pencil, Package, Boxes, History, RefreshCw, Merge, EyeOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import gerarId from '../utils/id'
import Modal from '../components/ui/Modal'
import AbaKits from '../components/AbaKits'
import AbaDuplicadas from '../components/AbaDuplicadas'
import { kitsDoConfig } from '../utils/kits'
import { rotuloDoTipo, rotuloDaOrigem, mensagemErroExtrato } from '../utils/movimentos'
import { pecaComCodigo, pecaAtiva, gruposDuplicados } from '../utils/pecas'

const vazio = { codigo: '', nome: '', categoria: '', estoque: '', minimo: '', precoCusto: '', preco: '' }

// ── Extrato de movimentação de uma peça (kardex) ─────────────────────────────
// Lê a tabela estoque_mov sob demanda — ela não fica sincronizada no app, é
// história e só cresce. Enquanto não carregou, a tela diz que está carregando;
// "vazio" só depois de o banco responder.
function ExtratoPeca({ item, onClose }) {
  const [estado, setEstado] = useState('carregando') // carregando | erro | pronto
  const [erro, setErro] = useState('')
  const [movs, setMovs] = useState([])

  async function carregar() {
    setEstado('carregando')
    try {
      const { data, error } = await supabase
        .from('estoque_mov')
        .select('*')
        .eq('peca_id', String(item.id))
        .order('criado_em', { ascending: false })
        .order('seq', { ascending: false })
        .limit(100)
      if (error) throw error
      setMovs(data || [])
      setEstado('pronto')
    } catch (e) {
      console.error('[extrato] falha ao carregar movimentações:', e)
      setErro(mensagemErroExtrato(e))
      setEstado('erro')
    }
  }

  useEffect(() => { carregar() }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmtData = (iso) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return '—' }
  }

  return (
    <Modal title={`Extrato — ${item.nome}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Saldo atual: <span className={`font-semibold ${Number(item.estoque) < 0 ? 'text-red-600' : 'text-slate-700'}`}>{item.estoque}</span>
          </p>
          <button onClick={carregar} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors" title="Recarregar">
            <RefreshCw size={13} />Atualizar
          </button>
        </div>

        {estado === 'carregando' && (
          <p className="text-center text-sm text-slate-400 py-8">Carregando o extrato…</p>
        )}
        {estado === 'erro' && (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-red-500">{erro}</p>
            <button onClick={carregar} className="text-sm text-primary-600 hover:underline">Tentar de novo</button>
          </div>
        )}
        {estado === 'pronto' && movs.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">
            Nenhuma movimentação registrada ainda.<br />
            <span className="text-xs">O extrato conta a partir de agora — o saldo atual veio de antes dele existir.</span>
          </p>
        )}
        {estado === 'pronto' && movs.length > 0 && (
          <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg overflow-hidden">
            {movs.map(m => (
              <div key={m.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-700">
                    {rotuloDoTipo(m.tipo)}
                    {rotuloDaOrigem(m) && <span className="font-normal text-slate-400"> · {rotuloDaOrigem(m)}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtData(m.criado_em)}{m.autor_nome ? ` · ${m.autor_nome}` : ''}
                  </p>
                  {m.motivo && <p className="text-xs text-slate-500 italic mt-0.5">{m.motivo}</p>}
                </div>
                <span className={`font-semibold whitespace-nowrap ${Number(m.qtd) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(m.qtd) > 0 ? `+${m.qtd}` : m.qtd}
                </span>
              </div>
            ))}
          </div>
        )}
        {estado === 'pronto' && movs.length >= 100 && (
          <p className="text-center text-xs text-slate-400">Mostrando as últimas 100 movimentações.</p>
        )}
      </div>
    </Modal>
  )
}

export default function Estoque() {
  const { estoque, setEstoque, movimentarEstoque, reservadoDe, config } = useApp()
  // Kits ficam nesta tela, e não em Configurações: quem monta kit é quem mexe
  // em estoque — as peças e as referências estão aqui.
  const [aba, setAba] = useState('pecas')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState(null) // item sendo editado
  const [ajustando, setAjustando] = useState(null) // { item, valor, motivo }
  const [extratoDe, setExtratoDe] = useState(null) // item com extrato aberto
  const [mostrarInativas, setMostrarInativas] = useState(false)

  // Peça desativada (juntada em outra, fora de linha) sai da lista, mas
  // continua no banco e no extrato — o interruptor traz de volta para conferir.
  const visiveis = mostrarInativas ? estoque : estoque.filter(pecaAtiva)
  const filtrados = visiveis.filter(i =>
    (i.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (i.codigo || '').toLowerCase().includes(busca.toLowerCase())
  )
  const qtdInativas = estoque.length - estoque.filter(pecaAtiva).length

  const emFalta = estoque.filter(i => pecaAtiva(i) && Number(i.estoque) <= Number(i.minimo)).length

  function salvar() {
    if (!form.nome.trim()) return
    // Codigo repetido nao entra: e assim que a mesma vela virou sete cadastros,
    // com o saldo real espalhado em sete linhas. A comparacao perdoa espaco,
    // hifen, barra, ponto e acento — "FLU/DS/280" e "flu ds 280" sao a mesma.
    const jaExiste = pecaComCodigo(estoque, form.codigo)
    if (jaExiste) {
      alert(`O código ${form.codigo} já está cadastrado em:\n\n${jaExiste.nome}\n\nSe for a mesma peça, use a peça que já existe (dá para editar o nome nela). Se for outra peça, corrija o código.`)
      return
    }
    // Maiúscula só ao salvar — em caps enquanto digita, o corretor do navegador
    // pula as palavras achando que é sigla.
    //
    // A peça nasce com saldo ZERO e a quantidade inicial entra por movimento de
    // "saldo inicial" no kardex: o extrato explica o saldo desde o primeiro dia.
    const id = gerarId()
    const qtdInicial = Number(form.estoque) || 0
    setEstoque(prev => [...prev, { ...form, nome: form.nome.toUpperCase().trim(), categoria: (form.categoria || '').toUpperCase(), id, estoque: 0, minimo: Number(form.minimo) || 0 }])
    if (qtdInicial !== 0) {
      movimentarEstoque({
        pecaId: id,
        qtd: qtdInicial,
        tipo: 'saldo_inicial',
        motivo: 'Cadastro da peça',
        custoUnit: form.precoCusto,
        criarSeFaltar: true,
      })
    }
    setForm(vazio)
    setModal(false)
  }

  function abrirEdicao(item) {
    setEditando({ ...item, minimo: String(item.minimo) })
  }

  function salvarEdicao() {
    if (!editando.nome.trim()) return
    const jaExiste = pecaComCodigo(estoque, editando.codigo, { ignorarId: editando.id })
    if (jaExiste) {
      alert(`O código ${editando.codigo} já está cadastrado em:\n\n${jaExiste.nome}\n\nDuas peças com o mesmo código dividem o saldo e o alerta de mínimo.`)
      return
    }
    // O saldo NÃO passa por aqui: editar cadastro mexe em nome, código, preços
    // e mínimo. Saldo muda por movimentação (botões −/+ com motivo), senão a
    // foto do formulário apagaria baixas feitas em outro aparelho.
    setEstoque(prev => prev.map(i => i.id === editando.id
      ? { ...editando, nome: editando.nome.toUpperCase().trim(), categoria: (editando.categoria || '').toUpperCase(), estoque: i.estoque, minimo: Number(editando.minimo) || 0 }
      : i
    ))
    setEditando(null)
  }

  function excluir(id) {
    if (confirm('Excluir este item?')) setEstoque(prev => prev.filter(i => i.id !== id))
  }

  // Os botões − e + não mexem mais no saldo direto: abrem o ajuste com motivo.
  // Todo ajuste vira movimento no kardex — quem, quando, quanto e por quê.
  function abrirAjuste(item, delta = 0) {
    setAjustando({
      item,
      valor: String((Number(item.estoque) || 0) + delta),
      motivo: '',
    })
  }

  function confirmarAjuste() {
    const { item, valor, motivo } = ajustando
    // Lê o saldo mais FRESCO do estado — o modal pode ter ficado aberto
    // enquanto outro aparelho movimentava a peça.
    const atual = estoque.find(i => i.id === item.id)
    const saldoAtual = Number(atual?.estoque) || 0
    // Campo vazio NÃO é zero: Number('') dá 0 e zeraria a peça sem ninguém
    // ter digitado número nenhum.
    const novo = String(valor).trim() === '' ? NaN : Number(valor)
    if (!Number.isFinite(novo)) return
    const diff = novo - saldoAtual
    if (diff === 0) { setAjustando(null); return }
    if (!motivo.trim()) return
    movimentarEstoque({
      pecaId: item.id,
      qtd: diff,
      tipo: 'ajuste',
      motivo: motivo.trim(),
    })
    setAjustando(null)
  }

  const camposForm = (f, set, { comSaldo = true } = {}) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
          <input value={f.codigo} onChange={e => set(x => ({ ...x, codigo: e.target.value }))} placeholder="FLT-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <input value={f.categoria} onChange={e => set(x => ({ ...x, categoria: e.target.value }))} spellCheck lang="pt-BR" placeholder="FILTROS, ÓLEOS..." className="w-full uppercase border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto *</label>
        <input value={f.nome} onChange={e => set(x => ({ ...x, nome: e.target.value }))} spellCheck lang="pt-BR" placeholder="EX: FILTRO DE ÓLEO" className="w-full uppercase border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {comSaldo ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. em Estoque</label>
            <input type="number" value={f.estoque} onChange={e => set(x => ({ ...x, estoque: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. em Estoque</label>
            <div className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500">
              {f.estoque}
              <span className="block text-[11px] text-slate-400">muda pelos botões − / + da lista, com motivo</span>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Mínima</label>
          <input type="number" value={f.minimo} onChange={e => set(x => ({ ...x, minimo: e.target.value }))} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Custo (R$)</label>
          <input value={f.precoCusto} onChange={e => set(x => ({ ...x, precoCusto: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preço de Venda (R$)</label>
          <input value={f.preco} onChange={e => set(x => ({ ...x, preco: e.target.value }))} placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>
    </div>
  )

  const qtdKits = kitsDoConfig(config).length
  const qtdDuplicadas = gruposDuplicados(estoque.filter(pecaAtiva)).length

  return (
    <div className="space-y-4">
      {/* Abas: "Peças" é a tela de sempre, intocada. "Kits" é o cadastro do
          molde de revisão. */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setAba('pecas')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'pecas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Boxes size={14} />Peças
        </button>
        <button onClick={() => setAba('kits')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'kits' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Package size={14} />Kits
          {qtdKits > 0 && (
            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{qtdKits}</span>
          )}
        </button>
        {/* A aba só existe enquanto houver o que juntar: some sozinha quando o
            cadastro estiver limpo. */}
        {qtdDuplicadas > 0 && (
          <button onClick={() => setAba('duplicadas')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${aba === 'duplicadas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Merge size={14} />Duplicadas
            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{qtdDuplicadas}</span>
          </button>
        )}
      </div>

      {aba === 'kits' && <AbaKits />}
      {aba === 'duplicadas' && <AbaDuplicadas />}

      {aba === 'pecas' && (<>
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar peça ou código..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        </div>
        <div className="flex items-center gap-3">
          {qtdInativas > 0 && (
            <button onClick={() => setMostrarInativas(v => !v)}
              title="Peças desativadas continuam no histórico e no extrato, mas não podem ser lançadas"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mostrarInativas ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
              <EyeOff size={15} />{mostrarInativas ? 'Ocultar' : 'Mostrar'} inativas ({qtdInativas})
            </button>
          )}
          <button onClick={() => { setForm(vazio); setModal(true) }} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />Nova Peça
          </button>
        </div>
      </div>

      {emFalta > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-2.5 rounded-lg">
          <AlertTriangle size={16} />
          <span><strong>{emFalta} {emFalta === 1 ? 'item' : 'itens'}</strong> com estoque abaixo do mínimo</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Produto</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estoque</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Custo</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Venda</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrados.map(item => {
              const baixo = Number(item.estoque) <= Number(item.minimo)
              const negativo = Number(item.estoque) < 0
              // Reservado: comprometido em OS ainda não aprovadas. Só aparece
              // quando existe — a coluna continua sendo o saldo físico.
              const reservado = reservadoDe(item.id)
              const disponivel = (Number(item.estoque) || 0) - reservado
              const inativa = !pecaAtiva(item)
              return (
                <tr key={item.id} className={`transition-colors ${inativa ? 'bg-slate-50/70 opacity-60' : 'hover:bg-slate-50'}`}>
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{item.codigo || '—'}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">
                    {item.nome}
                    {inativa && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600" title={item.fundidaEm ? 'Juntada em outra peça' : 'Peça desativada'}>
                        {item.fundidaEm ? 'juntada' : 'inativa'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{item.categoria || '—'}</span></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {baixo && !negativo && <AlertTriangle size={13} className="text-yellow-500" />}
                      {negativo && <AlertTriangle size={13} className="text-red-500" title="Saldo negativo — a prateleira e o sistema divergem" />}
                      <button onClick={() => abrirAjuste(item, -1)} title="Ajustar para baixo (pede motivo)" className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm flex items-center justify-center">−</button>
                      <span
                        title={negativo ? 'Saldo negativo: saiu mais peça do que o sistema conhecia. Acerte com um ajuste.' : undefined}
                        className={`text-sm font-semibold w-6 text-center ${negativo ? 'text-red-600' : baixo ? 'text-yellow-600' : 'text-slate-700'}`}>
                        {item.estoque}
                      </span>
                      <button onClick={() => abrirAjuste(item, 1)} title="Ajustar para cima (pede motivo)" className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm flex items-center justify-center">+</button>
                      <span className="text-xs text-slate-400">mín: {item.minimo}</span>
                    </div>
                    {reservado > 0 && (
                      <div className="text-[11px] text-amber-600 mt-0.5 pl-8" title="Reservadas em OS antes da aprovação · disponível para prometer">
                        {reservado} reserv. · <span className={disponivel < 0 ? 'text-red-600 font-semibold' : ''}>{disponivel} disp.</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">{item.precoCusto ? `R$ ${item.precoCusto}` : '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">{item.preco ? `R$ ${item.preco}` : '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExtratoDe(item)} className="p-1.5 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors" title="Extrato de movimentação">
                        <History size={14} />
                      </button>
                      <button onClick={() => abrirEdicao(item)} className="p-1.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400 transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluir(item.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nenhum item encontrado.</p>}
      </div>
      </>)}

      {/* Modal Nova Peça */}
      {modal && (
        <Modal title="Nova Peça / Item" onClose={() => setModal(false)}>
          {camposForm(form, setForm)}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={salvar} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar</button>
          </div>
        </Modal>
      )}

      {/* Modal Editar Peça — sem o campo de saldo: saldo muda por movimentação */}
      {editando && (
        <Modal title="Editar Peça" onClose={() => setEditando(null)}>
          {camposForm(editando, setEditando, { comSaldo: false })}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setEditando(null)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={salvarEdicao} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Salvar Alterações</button>
          </div>
        </Modal>
      )}

      {/* Modal Ajuste de saldo — todo ajuste tem motivo e vira extrato */}
      {ajustando && (() => {
        const atual = estoque.find(i => i.id === ajustando.item.id)
        const saldoAtual = Number(atual?.estoque) || 0
        const novo = String(ajustando.valor).trim() === '' ? NaN : Number(ajustando.valor)
        const diff = Number.isFinite(novo) ? novo - saldoAtual : 0
        return (
          <Modal title={`Ajustar saldo — ${ajustando.item.nome}`} onClose={() => setAjustando(null)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Saldo atual: <span className={`font-semibold ${saldoAtual < 0 ? 'text-red-600' : 'text-slate-700'}`}>{saldoAtual}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Novo saldo (contagem)</label>
                <input type="number" autoFocus value={ajustando.valor}
                  onChange={e => setAjustando(a => ({ ...a, valor: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {diff !== 0 && Number.isFinite(novo) && (
                  <p className={`text-xs mt-1 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {diff > 0 ? `Entram ${diff}` : `Saem ${-diff}`} no extrato desta peça
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo *</label>
                <input value={ajustando.motivo}
                  onChange={e => setAjustando(a => ({ ...a, motivo: e.target.value }))}
                  spellCheck lang="pt-BR"
                  placeholder="Contagem da prateleira, quebra, perda, devolução..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAjustando(null)} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="button" onClick={confirmarAjuste}
                  disabled={!Number.isFinite(novo) || diff === 0 || !ajustando.motivo.trim()}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                  Confirmar Ajuste
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Modal Extrato da peça */}
      {extratoDe && (
        <ExtratoPeca
          item={estoque.find(i => i.id === extratoDe.id) || extratoDe}
          onClose={() => setExtratoDe(null)}
        />
      )}
    </div>
  )
}

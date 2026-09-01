import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, AlertTriangle, Trash2, Pencil, Package, Boxes, History, RefreshCw, Merge, EyeOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import Modal from '../components/ui/Modal'
import AbaKits from '../components/AbaKits'
import AbaDuplicadas from '../components/AbaDuplicadas'
import { kitsDoConfig } from '../utils/kits'
import { rotuloDoTipo, rotuloDaOrigem, mensagemErroExtrato } from '../utils/movimentos'
import { pecaAtiva, gruposDuplicados, casaBusca } from '../utils/pecas'
import { proximaOrdem, ordenarPor, setaDaColuna } from '../utils/ordenar'
import { parseValorBR } from '../utils/numero'

const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const navigate = useNavigate()
  const { estoque, setEstoque, movimentarEstoque, reservadoDe, config } = useApp()
  // Kits ficam nesta tela, e não em Configurações: quem monta kit é quem mexe
  // em estoque — as peças e as referências estão aqui.
  const [aba, setAba] = useState('pecas')
  const [busca, setBusca] = useState('')
  const [ajustando, setAjustando] = useState(null) // { item, valor, motivo }
  const [extratoDe, setExtratoDe] = useState(null) // item com extrato aberto
  const [mostrarInativas, setMostrarInativas] = useState(false)
  // `null` = ordem de cadastro, que e a que o terceiro clique devolve.
  const [ordem, setOrdem] = useState(null)

  // Qual coluna ordena por que valor, e se e numero ou texto. O tipo importa:
  // dinheiro comparado como TEXTO poe "R$ 1.000,00" antes de "R$ 90,00", porque
  // o "1" e menor que o "9" — a tabela fica ordenada e errada ao mesmo tempo.
  const COLUNAS = {
    codigo:  { tipo: 'texto',  valor: p => p.codigo },
    produto: { tipo: 'texto',  valor: p => p.nome },
    marca:   { tipo: 'texto',  valor: p => p.marca },
    estoque: { tipo: 'numero', valor: p => p.estoque },
    custo:   { tipo: 'numero', valor: p => p.precoCusto },
    venda:   { tipo: 'numero', valor: p => p.preco },
  }
  const clicarColuna = (campo) => setOrdem(o => proximaOrdem(o, campo))

  // Peça desativada (juntada em outra, fora de linha) sai da lista, mas
  // continua no banco e no extrato — o interruptor traz de volta para conferir.
  const visiveis = mostrarInativas ? estoque : estoque.filter(pecaAtiva)
  const encontrados = visiveis.filter(i => casaBusca(i, busca))
  const filtrados = ordenarPor(encontrados, ordem, COLUNAS)
  const qtdInativas = estoque.length - estoque.filter(pecaAtiva).length
  const totalUnidades = filtrados.reduce((s, i) => s + (Number(i.estoque) || 0), 0)
  const valorEstoque = filtrados.reduce((s, i) => s + (Number(i.estoque) || 0) * parseValorBR(i.precoCusto), 0)

  const emFalta = estoque.filter(i => pecaAtiva(i) && Number(i.estoque) <= Number(i.minimo)).length

  // Cadastrar e editar peça vivem em `pages/PecaCadastro.jsx`, em tela cheia.
  // São 20 campos em 4 seções — ficha grande é tela em todo o resto do sistema
  // (OS, Compra, Nova Entrada), e como popup ela rolava dentro de uma caixa,
  // não tinha endereço próprio e sumia com um clique fora. Os popups que
  // ficaram nesta tela — ajuste de saldo e extrato — são decisão curta, que é
  // o uso certo de popup.

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
          <button onClick={() => navigate('/estoque/peca/nova')} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
            {/* Cabecalho que ordena: 1o clique crescente, 2o decrescente, 3o
                volta a ordem de cadastro. O botao dentro do th e de proposito —
                th nao recebe foco de teclado, e sem isso a coluna so existiria
                para quem usa mouse. */}
            <tr className="border-b border-slate-100 bg-slate-50">
              {[
                { campo: 'codigo',  titulo: 'Código',  alinha: 'text-left' },
                { campo: 'produto', titulo: 'Produto', alinha: 'text-left' },
                // Marca no lugar de categoria: 82 das 543 peças tinham categoria
                // preenchida, e existem 16 peças de nome igual que só a marca e
                // a aplicação distinguem.
                { campo: 'marca',   titulo: 'Marca',   alinha: 'text-left' },
                { campo: 'estoque', titulo: 'Estoque', alinha: 'text-left' },
                { campo: 'custo',   titulo: 'Custo',   alinha: 'text-right' },
                { campo: 'venda',   titulo: 'Venda',   alinha: 'text-right' },
              ].map(({ campo, titulo, alinha }) => {
                const ativa = ordem?.campo === campo
                return (
                  <th key={campo} className={`${alinha} px-5 py-3 text-xs font-semibold uppercase tracking-wide ${ativa ? 'text-primary-600' : 'text-slate-500'}`}>
                    <button type="button" onClick={() => clicarColuna(campo)}
                      title={ativa
                        ? (ordem.direcao === 'asc' ? 'Clique para inverter' : 'Clique para voltar à ordem de cadastro')
                        : `Ordenar por ${titulo.toLowerCase()}`}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-primary-600 transition-colors ${alinha === 'text-right' ? 'flex-row-reverse' : ''}`}>
                      {titulo}
                      <span className="text-[11px] w-2 inline-block">{setaDaColuna(ordem, campo)}</span>
                    </button>
                  </th>
                )
              })}
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
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    {item.marca || item.categoria || <span className="text-slate-300">—</span>}
                    {item.aplicacao && <span className="block text-[11px] text-slate-400 truncate max-w-[16rem]">{item.aplicacao}</span>}
                  </td>
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
                  <td className="px-5 py-3.5 text-sm text-slate-700 text-right tabular-nums">{item.precoCusto || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700 text-right tabular-nums">{item.preco || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExtratoDe(item)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Extrato de movimentação">
                        <History size={14} />
                      </button>
                      <button onClick={() => navigate(`/estoque/peca/${item.id}`)} className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => excluir(item.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors" title="Excluir">
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
        {/* Rodapé de sistema: os números que o dono quer saber sem abrir
            relatório — quantas peças, quantas unidades, quanto vale a
            prateleira pelo custo. */}
        {filtrados.length > 0 && (
          <div className="hidden lg:flex items-center justify-between gap-4 px-3 py-1.5 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600">
            <span>
              {filtrados.length} {filtrados.length === 1 ? 'peça' : 'peças'}
              {busca && ` (de ${visiveis.length})`}
              {emFalta > 0 && <span className="ml-2 text-yellow-700">· {emFalta} abaixo do mínimo</span>}
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              <span>{totalUnidades.toLocaleString('pt-BR')} unidades</span>
              <span>Custo na prateleira: <strong className="font-medium">{fmtBRL(valorEstoque)}</strong></span>
            </span>
          </div>
        )}
      </div>
      </>)}

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

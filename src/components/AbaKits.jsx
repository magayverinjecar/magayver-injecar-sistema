import { useState } from 'react'
import { Plus, Trash2, Pencil, Package, AlertTriangle, X, Save } from 'lucide-react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import PainelAdicionarItem from '../components/PainelAdicionarItem'
import {
  kitsDoConfig, produtoDoCadastro, servicoDoCadastro, pecaSemEstoque,
  precoDaLinha, totalDoKit,
} from '../utils/kits'

// Aba "Kits" do Estoque. Fica aqui, e não em Configurações, porque quem monta
// kit é quem mexe em estoque: as peças e as referências estão nesta tela.

const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const VAZIO = { id: null, nome: '', itens: [] }

export default function AbaKits() {
  const { config, setConfig, servicos, estoque } = useApp()
  const kits = kitsDoConfig(config)

  const [editando, setEditando] = useState(null)   // null = lista; objeto = editor
  const [painel, setPainel] = useState(true)

  function novoKit() {
    setEditando({ ...VAZIO, itens: [] })
    setPainel(true)
  }

  function abrirKit(kit) {
    // Cópia profunda das linhas: enquanto ele edita, o kit gravado fica intacto
    // — se desistir no meio, nada foi perdido.
    setEditando({ ...kit, itens: (kit.itens || []).map(l => ({ ...l })) })
    setPainel(false)
  }

  // Vem do painel compartilhado no formato da OS. O kit guarda só o vínculo, a
  // descrição de reserva e a quantidade — preço nunca.
  function adicionarAoKit(dados) {
    const ref = dados.tipo === 'peca' ? dados.produtoId : dados.servicoId
    if (ref === null || ref === undefined || ref === '') {
      alert('Escolha a peça ou o serviço na lista.\n\nO kit precisa do vínculo com o cadastro para buscar o preço certo na hora de aplicar.')
      return
    }
    setEditando(k => {
      // Mesmo item duas vezes é quase sempre engano de clique: soma a
      // quantidade em vez de criar linha repetida, que sairia dobrada na OS.
      const iguais = (l) => l.tipo === dados.tipo &&
        String(dados.tipo === 'peca' ? l.produtoId : l.servicoId) === String(ref)
      const existente = (k.itens || []).find(iguais)
      if (existente) {
        return { ...k, itens: k.itens.map(l => l === existente
          ? { ...l, quantidade: (Number(l.quantidade) || 1) + (Number(dados.quantidade) || 1) }
          : l) }
      }
      return {
        ...k,
        itens: [...(k.itens || []), {
          id: gerarId(),
          tipo: dados.tipo,
          produtoId: dados.tipo === 'peca' ? ref : null,
          servicoId: dados.tipo === 'servico' ? ref : null,
          descricao: dados.descricao,
          quantidade: Number(dados.quantidade) || 1,
        }],
      }
    })
  }

  function mudarQtd(linhaId, valor) {
    setEditando(k => ({ ...k, itens: k.itens.map(l => l.id === linhaId ? { ...l, quantidade: valor } : l) }))
  }

  function removerLinha(linhaId) {
    setEditando(k => ({ ...k, itens: k.itens.filter(l => l.id !== linhaId) }))
  }

  function salvarKit() {
    const nome = (editando.nome || '').trim()
    if (!nome) { alert('Dê um nome ao kit. Ex.: "Kit Polo TSI" ou "Revisão 10 mil".'); return }
    if (!editando.itens.length) { alert('O kit está vazio. Adicione ao menos um item.'); return }

    const pronto = {
      id: editando.id ?? gerarId(),
      nome: nome.toUpperCase(),
      itens: editando.itens.map(l => ({ ...l, quantidade: Number(l.quantidade) || 1 })),
    }
    setConfig(c => {
      const atuais = kitsDoConfig(c)
      const kitsItens = editando.id
        ? atuais.map(k => k.id === editando.id ? pronto : k)
        : [...atuais, pronto]
      return { ...c, kitsItens }
    })
    setEditando(null)
  }

  function excluirKit(kit) {
    if (!confirm(`Excluir o kit "${kit.nome}"?\n\nOs itens já lançados em OS e orçamentos não são afetados.`)) return
    setConfig(c => ({ ...c, kitsItens: kitsDoConfig(c).filter(k => k.id !== kit.id) }))
  }

  // ---------- EDITOR ----------
  if (editando) {
    const totalPrevisto = totalDoKit(editando, servicos, estoque)
    const faltando = editando.itens.filter(l => l.tipo === 'peca' && pecaSemEstoque(estoque, l.produtoId)).length

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[15rem]">
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="kit-nome">Nome do kit *</label>
              <input id="kit-nome" value={editando.nome} onChange={e => setEditando(k => ({ ...k, nome: e.target.value }))}
                spellCheck lang="pt-BR" placeholder="EX: KIT POLO TSI, REVISÃO 10 MIL"
                className="w-full uppercase border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <button type="button" onClick={() => setEditando(null)}
                className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                <X size={14} />Cancelar
              </button>
              <button type="button" onClick={salvarKit}
                className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Save size={14} />{editando.id ? 'Salvar alterações' : 'Salvar kit'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            O kit guarda <strong>quais itens e quantos</strong> — nunca o preço. O valor sai do cadastro
            no momento em que o kit é aplicado, então reajustar uma peça não obriga a editar kit por kit.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-slate-800">Itens do kit</h3>
              <p className="text-sm text-slate-500">
                {editando.itens.length} {editando.itens.length === 1 ? 'item' : 'itens'} · {fmt(totalPrevisto)} pelos preços de hoje
              </p>
            </div>
            {!painel && (
              <button type="button" onClick={() => setPainel(true)}
                className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus size={15} />Adicionar item
              </button>
            )}
          </div>

          {painel && (
            <PainelAdicionarItem
              servicos={servicos}
              estoque={estoque}
              mostrarReparador={false}
              permitirAvulso={false}
              permitirSemEstoque
              esconderPrecos
              textoBotao="Pôr no kit"
              onAdd={adicionarAoKit}
              onFechar={() => setPainel(false)}
            />
          )}

          {editando.itens.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">
              Nenhum item no kit ainda. Busque a peça ou o serviço acima.
            </p>
          ) : (
            <div className="space-y-2">
              {editando.itens.map(l => {
                const unit = precoDaLinha(l, servicos, estoque)
                const zerada = l.tipo === 'peca' && pecaSemEstoque(estoque, l.produtoId)
                const sumiu = l.tipo === 'peca'
                  ? !produtoDoCadastro(estoque, l.produtoId)
                  : !servicoDoCadastro(servicos, l.servicoId)
                return (
                  <div key={l.id}
                    className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2.5 flex-wrap ${zerada || sumiu ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${l.tipo === 'servico' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {l.tipo === 'servico' ? 'serviço' : 'peça'}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium break-words ${zerada || sumiu ? 'text-red-700' : 'text-slate-800'}`}>{l.descricao}</p>
                        <p className="text-xs text-slate-400">
                          {sumiu
                            ? 'Não está mais no cadastro — sairá sem preço'
                            : `${fmt(unit)} cada${zerada ? ' · sem estoque hoje' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        Qtd.
                        <input type="text" inputMode="decimal" value={l.quantidade}
                          onChange={e => mudarQtd(l.id, e.target.value)}
                          className="w-16 text-right tabular-nums border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </label>
                      <span className="text-sm font-semibold text-slate-700 tabular-nums w-24 text-right">
                        {fmt(unit * (Number(l.quantidade) || 1))}
                      </span>
                      <button type="button" onClick={() => removerLinha(l.id)} aria-label={`Remover ${l.descricao} do kit`}
                        className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {faltando > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                {faltando} {faltando === 1 ? 'peça deste kit está' : 'peças deste kit estão'} sem estoque hoje.
                O kit pode ser salvo assim mesmo — o aviso volta a aparecer na hora de aplicar.
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------- LISTA ----------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500 max-w-xl">
          Kit é a revisão pronta: filtros, óleo e a mão de obra em um clique.
          Monte aqui e aplique na OS ou no orçamento.
        </p>
        <button onClick={novoKit}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Novo Kit
        </button>
      </div>

      {kits.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 py-14 text-center">
          <Package size={32} className="text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhum kit criado ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Ex.: &quot;Kit Polo TSI&quot; com os quatro filtros, o óleo e a revisão.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {kits.map(kit => {
            const pecas = (kit.itens || []).filter(l => l.tipo === 'peca').length
            const servs = (kit.itens || []).length - pecas
            const semEstoque = (kit.itens || []).filter(l => l.tipo === 'peca' && pecaSemEstoque(estoque, l.produtoId)).length
            return (
              <div key={kit.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 break-words">{kit.nome}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {pecas} {pecas === 1 ? 'peça' : 'peças'} · {servs} {servs === 1 ? 'serviço' : 'serviços'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => abrirKit(kit)} title="Editar kit"
                      className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => excluirKit(kit)} title="Excluir kit"
                      className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>

                <p className="text-lg font-bold text-slate-800 tabular-nums">{fmt(totalDoKit(kit, servicos, estoque))}</p>

                {semEstoque > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                    <AlertTriangle size={13} className="flex-shrink-0" />
                    {semEstoque} {semEstoque === 1 ? 'peça sem estoque' : 'peças sem estoque'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

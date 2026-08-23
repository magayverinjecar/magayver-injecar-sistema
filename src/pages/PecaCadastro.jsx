import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Package, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import gerarId from '../utils/id'
import FormularioPeca from '../components/FormularioPeca'
import { PECA_VAZIA } from '../utils/pecaCampos'
import { pecaComCodigo } from '../utils/pecas'

// Cadastro da peça em tela inteira, não em popup.
//
// POR QUE DEIXOU DE SER POPUP — leia antes de mexer.
//
// Este formulário tem 20 campos em 4 seções. Todos os outros popups do sistema
// têm no máximo 8 (conferido um a um): eles são decisão curta — confirmar,
// ajustar saldo, escolher uma coisa —, que é o uso certo de popup. Ficha de
// cadastro não é decisão curta, e como popup ela custava três coisas:
//
//   1. Rolagem dentro de uma caixa, com a lista inútil atrás.
//   2. Nenhum endereço próprio: atualizar a página no meio perdia tudo, e o
//      botão "voltar" do navegador fazia coisa nenhuma.
//   3. Clicar fora fechava e apagava os 20 campos sem avisar — o popup de
//      cliente (6 campos) se protegia disso, este não.
//
// Como tela, segue o padrão que o sistema já usa em toda ficha grande: OS,
// Compra, Nova Entrada, Checklist, Diagnóstico. Salvou, volta para a lista.
//
// A mesma tela serve para cadastrar e para editar — o que muda é o saldo, que
// só é digitável no cadastro (na edição o saldo pertence ao kardex).
export default function PecaCadastro() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { estoque, setEstoque, movimentarEstoque } = useApp()
  const { currentUser } = useAuth()

  const editando = id != null
  const original = editando ? estoque.find(p => String(p.id) === String(id)) : null

  const [form, setForm] = useState(() =>
    original ? { ...original, minimo: String(original.minimo ?? 0) } : { ...PECA_VAZIA })
  const [erro, setErro] = useState('')
  const salvouRef = useRef(false)

  // A lista do estoque chega do banco DEPOIS da primeira pintura: abrir a
  // edição por link direto (ou dar F5 aqui) pega `original` ainda indefinido, e
  // o formulário nasceria em branco — salvar apagaria o cadastro inteiro. Este
  // é o preenchimento quando a peça enfim aparece.
  //
  // Ajuste de estado durante a pintura, e não em efeito: é o padrão que o React
  // recomenda para estado que deriva de outra coisa. Em efeito, a tela pintaria
  // uma vez em branco antes de corrigir.
  const [carregadaDe, setCarregadaDe] = useState(null)
  if (original && carregadaDe !== original.id) {
    setCarregadaDe(original.id)
    setForm({ ...original, minimo: String(original.minimo ?? 0) })
  }

  // Há trabalho a perder? Comparado direto com a origem, sem guardar cópia:
  // no cadastro, contra o formulário vazio; na edição, contra a peça como ela
  // está gravada. Sem isto, um clique no menu lateral apagaria o cadastro em
  // silêncio — risco que o popup não tinha, porque prendia a tela.
  const referencia = editando
    ? (original ? { ...original, minimo: String(original.minimo ?? 0) } : null)
    : { ...PECA_VAZIA }
  const sujo = referencia != null && JSON.stringify(form) !== JSON.stringify(referencia)

  // Fechar a aba ou atualizar a página com cadastro pela metade agora avisa.
  useEffect(() => {
    if (!sujo) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])

  function voltar() {
    if (sujo && !salvouRef.current && !confirm('Sair sem salvar? O que foi preenchido se perde.')) return
    navigate('/estoque')
  }

  function salvar() {
    if (!form.nome.trim()) {
      setErro('O nome da peça é obrigatório.')
      return
    }
    // Código repetido não entra: é assim que a mesma vela virou sete cadastros,
    // com o saldo real espalhado em sete linhas. A comparação perdoa espaço,
    // hífen, barra, ponto e acento — "FLU/DS/280" e "flu ds 280" são a mesma.
    const jaExiste = pecaComCodigo(estoque, form.codigo, editando ? { ignorarId: form.id } : undefined)
    if (jaExiste) {
      setErro(`O código ${form.codigo} já está cadastrado em "${jaExiste.nome}". `
        + (editando
          ? 'Duas peças com o mesmo código dividem o saldo e o alerta de mínimo.'
          : 'Se for a mesma peça, use a que já existe. Se for outra, corrija o código.'))
      return
    }

    // Maiúscula só ao salvar — em caps enquanto digita, o corretor do navegador
    // pula as palavras achando que é sigla.
    const emCaps = {
      nome: form.nome.toUpperCase().trim(),
      categoria: (form.categoria || '').toUpperCase(),
      marca: (form.marca || '').toUpperCase(),
      aplicacao: (form.aplicacao || '').toUpperCase(),
      localizacao: (form.localizacao || '').toUpperCase(),
      minimo: Number(form.minimo) || 0,
    }

    if (editando) {
      // O saldo NÃO passa por aqui: editar cadastro mexe em nome, código,
      // preços e mínimo. Saldo muda por movimentação, senão a foto do
      // formulário apagaria baixas feitas em outro aparelho.
      setEstoque(prev => prev.map(i => String(i.id) === String(form.id)
        ? { ...form, ...emCaps, estoque: i.estoque }
        : i))
    } else {
      // A peça nasce com saldo ZERO e a quantidade inicial entra por movimento
      // de "saldo inicial" no kardex: o extrato explica o saldo desde o dia um.
      const novoId = gerarId()
      const qtdInicial = Number(form.estoque) || 0
      setEstoque(prev => [...prev, {
        ...form, ...emCaps,
        id: novoId, estoque: 0, ativo: true,
        criadoEm: Date.now(),
        criadoPor: currentUser?.nome || '',
      }])
      if (qtdInicial !== 0) {
        movimentarEstoque({
          pecaId: novoId,
          qtd: qtdInicial,
          tipo: 'saldo_inicial',
          motivo: 'Cadastro da peça',
          custoUnit: form.precoCusto,
          criarSeFaltar: true,
        })
      }
    }

    salvouRef.current = true
    navigate('/estoque')
  }

  // Editar uma peça que não existe (link velho, peça apagada em outro aparelho)
  // não pode virar formulário em branco: salvar ali criaria um cadastro fantasma.
  if (editando && !original && estoque.length > 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <Package size={30} className="text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Peça não encontrada.</p>
        <p className="text-xs text-slate-400 mt-1">Ela pode ter sido excluída ou juntada em outro cadastro.</p>
        <button onClick={() => navigate('/estoque')}
          className="mt-4 inline-flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          <ArrowLeft size={15} /> Voltar ao estoque
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl lg:max-w-none mx-auto">

      <div className="flex items-center gap-3 mb-5">
        <button onClick={voltar} title="Voltar ao estoque"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl lg:text-base font-bold text-slate-800">
            {editando ? 'Editar Peça' : 'Nova Peça / Item'}
          </h1>
          <p className="text-sm lg:text-xs text-slate-400">
            {editando
              ? 'O saldo não muda aqui — ele muda por movimentação, e o extrato guarda o porquê.'
              : 'A quantidade inicial entra como movimento de saldo inicial no extrato.'}
          </p>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{erro}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl lg:rounded p-6 lg:p-4">
        {/* `largo`: na tela cheia as quatro seções ficam abertas e lado a lado.
            A sanfona existia porque no popup não cabia tudo — aqui cabe, e
            cadastro com tudo à vista é mais rápido do que abrir seção por seção. */}
        <FormularioPeca f={form} set={setForm} comSaldo={!editando} largo />
      </div>

      {/* Barra fixa no fim do conteúdo, no mesmo lugar em que as outras telas do
          sistema põem o botão de gravar. */}
      <div className="flex items-center justify-between gap-4 mt-4 px-4 py-3 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600">
        <span>
          {!form.nome.trim()
            ? <>Falta: <strong className="font-medium text-amber-700">nome da peça</strong></>
            : sujo
              ? <span className="text-slate-500">Alterações não salvas</span>
              : <span className="text-slate-400">Nada alterado</span>}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={voltar}
            className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded text-xs font-medium hover:bg-white transition-colors">
            Cancelar
          </button>
          <button onClick={salvar}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-1.5 rounded text-xs font-semibold transition-colors">
            <Check size={14} /> {editando ? 'Salvar alterações' : 'Cadastrar peça'}
          </button>
        </div>
      </div>
    </div>
  )
}

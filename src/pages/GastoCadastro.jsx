import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import TelaCadastro from '../components/TelaCadastro'
import { sincronizarFinanceiro, paraISO } from '../utils/gastoFinanceiro'
import { ehRetirada, ehFinanceiro } from '../utils/margem'

// Cadastro do gasto em tela, não em popup.
//
// Foi o último popup de cadastro que sobrou — os outros sete viraram tela em
// 23/08. Este ficou, e é justamente o de maior volume: as contas do mês são
// vinte e tantos lançamentos parecidos, feitos de uma sentada.
//
// Como popup ele custava o que todos custavam (sem endereço próprio, clicar
// fora apagava tudo, F5 no meio perdia o preenchimento), e mais uma coisa que
// só aparece no lote: obrigava a voltar para a lista entre um gasto e o
// seguinte. Daí o botão "Salvar e lançar outro", que é o motivo real desta
// tela existir — custo fixo cadastrado pela metade estraga o custo da hora
// inteiro, e o que faz parar no meio é o atrito, não a falta de vontade.

// As categorias em três grupos, e o <optgroup> mostra isso na hora de escolher.
//
// A separação não é organização: é a decisão que muda o custo da hora. Numa
// lista corrida de 17 nomes, "Empréstimo" e "Energia" parecem a mesma espécie
// de coisa — e não são. Uma vira preço, a outra não pode virar.
const GRUPOS = [
  {
    rotulo: 'Custo de operar — entra no preço',
    itens: ['Aluguel', 'Água', 'Energia', 'Internet', 'Telefone', 'Salário',
      'Impostos', 'Manutenção', 'Marketing', 'Seguro', 'Contabilidade', 'Depreciação'],
  },
  {
    rotulo: 'Dívida e bem — fica fora do preço',
    itens: ['Empréstimo', 'Equipamento', 'Investimento'],
  },
  {
    rotulo: 'Distribuição do lucro',
    itens: ['Retirada', 'Pró-labore'],
  },
  { rotulo: 'Sem classificar', itens: ['Outros'] },
]

const VAZIO = { descricao: '', categoria: 'Outros', tipo: 'Fixo', valor: '', status: 'Pendente', data: '', recorrente: true, observacoes: '' }
const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'

// O que este gasto vai fazer com os números — dito ANTES de gravar.
//
// Usa `ehRetirada` e `ehFinanceiro`, as MESMAS funções que o cálculo usa. Um
// aviso escrito à mão poderia descrever um comportamento que o sistema não tem;
// este não pode mentir, porque pergunta para quem decide.
function oQueVaiAcontecer(form) {
  const g = { categoria: form.categoria, descricao: form.descricao }
  if (ehRetirada(g)) {
    return {
      cor: 'bg-violet-50 border-violet-200 text-violet-800',
      texto: 'Fica FORA do custo fixo. Aparece no DRE abaixo do resultado, como distribuição do lucro — retirar dinheiro não é custo da oficina.',
    }
  }
  if (ehFinanceiro(g)) {
    return {
      cor: 'bg-amber-50 border-amber-200 text-amber-800',
      texto: 'Fica FORA do custo da hora, de propósito. Vai para a linha "Compromissos financeiros" do DRE, abaixo do resultado: dívida é cobrança sobre a margem, não custo de produzir. Se entrasse no preço, a tabela subiria acima do mercado — e não desceria quando a dívida acabasse.',
    }
  }
  if (form.tipo === 'Fixo') {
    return {
      cor: 'bg-blue-50 border-blue-200 text-blue-800',
      texto: 'Entra no custo fixo: custo da hora, ponto de equilíbrio e régua de preço do orçamento. É o que a oficina precisa faturar para se pagar.',
    }
  }
  return {
    cor: 'bg-slate-50 border-slate-200 text-slate-600',
    texto: 'Gasto variável: entra no resultado do mês pela data de vencimento, e não no custo da hora.',
  }
}

export default function GastoCadastro() {
  const { id } = useParams()
  const { gastos, setGastos, adicionarLancamento, setFinanceiro } = useApp()

  const editando = id != null
  const original = editando ? gastos.find(g => String(g.id) === String(id)) : null

  const daOrigem = (g) => ({ ...VAZIO, ...g, data: paraISO(g.vencimento) })
  const [form, setForm] = useState(() => (original ? daOrigem(original) : { ...VAZIO }))
  const [erro, setErro] = useState('')

  // A lista chega do banco DEPOIS da primeira pintura: abrir a edição por link
  // direto (ou dar F5 aqui) pegaria `original` indefinido e o formulário
  // nasceria em branco — salvar apagaria o gasto. Mesmo padrão do PecaCadastro:
  // ajuste durante a pintura, não em efeito.
  const [carregadoDe, setCarregadoDe] = useState(null)
  if (original && carregadoDe !== original.id) {
    setCarregadoDe(original.id)
    setForm(daOrigem(original))
  }

  const campo = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const referencia = editando ? (original ? daOrigem(original) : null) : { ...VAZIO }
  const sujo = referencia != null && JSON.stringify(form) !== JSON.stringify(referencia)

  const faltando = [
    !form.descricao.trim() && 'descrição',
    !form.valor && 'valor',
  ].filter(Boolean).join(' e ')

  const aviso = oQueVaiAcontecer(form)

  function salvar() {
    if (!form.descricao.trim() || !form.valor) {
      setErro('Descrição e valor são obrigatórios — sem valor o gasto não entra em conta nenhuma.')
      return false
    }
    setErro('')
    // Sem data informada numa EDIÇÃO, mantém o vencimento que já existia.
    const vencimento = form.data
      ? new Date(form.data + 'T12:00:00').toLocaleDateString('pt-BR')
      : (original?.vencimento || new Date().toLocaleDateString('pt-BR'))
    const portas = { adicionarLancamento, setFinanceiro }

    if (editando) {
      if (!original) { setErro('Este gasto não foi encontrado. Volte para a lista e abra de novo.'); return false }
      const atualizado = { ...original, ...form, vencimento }
      setGastos(prev => prev.map(g => g.id === original.id ? atualizado : g))
      sincronizarFinanceiro(atualizado, original.status, portas)
    } else {
      const novo = { ...form, id: gerarId(), vencimento }
      setGastos(prev => [novo, ...prev])
      sincronizarFinanceiro(novo, null, portas)
    }
  }

  // Depois de gravar em lote, o que fica e o que limpa.
  //
  // Fica: categoria, tipo, status, recorrência e vencimento — lançar as contas
  // do mês é repetir esses cinco e trocar só nome e valor (oito empréstimos
  // seguidos, por exemplo). Limpa: descrição, valor e observação, que são o que
  // muda de um para o outro. Zerar tudo faria o botão economizar meio clique.
  function proximo() {
    setForm(f => ({
      ...VAZIO,
      categoria: f.categoria, tipo: f.tipo, status: f.status,
      recorrente: f.recorrente, data: f.data,
    }))
    setErro('')
  }

  return (
    <TelaCadastro
      titulo={editando ? 'Editar Gasto' : 'Novo Gasto'}
      subtitulo={editando
        ? 'Corrigir a categoria aqui muda em qual linha do DRE este gasto aparece.'
        : 'A categoria decide se este gasto entra no preço dos seus serviços ou não.'}
      voltarPara="/gastos"
      sujo={sujo}
      faltando={faltando}
      erro={erro}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Lançar gasto'}
      rotuloLimpo={editando ? 'Nada alterado' : 'Nada preenchido ainda'}
      acaoSecundaria={editando ? null : { rotulo: 'Salvar e lançar outro', onDepois: proximo }}
      onSalvar={salvar}
    >
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-4">
          <label className={ROTULO}>Descrição *</label>
          <input value={form.descricao} onChange={campo('descricao')} spellCheck lang="pt-BR"
            placeholder="Ex: Empréstimo Banco Inter" className={INP} autoFocus />
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Valor (R$) *</label>
          <input value={form.valor} onChange={campo('valor')} inputMode="decimal"
            placeholder="0,00" className={INP} />
        </div>

        <div className="lg:col-span-3">
          <label className={ROTULO}>Categoria</label>
          <select value={form.categoria} onChange={campo('categoria')} className={INP}>
            {GRUPOS.map(g => (
              <optgroup key={g.rotulo} label={g.rotulo}>
                {g.itens.map(c => <option key={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="lg:col-span-3">
          <label className={ROTULO}>Tipo</label>
          {/* Trocar para Fixo religa a recorrência; para Variável, desliga —
              gasto variável costuma ser pontual. Continua editável no toggle
              abaixo para os casos fora da regra. */}
          <select value={form.tipo} className={INP}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value, recorrente: e.target.value === 'Fixo' }))}>
            <option>Fixo</option>
            <option>Variável</option>
          </select>
        </div>

        {/* O aviso vem logo abaixo da categoria e do tipo — no lugar onde a
            decisão acabou de ser tomada, e não no fim do formulário. */}
        <div className="lg:col-span-6">
          <div className={`border rounded-lg px-3 py-2.5 text-xs leading-relaxed ${aviso.cor}`}>
            {aviso.texto}
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className={ROTULO}>Vencimento</label>
          <input type="date" value={form.data} onChange={campo('data')} className={INP} />
          <p className="text-[11px] text-slate-400 mt-1">É o que decide em qual mês o gasto entra.</p>
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Status</label>
          <select value={form.status} onChange={campo('status')} className={INP}>
            <option>Pendente</option>
            <option>Pago</option>
            <option>Atrasado</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">Marcar como Pago lança a despesa no Financeiro.</p>
        </div>
        <div className="lg:col-span-2">
          <label className={ROTULO}>Repetição</label>
          <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <button type="button" onClick={() => setForm(f => ({ ...f, recorrente: !f.recorrente }))}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${form.recorrente ? 'bg-primary-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.recorrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <p className="text-xs text-slate-600 leading-snug">
              {form.recorrente
                ? <>Todo mês. <strong className="font-medium">Lance uma vez só</strong> — o sistema repete.</>
                : 'Só neste mês, no vencimento acima.'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-6">
          <label className={ROTULO}>Observações</label>
          <textarea value={form.observacoes} onChange={campo('observacoes')} rows={2}
            spellCheck lang="pt-BR" placeholder="Ex: 24 parcelas, termina em 08/2028"
            className={`${INP} resize-none`} />
        </div>
      </div>
    </TelaCadastro>
  )
}

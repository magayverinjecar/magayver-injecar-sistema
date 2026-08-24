import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react'

// A casca das telas de cadastro — cabeçalho com o voltar, o corpo, e a barra
// de gravar embaixo.
//
// Existe porque cinco cadastros deixaram de ser popup no mesmo dia (peça,
// funcionário, veículo, serviço, cliente) e todos precisam das mesmas três
// coisas que o popup dava de graça e a tela não dá:
//
//   1. um jeito de voltar sem perder o que foi digitado por engano;
//   2. o aviso ao fechar a aba com trabalho pela metade;
//   3. um lugar fixo para o botão de gravar, igual em todas.
//
// Repetir isso em cinco arquivos garantia que uma delas ia ficar diferente das
// outras — normalmente a que ninguém testou.
//
// `sujo`: quem chama compara o formulário com a origem e diz se há trabalho a
// perder. Fica com o chamador porque só ele sabe o que conta como alteração.
export default function TelaCadastro({
  titulo,
  subtitulo,
  voltarPara,
  sujo = false,
  faltando = '',
  erro = '',
  rotuloSalvar = 'Salvar',
  // O que o rodape diz quando nao ha nada a gravar. Muda entre cadastrar
  // ("nada preenchido") e corrigir ("nada alterado") — a mesma frase nos dois
  // casos soa errada em um deles.
  rotuloLimpo = 'Nada preenchido ainda',
  // Grava e FICA na tela, com o formulário zerado para o próximo.
  //
  // Existe para o cadastro em lote. Lançar as contas do mês são vinte e tantos
  // registros parecidos: sem isto é gravar → voltar para a lista → achar o botão
  // → abrir de novo, vinte e tantas vezes. É justamente o trabalho em lote que
  // faz a pessoa desistir de cadastrar tudo — e custo fixo pela metade estraga
  // o custo da hora inteiro.
  //
  // `{ rotulo, onDepois }`: quem chama zera o próprio formulário no `onDepois`.
  acaoSecundaria = null,
  onSalvar,
  children,
}) {
  const navigate = useNavigate()
  const salvouRef = useRef(false)
  const [gravados, setGravados] = useState(0)

  useEffect(() => {
    if (!sujo) return
    const avisar = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])

  function voltar() {
    if (sujo && !salvouRef.current && !confirm('Sair sem salvar? O que foi preenchido se perde.')) return
    navigate(voltarPara)
  }

  function salvar() {
    // O `onSalvar` devolve false quando a validação dele barrou — aí a tela
    // continua onde está, e a marca de "já salvei" não pode ser posta, senão o
    // voltar seguinte deixaria de avisar sobre o que ainda está por gravar.
    const ok = onSalvar?.()
    if (ok === false) return
    salvouRef.current = true
    navigate(voltarPara)
  }

  // Mesma gravação, sem sair da tela.
  function salvarEContinuar() {
    const ok = onSalvar?.()
    if (ok === false) return
    setGravados(n => n + 1)
    acaoSecundaria.onDepois?.()
    // O formulário volta a zero, então a próxima saída com coisa digitada tem
    // de avisar de novo. Sem esta linha, o `salvouRef` de um registro já gravado
    // silenciaria o aviso do SEGUINTE, que ainda está por gravar.
    salvouRef.current = false
  }

  return (
    <div className="p-6 max-w-3xl lg:max-w-none mx-auto">

      <div className="flex items-center gap-3 mb-5">
        <button onClick={voltar} title="Voltar"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl lg:text-base font-bold text-slate-800">{titulo}</h1>
          {subtitulo && <p className="text-sm lg:text-xs text-slate-400">{subtitulo}</p>}
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{erro}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl lg:rounded p-6 lg:p-4">
        {children}
      </div>

      <div className="flex items-center justify-between gap-4 mt-4 px-4 py-3 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600">
        <span>
          {gravados > 0 && (
            <span className="text-green-700 font-medium mr-2">
              {gravados} gravado{gravados === 1 ? '' : 's'} aqui ·
            </span>
          )}
          {faltando
            ? <>Falta: <strong className="font-medium text-amber-700">{faltando}</strong></>
            : sujo
              ? <span className="text-slate-500">Alterações não salvas</span>
              : <span className="text-slate-400">{rotuloLimpo}</span>}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={voltar}
            className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded text-xs font-medium hover:bg-white transition-colors">
            Cancelar
          </button>
          {acaoSecundaria && (
            <button onClick={salvarEContinuar} title="Grava e deixa a tela pronta para o próximo"
              className="border border-green-600 text-green-700 px-4 py-1.5 rounded text-xs font-semibold hover:bg-green-50 transition-colors">
              {acaoSecundaria.rotulo}
            </button>
          )}
          <button onClick={salvar}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-1.5 rounded text-xs font-semibold transition-colors">
            <Check size={14} /> {rotuloSalvar}
          </button>
        </div>
      </div>
    </div>
  )
}

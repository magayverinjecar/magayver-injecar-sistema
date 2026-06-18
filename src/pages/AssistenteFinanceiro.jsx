import { useState, useMemo, useRef, useEffect } from 'react'
import { Brain, Send, Bot, User, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'

function parseVal(v) {
  if (!v) return 0
  return parseFloat(v.toString().replace(',', '.')) || 0
}

function fmt(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function brToDate(str) {
  if (!str) return null
  const [datePart] = str.split(' ')
  const [d, m, y] = datePart.split('/')
  if (!d || !m || !y) return null
  return new Date(`${y}-${m}-${d}`)
}

function mesAno(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function nomeMes(num) {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][num]
}

const sugestoes = [
  { categoria: '💰 Financeiro', perguntas: [
    'Qual foi o faturamento este mês?',
    'Como está minha margem de lucro?',
    'Qual o ticket médio das OS?',
    'Qual foi o mês mais lucrativo?',
  ]},
  { categoria: '🔧 Operacional', perguntas: [
    'Quantas OS estão em aberto?',
    'Qual mecânico é mais produtivo?',
    'Qual serviço é mais realizado?',
    'Qual a taxa de conversão dos orçamentos?',
  ]},
  { categoria: '👥 Clientes', perguntas: [
    'Quais são meus clientes mais valiosos?',
    'Quais clientes estão inativos há mais de 90 dias?',
    'Quantos clientes novos tive este mês?',
    'Qual veículo aparece mais na oficina?',
  ]},
  { categoria: '📦 Estoque', perguntas: [
    'Quais itens estão em falta ou críticos?',
    'Qual o valor total do meu estoque?',
  ]},
  { categoria: '📅 Agenda', perguntas: [
    'Quantos agendamentos tenho hoje?',
  ]},
]

function DigitandoDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

function TextoAnimado({ texto }) {
  const [visivel, setVisivel] = useState('')
  useEffect(() => {
    let i = 0
    setVisivel('')
    const timer = setInterval(() => {
      i++
      setVisivel(texto.slice(0, i))
      if (i >= texto.length) clearInterval(timer)
    }, 12)
    return () => clearInterval(timer)
  }, [texto])
  return <span style={{ whiteSpace: 'pre-line' }}>{visivel}</span>
}

export default function AssistenteFinanceiro() {
  const { clientes, veiculos, ordens, estoque, financeiro, funcionarios, orcamentos, agenda, totalOrdem } = useApp()
  const [mensagens, setMensagens] = useState([
    { id: 0, tipo: 'bot', texto: 'Olá! Sou o Assistente Financeiro da sua oficina.\n\nAnaliso os dados do sistema em tempo real e respondo perguntas sobre finanças, clientes, estoque e operacional.\n\nEscolha uma categoria abaixo e clique em uma pergunta para começar.', animado: false },
  ])
  const [pensando, setPensando] = useState(false)
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(0)
  const fimRef = useRef(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, pensando])

  const hoje = new Date()
  const mesAtual = mesAno(hoje)
  const mesAnterior = mesAno(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
  const hojeStr = hoje.toLocaleDateString('pt-BR')

  const dados = useMemo(() => {
    const receitasPorMes = {}, despesasPorMes = {}
    financeiro.forEach(l => {
      const d = brToDate(l.data)
      if (!d) return
      const k = mesAno(d)
      if (l.tipo === 'receita') receitasPorMes[k] = (receitasPorMes[k] || 0) + parseVal(l.valor)
      else despesasPorMes[k] = (despesasPorMes[k] || 0) + parseVal(l.valor)
    })

    const recMes = receitasPorMes[mesAtual] || 0
    const recAnt = receitasPorMes[mesAnterior] || 0
    const despMes = despesasPorMes[mesAtual] || 0
    const lucroMes = recMes - despMes
    const variacaoRec = recAnt > 0 ? ((recMes - recAnt) / recAnt) * 100 : null
    const margemLucro = recMes > 0 ? (lucroMes / recMes) * 100 : 0

    let melhorMes = null, melhorLucro = -Infinity
    Object.keys(receitasPorMes).forEach(k => {
      const l = (receitasPorMes[k] || 0) - (despesasPorMes[k] || 0)
      if (l > melhorLucro) { melhorLucro = l; melhorMes = k }
    })

    const osAbertas = ordens.filter(o => ['Aberta','Em andamento','Aguardando peças'].includes(o.status))
    const osConcluidas = ordens.filter(o => ['Concluída','Entregue'].includes(o.status))
    const osAtrasadas = osAbertas.filter(o => {
      const d = brToDate(o.data || o.dataEntrada)
      return d && (hoje - d) / 86400000 > 3
    })

    const valoresOS = osConcluidas.map(o => totalOrdem(o)).filter(v => v > 0)
    const ticketMedio = valoresOS.length > 0 ? valoresOS.reduce((a, b) => a + b, 0) / valoresOS.length : 0

    const osMes = osConcluidas.filter(o => {
      const d = brToDate(o.data || o.dataConclusao || o.dataEntrada)
      return d && mesAno(d) === mesAtual
    })

    const porMecanico = {}
    osConcluidas.forEach(o => {
      if (o.mecanicoId) porMecanico[o.mecanicoId] = (porMecanico[o.mecanicoId] || 0) + 1
    })
    const mecanicoTopEntry = Object.entries(porMecanico).sort((a, b) => b[1] - a[1])[0]
    const mecanicoNome = mecanicoTopEntry ? (funcionarios.find(f => f.id === Number(mecanicoTopEntry[0]))?.nome || 'Desconhecido') : null

    const contServicos = {}
    ordens.forEach(o => { const s = o.servico || o.descricaoProblema || ''; if (s) contServicos[s] = (contServicos[s] || 0) + 1 })
    const servicoTop = Object.entries(contServicos).sort((a, b) => b[1] - a[1])[0]

    const orcTotal = orcamentos.length
    const orcAprovados = orcamentos.filter(o => o.status === 'Aprovado').length
    const taxaConversao = orcTotal > 0 ? (orcAprovados / orcTotal) * 100 : null

    const atividadeCliente = {}
    ordens.forEach(o => {
      const d = brToDate(o.data || o.dataEntrada)
      if (!d || !o.clienteId) return
      if (!atividadeCliente[o.clienteId] || d > atividadeCliente[o.clienteId]) atividadeCliente[o.clienteId] = d
    })
    const inativos = clientes.filter(c => {
      const ult = atividadeCliente[c.id]
      return !ult || (hoje - ult) / 86400000 > 90
    })

    const valorCliente = {}
    osConcluidas.forEach(o => {
      if (o.clienteId) valorCliente[o.clienteId] = (valorCliente[o.clienteId] || 0) + totalOrdem(o)
    })
    const topClientes = Object.entries(valorCliente)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, val]) => ({ cliente: clientes.find(c => c.id === Number(id)), val }))
      .filter(x => x.cliente)

    const clientesNovosMes = clientes.filter(c => { const d = brToDate(c.dataCadastro); return d && mesAno(d) === mesAtual })

    const contModelos = {}
    veiculos.forEach(v => { const m = v.modelo || 'Desconhecido'; contModelos[m] = (contModelos[m] || 0) + 1 })
    const modeloTop = Object.entries(contModelos).sort((a, b) => b[1] - a[1])[0]

    const itensCriticos = estoque.filter(i => Number(i.estoque) < Number(i.minimo))
    const itensSemEstoque = estoque.filter(i => Number(i.estoque) === 0)
    const valorTotalEstoque = estoque.reduce((s, i) => s + parseVal(i.preco) * Number(i.estoque), 0)

    const agendaHoje = agenda.filter(a => a.data === hojeStr)

    return {
      recMes, recAnt, despMes, lucroMes, variacaoRec, margemLucro,
      melhorMes, melhorLucro, osAbertas, osConcluidas, osAtrasadas,
      ticketMedio, osMes, porMecanico, mecanicoNome,
      servicoTop, taxaConversao, orcTotal, orcAprovados,
      inativos, topClientes, clientesNovosMes, modeloTop,
      itensCriticos, itensSemEstoque, valorTotalEstoque, agendaHoje,
    }
  }, [clientes, veiculos, ordens, estoque, financeiro, funcionarios, orcamentos, agenda])

  function gerarTexto(pergunta) {
    const d = dados

    if (pergunta.includes('faturamento este mês')) {
      const [m, a] = mesAtual.split('/')
      let texto = `📊 Faturamento de ${nomeMes(Number(m)-1)} de ${a}:\n\n`
      texto += `• Total faturado: ${fmt(d.recMes)}\n`
      texto += `• OS concluídas no mês: ${d.osMes.length}\n`
      if (d.variacaoRec !== null) {
        const sinal = d.variacaoRec >= 0 ? '▲' : '▼'
        texto += `• Variação vs mês anterior: ${sinal} ${Math.abs(d.variacaoRec).toFixed(1)}%\n`
        texto += `• Mês anterior: ${fmt(d.recAnt)}\n`
      } else {
        texto += `• Sem dados do mês anterior para comparar.\n`
      }
      return texto
    }

    if (pergunta.includes('margem de lucro')) {
      const status = d.margemLucro >= 30 ? '✅ Saudável' : d.margemLucro >= 10 ? '⚠️ Moderada' : '🚨 Baixa'
      let texto = `💰 Margem de lucro deste mês:\n\n`
      texto += `• Receita total: ${fmt(d.recMes)}\n`
      texto += `• Despesas: ${fmt(d.despMes)}\n`
      texto += `• Lucro líquido: ${fmt(d.lucroMes)}\n`
      texto += `• Margem: ${d.margemLucro.toFixed(1)}% — ${status}\n\n`
      if (d.margemLucro >= 30) texto += `O negócio está em boa situação financeira.`
      else if (d.margemLucro >= 10) texto += `Recomendo revisar as despesas para melhorar a margem.`
      else texto += `Atenção: as despesas estão consumindo a maior parte da receita.`
      return texto
    }

    if (pergunta.includes('ticket médio')) {
      let texto = `🔧 Ticket médio por OS:\n\n`
      texto += `• Valor médio: ${fmt(d.ticketMedio)}\n`
      texto += `• Baseado em: ${d.osConcluidas.length} OS concluída(s)\n\n`
      if (d.ticketMedio >= 200) texto += `✅ Ticket em bom nível.`
      else if (d.ticketMedio > 0) texto += `💡 Considere oferecer serviços adicionais para aumentar o valor por atendimento.`
      else texto += `Nenhuma OS concluída registrada ainda.`
      return texto
    }

    if (pergunta.includes('mês mais lucrativo')) {
      if (!d.melhorMes) return `Sem dados financeiros suficientes para calcular.`
      const [m, a] = d.melhorMes.split('/')
      let texto = `⭐ Mês mais lucrativo:\n\n`
      texto += `• Mês: ${nomeMes(Number(m)-1)} de ${a}\n`
      texto += `• Lucro neste mês: ${fmt(d.melhorLucro)}\n\n`
      texto += `Este foi o período com maior resultado líquido registrado no sistema.`
      return texto
    }

    if (pergunta.includes('OS estão em aberto')) {
      let texto = `📋 Situação das ordens de serviço:\n\n`
      texto += `• OS abertas no momento: ${d.osAbertas.length}\n`
      texto += `• OS atrasadas (mais de 3 dias): ${d.osAtrasadas.length}\n`
      texto += `• OS concluídas no histórico: ${d.osConcluidas.length}\n`
      if (d.osAbertas.length > 0) {
        texto += `\nOS abertas:\n`
        d.osAbertas.slice(0, 5).forEach(o => { texto += `  — ${o.id} · ${o.status}\n` })
        if (d.osAbertas.length > 5) texto += `  ... e mais ${d.osAbertas.length - 5} outras.`
      }
      return texto
    }

    if (pergunta.includes('mecânico é mais produtivo')) {
      if (!d.mecanicoNome) return `Nenhuma OS está vinculada a um mecânico ainda.\n\nAtribua um mecânico nas ordens de serviço para ver o ranking.`
      let texto = `👨‍🔧 Ranking de produtividade por mecânico:\n\n`
      Object.entries(d.porMecanico)
        .sort((a, b) => b[1] - a[1])
        .forEach(([id, qtd], i) => {
          const f = funcionarios.find(f => f.id === Number(id))
          const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
          texto += `${medalha} ${f?.nome || 'Desconhecido'}: ${qtd} OS concluída(s)\n`
        })
      return texto
    }

    if (pergunta.includes('serviço é mais realizado')) {
      if (!d.servicoTop) return `Sem OS cadastradas ainda.`
      let texto = `🔩 Serviço mais realizado na oficina:\n\n`
      texto += `• Serviço: ${d.servicoTop[0]}\n`
      texto += `• Realizado: ${d.servicoTop[1]} vez(es)\n\n`
      texto += `💡 Mantenha em estoque os itens utilizados neste serviço para agilizar os atendimentos.`
      return texto
    }

    if (pergunta.includes('taxa de conversão')) {
      if (d.taxaConversao === null) return `Nenhum orçamento registrado no sistema ainda.`
      let texto = `📄 Taxa de conversão de orçamentos:\n\n`
      texto += `• Total de orçamentos: ${d.orcTotal}\n`
      texto += `• Aprovados: ${d.orcAprovados}\n`
      texto += `• Taxa de conversão: ${d.taxaConversao.toFixed(0)}%\n\n`
      if (d.taxaConversao >= 50) texto += `✅ Boa taxa — mais da metade dos orçamentos viram serviço.`
      else texto += `💡 Taxa abaixo de 50%. Tente responder mais rápido ou revisar os preços.`
      return texto
    }

    if (pergunta.includes('clientes mais valiosos')) {
      if (d.topClientes.length === 0) return `Sem OS concluídas com clientes vinculados ainda.`
      let texto = `👑 Top clientes por valor gasto:\n\n`
      d.topClientes.forEach(({ cliente, val }, i) => {
        const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`
        texto += `${medalha} ${cliente.nome}: ${fmt(val)}\n`
      })
      return texto
    }

    if (pergunta.includes('inativos')) {
      if (d.inativos.length === 0) return `✅ Ótimo! Todos os clientes tiveram atividade nos últimos 90 dias.`
      let texto = `⏰ Clientes sem retorno há mais de 90 dias:\n\n`
      texto += `• Total: ${d.inativos.length} cliente(s)\n\n`
      d.inativos.slice(0, 8).forEach(c => { texto += `• ${c.nome} — ${c.telefone || 'sem telefone'}\n` })
      if (d.inativos.length > 8) texto += `... e mais ${d.inativos.length - 8} outros.\n`
      texto += `\n💡 Uma mensagem simples pode trazer esses clientes de volta.`
      return texto
    }

    if (pergunta.includes('clientes novos')) {
      const [m, a] = mesAtual.split('/')
      let texto = `🆕 Clientes novos em ${nomeMes(Number(m)-1)}:\n\n`
      texto += `• Total: ${d.clientesNovosMes.length} cliente(s) cadastrado(s)\n`
      if (d.clientesNovosMes.length > 0) {
        texto += `\nNomes:\n`
        d.clientesNovosMes.forEach(c => { texto += `• ${c.nome}\n` })
      }
      return texto
    }

    if (pergunta.includes('veículo aparece mais')) {
      if (!d.modeloTop) return `Sem veículos cadastrados no sistema ainda.`
      let texto = `🚗 Veículo mais frequente na oficina:\n\n`
      texto += `• Modelo: ${d.modeloTop[0]}\n`
      texto += `• Quantidade cadastrada: ${d.modeloTop[1]} veículo(s)\n\n`
      texto += `💡 Considere manter peças comuns deste modelo sempre em estoque.`
      return texto
    }

    if (pergunta.includes('falta ou críticos')) {
      if (d.itensCriticos.length === 0) return `✅ Estoque em ordem! Nenhum item está abaixo do mínimo.`
      let texto = `📦 Itens com estoque crítico:\n\n`
      if (d.itensSemEstoque.length > 0) {
        texto += `🔴 ZERADOS (urgente):\n`
        d.itensSemEstoque.forEach(i => { texto += `• ${i.nome}\n` })
        texto += `\n`
      }
      const abaixo = d.itensCriticos.filter(i => Number(i.estoque) > 0)
      if (abaixo.length > 0) {
        texto += `🟡 ABAIXO DO MÍNIMO:\n`
        abaixo.forEach(i => { texto += `• ${i.nome}: ${i.estoque} un (mín: ${i.minimo})\n` })
      }
      return texto
    }

    if (pergunta.includes('valor total do meu estoque')) {
      let texto = `📦 Valor total do estoque:\n\n`
      texto += `• Valor total: ${fmt(d.valorTotalEstoque)}\n`
      texto += `• Itens cadastrados: ${estoque.length}\n`
      texto += `• Itens críticos: ${d.itensCriticos.length}\n`
      texto += `• Itens zerados: ${d.itensSemEstoque.length}`
      return texto
    }

    if (pergunta.includes('agendamentos tenho hoje')) {
      let texto = `📅 Agendamentos para hoje (${hojeStr}):\n\n`
      texto += `• Total: ${d.agendaHoje.length} agendamento(s)\n`
      if (d.agendaHoje.length > 0) {
        texto += `\nDetalhes:\n`
        d.agendaHoje.forEach(ag => {
          const c = clientes.find(cl => cl.id === ag.clienteId)
          texto += `• ${ag.hora} — ${c?.nome || 'Cliente'} · ${ag.servico}\n`
        })
      }
      return texto
    }

    return `Não encontrei dados para essa pergunta.`
  }

  function enviarPergunta(pergunta) {
    const idUser = Date.now()
    setMensagens(prev => [...prev, { id: idUser, tipo: 'user', texto: pergunta, animado: false }])
    setPensando(true)

    const delay = 1200 + Math.random() * 1000
    setTimeout(() => {
      const resposta = gerarTexto(pergunta)
      setPensando(false)
      setMensagens(prev => [...prev, { id: Date.now(), tipo: 'bot', texto: resposta, animado: true }])
    }, delay)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
          <Brain size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Assistente Financeiro</h2>
          <p className="text-xs text-slate-400 flex items-center gap-1"><Sparkles size={10} /> Análise inteligente • dados em tempo real</p>
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {mensagens.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.tipo === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.tipo === 'bot' ? 'bg-primary-500' : 'bg-slate-200'}`}>
              {msg.tipo === 'bot' ? <Bot size={14} className="text-white" /> : <User size={14} className="text-slate-500" />}
            </div>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${msg.tipo === 'bot' ? 'bg-white border border-slate-100 rounded-tl-sm text-slate-700' : 'bg-primary-500 text-white rounded-tr-sm'}`}>
              {msg.tipo === 'bot' && msg.animado
                ? <TextoAnimado texto={msg.texto} />
                : <span style={{ whiteSpace: 'pre-line' }}>{msg.texto}</span>
              }
            </div>
          </div>
        ))}

        {/* Indicador "pensando" */}
        {pensando && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 mt-1">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              <span className="text-xs text-slate-400">Analisando dados</span>
              <DigitandoDots />
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {/* Sugestões */}
      <div className="flex-shrink-0 bg-white border border-slate-100 rounded-2xl shadow-sm p-3 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {sugestoes.map((s, i) => (
            <button
              key={i}
              onClick={() => setCategoriaSelecionada(i)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${categoriaSelecionada === i ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.categoria}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-1">
          {sugestoes[categoriaSelecionada].perguntas.map((p, i) => (
            <button
              key={i}
              disabled={pensando}
              onClick={() => enviarPergunta(p)}
              className="text-left text-sm text-slate-700 bg-slate-50 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-colors flex items-center gap-2 group"
            >
              <Send size={12} className="text-slate-300 group-hover:text-primary-400 flex-shrink-0" />
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

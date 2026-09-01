import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Wrench, Package, Users, PieChart, Lock } from 'lucide-react'
import { useApp } from '../context/AppContext'
import SeletorPeriodo from '../components/ui/SeletorPeriodo'
import { intervaloDe } from '../utils/periodo'
import { ORIGENS_CLIENTE } from '../utils/origemCliente'
import {
  resumoDaGestao, rankingServicos, rankingPecas, rankingClientes,
  serieMensal, dinheiroParado, lacunasDaLeitura,
} from '../utils/gestao'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const curto = (v) => {
  const n = Number(v || 0)
  if (n >= 1000) return 'R$ ' + Math.round(n / 1000) + 'k'
  return 'R$ ' + Math.round(n)
}

// A leitura geral da oficina, num lugar só.
//
// O dado já estava quase todo no sistema — espalhado em Financeiro,
// Produtividade, Estoque e Compras. Para saber "como está minha empresa" era
// preciso abrir sete telas e montar o quadro na cabeça.
//
// DUAS DECISÕES DE DESENHO, as duas pedidas pelo dono:
//
// 1. Tem permissão PRÓPRIA ('gestao'). Aqui estão faturamento, margem, quem
//    fatura quanto e de quem a oficina depende — não é tela de balcão.
//
// 2. As LACUNAS vêm ANTES dos números. Enquanto o custo fixo não estiver
//    cadastrado, "lucro" é receita menos despesa de caixa, e retirar dinheiro
//    olhando esse número descapitaliza a empresa. Um número errado com cara de
//    certo é pior que número nenhum: nele a pessoa confia.
export default function Gestao() {
  const {
    financeiro, ordens, orcamentos, estoque, clientes, gastos, config,
    totalOrdem, getCliente, getFuncionario, setClientes,
  } = useApp()

  // Marcar a origem sem sair da tela.
  //
  // O aviso dizia QUANTOS e escondia QUAIS, e mandava a pessoa procurar noutra
  // tela — que e onde ela desiste. Com o cliente e a lista de canais aqui, o
  // conserto e um clique, e o proprio aviso encolhe a cada resposta ate sumir.
  function marcarOrigem(clienteId, origem) {
    if (!origem) return
    setClientes(prev => prev.map(c => String(c.id) === String(clienteId) ? { ...c, origem } : c))
  }

  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState('mes')
  const [datas, setDatas] = useState({ de: '', ate: '' })
  const intervalo = useMemo(() => intervaloDe(periodo, datas), [periodo, datas])

  const lacunas = useMemo(
    // `ordens` e `intervalo` entram por causa da origem: ela conta só os
    // clientes que chegaram no período escolhido, e não a base inteira.
    () => lacunasDaLeitura({ gastos, config, clientes, estoque, ordens, intervalo }),
    [gastos, config, clientes, estoque, ordens, intervalo],
  )
  const resumo = useMemo(
    () => resumoDaGestao({ financeiro, ordens, intervalo, totalOrdem, gastos }),
    [financeiro, ordens, intervalo, totalOrdem, gastos],
  )
  const servicos = useMemo(() => rankingServicos(ordens, intervalo), [ordens, intervalo])
  const pecas = useMemo(() => rankingPecas(ordens, intervalo, { estoque }), [ordens, intervalo, estoque])
  const cli = useMemo(
    () => rankingClientes(ordens, intervalo, { totalOrdem, nomeDoCliente: (os) => getCliente(os.clienteId)?.nome || os.clienteNome }),
    [ordens, intervalo, totalOrdem, getCliente],
  )
  const serie = useMemo(() => serieMensal(ordens, { meses: 12, totalOrdem }), [ordens, totalOrdem])
  const parado = useMemo(
    () => dinheiroParado({ orcamentos, estoque, ordens, totalOrdem }),
    [orcamentos, estoque, ordens, totalOrdem],
  )

  // Por reparador — a mesma pergunta da tela de Produtividade, aqui só para o
  // quadro geral ficar completo sem obrigar a trocar de tela.
  const porReparador = useMemo(() => {
    const mapa = new Map()
    for (const os of ordens || []) {
      if (!['Concluída', 'Entregue'].includes(os?.status)) continue
      const quando = os.dataConclusao || os.data || os.dataEntrada || ''
      if (!intervalo || !quando) continue
      const t = quando.split('/')
      const ts = t.length === 3 ? new Date(+t[2], +t[1] - 1, +t[0]).getTime() : 0
      if (!(ts >= intervalo.de && ts <= intervalo.ate)) continue
      const id = os.responsavelId ?? os.mecanicoId
      const k = String(id ?? 'sem')
      const atual = mapa.get(k) || {
        chave: k,
        nome: id != null ? (getFuncionario(id)?.nome || 'Sem nome') : 'Sem reparador',
        ordens: 0, faturamento: 0,
      }
      atual.ordens++
      atual.faturamento += Number(totalOrdem ? totalOrdem(os) : 0) || 0
      mapa.set(k, atual)
    }
    return [...mapa.values()].sort((a, b) => b.faturamento - a.faturamento)
  }, [ordens, intervalo, totalOrdem, getFuncionario])

  const maxSerie = Math.max(1, ...serie.map(s => s.faturamento))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl lg:text-base font-bold text-slate-800 flex items-center gap-2">
            <PieChart size={18} className="text-primary-500" />Gestão
          </h2>
          <p className="text-sm lg:text-xs text-slate-400">
            A leitura geral da oficina no período escolhido.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-2 py-1">
          <Lock size={11} /> Tela restrita — liberada por pessoa em Funcionários
        </span>
      </div>

      <SeletorPeriodo periodo={periodo} datas={datas}
        onChange={(p, d) => { setPeriodo(p); setDatas(d) }} />

      {/* As lacunas vêm ANTES dos números, de propósito. */}
      {lacunas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl lg:rounded overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-900">
              Antes de decidir por estes números, leia o que falta cadastrar
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {lacunas.map(l => (
              <div key={l.id} className="px-4 py-2.5">
                <p className="text-xs font-semibold text-amber-900">
                  {l.titulo}
                  <span className="ml-2 font-normal text-amber-700">· {l.onde}</span>
                </p>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{l.texto}</p>

                {/* A ORIGEM se resolve AQUI. Um seletor por cliente: escolheu,
                    gravou, e a linha some do aviso na hora. Sem trocar de tela,
                    que e onde a correcao costuma morrer. */}
                {l.id === 'origem' && l.alvos?.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {l.alvos.map(alvo => (
                      <div key={alvo.id} className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-amber-900 font-medium min-w-0 flex-1 truncate" title={alvo.nome}>
                          {alvo.nome}
                        </span>
                        <select defaultValue="" aria-label={`Como ${alvo.nome} conheceu a oficina`}
                          onChange={e => marcarOrigem(alvo.id, e.target.value)}
                          className="text-xs border border-amber-300 bg-white rounded px-2 py-1 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
                          <option value="">como conheceu?</option>
                          {ORIGENS_CLIENTE.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* A peca nao da para consertar aqui — o custo pede a ficha
                    inteira. Mas dizer o NOME ja evita a cacada, e o link cai
                    direto na peca certa. */}
                {l.id === 'custo_peca' && l.alvos?.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {l.alvos.map(alvo => (
                      <button key={alvo.id} type="button"
                        onClick={() => navigate(`/estoque/peca/${encodeURIComponent(alvo.id)}`)}
                        className="text-left text-xs text-amber-900 hover:text-amber-700 hover:underline">
                        {alvo.codigo && <span className="font-mono text-amber-700">{alvo.codigo} · </span>}
                        {alvo.nome}
                        <span className="ml-1 text-amber-600">→ preencher o custo</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { r: 'Entrou no caixa', v: fmt(resumo.entrou), cor: 'text-green-700' },
          { r: 'Saiu do caixa', v: fmt(resumo.saiu), cor: 'text-red-600' },
          {
            r: 'Sobra de caixa', v: fmt(resumo.sobraDeCaixa), cor: 'text-slate-800',
            nota: lacunas.some(l => l.id === 'custo_fixo') ? 'não é lucro — falta o custo fixo' : `custo fixo do período: ${fmt(resumo.custoFixoPeriodo)}`,
          },
          // Empréstimo e parcela de bem não entram no custo fixo — se entrassem,
          // virariam preço. Mas têm que aparecer: numa oficina alavancada este é
          // o número que decide se a sobra do mês chega no bolso do dono.
          {
            r: 'Foi para credor', v: fmt(resumo.compromissoFinanceiro), cor: 'text-amber-700',
            nota: resumo.gastosFinanceiros > 0
              ? `${resumo.gastosFinanceiros} lançamento(s) — fora do custo da hora, de propósito`
              : 'nada lançado como Empréstimo/Equipamento/Investimento',
          },
          { r: 'Faturado em OS', v: fmt(resumo.faturadoEmOS), cor: 'text-slate-800', nota: `${resumo.ordens} OS concluída(s)` },
          { r: 'Ticket médio', v: fmt(resumo.ticketMedio), cor: 'text-slate-800' },
        ].map(({ r, v, cor, nota }) => (
          <div key={r} className="bg-white rounded-xl lg:rounded p-4 shadow-sm border border-slate-100">
            <p className="text-[11px] text-slate-400">{r}</p>
            <p className={`text-lg font-bold tabular-nums ${cor}`}>{v}</p>
            {nota && <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{nota}</p>}
          </div>
        ))}
      </div>

      {/* Estou crescendo, ou só correndo mais? Nenhuma tela responde isso hoje:
          todas comparam com o mês anterior e param aí. */}
      <div className="bg-white rounded-xl lg:rounded shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Faturamento mês a mês</h3>
          <span className="text-xs text-slate-400">· últimos 12 meses, independente do período acima</span>
        </div>
        <div className="p-5 flex items-end gap-1.5 h-40">
          {serie.map(s => (
            <div key={`${s.ano}-${s.mes}`} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
              title={`${s.rotulo}/${String(s.ano).slice(2)} · ${s.ordens} OS · ${fmt(s.faturamento)} · ticket ${fmt(s.ticket)}`}>
              <span className="text-[9px] text-slate-500 tabular-nums whitespace-nowrap">{s.faturamento > 0 ? curto(s.faturamento) : ''}</span>
              <div className="w-full bg-primary-400 rounded-t" style={{ height: `${Math.max(2, (s.faturamento / maxSerie) * 100)}%` }} />
              <span className="text-[10px] text-slate-400 capitalize">{s.rotulo}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloco titulo="Serviços que mais faturam" icone={Wrench}
          nota="ordenado por dinheiro, não por quantidade"
          vazio="Nenhum serviço faturado no período."
          linhas={servicos.map(s => ({
            chave: s.chave, principal: s.nome, secundario: `${s.quantidade}×`, valor: s.faturamento,
          }))} />

        <Bloco titulo="Peças que mais saíram" icone={Package}
          nota="valor de venda; a margem usa o custo que estava no item"
          vazio="Nenhuma peça vendida no período."
          linhas={pecas.map(p => ({
            chave: p.chave, principal: p.nome,
            secundario: `${p.quantidade} un.${p.margem > 0 ? ` · margem ${fmt(p.margem)}` : ''}`,
            valor: p.faturamento,
          }))} />

        <Bloco titulo="Clientes que mais gastaram" icone={Users}
          nota={cli.total > 0 ? `os 5 maiores são ${cli.concentracaoTop5.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do faturamento` : ''}
          alerta={cli.concentracaoTop5 >= 40 ? 'Concentração alta: perder um desses clientes abre um buraco grande.' : ''}
          vazio="Nenhum faturamento no período."
          linhas={cli.lista.map(c => ({
            chave: c.chave, principal: c.nome,
            secundario: `${c.quantidade} OS · ${c.participacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
            valor: c.faturamento,
          }))} />

        <Bloco titulo="Por reparador" icone={Wrench}
          nota="OS concluídas no período"
          vazio="Nenhuma OS concluída no período."
          linhas={porReparador.map(r => ({
            chave: r.chave, principal: r.nome, secundario: `${r.ordens} OS`, valor: r.faturamento,
          }))} />
      </div>

      {/* Dinheiro que já é da oficina e está travado — o mais barato de
          destravar, porque não exige vender nada novo. */}
      <div className="bg-white rounded-xl lg:rounded shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Dinheiro parado</h3>
          <p className="text-xs text-slate-400 mt-0.5">Posição de hoje — não muda com o período acima.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {[
            { r: 'Em orçamentos sem resposta', v: fmt(parado.emOrcamento), n: `${parado.orcamentosParados} orçamento(s)` },
            { r: 'Parado no estoque', v: fmt(parado.emEstoque), n: `${parado.pecasComSaldo} peça(s) com saldo` },
            { r: 'Carros parados no pátio', v: parado.valorNoPatio > 0 ? fmt(parado.valorNoPatio) : String(parado.noPatio), n: `${parado.noPatio} há mais de 15 dias` },
          ].map(({ r, v, n }) => (
            <div key={r} className="px-5 py-4">
              <p className="text-[11px] text-slate-400">{r}</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{v}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{n}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Um ranking. Barra proporcional ao maior — comparar número com número exige
// contar dígitos; comparar barra é imediato.
function Bloco({ titulo, icone: Icone, nota, alerta, vazio, linhas }) {
  const maior = Math.max(1, ...linhas.map(l => l.valor))
  return (
    <div className="bg-white rounded-xl lg:rounded shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Icone size={15} className="text-slate-400" />{titulo}
        </h3>
        {nota && <p className="text-xs text-slate-400 mt-0.5">{nota}</p>}
        {alerta && <p className="text-xs text-amber-700 mt-1">{alerta}</p>}
      </div>
      {linhas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400 text-center">{vazio}</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {linhas.map((l, i) => (
            <div key={l.chave} className="px-5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-slate-700 truncate min-w-0" title={l.principal}>
                  <span className="text-slate-300 tabular-nums mr-1.5">{i + 1}.</span>{l.principal}
                </p>
                <span className="text-sm font-semibold text-slate-800 tabular-nums flex-shrink-0">{fmt(l.valor)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-400 rounded-full" style={{ width: `${(l.valor / maior) * 100}%` }} />
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{l.secundario}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

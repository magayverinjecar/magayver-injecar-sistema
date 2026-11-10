// Peças dos filtros das listas de Ordens de Serviço e de Orçamentos: botões de
// situação e de período, título de coluna que ordena e a linha que diz por
// que coluna a lista está ordenada. As regras ficam em utils/filtroLista.js.
//
// Coluna ordenável: { campo, titulo, tipo, valor, primeira, nomes, alinha }
//   primeira — sentido do 1º clique ('asc' | 'desc');
//   nomes    — como cada sentido aparece escrito: ['mais nova primeiro', 'mais antiga primeiro'].

import { PERIODOS } from '../utils/filtroLista'
import { setaDaColuna } from '../utils/ordenar'

const outra = (d) => (d === 'asc' ? 'desc' : 'asc')
const primeiraDe = (col) => col.primeira || 'asc'

function classeChip(ativo) {
  return `px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 transition-colors ${
    ativo ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
  }`
}

// Rótulo à esquerda no computador; em cima no celular, para a linha de botões
// ter a largura toda (e deslizar para o lado em vez de ocupar a tela).
function Linha({ rotulo, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-1 md:gap-2 min-w-0">
      <span className="text-[11px] font-bold uppercase text-slate-400 md:w-16 md:pt-1.5 flex-shrink-0">{rotulo}</span>
      {children}
    </div>
  )
}

const LINHA_DE_BOTOES = 'flex gap-1.5 overflow-x-auto max-w-full md:flex-wrap pb-1 md:pb-0'

export function FiltroSituacao({ situacoes, valor, contagem, onMudar }) {
  return (
    <Linha rotulo="Situação">
      <div className={LINHA_DE_BOTOES}>
        {situacoes.map(s => (
          <button key={s.id} type="button" onClick={() => onMudar(s.id)} className={classeChip(valor === s.id)}>
            {s.rotulo}<span className="ml-1 font-medium opacity-70 tabular-nums">{contagem(s)}</span>
          </button>
        ))}
      </div>
    </Linha>
  )
}

// "2026-11-10" no fuso daqui (o toISOString daria o dia de Londres).
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// `campos` (opcional): por qual data o período filtra — [{ id, rotulo }].
export function FiltroPeriodo({ filtros, onMudar, campos }) {
  function escolher(id) {
    // "Escolher datas" já abre preenchido com este mês: campo de data vazio
    // não filtra nada, e a pessoa ficaria sem saber se funcionou.
    if (id === 'escolher' && !filtros.de && !filtros.ate) {
      const hoje = new Date()
      onMudar({ periodo: id, de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: isoLocal(hoje) })
      return
    }
    onMudar({ periodo: id })
  }
  return (
    <Linha rotulo="Período">
      <div className="flex gap-2 flex-wrap items-center min-w-0">
        <div className={LINHA_DE_BOTOES}>
          {PERIODOS.map(p => (
            <button key={p.id} type="button" onClick={() => escolher(p.id)} className={classeChip(filtros.periodo === p.id)}>
              {p.rotulo}
            </button>
          ))}
        </div>
        {filtros.periodo === 'escolher' && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            de
            <input type="date" value={filtros.de || ''} onChange={e => onMudar({ de: e.target.value })} aria-label="Data inicial"
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
            até
            <input type="date" value={filtros.ate || ''} onChange={e => onMudar({ ate: e.target.value })} aria-label="Data final"
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </span>
        )}
        {campos && filtros.periodo !== 'tudo' && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            pela data de
            <span className="inline-flex border border-slate-200 rounded-lg overflow-hidden">
              {campos.map(c => (
                <button key={c.id} type="button" onClick={() => onMudar({ campoData: c.id })}
                  className={`px-2.5 py-1 text-xs font-medium border-r last:border-r-0 border-slate-200 transition-colors ${
                    filtros.campoData === c.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}>
                  {c.rotulo}
                </button>
              ))}
            </span>
          </span>
        )}
      </div>
    </Linha>
  )
}

// Título de coluna que ordena. O botão dentro do th é de propósito: th não
// recebe foco de teclado. A setinha apagada (↕) avisa que dá para clicar.
export function ThOrdenavel({ col, ordem, onOrdenar, titulo, className = '' }) {
  const ativa = ordem?.campo === col.campo
  const nome = titulo || col.titulo
  const alinha = col.alinha === 'right' ? 'text-right' : col.alinha === 'center' ? 'text-center' : 'text-left'
  const dica = !ativa ? `Ordenar por ${nome.toLowerCase()}`
    : ordem.direcao === primeiraDe(col) ? 'Clique para inverter' : 'Clique para voltar à ordem padrão'
  return (
    <th className={`${alinha} px-5 py-3 text-xs font-semibold uppercase tracking-wide ${ativa ? 'text-primary-600' : 'text-slate-500'} ${className}`}>
      <button type="button" onClick={() => onOrdenar(col)} title={dica}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-primary-600 transition-colors ${col.alinha === 'right' ? 'flex-row-reverse' : ''}`}>
        {nome}
        <span className="text-[11px] w-2 inline-block">{ativa ? setaDaColuna(ordem, col.campo) : <span className="text-slate-300">↕</span>}</span>
      </button>
    </th>
  )
}

// Como o sentido atual aparece escrito ("mais nova primeiro").
function nomeDoSentido(col, direcao) {
  return (col.nomes || [])[direcao === primeiraDe(col) ? 0 : 1] || ''
}

// A linha em cima da lista: por que coluna está ordenada, ou qual é a ordem padrão.
export function FaixaOrdem({ cols, ordem, padrao, tituloDe = c => c.titulo, onVoltar }) {
  const col = ordem && cols.find(c => c.campo === ordem.campo)
  if (!col) {
    return (
      <p className="text-xs text-slate-500 px-1">
        Ordem padrão: {padrao}. <span className="hidden md:inline">Clique no título de uma coluna para ordenar.</span>
      </p>
    )
  }
  return (
    <p className="text-xs text-slate-500 px-1">
      Ordenado por <strong className="text-slate-700">{tituloDe(col)}</strong> — {nomeDoSentido(col, ordem.direcao)}
      <button type="button" onClick={onVoltar} className="ml-2 text-primary-600 font-semibold hover:underline">voltar ao padrão</button>
    </p>
  )
}

// No celular não há título de coluna para clicar: a ordem vira uma caixa.
export function SeletorOrdem({ cols, ordem, padrao, tituloDe = c => c.titulo, onEscolher, className = '' }) {
  const valor = ordem && cols.some(c => c.campo === ordem.campo) ? `${ordem.campo}:${ordem.direcao}` : ''
  return (
    <select value={valor} aria-label="Ordenar por"
      onChange={e => {
        if (!e.target.value) { onEscolher(null); return }
        const [campo, direcao] = e.target.value.split(':')
        onEscolher({ campo, direcao })
      }}
      className={`border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${className}`}>
      <option value="">Ordem: {padrao}</option>
      {cols.flatMap(c => [primeiraDe(c), outra(primeiraDe(c))].map(d => (
        <option key={`${c.campo}:${d}`} value={`${c.campo}:${d}`}>{tituloDe(c)} — {nomeDoSentido(c, d)}</option>
      )))}
    </select>
  )
}

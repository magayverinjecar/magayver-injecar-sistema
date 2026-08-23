import { useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { UNIDADES, ORIGENS, formatarNcm, formatarCest, soDigitos, temConversao, pendenciasFiscais } from '../utils/pecaCampos'
import { useApp } from '../context/AppContext'

const INP = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const ROTULO = 'block text-sm font-medium text-slate-700 mb-1'
const AJUDA = 'block text-[11px] text-slate-400 mt-0.5'

// Uma seção do formulário. As duas primeiras nascem abertas — são as que a
// oficina usa todo dia. Fiscal e Detalhes ficam recolhidas: quem cadastra
// rápido não tropeça nelas, e quem vai emitir nota abre com um clique.
function Secao({ titulo, resumo, aberta, onToggle, children }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {aberta ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
          {titulo}
        </span>
        {!aberta && resumo && <span className="text-xs text-slate-400 truncate max-w-[55%]">{resumo}</span>}
      </button>
      {aberta && <div className="p-3 space-y-3">{children}</div>}
    </div>
  )
}

// O formulário da peça, usado no cadastro e na edição.
//
// `comSaldo`: no cadastro o saldo inicial é digitável (vira movimento de saldo
// inicial); na edição não, porque saldo só muda por movimentação.
//
// `largo`: em tela cheia. As quatro seções nascem ABERTAS e se espalham em duas
// colunas, porque a sanfona só existia por falta de espaço no popup — onde cabe
// tudo, abrir seção por seção é trabalho a mais. No popup (ou no celular) o
// comportamento é o de sempre: as duas do dia a dia abertas, fiscal e detalhes
// recolhidas para quem cadastra rápido não tropeçar nelas.
export default function FormularioPeca({ f, set, comSaldo = true, largo = false }) {
  const { fornecedores } = useApp()
  const [abertas, setAbertas] = useState(largo
    ? { ident: true, precos: true, fiscal: true, detalhes: true }
    : { ident: true, precos: true, fiscal: false, detalhes: false })
  const alternar = (k) => setAbertas(a => ({ ...a, [k]: !a[k] }))
  const campo = (k) => (e) => set(x => ({ ...x, [k]: e.target.value }))

  const faltamFiscais = pendenciasFiscais(f)
  const conversao = temConversao(f)

  return (
    <div className={largo
      ? 'space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3'
      : 'space-y-3'}>
      <Secao titulo="Identificação" aberta={abertas.ident} onToggle={() => alternar('ident')}
        resumo={[f.codigo, f.nome].filter(Boolean).join(' · ')}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO}>Código *</label>
            <input value={f.codigo || ''} onChange={campo('codigo')} placeholder="FLT-001" className={INP} />
            <span className={AJUDA}>Não pode repetir</span>
          </div>
          <div>
            <label className={ROTULO}>Código do fabricante</label>
            <input value={f.codigoFabricante || ''} onChange={campo('codigoFabricante')} placeholder="Ex: 93342049" className={INP} />
            <span className={AJUDA}>O código original da montadora</span>
          </div>
        </div>
        <div>
          <label className={ROTULO}>Nome do Produto *</label>
          <input value={f.nome || ''} onChange={campo('nome')} spellCheck lang="pt-BR"
            placeholder="EX: FILTRO DE AR CONDICIONADO" className={`${INP} uppercase`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO}>Marca</label>
            <input value={f.marca || ''} onChange={campo('marca')} spellCheck lang="pt-BR"
              placeholder="BOSCH, TECFIL..." className={`${INP} uppercase`} />
          </div>
          <div>
            <label className={ROTULO}>Categoria</label>
            <input value={f.categoria || ''} onChange={campo('categoria')} spellCheck lang="pt-BR"
              placeholder="FILTROS, ÓLEOS..." className={`${INP} uppercase`} />
          </div>
        </div>
        <div>
          <label className={ROTULO}>Aplicação — que carros usam</label>
          <input value={f.aplicacao || ''} onChange={campo('aplicacao')} spellCheck lang="pt-BR"
            placeholder="EX: ONIX 1.0 2017-2022, PRISMA 1.4" className={`${INP} uppercase`} />
          <span className={AJUDA}>
            Ajuda a diferenciar peças de nome parecido — existem 16 "filtro de ar condicionado cabine" no cadastro
          </span>
        </div>
      </Secao>

      <Secao titulo="Preços e estoque" aberta={abertas.precos} onToggle={() => alternar('precos')}
        resumo={[f.precoCusto && `custo ${f.precoCusto}`, f.preco && `venda ${f.preco}`].filter(Boolean).join(' · ')}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO}>Preço de Custo (R$)</label>
            <input value={f.precoCusto || ''} onChange={campo('precoCusto')} placeholder="0,00" className={INP} />
            <span className={AJUDA}>Atualiza sozinho a cada compra recebida</span>
          </div>
          <div>
            <label className={ROTULO}>Preço de Venda (R$)</label>
            <input value={f.preco || ''} onChange={campo('preco')} placeholder="0,00" className={INP} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {comSaldo ? (
            <div>
              <label className={ROTULO}>Qtd. em Estoque</label>
              <input type="number" value={f.estoque || ''} onChange={campo('estoque')} placeholder="0" className={INP} />
              <span className={AJUDA}>Entra como "saldo inicial" no extrato</span>
            </div>
          ) : (
            <div>
              <label className={ROTULO}>Qtd. em Estoque</label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500">
                {f.estoque}
                <span className="block text-[11px] text-slate-400">muda pelos botões − / + da lista, com motivo</span>
              </div>
            </div>
          )}
          <div>
            <label className={ROTULO}>Qtd. Mínima</label>
            <input type="number" value={f.minimo || ''} onChange={campo('minimo')} placeholder="0" className={INP} />
          </div>
        </div>
        <div>
          <label className={ROTULO}>Localização na prateleira</label>
          <input value={f.localizacao || ''} onChange={campo('localizacao')}
            placeholder="Ex: Estante B, gaveta 3" className={`${INP} uppercase`} />
        </div>
      </Secao>

      <Secao titulo="Compra e fornecedor" aberta={abertas.detalhes} onToggle={() => alternar('detalhes')}
        resumo={[f.unidade, conversao && `1 ${f.unidadeCompra} = ${f.fatorConversao} ${f.unidade}`].filter(Boolean).join(' · ')}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={ROTULO}>Unidade de uso</label>
            <select value={f.unidade || 'UN'} onChange={campo('unidade')} className={INP}>
              {UNIDADES.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>)}
            </select>
            <span className={AJUDA}>Como sai para a OS</span>
          </div>
          <div>
            <label className={ROTULO}>Unidade de compra</label>
            <select value={f.unidadeCompra || ''} onChange={campo('unidadeCompra')} className={INP}>
              <option value="">A mesma</option>
              {UNIDADES.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>)}
            </select>
            <span className={AJUDA}>Como vem na nota</span>
          </div>
          <div>
            <label className={ROTULO}>Quantas por embalagem</label>
            <input value={f.fatorConversao || ''} onChange={campo('fatorConversao')} placeholder="1" className={INP}
              disabled={!f.unidadeCompra} />
            <span className={AJUDA}>Ex.: balde com 20</span>
          </div>
        </div>
        {conversao && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded-lg">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Comprando <strong>1 {f.unidadeCompra}</strong>, entram <strong>{f.fatorConversao} {f.unidade}</strong> no
              estoque. O custo por {f.unidade.toLowerCase()} é calculado sozinho.
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO}>Fornecedor habitual</label>
            <select value={f.fornecedorId || ''} onChange={campo('fornecedorId')} className={INP}>
              <option value="">—</option>
              {(fornecedores || []).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={ROTULO}>Garantia (dias)</label>
            <input type="number" value={f.garantiaDias || ''} onChange={campo('garantiaDias')} placeholder="90" className={INP} />
          </div>
        </div>
        <div>
          <label className={ROTULO}>Código de barras (EAN)</label>
          <input value={f.ean || ''} onChange={e => set(x => ({ ...x, ean: soDigitos(e.target.value, 14) }))}
            placeholder="7891234567890" className={`${INP} font-mono`} />
          <span className={AJUDA}>Vem preenchido quando a entrada for por XML da nota</span>
        </div>
      </Secao>

      <Secao titulo="Fiscal — para a nota fiscal" aberta={abertas.fiscal} onToggle={() => alternar('fiscal')}
        resumo={faltamFiscais.length ? `falta ${faltamFiscais.join(', ')}` : `NCM ${formatarNcm(f.ncm)}`}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO}>NCM</label>
            <input value={formatarNcm(f.ncm)} onChange={e => set(x => ({ ...x, ncm: soDigitos(e.target.value, 8) }))}
              placeholder="8708.99.90" className={`${INP} font-mono`} />
            <span className={AJUDA}>8 dígitos — obrigatório na nota</span>
          </div>
          <div>
            <label className={ROTULO}>CEST</label>
            <input value={formatarCest(f.cest)} onChange={e => set(x => ({ ...x, cest: soDigitos(e.target.value, 7) }))}
              placeholder="01.023.00" className={`${INP} font-mono`} />
            <span className={AJUDA}>Só para peça com substituição tributária</span>
          </div>
        </div>
        <div>
          <label className={ROTULO}>Origem da mercadoria</label>
          <select value={f.origem ?? '0'} onChange={campo('origem')} className={INP}>
            {ORIGENS.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.nome}</option>)}
          </select>
        </div>
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 text-slate-500 text-xs px-3 py-2 rounded-lg">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            Estes campos vêm preenchidos sozinhos quando a entrada da peça for pelo XML da nota do fornecedor.
            Preencher agora só é necessário para peça que você cadastra à mão e vai sair em nota.
          </span>
        </div>
      </Secao>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, AlertTriangle, Check, Package, PackagePlus, Calendar } from 'lucide-react'
import { useApp } from '../context/AppContext'
import gerarId from '../utils/id'
import { extrairNFe, interpretarNFe } from '../utils/nfe'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const br = (v) => Number(v || 0).toFixed(2).replace('.', ',')

// Importar a NF-e do fornecedor.
//
// A entrada de peça digitada à mão é onde o estoque se perde: erra-se o código,
// erra-se a quantidade, e o boleto vira conta a pagar que ninguém lançou. O XML
// tem tudo isso assinado pelo emissor.
//
// A tela NÃO dá entrada no estoque. Ela cria a compra em rascunho, com os itens
// e os boletos preenchidos, e a entrada continua acontecendo onde já acontecia:
// no botão "Receber" da compra, depois de alguém conferir contra a caixa que
// chegou. Nota não é conferência — o que veio no caminhão é que é.
export default function CompraImportarXml() {
  const navigate = useNavigate()
  const { estoque, fornecedores, compras, criarCompra, atualizarCompra } = useApp()

  const [nome, setNome] = useState('')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)

  function lerArquivo(file) {
    if (!file) return
    setErro(''); setDados(null); setNome(file.name)
    const leitor = new FileReader()
    leitor.onload = () => {
      try {
        const nfe = extrairNFe(String(leitor.result || ''))
        setDados(interpretarNFe(nfe, { estoque, fornecedores, compras }))
      } catch (e) {
        console.error('[nfe] falha ao ler o XML:', e)
        setErro(e.message || 'Não consegui ler este arquivo.')
      }
    }
    leitor.onerror = () => setErro('Não consegui abrir o arquivo.')
    leitor.readAsText(file, 'utf-8')
  }

  function importar() {
    if (!dados) return
    setGravando(true)
    const id = criarCompra()

    const itens = dados.itens.map(i => ({
      id: gerarId(),
      codigo: i.codigo,
      descricao: i.nomeLimpo,
      quantidade: br(i.quantidade),
      valorUnitario: br(i.custoUnitario),
      produtoId: i.peca?.id ?? null,
      ...(i.nova ? {
        cadastrarNova: true,
        novoItemDados: {
          nome: i.nomeLimpo,
          codigo: i.codigo,
          categoria: '',
          precoVenda: '',
          minimo: 0,
          // O que o XML traz de fiscal fica guardado desde já: é o motivo de a
          // importação vir antes do resto: digitar NCM à mão ninguém digita.
          ean: i.ean && i.ean !== 'SEM GTIN' ? i.ean : '',
          ncm: i.ncm,
          cest: i.cest,
          origem: i.origem,
          unidade: i.unidade,
          codigoFabricante: '',
        },
      } : {}),
    }))

    atualizarCompra(id, {
      fornecedorId: dados.fornecedor?.id ?? '',
      fornecedorNome: dados.fornecedor?.nome || dados.emitente.nome,
      itens,
      total: dados.somaItens,
      parcelas: dados.parcelas.map(p => ({
        id: gerarId(),
        valor: br(p.valor),
        vencimento: p.vencimento,
      })),
      // A chave é o que impede a mesma nota de entrar duas vezes.
      chaveNFe: dados.chave,
      numeroNota: dados.numero,
      serieNota: dados.serie,
      data: dados.emissao,
      observacoes: `Importada do XML da NF-e ${dados.numero}/${dados.serie} — ${dados.emitente.nome}.`,
    })
    navigate(`/compras/${encodeURIComponent(id)}`)
  }

  return (
    <div className="p-6 max-w-3xl lg:max-w-none mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/compras')} title="Voltar"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl lg:text-base font-bold text-slate-800">Importar NF-e do fornecedor</h1>
          <p className="text-sm lg:text-xs text-slate-400">
            O XML traz código, quantidade, custo e os boletos. A entrada no estoque continua sendo feita no "Receber", depois de conferir a caixa.
          </p>
        </div>
      </div>

      {!dados && (
        <label className="block bg-white border-2 border-dashed border-slate-300 hover:border-primary-400 rounded-2xl lg:rounded p-10 text-center cursor-pointer transition-colors">
          <input type="file" accept=".xml,text/xml,application/xml" className="hidden"
            onChange={e => lerArquivo(e.target.files?.[0])} />
          <Upload size={30} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Escolha o arquivo XML da nota</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            É o arquivo que o fornecedor manda por e-mail junto com a nota — o que termina em <strong>.xml</strong>.
            O DANFE em PDF não serve: ele é a foto da nota, não os dados dela.
          </p>
          {nome && <p className="text-xs text-slate-500 mt-3">Último escolhido: {nome}</p>}
        </label>
      )}

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{erro}</p>
        </div>
      )}

      {dados && (
        <div className="space-y-4">

          <div className="bg-white border border-slate-200 rounded-xl lg:rounded overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{dados.emitente.nome}</p>
                  <p className="text-xs text-slate-400">
                    NF-e {dados.numero}/{dados.serie} · {dados.emissao} · CNPJ {dados.emitente.cnpj}
                    {!dados.fornecedor && <span className="ml-1 text-amber-600">· fornecedor não cadastrado</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => { setDados(null); setErro('') }}
                className="text-xs text-slate-500 hover:text-slate-800 underline flex-shrink-0">
                trocar arquivo
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
              {[
                { r: 'Itens na nota', v: String(dados.itens.length) },
                { r: 'Já no cadastro', v: String(dados.casadas), cor: 'text-green-700' },
                { r: 'Peças novas', v: String(dados.novas), cor: dados.novas > 0 ? 'text-amber-700' : '' },
                { r: 'Total da nota', v: fmt(dados.totais.nota) },
              ].map(({ r, v, cor }) => (
                <div key={r} className="px-4 py-3">
                  <p className="text-[11px] text-slate-400">{r}</p>
                  <p className={`text-lg font-bold tabular-nums ${cor || 'text-slate-800'}`}>{v}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item da nota</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">No seu estoque</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qtd</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Custo un.</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dados.itens.map(i => (
                    <tr key={i.nItem} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-800">{i.nomeLimpo}</p>
                        <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {i.codigo || <span className="text-amber-600">sem código</span>}
                          {i.ncm && ` · NCM ${i.ncm}`}
                          {i.unidade && ` · ${i.unidade}`}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        {i.peca ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-green-50 text-green-700">
                              <Package size={10} /> {i.casouPor === 'ean' ? 'casou pelo cód. de barras' : 'já cadastrada'}
                            </span>
                            <p className="text-xs text-slate-600 mt-0.5 truncate max-w-xs">
                              {i.peca.nome} · saldo {Number(i.peca.estoque) || 0}
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-700">
                              <PackagePlus size={10} /> será cadastrada
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5">com o NCM e a origem da nota</p>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-700 tabular-nums">{br(i.quantidade)}</td>
                      <td className="px-5 py-3 text-right text-sm tabular-nums">
                        <span className="text-slate-800">{fmt(i.custoUnitario)}</span>
                        {/* Custo com rateio é maior que o da nota. Dizer isso
                            evita parecer erro de digitação. */}
                        {i.temRateio && (
                          <p className="text-[11px] text-slate-400" title="Frete e despesas rateados por valor">
                            nota: {fmt(i.valorUnitario)} + rateio
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700 tabular-nums">
                        {fmt(i.custoUnitario * i.quantidade)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl lg:rounded overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Calendar size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">
                Boletos da nota {dados.parcelas.length > 0 && <span className="font-normal text-slate-400">· viram parcelas da compra</span>}
              </h3>
            </div>
            {dados.parcelas.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">A nota não traz duplicata. Nenhuma conta a pagar será criada.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {dados.parcelas.map(p => (
                  <div key={p.numero} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">Parcela {p.numero} · vence {p.vencimentoBR}</span>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">{fmt(p.valor)}</span>
                  </div>
                ))}
                <div className="px-5 py-2 bg-slate-100 flex items-center justify-between gap-3 text-[11px] text-slate-600">
                  <span>{dados.parcelas.length} boleto(s)</span>
                  <span className="tabular-nums">{fmt(dados.somaParcelas)}</span>
                </div>
              </div>
            )}
          </div>

          {dados.avisos.map(a => (
            <div key={a.tipo} className={`flex items-start gap-2 border rounded-lg px-4 py-3 ${
              a.tipo === 'duplicada' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <AlertTriangle size={15} className={`flex-shrink-0 mt-0.5 ${a.tipo === 'duplicada' ? 'text-red-500' : 'text-amber-500'}`} />
              <p className={`text-xs leading-relaxed ${a.tipo === 'duplicada' ? 'text-red-700' : 'text-amber-800'}`}>{a.texto}</p>
            </div>
          ))}

          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600">
            <span>
              Vai criar uma compra <strong className="font-medium">em rascunho</strong>, com {dados.itens.length} item(ns) e {dados.parcelas.length} boleto(s).
              O estoque só muda quando você clicar em Receber.
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => navigate('/compras')}
                className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded text-xs font-medium hover:bg-white transition-colors">
                Cancelar
              </button>
              <button onClick={importar} disabled={gravando}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-5 py-1.5 rounded text-xs font-semibold transition-colors">
                <Check size={14} /> {gravando ? 'Importando…' : 'Importar nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { textoPedidoCotacao, temOQueCotar } from '../utils/cotacao'
import { copiarTexto } from '../utils/copiar'
import { parseValorBR } from '../utils/numero'

// "Copiar pedido de cotação": o texto pronto para colar no ChatGPT, com o
// carro, os serviços e as peças que o reparador pediu (utils/cotacao.js).
// Acaba a digitação de cada orçamento: o ChatGPT devolve as peças com preço e
// link e a mão de obra pelo tempo × a hora da oficina; quem decide o preço
// final continua sendo a oficina.
export default function PedidoCotacao({ os, veiculo, valorHora }) {
  const [copiado, setCopiado] = useState(false)
  if (!temOQueCotar(os)) return null
  const hora = parseValorBR(valorHora)

  async function copiar() {
    const ok = await copiarTexto(textoPedidoCotacao({ os, veiculo, valorHora }))
    if (!ok) { alert('Não consegui copiar neste aparelho.'); return }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-900">Cotação rápida no ChatGPT</p>
        <p className="text-xs text-violet-800 mt-0.5 leading-snug">
          Copia o carro, os serviços e as peças que o reparador pediu, com o pedido pronto: peças com marca,
          referência, preço e link (Mercado Livre e outras lojas) e a mão de obra pelo tempo de cada serviço
          {hora > 0 ? <> × a sua hora de <strong>R$ {hora.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></> : ' × a sua hora'}.
          Nome, telefone e placa do cliente não vão.
        </p>
        {!(hora > 0) && (
          <p className="text-xs text-amber-700 mt-1">Cadastre o valor da sua hora em Configurações para o pedido já sair com ele.</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button type="button" onClick={copiar}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap text-white ${
            copiado ? 'bg-green-600' : 'bg-violet-600 hover:bg-violet-700'
          }`}>
          {copiado ? <><Check size={15} />Copiado — cole no ChatGPT</> : <><Copy size={15} />Copiar pedido de cotação</>}
        </button>
        <a href="https://chatgpt.com/" target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline whitespace-nowrap">
          Abrir ChatGPT <ExternalLink size={12} />
        </a>
      </div>
    </div>
  )
}

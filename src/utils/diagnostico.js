// Parâmetros técnicos medidos no diagnóstico de injeção.
export const DIAGNOSTICO_ITENS = [
  { id: 'bateria',          label: 'Bateria',                  unidade: 'V' },
  { id: 'compressao',       label: 'Compressão Relativa',      unidade: '%' },
  { id: 'af_alcool',        label: 'Porcentagem de Alcool (AF)', unidade: '%' },
  { id: 'pressao_coletor',  label: 'Pressão do Coletor',       unidade: 'bar' },
  { id: 'pressao_bomba',    label: 'Pressão / Vazão da Bomba', unidade: 'bar' },
  { id: 'valvula_canister', label: 'Válvula do Canister',      unidade: '' },
  { id: 'entrada_ar',       label: 'Entrada de Ar Falsa',      unidade: '' },
  { id: 'ignicao',          label: 'Ignição nos Cilindros',    unidade: '' },
  { id: 'sonda_pre',        label: 'Sonda Pré Catalisador',    unidade: 'V' },
  { id: 'sonda_pos',        label: 'Sonda Pós Catalisador',    unidade: 'V' },
  { id: 'eficiencia_cat',   label: 'Eficiência Catalítica',    unidade: '%' },
  { id: 'sincronismo',      label: 'Sincronismo do Motor',     unidade: '' },
]

// O checklist antigo gravava o campo como `valor`; a OS usa `value`. Os dados
// migrados vieram com `valor`, então a leitura precisa aceitar os dois — senão
// um diagnóstico já feito aparece em branco.
export function valorDoItem(item) {
  return item?.value ?? item?.valor ?? ''
}

// Normaliza uma lista vinda de qualquer origem para o formato da OS,
// preenchendo os itens que faltarem com a lista padrão.
export function normalizarDiagnostico(salvos) {
  const porId = new Map((salvos || []).map(i => [i.id, i]))
  return DIAGNOSTICO_ITENS.map(padrao => {
    const s = porId.get(padrao.id)
    return {
      ...padrao,
      value: valorDoItem(s),
      status: s?.status || 'normal',
    }
  })
}

export function contarPreenchidos(itens) {
  return (itens || []).filter(i => String(valorDoItem(i)).trim() !== '').length
}

export const MINIMO_PARA_CONCLUIR = 6

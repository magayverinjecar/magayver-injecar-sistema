// Checklist de conferência antes de liberar o veículo para entrega.
// Esta é a lista PADRÃO — o Magayver pode editar em Configurações, e o que
// estiver salvo em config.checklistConferencia tem prioridade.
export const CHECKLIST_PADRAO = [
  { id: 'bancos',      label: 'Bancos e forrações recolocados' },
  { id: 'rodas',       label: 'Parafusos de roda apertados' },
  { id: 'ferramentas', label: 'Ferramentas retiradas do veículo' },
  { id: 'chicotes',    label: 'Conectores e chicotes reencaixados' },
  { id: 'painel',      label: 'Painel sem luz de falha acesa' },
  { id: 'codigos',     label: 'Códigos apagados no scanner' },
  { id: 'niveis',      label: 'Níveis de óleo e arrefecimento' },
  { id: 'bateria',     label: 'Bateria e terminais firmes' },
  { id: 'testeRua',    label: 'Teste de rua realizado' },
  { id: 'protecoes',   label: 'Proteções e tapetes removidos' },
]

export const STATUS_CONFERENCIA = {
  ok:       { label: 'OK',           cls: 'bg-green-100 text-green-700 border-green-300' },
  na:       { label: 'N/A',          cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  problema: { label: 'Problema',     cls: 'bg-red-500 text-white border-red-500' },
}

// Lê a lista configurada, caindo para a padrão quando não houver nada salvo.
export function itensDoChecklist(config) {
  const salvos = config?.checklistConferencia
  if (Array.isArray(salvos) && salvos.length > 0) return salvos
  return CHECKLIST_PADRAO
}

// Monta o estado inicial da conferência: nada vem pré-marcado de propósito —
// checklist que já nasce preenchido vira carimbo e não protege ninguém.
export function novaConferencia(config) {
  return itensDoChecklist(config).map(i => ({ id: i.id, label: i.label, status: '', nota: '' }))
}

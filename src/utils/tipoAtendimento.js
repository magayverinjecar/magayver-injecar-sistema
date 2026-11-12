// O que o cliente veio fazer, marcado pela recepção na entrada do carro.
//
// A oficina tem dois ritmos muito diferentes: a revisão e o serviço rápido
// saem em 1 hora, 1h30; o diagnóstico avançado (defeito para descobrir) fica
// de 1 a 3 dias. O reparador precisa saber qual é ANTES de pegar o carro — e
// a revisão preventiva já abre a avaliação completa (todas as áreas).
//
// Gravado em `os.tipoAtendimento` (só o id). OS antiga não tem: "não informado".
// As classes de cor ficam escritas por inteiro aqui para o Tailwind achá-las.

export const TIPOS_ATENDIMENTO = [
  {
    id: 'preventiva', rotulo: 'Revisão preventiva',
    descricao: 'Checagem completa do carro. Cerca de 1h a 1h30.',
    tempo: 'cerca de 1h a 1h30',
    modoAvaliacao: 'completa',
    etiqueta: 'bg-green-100 text-green-800',
    escolhido: 'border-green-500 bg-green-50 text-green-800',
    bolinha: 'border-green-600',
  },
  {
    id: 'rapido', rotulo: 'Serviço rápido',
    descricao: 'Óleo, lâmpada, peça já combinada. Sai no mesmo dia.',
    tempo: 'sai no mesmo dia',
    modoAvaliacao: 'queixa',
    etiqueta: 'bg-sky-100 text-sky-800',
    escolhido: 'border-sky-500 bg-sky-50 text-sky-800',
    bolinha: 'border-sky-600',
  },
  {
    id: 'diagnostico', rotulo: 'Diagnóstico avançado',
    descricao: 'Defeito para descobrir (falha, luz no painel…). Pode levar de 1 a 3 dias.',
    tempo: 'pode levar 1 a 3 dias',
    modoAvaliacao: 'queixa',
    etiqueta: 'bg-violet-100 text-violet-800',
    escolhido: 'border-violet-500 bg-violet-50 text-violet-800',
    bolinha: 'border-violet-600',
  },
]

export function tipoPorId(id) {
  return TIPOS_ATENDIMENTO.find(t => t.id === id) || null
}

export function tipoDaOS(os) {
  return tipoPorId(os?.tipoAtendimento)
}

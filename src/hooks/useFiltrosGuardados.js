import { useState, useEffect } from 'react'

// Filtros de uma lista que sobrevivem a abrir um item e voltar.
//
// Sem isto, filtrar "abertas deste mês", abrir uma OS e voltar devolvia a lista
// inteira — e a pessoa refazia o filtro a cada OS. Fica no sessionStorage:
// vale para aquela aba enquanto ela estiver aberta (inclusive se recarregar),
// e some ao fechar. Assim um filtro esquecido não esconde OS de ninguém no
// dia seguinte.
//
// O que foi guardado é misturado com o `inicial`: campo novo que a tela ganhar
// depois já nasce com o valor padrão, e não `undefined`.
export function useFiltrosGuardados(chave, inicial) {
  const [filtros, setFiltros] = useState(() => {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(chave) || 'null')
      return salvo && typeof salvo === 'object' ? { ...inicial, ...salvo } : inicial
    } catch {
      return inicial
    }
  })

  useEffect(() => {
    try { sessionStorage.setItem(chave, JSON.stringify(filtros)) } catch { /* modo privado ou cota cheia: só não guarda */ }
  }, [chave, filtros])

  // Muda um ou mais campos: mudar({ periodo: 'mes' })
  const mudar = (patch) => setFiltros(f => ({ ...f, ...patch }))
  return [filtros, mudar, setFiltros]
}

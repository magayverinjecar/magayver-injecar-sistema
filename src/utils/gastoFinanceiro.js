// Gasto pago vira despesa no financeiro — e desmarcar desfaz.
//
// Estava dentro de Gastos.jsx, e saiu de lá quando o cadastro deixou de ser
// popup: a lista precisa disto (o seletor de status na linha) e a tela de
// cadastro também. Duas cópias acabariam divergindo, e a que divergisse
// deixaria lançamento órfão no financeiro — dinheiro fantasma no DRE.
//
// `adicionarLancamento` e `setFinanceiro` chegam por parâmetro para esta função
// não depender de React: quem chama pega os dois do `useApp`.
export function sincronizarFinanceiro(gasto, antigoStatus, { adicionarLancamento, setFinanceiro }) {
  if (gasto.status === 'Pago' && antigoStatus !== 'Pago') {
    // O lançamento carrega a data do pagamento além do `gastoId`. Sem ela,
    // marcar o aluguel como Pago de novo no mês seguinte apagava TODOS os
    // lançamentos daquele gasto, de todos os meses — o histórico de doze
    // aluguéis sumia numa remarcação. Ver o filtro do desfazer logo abaixo.
    adicionarLancamento({
      descricao: `Gasto - ${gasto.descricao}`,
      tipo: 'despesa',
      valor: gasto.valor,
      gastoId: gasto.id,
      competencia: gasto.vencimento || '',
    })
  } else if (gasto.status !== 'Pago' && antigoStatus === 'Pago') {
    // Desfaz só o lançamento DAQUELA competência. Filtrar por `gastoId`
    // sozinho apagava o histórico inteiro do gasto recorrente.
    const comp = gasto.vencimento || ''
    setFinanceiro(fp => fp.filter(f =>
      f.gastoId !== gasto.id || (f.competencia && f.competencia !== comp)
    ))
  }
}

// "16/08/2026" → "2026-08-16", que é o formato que <input type="date"> entende.
//
// Já custou caro uma vez: no importador de NF-e a data ia para o campo no
// formato brasileiro e o input ficava VAZIO sem reclamar, perdendo o
// vencimento do boleto em silêncio.
export function paraISO(vencimentoBR) {
  const m = String(vencimentoBR || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

// Quanto esta oficina já cobrou por este serviço.
//
// POR QUE ISTO EXISTE — leia antes de mexer.
//
// A Injecar não cobra por hora nem por tabela fixa: cobra por DIFICULDADE
// TÉCNICA, decidida carro a carro. Em injeção isso é o certo — um diagnóstico
// que sai em vinte minutos porque o dono conhece o defeito vale mais do que três
// horas de alguém tentando. Cobrar por hora puniria exatamente a especialidade.
//
// O problema desse modelo não é o preço: é que ele mora na cabeça de uma pessoa
// só. Funciona enquanto o dono monta todo orçamento, e quebra quando a recepção
// monta, quando ele está com pressa, ou quando a oficina cresce. Foi ele quem
// disse que está "crescendo de forma desorganizada".
//
// Só que a oficina já tem 285 OS fechadas, cada uma com serviço, carro e o preço
// que foi cobrado. Isso É uma tabela de preços — dos carros dela, do mercado
// dela, da mão de obra dela. Ela só nunca foi lida de volta.
//
// Este arquivo lê. Sem tirar a liberdade de precificar cada carro: devolve a
// faixa já praticada no segundo em que a pessoa decide, e separa "neste mesmo
// modelo" de "em qualquer carro", porque remover o tanque de um Gol e de uma
// Hilux não são o mesmo trabalho.
//
// Funções puras — sem React, testáveis em Node.

import { parseValorBR, cent } from './numero.js'
import { momentoEntrada } from './datas.js'

// Palavras de ligação. Saem da comparação porque o mesmo serviço aparece
// escrito com e sem elas: o catálogo tem "SUBSTITUIÇÃO FILTRO DE COMBUSTÍVEL" e
// as OS têm "SUBSTITUIÇÃO DO FILTRO DE COMBUSTIVEL" — uma palavra de diferença
// fazia o histórico não aparecer justamente no serviço que existia.
//
// Tirar só conectivos é seguro: o que distingue dois serviços é substantivo.
// "TROCA DE ÓLEO DO MOTOR" e "TROCA DE ÓLEO DA CAIXA" continuam diferentes,
// porque MOTOR e CAIXA ficam.
const LIGACAO = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'COM', 'PARA', 'EM', 'NO', 'NA', 'NOS', 'NAS', 'A', 'O', 'AS', 'OS', 'POR'])

// Duas descrições são o mesmo serviço? Compara sem acento, sem pontuação, sem
// espaço dobrado e sem conectivo. O `servicoId` é a via principal; isto cobre as
// OS antigas, que guardaram só o texto — e são justamente as que formam o
// histórico. Na base real isto junta as 105 cobranças de "AJUSTE E
// REPROGRAMAÇÃO DA INJEÇÃO", que estavam escritas de quatro formas diferentes.
export function mesmoServico(a, b) {
  const chave = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ')
    .split(' ').filter(p => p && !LIGACAO.has(p)).join(' ')
  const x = chave(a), y = chave(b)
  return !!x && x === y
}

function resumir(valores) {
  if (!valores.length) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const soma = ordenados.reduce((s, v) => s + v, 0)
  const meio = Math.floor(ordenados.length / 2)
  return {
    n: ordenados.length,
    min: cent(ordenados[0]),
    max: cent(ordenados[ordenados.length - 1]),
    media: cent(soma / ordenados.length),
    // A mediana resiste ao caso raro: um serviço cobrado uma vez por R$ 2.000
    // num carro importado puxaria a média e daria uma referência que não serve
    // para o Gol da próxima segunda.
    mediana: cent(ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2),
  }
}

// O histórico de preço de um serviço, separado por modelo.
//
// `modeloDaOS` recebe a OS e devolve o texto do carro — quem chama é que sabe
// juntar OS + veículo, e assim esta função continua pura.
export function historicoDePreco(ordens, {
  servicoId = null,
  descricao = '',
  modeloAtual = '',
  modeloDaOS = () => '',
  ignorarOS = null,
} = {}) {
  const alvoModelo = String(modeloAtual || '').trim().toUpperCase()
  const noModelo = []
  const nosOutros = []
  const linhas = []

  for (const os of ordens || []) {
    if (ignorarOS != null && String(os?.id) === String(ignorarOS)) continue
    for (const item of os?.itens || []) {
      if (item?.tipo && item.tipo !== 'servico') continue
      const casa = (servicoId != null && item.servicoId != null && String(item.servicoId) === String(servicoId))
        || mesmoServico(item.descricao, descricao)
      if (!casa) continue

      const valor = parseValorBR(item.valorUnitario)
      // Item a zero não é preço praticado: é serviço lançado sem valor, ou
      // cortesia. Entrar na média puxaria a referência para baixo e o histórico
      // aconselharia cobrar menos do que a oficina cobra.
      if (!(valor > 0)) continue

      const modelo = String(modeloDaOS(os) || '').trim().toUpperCase()
      const mesmo = !!alvoModelo && !!modelo && modelo.includes(alvoModelo.split(' ')[0])

      ;(mesmo ? noModelo : nosOutros).push(valor)
      linhas.push({ osId: os.id, modelo, valor: cent(valor), quando: momentoEntrada(os), mesmoModelo: mesmo })
    }
  }

  linhas.sort((a, b) => b.quando - a.quando)

  return {
    total: noModelo.length + nosOutros.length,
    noModelo: resumir(noModelo),
    nosOutros: resumir(nosOutros),
    // As últimas cobranças, para dar contexto ao número: preço de dois anos
    // atrás não serve de referência hoje.
    ultimas: linhas.slice(0, 5),
  }
}

// A régua de segurança: o preço cobre o custo do tempo de bancada?
//
// Não é o método de precificação — é a conferência. A oficina pode cobrar o que
// quiser por dificuldade, mas se o serviço ocupa 3 horas de bancada e o custo
// fixo da hora é R$ 84, cobrar R$ 120 é pagar para trabalhar. Só que hoje isso
// não aparece em lugar nenhum: some dentro do resultado do mês.
//
// Devolve `null` quando falta entrada — sem custo da hora ou sem tempo não há
// régua, e inventar uma seria pior que não ter.
export function conferirPiso({ valor, horas, custoHora }) {
  const v = parseValorBR(valor)
  const h = parseValorBR(horas)
  const c = parseValorBR(custoHora)
  if (!(h > 0) || !(c > 0)) return null

  const porHora = cent(v / h)
  const custoDoTempo = cent(c * h)
  return {
    porHora,
    custoDoTempo,
    sobra: cent(v - custoDoTempo),
    abaixoDoPiso: porHora < c,
  }
}

// Níveis de dificuldade. Três, e não cinco: quem escolhe está com o cliente na
// frente, e escala longa vira "sempre o do meio".
export const DIFICULDADES = [
  { id: 1, rotulo: 'Simples', ajuda: 'Serviço direto, acesso fácil' },
  { id: 2, rotulo: 'Média',   ajuda: 'Exige desmontagem ou tempo de bancada' },
  { id: 3, rotulo: 'Alta',    ajuda: 'Diagnóstico eletrônico, acesso difícil, especialidade' },
]

function getConfig() {
  try {
    const v = localStorage.getItem('config-oficina')
    return v ? JSON.parse(v) : {}
  } catch { return {} }
}

function pNum(v) { return parseFloat((v || '0').toString().replace(',', '.')) || 0 }
const fmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function abrirJanela(html, titulo) {
  const w = window.open('', '_blank')
  if (!w) { alert('Permita popups para imprimir.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 450)
}

function itensTableRows(itens) {
  if (!itens || itens.length === 0) return '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:8px">Nenhum item</td></tr>'
  return itens.map(it => {
    const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto)
    return `<tr>
      <td>${it.descricao}</td>
      <td style="text-align:center">${it.quantidade}</td>
      <td style="text-align:right">${fmt(pNum(it.valorUnitario))}</td>
      <td style="text-align:right">${fmt(sub)}</td>
    </tr>`
  }).join('')
}

// ─── CUPOM TÉRMICO ────────────────────────────────────────────────────────────

function gerarCupom(os, cliente, veiculo, mecanico, total, cfg, largura, fSize) {
  const css = `
    @page { size: ${largura} auto; margin: 3mm 4mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: ${fSize}; margin: 0; padding: 0; width: ${largura}; color: #000; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; }
    .total { font-weight: bold; font-size: ${fSize === '12px' ? '15px' : '13px'}; display: flex; justify-content: space-between; margin-top: 4px; }
  `
  const linhaItens = (os.itens || []).map(it => {
    const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto)
    return `<div><span>${it.quantidade}x ${it.descricao}</span></div><div class="row"><span style="color:#555">${fmt(pNum(it.valorUnitario))} cada</span><span class="b">${fmt(sub)}</span></div>`
  }).join('<hr class="hr" style="margin:2px 0;border-style:dotted">')

  const body = `
    <div class="c b">${cfg.nome || 'Oficina'}</div>
    ${cfg.cnpj ? `<div class="c">CNPJ: ${cfg.cnpj}</div>` : ''}
    ${cfg.telefone ? `<div class="c">Tel: ${cfg.telefone}</div>` : ''}
    ${cfg.endereco ? `<div class="c" style="font-size:10px">${cfg.endereco}</div>` : ''}
    <hr class="hr">
    <div class="c b">ORDEM DE SERVIÇO</div>
    <div class="row"><span>Nº:</span><span class="b">${os.id}</span></div>
    <div class="row"><span>Entrada:</span><span>${os.dataEntrada || os.data}</span></div>
    ${os.dataConclusao ? `<div class="row"><span>Conclusão:</span><span>${os.dataConclusao}</span></div>` : ''}
    <div class="row"><span>Status:</span><span class="b">${os.status}</span></div>
    <hr class="hr">
    <div class="b">CLIENTE</div>
    <div>${cliente?.nome || '—'}</div>
    ${cliente?.telefone ? `<div>Tel: ${cliente.telefone}</div>` : ''}
    <hr class="hr">
    <div class="b">VEÍCULO</div>
    ${veiculo ? `<div>${veiculo.modelo} ${veiculo.ano || ''}</div><div>Placa: ${veiculo.placa}</div>` : '<div>—</div>'}
    ${os.kmEntrada ? `<div>KM: ${os.kmEntrada}</div>` : ''}
    ${mecanico ? `<div>Mecânico: ${mecanico.nome}</div>` : ''}
    ${os.descricaoProblema ? `<hr class="hr"><div class="b">PROBLEMA</div><div style="font-size:10px">${os.descricaoProblema}</div>` : ''}
    <hr class="hr">
    <div class="b">ITENS</div>
    <div style="margin-top:3px">${linhaItens || '<div style="color:#aaa">Sem itens</div>'}</div>
    <hr class="hr">
    ${pNum(os.descontoGeral) > 0 ? `<div class="row"><span>Subtotal:</span><span>${fmt(total + pNum(os.descontoGeral))}</span></div><div class="row" style="color:#b91c1c"><span>Desconto:</span><span>- ${fmt(pNum(os.descontoGeral))}</span></div>` : ''}
    <div class="total"><span>TOTAL:</span><span>${fmt(total)}</span></div>
    <hr class="hr">
    <div class="c" style="margin-top:6px;font-size:${fSize === '12px' ? '10px' : '9px'};font-weight:bold">GARANTIA: 90 DIAS</div>
    <div class="c" style="font-size:${fSize === '12px' ? '9px' : '8px'}">nos serviços realizados (CDC art. 26)</div>
    <hr class="hr">
    <div class="c" style="margin-top:8px">Obrigado pela preferência!</div>
    <div class="c" style="font-size:9px;margin-top:2px">${cfg.nome || ''}</div>
    <br><br>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS ${os.id}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── A4 DETALHADO (layout baseado no modelo da oficina) ───────────────────────

function secHeader(titulo) {
  return `<div style="background:#1e293b;color:#fff;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;padding:5px 8px;margin-bottom:0">${titulo}</div>`
}

function tabelaCliente(cliente, os) {
  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:0">
    <tr style="background:#f8fafc">
      <th style="text-align:left;padding:4px 7px;font-size:9px;color:#64748b;font-weight:600;border-right:1px solid #cbd5e1;width:45%">NOME DO CLIENTE</th>
      <th style="text-align:left;padding:4px 7px;font-size:9px;color:#64748b;font-weight:600;border-right:1px solid #cbd5e1;width:25%">TELEFONE</th>
      <th style="text-align:left;padding:4px 7px;font-size:9px;color:#64748b;font-weight:600;border-right:1px solid #cbd5e1;width:15%">CPF/CNPJ</th>
      <th style="text-align:left;padding:4px 7px;font-size:9px;color:#64748b;font-weight:600;width:15%">E-MAIL</th>
    </tr>
    <tr>
      <td style="padding:5px 7px;border-right:1px solid #e2e8f0;font-weight:600">${cliente?.nome || '—'}</td>
      <td style="padding:5px 7px;border-right:1px solid #e2e8f0">${cliente?.telefone || '—'}</td>
      <td style="padding:5px 7px;border-right:1px solid #e2e8f0">${cliente?.cpf || '—'}</td>
      <td style="padding:5px 7px">${cliente?.email || '—'}</td>
    </tr>
  </table>
  ${cliente?.endereco ? `<table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-top:0;margin-bottom:0"><tr><td style="padding:4px 7px;font-size:10px"><span style="color:#64748b;font-size:9px;font-weight:600">ENDEREÇO: </span>${cliente.endereco}</td></tr></table>` : ''}
  `
}

function tabelaVeiculo(veiculo, os, mecanico) {
  if (!veiculo) return `<table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:0"><tr><td style="padding:6px 8px;color:#94a3b8">Veículo não informado</td></tr></table>`
  const cel = (label, valor) => `<td style="border-right:1px solid #e2e8f0;padding:0"><div style="background:#f8fafc;font-size:8px;color:#64748b;font-weight:600;padding:2px 6px;border-bottom:1px solid #e2e8f0">${label}</div><div style="padding:4px 6px;font-weight:600;font-size:10px">${valor || '—'}</div></td>`
  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:0;table-layout:fixed">
    <tr>
      ${cel('PLACA', veiculo.placa)}
      ${cel('MODELO', veiculo.modelo)}
      ${cel('ANO', veiculo.ano)}
      ${cel('MOTOR', veiculo.motor || '')}
      ${cel('COR', veiculo.cor || '')}
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-top:0;margin-bottom:0;table-layout:fixed">
    <tr>
      ${cel('COMBUSTÍVEL', veiculo.combustivel || '')}
      ${cel('MECÂNICO', mecanico?.nome || '')}
      ${cel('DATA ENTRADA', os.dataEntrada || os.data)}
      ${cel('DATA CONCLUSÃO', os.dataConclusao || '')}
      <td style="border-right:0;padding:0"><div style="background:#f8fafc;font-size:8px;color:#64748b;font-weight:600;padding:2px 6px;border-bottom:1px solid #e2e8f0">STATUS</div><div style="padding:4px 6px;font-weight:700;font-size:10px;color:#1e293b">${os.status}</div></td>
    </tr>
  </table>`
}

// versão para orçamento: só dados do cadastro do veículo, sem campos de OS
function tabelaVeiculoOrcamento(veiculo) {
  if (!veiculo) return ''
  const cel = (label, valor) => valor
    ? `<td style="border-right:1px solid #e2e8f0;padding:0"><div style="background:#f8fafc;font-size:8px;color:#64748b;font-weight:600;padding:2px 6px;border-bottom:1px solid #e2e8f0">${label}</div><div style="padding:4px 6px;font-weight:600;font-size:10px">${valor}</div></td>`
    : ''

  const linha1 = [
    cel('PLACA', veiculo.placa),
    cel('MODELO', veiculo.modelo),
    cel('ANO', veiculo.ano),
    cel('MOTOR', veiculo.motor || ''),
    cel('COR', veiculo.cor || ''),
  ].filter(Boolean).join('')

  const linha2 = [
    cel('COMBUSTÍVEL', veiculo.combustivel || ''),
  ].filter(Boolean).join('')

  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:0;table-layout:fixed">
    <tr>${linha1}</tr>
  </table>
  ${linha2 ? `<table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-top:0;margin-bottom:0;table-layout:fixed"><tr>${linha2}</tr></table>` : ''}
  `
}

function gerarA4Det(os, cliente, veiculo, mecanico, total, cfg) {
  const itens = os.itens || []
  const servicos = itens.filter(i => i.tipo === 'servico')
  const pecas    = itens.filter(i => i.tipo !== 'servico')
  const totalSrv = servicos.reduce((s, i) => s + pNum(i.valorUnitario) * (Number(i.quantidade) || 1) - pNum(i.desconto), 0)
  const totalPec = pecas.reduce((s, i) => s + pNum(i.valorUnitario) * (Number(i.quantidade) || 1) - pNum(i.desconto), 0)

  const emissao = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const css = `
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; margin: 0; }
    table { border-collapse: collapse; }
    .seccao { margin-bottom: 10px; }
  `

  const rowServico = (it, idx) => {
    const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto)
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:6px 8px;vertical-align:top">
        <span style="font-weight:700;color:#1e293b">${String.fromCharCode(65 + idx)}1</span> — ${it.descricao}
        ${it.quantidade > 1 ? `<span style="font-size:9px;color:#64748b"> (${it.quantidade}x)</span>` : ''}
      </td>
      <td style="padding:6px 8px;text-align:right;white-space:nowrap;font-weight:700;vertical-align:top">${fmt(sub)}</td>
    </tr>`
  }

  const rowPeca = (it, idx, srvIdx) => {
    const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto)
    const cod = srvIdx !== undefined ? `${String.fromCharCode(65 + srvIdx)}1.${idx + 1}` : `P${idx + 1}`
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:5px 8px"><span style="font-weight:700;color:#64748b">${cod}</span> — ${it.descricao}</td>
      <td style="padding:5px 8px;text-align:center">${it.quantidade}</td>
      <td style="padding:5px 8px;text-align:right">UN</td>
      <td style="padding:5px 8px;text-align:right">${fmt(pNum(it.valorUnitario))}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:700">${fmt(sub)}</td>
    </tr>`
  }

  const body = `
    <!-- CABEÇALHO -->
    <div style="padding-bottom:10px;border-bottom:3px solid #1e293b;margin-bottom:10px">
      <div style="font-size:20px;font-weight:900;color:#1e293b;letter-spacing:-0.5px">${cfg.nome || 'Oficina'}</div>
      <div style="font-size:10px;color:#475569;margin-top:2px">
        ${[cfg.telefone, cfg.email].filter(Boolean).join(' / ')}
      </div>
      <div style="font-size:10px;color:#475569">
        ${cfg.endereco || ''}${cfg.cnpj ? `${cfg.endereco ? ' — ' : ''}CNPJ: ${cfg.cnpj}` : ''}
      </div>
    </div>

    <!-- BARRA OS -->
    <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:6px 10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:16px;font-weight:900;color:#1e293b">OS: ${os.id}</span>
      <span style="font-size:11px;font-weight:700;color:#1e293b;border:1px solid #cbd5e1;background:#fff;padding:2px 10px;border-radius:3px">VIA CLIENTE</span>
      <span style="font-size:10px;color:#475569">Emissão: ${emissao}</span>
    </div>

    <!-- CLIENTE -->
    <div class="seccao">
      ${tabelaCliente(cliente, os)}
    </div>

    <!-- VEÍCULO -->
    <div class="seccao">
      ${secHeader('Informações do Veículo')}
      ${tabelaVeiculo(veiculo, os, mecanico)}
    </div>

    <!-- DIAGNÓSTICO -->
    ${(os.descricaoProblema || os.diagnostico) ? `
    <div class="seccao">
      ${secHeader('Informações de Diagnósticos')}
      <div style="border:1px solid #cbd5e1;border-top:0;padding:8px 10px;font-size:10px;line-height:1.6;color:#334155">
        ${os.descricaoProblema ? os.descricaoProblema : ''}
        ${os.diagnostico ? `<br><strong>Diagnóstico:</strong> ${os.diagnostico}` : ''}
      </div>
    </div>` : ''}

    <!-- SERVIÇOS -->
    ${servicos.length > 0 ? `
    <div class="seccao">
      ${secHeader('Informações de Serviços')}
      <table style="width:100%;border:1px solid #cbd5e1;border-top:0">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <th style="text-align:left;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600">SERVIÇO(S)</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:100px">TOTAL</th>
        </tr>
        ${servicos.map((it, idx) => rowServico(it, idx)).join('')}
      </table>
    </div>` : ''}

    <!-- PEÇAS -->
    ${pecas.length > 0 ? `
    <div class="seccao">
      ${secHeader('Informações de Peças')}
      <table style="width:100%;border:1px solid #cbd5e1;border-top:0">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <th style="text-align:left;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600">PEÇA(S)</th>
          <th style="text-align:center;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:50px">QTD</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:50px">UN</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:90px">VALOR UNIT.</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:90px">VALOR TOTAL</th>
        </tr>
        ${pecas.map((it, idx) => rowPeca(it, idx)).join('')}
      </table>
    </div>` : ''}

    <!-- ITENS SEM TIPO (fallback) -->
    ${servicos.length === 0 && pecas.length === 0 && itens.length > 0 ? `
    <div class="seccao">
      ${secHeader('Itens')}
      <table style="width:100%;border:1px solid #cbd5e1;border-top:0">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <th style="text-align:left;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600">DESCRIÇÃO</th>
          <th style="text-align:center;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:50px">QTD</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:90px">VALOR UNIT.</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:90px">SUBTOTAL</th>
        </tr>
        ${itens.map(it => {
          const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto)
          return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:5px 8px">${it.descricao}</td><td style="padding:5px 8px;text-align:center">${it.quantidade}</td><td style="padding:5px 8px;text-align:right">${fmt(pNum(it.valorUnitario))}</td><td style="padding:5px 8px;text-align:right;font-weight:700">${fmt(sub)}</td></tr>`
        }).join('')}
      </table>
    </div>` : ''}

    <!-- TOTAIS -->
    <div style="border:1px solid #cbd5e1;border-radius:4px;padding:8px 12px;margin-bottom:14px;display:flex;justify-content:flex-end;gap:24px;align-items:center;background:#f8fafc">
      ${servicos.length > 0 ? `<div><div style="font-size:9px;color:#64748b;font-weight:600">TOTAL SERVIÇOS</div><div style="font-size:13px;font-weight:700;color:#1e293b">${fmt(totalSrv)}</div></div>` : ''}
      ${pecas.length > 0 ? `<div><div style="font-size:9px;color:#64748b;font-weight:600">TOTAL PEÇAS</div><div style="font-size:13px;font-weight:700;color:#1e293b">${fmt(totalPec)}</div></div>` : ''}
      ${pNum(os.descontoGeral) > 0 ? `<div><div style="font-size:9px;color:#b91c1c;font-weight:600">DESCONTO</div><div style="font-size:13px;font-weight:700;color:#b91c1c">- ${fmt(pNum(os.descontoGeral))}</div></div>` : ''}
      <div style="border-left:2px solid #e2e8f0;padding-left:24px"><div style="font-size:9px;color:#64748b;font-weight:600">VALOR TOTAL</div><div style="font-size:20px;font-weight:900;color:#1e293b">${fmt(total)}</div></div>
    </div>

    ${os.observacoes ? `<div style="font-size:10px;color:#475569;margin-bottom:12px;border-left:3px solid #1e293b;padding-left:8px"><strong>Observações:</strong> ${os.observacoes}</div>` : ''}

    <!-- GARANTIA -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:8px 12px;margin-bottom:12px;text-align:center">
      <span style="font-size:11px;font-weight:700;color:#15803d">✓ GARANTIA DE 90 DIAS</span>
      <span style="font-size:10px;color:#166534"> nos serviços realizados, conforme CDC art. 26.</span>
    </div>

    <!-- RODAPÉ -->
    <div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-top:4px">
      <div style="text-align:center;font-size:11px;color:#475569;margin-bottom:18px">
        Caro Cliente, obrigado por confiar em nossos serviços!
      </div>
      <div style="display:flex;gap:40px;margin-top:8px">
        <div style="flex:1;border-top:1px solid #374151;padding-top:5px;text-align:center;font-size:9px;color:#64748b">
          Assinatura do Responsável pela Oficina
        </div>
        <div style="flex:1;border-top:1px solid #374151;padding-top:5px;text-align:center;font-size:9px;color:#64748b">
          Assinatura do Cliente na Retirada do Veículo
        </div>
      </div>
    </div>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS ${os.id}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── A4 COMPACTO ──────────────────────────────────────────────────────────────

function gerarA4Comp(os, cliente, veiculo, mecanico, total, cfg) {
  const css = `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #222; margin: 0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 10px; }
    .empresa h1 { font-size: 18px; margin: 0; color: #1e293b; }
    .empresa p { margin: 1px 0; font-size: 9px; color: #555; }
    .os-box { text-align: right; }
    .os-num { font-size: 22px; font-weight: 900; color: #1e293b; }
    .status-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 1px 8px; border-radius: 20px; font-size: 10px; font-weight: bold; }
    .info-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .info-row .col { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 7px 10px; }
    .col-title { font-size: 8px; font-weight: bold; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px; }
    .kv { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .kv .k { color: #6b7280; }
    .kv .v { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #f9fafb; font-size: 8px; color: #6b7280; text-transform: uppercase; padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
    th:not(:first-child) { text-align: right; }
    td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; font-size: 10px; }
    td:not(:first-child) { text-align: right; }
    .total-line { display: flex; justify-content: flex-end; gap: 12px; border-top: 2px solid #1e293b; padding-top: 6px; }
    .total-label { font-size: 12px; color: #6b7280; }
    .total-val { font-size: 16px; font-weight: 900; color: #1e293b; }
    .footer { margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8px; color: #9ca3af; text-align: center; }
  `
  const body = `
    <div class="header">
      <div class="empresa">
        <h1>${cfg.nome || 'Oficina'}</h1>
        ${cfg.cnpj ? `<p>CNPJ: ${cfg.cnpj}</p>` : ''}
        ${cfg.telefone ? `<p>Tel: ${cfg.telefone}</p>` : ''}
      </div>
      <div class="os-box">
        <div class="os-num">OS ${os.id}</div>
        <div style="font-size:9px;color:#6b7280">${os.dataEntrada || os.data}</div>
        <div><span class="status-badge">${os.status}</span></div>
      </div>
    </div>

    <div class="info-row">
      <div class="col">
        <div class="col-title">Cliente</div>
        <div class="kv"><span class="k">Nome</span><span class="v">${cliente?.nome || '—'}</span></div>
        <div class="kv"><span class="k">Tel</span><span class="v">${cliente?.telefone || '—'}</span></div>
      </div>
      <div class="col">
        <div class="col-title">Veículo</div>
        <div class="kv"><span class="k">Modelo</span><span class="v">${veiculo ? veiculo.modelo : '—'}</span></div>
        <div class="kv"><span class="k">Placa</span><span class="v">${veiculo?.placa || '—'}</span></div>
        <div class="kv"><span class="k">KM</span><span class="v">${os.kmEntrada || '—'}</span></div>
      </div>
      ${mecanico ? `<div class="col" style="flex:0.5"><div class="col-title">Mecânico</div><div class="v">${mecanico.nome}</div></div>` : ''}
    </div>

    ${os.descricaoProblema ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:7px 10px;margin-bottom:8px;font-size:10px"><strong>Problema:</strong> ${os.descricaoProblema}</div>` : ''}

    <table>
      <thead>
        <tr>
          <th style="text-align:left">Descrição</th>
          <th>Qtd</th>
          <th>V.Unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${itensTableRows(os.itens)}</tbody>
    </table>

    ${pNum(os.descontoGeral) > 0 ? `<div class="total-line" style="border-top:none;padding-top:0"><span style="font-size:10px;color:#b91c1c">DESCONTO</span><span style="font-size:12px;font-weight:700;color:#b91c1c">- ${fmt(pNum(os.descontoGeral))}</span></div>` : ''}
    <div class="total-line">
      <span class="total-label">TOTAL</span>
      <span class="total-val">${fmt(total)}</span>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:6px 10px;margin-top:8px;margin-bottom:6px;text-align:center">
      <span style="font-size:10px;font-weight:700;color:#15803d">✓ Garantia de 90 dias</span>
      <span style="font-size:9px;color:#166534"> nos serviços realizados (CDC art. 26)</span>
    </div>
    <div class="footer">${cfg.nome || 'Oficina'} • ${new Date().toLocaleDateString('pt-BR')}</div>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS ${os.id}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── A5 ───────────────────────────────────────────────────────────────────────

function gerarA5(os, cliente, veiculo, mecanico, total, cfg) {
  const css = `
    @page { size: A5; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #222; margin: 0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e293b; padding-bottom: 7px; margin-bottom: 9px; }
    .empresa h1 { font-size: 15px; margin: 0; color: #1e293b; }
    .empresa p { margin: 1px 0; font-size: 8px; color: #555; }
    .os-num { font-size: 18px; font-weight: 900; color: #1e293b; text-align: right; }
    .os-sub { font-size: 8px; color: #6b7280; text-align: right; }
    .status-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 20px; font-size: 9px; font-weight: bold; }
    .info { display: flex; gap: 6px; margin-bottom: 7px; }
    .col { flex: 1; border: 1px solid #e5e7eb; border-radius: 5px; padding: 5px 8px; }
    .col-title { font-size: 7px; font-weight: bold; color: #9ca3af; text-transform: uppercase; margin-bottom: 3px; }
    .kv { display: flex; justify-content: space-between; margin-bottom: 1px; }
    .k { color: #6b7280; }
    .v { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 7px; }
    th { background: #f9fafb; font-size: 7px; color: #6b7280; text-transform: uppercase; padding: 3px 5px; border-bottom: 1px solid #e5e7eb; }
    th:not(:first-child) { text-align: right; }
    td { padding: 4px 5px; border-bottom: 1px solid #f3f4f6; }
    td:not(:first-child) { text-align: right; }
    .total-line { display: flex; justify-content: flex-end; gap: 10px; border-top: 2px solid #1e293b; padding-top: 5px; }
    .total-val { font-size: 14px; font-weight: 900; color: #1e293b; }
    .footer { margin-top: 8px; font-size: 7px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 5px; }
  `
  const body = `
    <div class="header">
      <div class="empresa">
        <h1>${cfg.nome || 'Oficina'}</h1>
        ${cfg.cnpj ? `<p>CNPJ: ${cfg.cnpj}</p>` : ''}
        ${cfg.telefone ? `<p>Tel: ${cfg.telefone}</p>` : ''}
      </div>
      <div>
        <div class="os-num">OS ${os.id}</div>
        <div class="os-sub">${os.dataEntrada || os.data}</div>
        <div style="text-align:right"><span class="status-badge">${os.status}</span></div>
      </div>
    </div>

    <div class="info">
      <div class="col">
        <div class="col-title">Cliente</div>
        <div class="kv"><span class="k">Nome</span><span class="v">${cliente?.nome || '—'}</span></div>
        <div class="kv"><span class="k">Tel</span><span class="v">${cliente?.telefone || '—'}</span></div>
      </div>
      <div class="col">
        <div class="col-title">Veículo</div>
        <div class="kv"><span class="k">Modelo</span><span class="v">${veiculo ? veiculo.modelo : '—'}</span></div>
        <div class="kv"><span class="k">Placa</span><span class="v">${veiculo?.placa || '—'}</span></div>
        <div class="kv"><span class="k">KM</span><span class="v">${os.kmEntrada || '—'}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left">Descrição</th>
          <th>Qtd</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${(os.itens || []).length === 0
          ? '<tr><td colspan="3" style="text-align:center;color:#aaa">Nenhum item</td></tr>'
          : (os.itens || []).map(it => {
              const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto)
              return `<tr><td>${it.descricao}</td><td style="text-align:center">${it.quantidade}</td><td style="text-align:right">${fmt(sub)}</td></tr>`
            }).join('')}
      </tbody>
    </table>

    ${pNum(os.descontoGeral) > 0 ? `<div class="total-line" style="border-top:none;padding-top:0"><span style="font-size:9px;color:#b91c1c">DESCONTO</span><span style="font-size:11px;font-weight:700;color:#b91c1c">- ${fmt(pNum(os.descontoGeral))}</span></div>` : ''}
    <div class="total-line">
      <span style="font-size:10px;color:#6b7280">TOTAL</span>
      <span class="total-val">${fmt(total)}</span>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:5px 8px;margin-top:6px;margin-bottom:5px;text-align:center">
      <span style="font-size:9px;font-weight:700;color:#15803d">✓ Garantia de 90 dias</span>
      <span style="font-size:8px;color:#166534"> nos serviços realizados (CDC art. 26)</span>
    </div>
    <div class="footer">${cfg.nome || 'Oficina'} • ${new Date().toLocaleDateString('pt-BR')}</div>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS ${os.id}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── RECIBO DE VENDA ──────────────────────────────────────────────────────────

function gerarRecibo(venda, cfg) {
  const css = `
    @page { size: 80mm auto; margin: 3mm 4mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 0; width: 80mm; color: #000; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; }
    .total { font-weight: bold; font-size: 15px; display: flex; justify-content: space-between; margin-top: 4px; }
  `
  const itensHtml = (venda.itens || []).map(it => {
    const sub = pNum(it.preco) * pNum(it.qtd) - pNum(it.desc || 0)
    return `<div class="row"><span>${it.qtd}x ${it.nome}</span><span>${fmt(sub)}</span></div>`
  }).join('')

  const pagHtml = (venda.pagamentos || []).map(p =>
    `<div class="row"><span>${p.forma}</span><span>${p.forma === 'Pagar Depois' ? fmt(p.depois || 0) + ' (a rec.)' : fmt(pNum(p.valor))}</span></div>`
  ).join('')

  const body = `
    <div class="c b">${cfg.nome || 'Oficina'}</div>
    ${cfg.cnpj ? `<div class="c">CNPJ: ${cfg.cnpj}</div>` : ''}
    ${cfg.telefone ? `<div class="c">Tel: ${cfg.telefone}</div>` : ''}
    ${cfg.endereco ? `<div class="c" style="font-size:10px">${cfg.endereco}</div>` : ''}
    <hr class="hr">
    <div class="c b">RECIBO DE VENDA</div>
    <div class="row"><span>Nº:</span><span class="b">${venda.numero || ''}</span></div>
    <div class="row"><span>Data:</span><span>${new Date().toLocaleDateString('pt-BR')} ${venda.hora || ''}</span></div>
    <div class="row"><span>Cliente:</span><span>${venda.clienteNome || 'Consumidor'}</span></div>
    <hr class="hr">
    <div class="b">ITENS</div>
    <div style="margin:3px 0">${itensHtml || '<div style="color:#aaa">Sem itens</div>'}</div>
    <hr class="hr">
    <div class="total"><span>TOTAL:</span><span>${fmt(venda.total || 0)}</span></div>
    <hr class="hr">
    <div class="b">PAGAMENTOS</div>
    <div style="margin:3px 0">${pagHtml || '<div style="color:#aaa">Nenhum</div>'}</div>
    <hr class="hr">
    <div class="c" style="margin-top:8px">Obrigado pela preferência!</div>
    <div class="c" style="font-size:9px;margin-top:2px">${cfg.nome || ''}</div>
    <br><br>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recibo ${venda.numero}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── ORÇAMENTO ────────────────────────────────────────────────────────────────

function gerarOrcamentoPDF(orc, cliente, veiculo, cfg) {
  const itens = orc.itens || []
  const servicos = itens.filter(i => i.tipo === 'Serviço' || i.tipo === 'servico')
  const pecas    = itens.filter(i => i.tipo !== 'Serviço' && i.tipo !== 'servico')
  const totalSrv = servicos.reduce((s, i) => s + pNum(i.valorUnitario) * (Number(i.quantidade) || 1) - pNum(i.desconto || 0), 0)
  const totalPec = pecas.reduce((s, i) => s + pNum(i.valorUnitario) * (Number(i.quantidade) || 1) - pNum(i.desconto || 0), 0)
  const total = totalSrv + totalPec

  const emissao = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const css = `
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; margin: 0; }
    table { border-collapse: collapse; }
    .seccao { margin-bottom: 10px; }
  `

  const rowServico = (it, idx) => {
    const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto || 0)
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:6px 8px;vertical-align:top">
        <span style="font-weight:700;color:#1e293b">${String.fromCharCode(65 + idx)}1</span> — ${it.descricao}
        ${Number(it.quantidade) > 1 ? `<span style="font-size:9px;color:#64748b"> (${it.quantidade}x)</span>` : ''}
      </td>
      <td style="padding:6px 8px;text-align:right;white-space:nowrap;font-weight:700;vertical-align:top">${fmt(sub)}</td>
    </tr>`
  }

  const rowPeca = (it, idx) => {
    const sub = pNum(it.valorUnitario) * (Number(it.quantidade) || 1) - pNum(it.desconto || 0)
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:5px 8px"><span style="font-weight:700;color:#64748b">P${idx + 1}</span> — ${it.descricao}</td>
      <td style="padding:5px 8px;text-align:center">${it.quantidade}</td>
      <td style="padding:5px 8px;text-align:right">UN</td>
      <td style="padding:5px 8px;text-align:right">${fmt(pNum(it.valorUnitario))}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:700">${fmt(sub)}</td>
    </tr>`
  }

  const validadeTexto = orc.validade || '30 dias'
  const obsBlock = orc.observacoes
    ? '<div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px;margin-bottom:14px;background:#fffbeb"><div style="font-size:9px;color:#92400e;font-weight:700;margin-bottom:4px">OBSERVAÇÕES</div><div style="font-size:10px;color:#475569;line-height:1.5">' + orc.observacoes + '</div></div>'
    : ''

  const body = `
    <!-- CABEÇALHO -->
    <div style="padding-bottom:10px;border-bottom:3px solid #1e293b;margin-bottom:10px">
      <div style="font-size:20px;font-weight:900;color:#1e293b;letter-spacing:-0.5px">${cfg.nome || 'Oficina'}</div>
      <div style="font-size:10px;color:#475569;margin-top:2px">
        ${[cfg.telefone, cfg.email].filter(Boolean).join(' / ')}
      </div>
      <div style="font-size:10px;color:#475569">
        ${cfg.endereco || ''}${cfg.cnpj ? `${cfg.endereco ? ' — ' : ''}CNPJ: ${cfg.cnpj}` : ''}
      </div>
    </div>

    <!-- BARRA ORÇAMENTO -->
    <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:6px 10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:16px;font-weight:900;color:#1e293b">ORÇAMENTO: ${orc.id || orc.numero || ''}</span>
      <span style="font-size:11px;font-weight:700;color:#1e293b;border:1px solid #cbd5e1;background:#fff;padding:2px 10px;border-radius:3px">VIA CLIENTE</span>
      <span style="font-size:10px;color:#475569">Emissão: ${emissao}</span>
    </div>

    <!-- CLIENTE -->
    <div class="seccao">
      ${tabelaCliente(cliente, {})}
    </div>

    <!-- VEÍCULO -->
    ${veiculo ? `
    <div class="seccao">
      ${secHeader('Informações do Veículo')}
      ${tabelaVeiculoOrcamento(veiculo)}
    </div>` : ''}

    <!-- SERVIÇOS -->
    ${servicos.length > 0 ? `
    <div class="seccao">
      ${secHeader('Informações de Serviços')}
      <table style="width:100%;border:1px solid #cbd5e1;border-top:0">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <th style="text-align:left;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600">SERVIÇO(S)</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:100px">TOTAL</th>
        </tr>
        ${servicos.map((it, idx) => rowServico(it, idx)).join('')}
      </table>
    </div>` : ''}

    <!-- PEÇAS -->
    ${pecas.length > 0 ? `
    <div class="seccao">
      ${secHeader('Informações de Peças')}
      <table style="width:100%;border:1px solid #cbd5e1;border-top:0">
        <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <th style="text-align:left;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600">PEÇA(S)</th>
          <th style="text-align:center;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:50px">QTD</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:50px">UN</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:90px">VALOR UNIT.</th>
          <th style="text-align:right;padding:5px 8px;font-size:9px;color:#64748b;font-weight:600;width:90px">VALOR TOTAL</th>
        </tr>
        ${pecas.map((it, idx) => rowPeca(it, idx)).join('')}
      </table>
    </div>` : ''}

    <!-- TOTAIS -->
    <div style="border:1px solid #cbd5e1;border-radius:4px;padding:8px 12px;margin-bottom:14px;display:flex;justify-content:flex-end;gap:24px;align-items:center;background:#f8fafc">
      ${servicos.length > 0 ? `<div><div style="font-size:9px;color:#64748b;font-weight:600">TOTAL SERVIÇOS</div><div style="font-size:13px;font-weight:700;color:#1e293b">${fmt(totalSrv)}</div></div>` : ''}
      ${pecas.length > 0 ? `<div><div style="font-size:9px;color:#64748b;font-weight:600">TOTAL PEÇAS</div><div style="font-size:13px;font-weight:700;color:#1e293b">${fmt(totalPec)}</div></div>` : ''}
      <div style="border-left:2px solid #e2e8f0;padding-left:24px"><div style="font-size:9px;color:#64748b;font-weight:600">VALOR TOTAL</div><div style="font-size:20px;font-weight:900;color:#1e293b">${fmt(total)}</div></div>
    </div>

    <!-- OBSERVAÇÕES E VALIDADE -->
    ${obsBlock}

    <div style="font-size:10px;color:#475569;margin-bottom:16px;text-align:center">
      Este orçamento tem validade de <strong>${validadeTexto}</strong> a partir da data de emissão.
    </div>

    <!-- RODAPÉ -->
    <div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-top:4px">
      <div style="text-align:center;font-size:11px;color:#475569;margin-bottom:18px">
        Caro Cliente, obrigado por confiar em nossos serviços!
      </div>
      <div style="display:flex;gap:40px;margin-top:8px">
        <div style="flex:1;border-top:1px solid #374151;padding-top:5px;text-align:center;font-size:9px;color:#64748b">
          Assinatura do Responsável pela Oficina
        </div>
        <div style="flex:1;border-top:1px solid #374151;padding-top:5px;text-align:center;font-size:9px;color:#64748b">
          Assinatura do Cliente (Aprovação do Orçamento)
        </div>
      </div>
    </div>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento ${orc.id || ''}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

export function imprimirOS(os, cliente, veiculo, mecanico, total, modelo) {
  const cfg = getConfig()
  let html
  if (modelo === 'termica80') html = gerarCupom(os, cliente, veiculo, mecanico, total, cfg, '80mm', '12px')
  else if (modelo === 'termica58') html = gerarCupom(os, cliente, veiculo, mecanico, total, cfg, '58mm', '10px')
  else if (modelo === 'a4comp') html = gerarA4Comp(os, cliente, veiculo, mecanico, total, cfg)
  else if (modelo === 'a5') html = gerarA5(os, cliente, veiculo, mecanico, total, cfg)
  else html = gerarA4Det(os, cliente, veiculo, mecanico, total, cfg)
  abrirJanela(html, `OS ${os.id}`)
}

export function imprimirReciboCaixa(venda) {
  const cfg = getConfig()
  abrirJanela(gerarRecibo(venda, cfg), `Recibo ${venda.numero}`)
}

export function imprimirOrcamento(orc, cliente, veiculo) {
  const cfg = getConfig()
  abrirJanela(gerarOrcamentoPDF(orc, cliente, veiculo, cfg), `Orçamento ${orc.id || ''}`)
}

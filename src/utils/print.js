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
    <div class="total"><span>TOTAL:</span><span>${fmt(total)}</span></div>
    <hr class="hr">
    <div class="c" style="margin-top:8px">Obrigado pela preferência!</div>
    <div class="c" style="font-size:9px;margin-top:2px">${cfg.nome || ''}</div>
    <br><br>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS ${os.id}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── A4 DETALHADO ─────────────────────────────────────────────────────────────

function gerarA4Det(os, cliente, veiculo, mecanico, total, cfg) {
  const css = `
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #f97316; margin-bottom: 14px; }
    .empresa h1 { font-size: 22px; margin: 0 0 4px; color: #f97316; }
    .empresa p { margin: 1px 0; font-size: 10px; color: #555; }
    .os-box { text-align: right; }
    .os-num { font-size: 26px; font-weight: 900; color: #f97316; }
    .status-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-top: 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
    .box-title { font-size: 9px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .kv { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .kv .k { color: #6b7280; }
    .kv .v { font-weight: 600; }
    .problem-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f9fafb; font-size: 9px; color: #6b7280; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    th:not(:first-child) { text-align: right; }
    td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
    td:not(:first-child) { text-align: right; }
    .total-line { display: flex; justify-content: flex-end; align-items: center; gap: 16px; border-top: 2px solid #f97316; padding-top: 8px; margin-bottom: 20px; }
    .total-label { font-size: 13px; color: #6b7280; }
    .total-val { font-size: 20px; font-weight: 900; color: #f97316; }
    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 30px; }
    .assin { border-top: 1px solid #374151; padding-top: 6px; text-align: center; font-size: 10px; color: #6b7280; }
    .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #9ca3af; text-align: center; }
  `
  const body = `
    <div class="header">
      <div class="empresa">
        <h1>${cfg.nome || 'Oficina'}</h1>
        ${cfg.cnpj ? `<p>CNPJ: ${cfg.cnpj}</p>` : ''}
        ${cfg.telefone ? `<p>Tel: ${cfg.telefone}</p>` : ''}
        ${cfg.endereco ? `<p>${cfg.endereco}</p>` : ''}
        ${cfg.email ? `<p>${cfg.email}</p>` : ''}
      </div>
      <div class="os-box">
        <div class="os-num">OS ${os.id}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px">Entrada: ${os.dataEntrada || os.data}</div>
        ${os.dataConclusao ? `<div style="font-size:10px;color:#6b7280">Conclusão: ${os.dataConclusao}</div>` : ''}
        <div><span class="status-badge">${os.status}</span></div>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <div class="box-title">Cliente</div>
        <div class="kv"><span class="k">Nome</span><span class="v">${cliente?.nome || '—'}</span></div>
        <div class="kv"><span class="k">Telefone</span><span class="v">${cliente?.telefone || '—'}</span></div>
        <div class="kv"><span class="k">E-mail</span><span class="v">${cliente?.email || '—'}</span></div>
      </div>
      <div class="box">
        <div class="box-title">Veículo</div>
        <div class="kv"><span class="k">Modelo</span><span class="v">${veiculo ? `${veiculo.modelo} ${veiculo.ano || ''}` : '—'}</span></div>
        <div class="kv"><span class="k">Placa</span><span class="v">${veiculo?.placa || '—'}</span></div>
        <div class="kv"><span class="k">KM Entrada</span><span class="v">${os.kmEntrada || '—'}</span></div>
        ${mecanico ? `<div class="kv"><span class="k">Mecânico</span><span class="v">${mecanico.nome}</span></div>` : ''}
      </div>
    </div>

    ${(os.descricaoProblema || os.diagnostico) ? `
    <div class="problem-box">
      <div class="box-title">Descrição do Problema / Diagnóstico</div>
      ${os.descricaoProblema ? `<p style="margin:0 0 4px">${os.descricaoProblema}</p>` : ''}
      ${os.diagnostico ? `<p style="margin:0;color:#555"><strong>Diagnóstico:</strong> ${os.diagnostico}</p>` : ''}
    </div>` : ''}

    <table>
      <thead>
        <tr>
          <th style="text-align:left">Descrição</th>
          <th>Qtd</th>
          <th>Valor Unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${itensTableRows(os.itens)}</tbody>
    </table>

    <div class="total-line">
      <span class="total-label">TOTAL</span>
      <span class="total-val">${fmt(total)}</span>
    </div>

    ${os.observacoes ? `<div style="font-size:10px;color:#6b7280;margin-bottom:16px"><strong>Observações:</strong> ${os.observacoes}</div>` : ''}

    <div class="assinaturas">
      <div class="assin">Assinatura do Responsável pela Oficina</div>
      <div class="assin">Assinatura do Cliente</div>
    </div>

    <div class="footer">Documento emitido por ${cfg.nome || 'Oficina'} • ${new Date().toLocaleDateString('pt-BR')}</div>
  `
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS ${os.id}</title><style>${css}</style></head><body>${body}</body></html>`
}

// ─── A4 COMPACTO ──────────────────────────────────────────────────────────────

function gerarA4Comp(os, cliente, veiculo, mecanico, total, cfg) {
  const css = `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #222; margin: 0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 8px; margin-bottom: 10px; }
    .empresa h1 { font-size: 18px; margin: 0; color: #f97316; }
    .empresa p { margin: 1px 0; font-size: 9px; color: #555; }
    .os-box { text-align: right; }
    .os-num { font-size: 22px; font-weight: 900; color: #f97316; }
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
    .total-line { display: flex; justify-content: flex-end; gap: 12px; border-top: 2px solid #f97316; padding-top: 6px; }
    .total-label { font-size: 12px; color: #6b7280; }
    .total-val { font-size: 16px; font-weight: 900; color: #f97316; }
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

    <div class="total-line">
      <span class="total-label">TOTAL</span>
      <span class="total-val">${fmt(total)}</span>
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
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 7px; margin-bottom: 9px; }
    .empresa h1 { font-size: 15px; margin: 0; color: #f97316; }
    .empresa p { margin: 1px 0; font-size: 8px; color: #555; }
    .os-num { font-size: 18px; font-weight: 900; color: #f97316; text-align: right; }
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
    .total-line { display: flex; justify-content: flex-end; gap: 10px; border-top: 2px solid #f97316; padding-top: 5px; }
    .total-val { font-size: 14px; font-weight: 900; color: #f97316; }
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

    <div class="total-line">
      <span style="font-size:10px;color:#6b7280">TOTAL</span>
      <span class="total-val">${fmt(total)}</span>
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

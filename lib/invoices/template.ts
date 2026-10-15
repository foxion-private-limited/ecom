/**
 * Tax Invoice HTML Template Generator
 *
 * Generates a complete, self-contained HTML document from an InvoiceViewModel.
 * This string is used as the source for:
 *   1. Live preview in the browser
 *   2. PDF generation via Playwright
 *   3. PNG export via Playwright screenshot
 *
 * Design: Clean, professional Indian business tax invoice.
 * A4 portrait, white background, navy/charcoal typography.
 */

import type { InvoiceViewModel } from "./viewModel";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(str: string): string {
  return esc(str).replace(/\n/g, "<br/>");
}

function row(label: string, value: string, show: boolean = true): string {
  if (!show || !value) return "";
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

export function renderInvoiceHtml(vm: InvoiceViewModel): string {
  const brandColor = esc(vm.brandColor || "#1e3a5f");

  const testBanner = vm.isTestMode
    ? `<div class="test-banner">⚠ TEST INVOICE — NOT VALID FOR GST CLAIM OR FILING ⚠</div>`
    : "";

  const watermarkCss = vm.isTestMode
    ? `
    .watermark-layer {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    }
    .watermark-layer::before {
      content: "";
      position: absolute;
      top: -50%; left: -50%;
      width: 200%; height: 200%;
      background-image: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 80px,
        rgba(220,38,38,0.06) 80px,
        rgba(220,38,38,0.06) 160px
      );
    }
    .watermark-text {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.08);
      white-space: nowrap;
      letter-spacing: 12px;
      pointer-events: none;
      z-index: 9999;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
    }
    @media print {
      .watermark-layer, .watermark-text {
        position: fixed;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }`
    : "";

  const watermarkHtml = vm.isTestMode
    ? `<div class="watermark-layer"></div><div class="watermark-text">TEST INVOICE</div>`
    : "";

  // Build line items table columns
  const buildLineItemsTable = (): string => {
    const colGroup = `
      <colgroup>
        <col style="width:3%">
        <col style="width:${vm.showHsn ? "24%" : "29%"}">
        ${vm.showHsn ? `<col style="width:7%">` : ""}
        <col style="width:5%">
        <col style="width:5%">
        <col style="width:9%">
        ${vm.showDiscount ? `<col style="width:8%">` : ""}
        <col style="width:9%">
        ${vm.showCgstSgst ? `<col style="width:6%"><col style="width:7%"><col style="width:6%"><col style="width:7%">` : ""}
        ${vm.showIgst ? `<col style="width:6%"><col style="width:8%">` : ""}
        ${!vm.showCgstSgst && !vm.showIgst ? `<col style="width:5%"><col style="width:8%">` : ""}
        <col style="width:9%">
      </colgroup>`;

    const headerCells = `
        <th>No.</th>
        <th class="tl">Description</th>
        ${vm.showHsn ? `<th>HSN/SAC</th>` : ""}
        <th>Qty</th>
        <th>Unit</th>
        <th>Unit Price</th>
        ${vm.showDiscount ? `<th>Discount</th>` : ""}
        <th>Taxable Value</th>
        ${vm.showCgstSgst ? `<th>CGST%</th><th>CGST Amt</th><th>SGST%</th><th>SGST Amt</th>` : ""}
        ${vm.showIgst ? `<th>IGST%</th><th>IGST Amt</th>` : ""}
        ${!vm.showCgstSgst && !vm.showIgst ? `<th>GST%</th><th>GST Amt</th>` : ""}
        <th>Total</th>`;

    const dataRows = vm.lineItems
      .map(
        (li) => `
      <tr>
        <td class="tc">${li.no}</td>
        <td class="tl desc">${nl2br(li.description)}</td>
        ${vm.showHsn ? `<td class="tc mono">${esc(li.hsnSac)}</td>` : ""}
        <td class="tc">${esc(li.quantity)}</td>
        <td class="tc">${esc(li.unit)}</td>
        <td class="tr mono">${esc(li.unitPrice)}</td>
        ${vm.showDiscount ? `<td class="tr mono">${esc(li.discountAmount)}</td>` : ""}
        <td class="tr mono">${esc(li.taxableValue)}</td>
        ${vm.showCgstSgst ? `<td class="tc">${esc(li.cgstRate)}</td><td class="tr mono">${esc(li.cgstAmount)}</td><td class="tc">${esc(li.sgstRate)}</td><td class="tr mono">${esc(li.sgstAmount)}</td>` : ""}
        ${vm.showIgst ? `<td class="tc">${esc(li.igstRate)}</td><td class="tr mono">${esc(li.igstAmount)}</td>` : ""}
        ${!vm.showCgstSgst && !vm.showIgst ? `<td class="tc">${esc(li.gstRate)}</td><td class="tr mono">—</td>` : ""}
        <td class="tr mono bold">${esc(li.lineTotal)}</td>
      </tr>`
      )
      .join("");

    return `
    <table class="items-table" cellspacing="0" cellpadding="0">
      ${colGroup}
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>${dataRows}</tbody>
    </table>`;
  };

  // GST rate breakdown table
  const buildGstBreakdown = (): string => {
    if (vm.gstRateBreakdown.length === 0) return "";
    const rows = vm.gstRateBreakdown
      .map(
        (r) => `
      <tr>
        <td class="tc">${esc(r.rate)}</td>
        <td class="tr mono">${esc(r.taxableValue)}</td>
        ${vm.showCgstSgst ? `<td class="tr mono">${esc(r.cgstAmount)}</td><td class="tr mono">${esc(r.sgstAmount)}</td>` : ""}
        ${vm.showIgst ? `<td class="tr mono">${esc(r.igstAmount)}</td>` : ""}
        <td class="tr mono bold">${esc(r.total)}</td>
      </tr>`
      )
      .join("");

    return `
    <div class="gst-breakdown">
      <div class="section-label">GST Rate-Wise Summary</div>
      <table class="summary-table" cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <th class="tc">GST Rate</th>
            <th class="tr">Taxable Value</th>
            ${vm.showCgstSgst ? `<th class="tr">CGST</th><th class="tr">SGST</th>` : ""}
            ${vm.showIgst ? `<th class="tr">IGST</th>` : ""}
            <th class="tr">Total Tax</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  };

  // Optional fields (only shown if non-empty)
  const marketplaceSection =
    vm.marketplaceOrderId || vm.platform || vm.marketplaceRef || vm.awbNumber
      ? `
    <div class="info-section">
      <div class="section-label">Dispatch &amp; Marketplace Details</div>
      <table class="detail-table">
        ${row("Platform", vm.platform)}
        ${row("Order ID", vm.marketplaceOrderId)}
        ${row("Marketplace Ref", vm.marketplaceRef)}
        ${row("Courier", vm.courierCompany)}
        ${row("AWB / Tracking", vm.awbNumber || vm.trackingNumber)}
      </table>
    </div>`
      : "";

  const notesSection =
    vm.notes || vm.paymentTerms
      ? `
    <div class="notes-section">
      ${vm.paymentTerms ? `<div class="note-item"><strong>Payment Terms:</strong> ${nl2br(vm.paymentTerms)}</div>` : ""}
      ${vm.notes ? `<div class="note-item"><strong>Notes:</strong> ${nl2br(vm.notes)}</div>` : ""}
    </div>`
      : "";

  const declarationsText = [vm.additionalDeclarations, vm.defaultDeclarations]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(vm.isTestMode ? "TEST — " : "")}Tax Invoice ${esc(vm.serialNumber)}</title>
  <style>
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 10pt; }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #1a1f36;
      background: #fff;
      line-height: 1.45;
      padding: 0;
      margin: 0;
    }

    /* ── Watermark ── */
    ${watermarkCss}

    /* ── Test Banner ── */
    .test-banner {
      background: #dc2626;
      color: #fff;
      text-align: center;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 5px 0;
      position: relative;
      z-index: 100;
    }

    /* ── Page ── */
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 14mm 14mm 10mm;
      background: #fff;
      position: relative;
    }
    @media print {
      html, body { width: 210mm; }
      .page { padding: 12mm; margin: 0; box-shadow: none; }
      @page { size: A4 portrait; margin: 0; }
    }

    /* ── Invoice Header ── */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid ${brandColor};
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-block { flex: 1; }
    .company-name {
      font-size: 16pt;
      font-weight: 800;
      color: ${brandColor};
      line-height: 1.1;
    }
    .company-trade-name {
      font-size: 9pt;
      color: #64748b;
      margin-top: 1px;
    }
    .company-meta {
      margin-top: 6px;
      font-size: 8.5pt;
      color: #374151;
      line-height: 1.55;
    }
    .company-gstin {
      margin-top: 4px;
      font-size: 8.5pt;
      font-weight: 600;
      color: #1a1f36;
    }
    .logo-block img {
      max-height: 56px;
      max-width: 160px;
      object-fit: contain;
    }
    .invoice-title-block {
      text-align: right;
      min-width: 160px;
    }
    .invoice-title {
      font-size: 18pt;
      font-weight: 900;
      color: ${brandColor};
      letter-spacing: 1px;
      line-height: 1;
    }
    .invoice-meta-table {
      margin-top: 8px;
      font-size: 8.5pt;
      color: #374151;
      border-collapse: collapse;
      margin-left: auto;
    }
    .invoice-meta-table td { padding: 1.5px 4px; }
    .invoice-meta-table .lbl { font-weight: 600; color: #64748b; white-space: nowrap; }
    .invoice-meta-table .val { font-weight: 700; font-family: monospace; }
    .invoice-meta-table .fy { color: #64748b; font-size: 7.5pt; }

    /* ── Party Panel ── */
    .party-panel {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .party-box {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .party-box-title {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${brandColor};
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .party-name {
      font-size: 10pt;
      font-weight: 700;
      color: #1a1f36;
      margin-bottom: 2px;
    }
    .party-address {
      font-size: 8.5pt;
      color: #374151;
      line-height: 1.5;
    }
    .party-gstin {
      margin-top: 4px;
      font-size: 8pt;
      font-weight: 600;
      color: #1a1f36;
    }
    .party-contact {
      margin-top: 3px;
      font-size: 8pt;
      color: #64748b;
    }
    .pos-badge {
      display: inline-block;
      margin-top: 4px;
      font-size: 7.5pt;
      font-weight: 600;
      background: #eff6ff;
      color: ${brandColor};
      border: 1px solid #bfdbfe;
      border-radius: 3px;
      padding: 1px 6px;
    }

    /* ── Info Sections (dispatch, etc.) ── */
    .info-section {
      margin-bottom: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 7px 10px;
      background: #f8fafc;
    }
    .section-label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${brandColor};
      margin-bottom: 5px;
    }
    .detail-table { border-collapse: collapse; font-size: 8.5pt; }
    .detail-table .lbl {
      font-weight: 600;
      color: #64748b;
      padding-right: 12px;
      padding-bottom: 2px;
      white-space: nowrap;
    }
    .detail-table td { padding-bottom: 1px; }

    /* ── Line Items Table ── */
    .items-section { margin-bottom: 0; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 0;
    }
    .items-table thead tr {
      background: ${brandColor};
      color: #fff;
    }
    .items-table thead th {
      padding: 5px 4px;
      font-weight: 600;
      font-size: 7.5pt;
      letter-spacing: 0.3px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .items-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .items-table tbody td {
      padding: 5px 4px;
      vertical-align: top;
      border: 1px solid #e2e8f0;
      font-size: 8pt;
    }
    .items-table .desc { font-weight: 500; }
    .items-table .mono { font-family: 'Courier New', monospace; }

    /* ── Totals ── */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 0;
      border-top: 1px solid #e2e8f0;
    }
    .totals-table {
      min-width: 260px;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    .totals-table td {
      padding: 3px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-table .tlbl {
      color: #64748b;
      font-weight: 500;
      text-align: right;
      padding-right: 16px;
    }
    .totals-table .tval {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      text-align: right;
      min-width: 100px;
      white-space: nowrap;
    }
    .totals-table .total-row td {
      background: ${brandColor};
      color: #fff;
      font-weight: 700;
      font-size: 10pt;
      padding: 6px 8px;
      border: none;
    }
    .totals-table .total-row .tlbl { color: rgba(255,255,255,0.85); }
    .totals-table .total-row .tval { color: #fff; }

    /* ── Amount in Words ── */
    .amount-words {
      margin: 8px 0 10px;
      padding: 7px 12px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 4px;
      font-size: 8.5pt;
      color: #0c4a6e;
      font-weight: 600;
    }
    .amount-words .aw-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0369a1;
      font-weight: 700;
      margin-bottom: 1px;
    }

    /* ── GST Breakdown ── */
    .gst-breakdown {
      margin-bottom: 10px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .summary-table thead tr { background: #f1f5f9; }
    .summary-table th {
      padding: 4px 8px;
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .summary-table td {
      padding: 3.5px 8px;
      border: 1px solid #e2e8f0;
      font-size: 8pt;
    }
    .summary-table tbody tr:nth-child(even) { background: #f8fafc; }

    /* ── Declarations ── */
    .declarations {
      margin-top: 10px;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #fafafa;
      font-size: 7.5pt;
      color: #64748b;
      line-height: 1.55;
    }
    .declarations .dec-row { margin-bottom: 2px; }
    .declarations .dec-bold { font-weight: 700; color: #374151; }

    /* ── Notes ── */
    .notes-section {
      margin-top: 8px;
      font-size: 8pt;
      color: #475569;
      line-height: 1.5;
    }
    .note-item { margin-bottom: 3px; }

    /* ── Footer ── */
    .invoice-footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1.5px solid ${brandColor};
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left { font-size: 7.5pt; color: #94a3b8; }
    .footer-right {
      text-align: right;
      font-size: 8pt;
      color: #374151;
    }
    .footer-right .sig-label {
      font-size: 7pt;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #cbd5e1;
      padding-top: 3px;
    }

    /* ── Utilities ── */
    .tc { text-align: center; }
    .tr { text-align: right; }
    .tl { text-align: left; }
    .bold { font-weight: 700; }
    .mono { font-family: 'Courier New', monospace; }
    .mb4 { margin-bottom: 4px; }
    .nowrap { white-space: nowrap; }
  </style>
</head>
<body>
  ${watermarkHtml}
  ${testBanner}

  <div class="page">

    <!-- ── Header ── -->
    <div class="invoice-header">
      <div class="company-block">
        ${vm.sellerLogoUrl ? `<div class="logo-block mb4"><img src="${esc(vm.sellerLogoUrl)}" alt="Logo"/></div>` : ""}
        <div class="company-name">${esc(vm.sellerLegalName)}</div>
        ${vm.sellerTradeName && vm.sellerTradeName !== vm.sellerLegalName ? `<div class="company-trade-name">T/A: ${esc(vm.sellerTradeName)}</div>` : ""}
        <div class="company-meta">
          ${esc(vm.sellerAddress.line1)}${vm.sellerAddress.line2 ? ", " + esc(vm.sellerAddress.line2) : ""}<br/>
          ${esc(vm.sellerAddress.city)}, ${esc(vm.sellerAddress.state)} — ${esc(vm.sellerAddress.stateCode)},
          ${esc(vm.sellerAddress.pincode)}
          ${vm.sellerPhone ? `<br/>📞 ${esc(vm.sellerPhone)}` : ""}
          ${vm.sellerEmail ? `&nbsp;&nbsp;✉ ${esc(vm.sellerEmail)}` : ""}
        </div>
        ${vm.sellerGstin ? `<div class="company-gstin">GSTIN: ${esc(vm.sellerGstin)}</div>` : ""}
      </div>

      <div class="invoice-title-block">
        <div class="invoice-title">${esc(vm.invoiceTitle)}</div>
        <table class="invoice-meta-table">
          <tr>
            <td class="lbl">Invoice No.</td>
            <td class="val">${esc(vm.serialNumber)}</td>
          </tr>
          <tr>
            <td class="lbl">Date</td>
            <td class="val">${esc(vm.invoiceDate)}</td>
          </tr>
          <tr>
            <td class="lbl">F.Y.</td>
            <td class="fy">${esc(vm.financialYear)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ── Party Panel ── -->
    <div class="party-panel">
      <!-- Bill To -->
      <div class="party-box">
        <div class="party-box-title">Bill To (Customer)</div>
        <div class="party-name">${esc(vm.buyerName)}</div>
        <div class="party-address">
          ${esc(vm.buyerBillingAddress.line1)}
          ${vm.buyerBillingAddress.line2 ? `<br/>${esc(vm.buyerBillingAddress.line2)}` : ""}
          <br/>${esc(vm.buyerBillingAddress.city)}, ${esc(vm.buyerBillingAddress.state)} — ${esc(vm.buyerBillingAddress.stateCode)}
          ${vm.buyerBillingAddress.pincode ? `, ${esc(vm.buyerBillingAddress.pincode)}` : ""}
        </div>
        ${vm.buyerGstin ? `<div class="party-gstin">GSTIN: ${esc(vm.buyerGstin)}</div>` : ""}
        ${vm.buyerPhone || vm.buyerEmail ? `<div class="party-contact">${vm.buyerPhone ? `📞 ${esc(vm.buyerPhone)}` : ""}${vm.buyerEmail ? `  ✉ ${esc(vm.buyerEmail)}` : ""}</div>` : ""}
        <div class="pos-badge">Place of Supply: ${esc(vm.placeOfSupply)} (${esc(vm.placeOfSupplyCode)})</div>
      </div>

      <!-- Ship To -->
      <div class="party-box">
        <div class="party-box-title">Ship To</div>
        ${
          vm.buyerShippingAddress
            ? `
          <div class="party-name">${esc(vm.buyerName)}</div>
          <div class="party-address">
            ${esc(vm.buyerShippingAddress.line1)}
            ${vm.buyerShippingAddress.line2 ? `<br/>${esc(vm.buyerShippingAddress.line2)}` : ""}
            <br/>${esc(vm.buyerShippingAddress.city)}, ${esc(vm.buyerShippingAddress.state)} — ${esc(vm.buyerShippingAddress.stateCode)}
            ${vm.buyerShippingAddress.pincode ? `, ${esc(vm.buyerShippingAddress.pincode)}` : ""}
          </div>`
            : `<div class="party-address" style="color:#94a3b8;font-style:italic">Same as billing address</div>`
        }
        <div style="margin-top:6px;">
          <span style="font-size:7.5pt;font-weight:600;color:#475569;">Tax Treatment: </span>
          <span style="font-size:8pt;font-weight:700;">${esc(vm.taxTreatment.replace(/_/g, " "))}</span>
        </div>
      </div>
    </div>

    <!-- ── Marketplace/Dispatch ── -->
    ${marketplaceSection}

    <!-- ── Line Items ── -->
    <div class="items-section">${buildLineItemsTable()}</div>

    <!-- ── Totals ── -->
    <div class="totals-section">
      <table class="totals-table">
        ${vm.showDiscount && parseFloat(vm.totalDiscount.replace(/[^0-9.]/g, "")) > 0 ? `
        <tr>
          <td class="tlbl">Total Discount</td>
          <td class="tval">${esc(vm.totalDiscount)}</td>
        </tr>` : ""}
        <tr>
          <td class="tlbl">Taxable Amount</td>
          <td class="tval">${esc(vm.taxableSubtotal)}</td>
        </tr>
        ${vm.showCgstSgst ? `
        <tr><td class="tlbl">CGST</td><td class="tval">${esc(vm.cgstTotal)}</td></tr>
        <tr><td class="tlbl">SGST</td><td class="tval">${esc(vm.sgstTotal)}</td></tr>` : ""}
        ${vm.showIgst ? `
        <tr><td class="tlbl">IGST</td><td class="tval">${esc(vm.igstTotal)}</td></tr>` : ""}
        <tr>
          <td class="tlbl">Total GST</td>
          <td class="tval">${esc(vm.totalGst)}</td>
        </tr>
        <tr>
          <td class="tlbl">Gross Total</td>
          <td class="tval">${esc(vm.grossTotal)}</td>
        </tr>
        ${vm.roundOff && vm.roundOff !== "₹0.00" ? `
        <tr>
          <td class="tlbl">Round Off</td>
          <td class="tval">${esc(vm.roundOff)}</td>
        </tr>` : ""}
        <tr class="total-row">
          <td class="tlbl">Amount Payable</td>
          <td class="tval">${esc(vm.amountPayable)}</td>
        </tr>
      </table>
    </div>

    <!-- ── Amount in Words ── -->
    <div class="amount-words">
      <div class="aw-label">Amount in Words</div>
      ${esc(vm.amountInWords)}
    </div>

    <!-- ── GST Breakdown ── -->
    ${buildGstBreakdown()}

    <!-- ── Notes ── -->
    ${notesSection}

    <!-- ── Declarations ── -->
    <div class="declarations">
      <div class="dec-row">
        <span class="dec-bold">Reverse Charge Applicable:</span>
        ${esc(vm.reverseChargeApplicable ? "Yes" : "No")}
      </div>
      ${declarationsText ? `<div class="dec-row" style="margin-top:4px;">${nl2br(declarationsText)}</div>` : ""}
      <div class="dec-row" style="margin-top:4px;font-style:italic;">
        This is a computer-generated invoice and does not require a physical signature.
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="invoice-footer">
      <div class="footer-left">
        <div>Foxion Business Suite</div>
        ${vm.isTestMode ? `<div style="color:#dc2626;font-weight:700;">⚠ TEST INVOICE — NOT VALID FOR GST CLAIM</div>` : ""}
      </div>
      <div class="footer-right">
        <div>For <strong>${esc(vm.sellerLegalName)}</strong></div>
        <div class="sig-label">Authorised Signatory</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

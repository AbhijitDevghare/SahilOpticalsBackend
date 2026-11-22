import PDFDocument from 'pdfkit';
import { hasPrescriptionData, roundCurrency } from './billCalculator.js';

const escapeHtml = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDate = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatMoneyHtml = (num) => {
  return `&#8377;${Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatMoneyPdf = (num) => {
  return `Rs. ${Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatInvoiceData = (billDoc, shopDoc) => {
  const bill = typeof billDoc.toObject === 'function' ? billDoc.toObject() : billDoc;
  const shop = shopDoc
    ? typeof shopDoc.toObject === 'function'
      ? shopDoc.toObject()
      : shopDoc
    : {};

  const taxableAmount =
    bill.taxableAmount !== undefined
      ? bill.taxableAmount
      : Math.max(0, roundCurrency((bill.subtotal || 0) - (bill.discount || 0)));

  const gstAmount = Number(bill.GST || 0);
  const cgst = bill.cgst !== undefined ? bill.cgst : roundCurrency(gstAmount / 2);
  const sgst = bill.sgst !== undefined ? bill.sgst : roundCurrency(gstAmount - cgst);

  const prescription = bill.prescription || {
    rightEye: { sph: '', cyl: '', axis: '', add: '', va: '' },
    leftEye: { sph: '', cyl: '', axis: '', add: '', va: '' },
    pdDistance: '',
    pdNear: '',
    lensType: '',
    remarks: '',
  };

  const formattedItems = (bill.items || []).map((item) => {
    const itemRate = item.rate !== undefined ? item.rate : item.price;
    return {
      product: item.product || null,
      isManual: Boolean(item.isManual || !item.product),
      name: item.name,
      category: item.category || 'Other',
      quantity: item.quantity,
      rate: itemRate,
      price: itemRate,
      amount: item.amount,
    };
  });

  return {
    _id: bill._id,
    billNumber: bill.billNumber,
    billDate: bill.billDate,
    shop: {
      shopName: shop.shopName || 'Sahil Optical',
      tagline: shop.tagline || 'Complete Eye Care & Optical Showroom',
      address: shop.address || '',
      mobile: shop.mobile || '',
      email: shop.email || '',
      GSTIN: shop.GSTIN || '',
    },
    customer: bill.customer
      ? {
          _id: bill.customer._id,
          name: bill.customer.name || '',
          mobile: bill.customer.mobile || '',
          address: bill.customer.address || '',
        }
      : null,
    items: formattedItems,
    prescription,
    hasPrescription: hasPrescriptionData(prescription),
    subtotal: Number(bill.subtotal || 0),
    discountType: bill.discountType || 'fixed',
    discountValue: Number(bill.discountValue !== undefined ? bill.discountValue : bill.discount || 0),
    discount: Number(bill.discount || 0),
    taxableAmount,
    gstRate: Number(bill.gstRate || 0),
    GST: gstAmount,
    cgst,
    sgst,
    grandTotal: Number(bill.grandTotal || 0),
    advance: Number(bill.advance || 0),
    balance: Number(bill.balance || 0),
    paymentMode: bill.paymentMode || 'Cash',
    paymentBreakdown: bill.paymentBreakdown || { cash: 0, upi: 0, card: 0 },
    paymentStatus: bill.paymentStatus || 'Pending',
    notes: bill.notes || '',
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
};

export const generateInvoiceHtml = (invoice) => {
  const statusColor =
    invoice.paymentStatus === 'Paid'
      ? { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' }
      : invoice.paymentStatus === 'Partial'
      ? { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' }
      : { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' };

  const rx = invoice.prescription || {};
  const od = rx.rightEye || {};
  const os = rx.leftEye || {};

  const prescriptionSection = invoice.hasPrescription
    ? `
      <div class="section">
        <div class="section-title">Eye Prescription (Rx)</div>
        <table class="data-table rx-table">
          <thead>
            <tr>
              <th>Eye</th>
              <th>SPH</th>
              <th>CYL</th>
              <th>Axis</th>
              <th>ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Right Eye (OD)</strong></td>
              <td>${escapeHtml(od.sph || '-')}</td>
              <td>${escapeHtml(od.cyl || '-')}</td>
              <td>${escapeHtml(od.axis ? `${od.axis}°` : '-')}</td>
              <td>${escapeHtml(od.add || '-')}</td>
            </tr>
            <tr>
              <td><strong>Left Eye (OS)</strong></td>
              <td>${escapeHtml(os.sph || '-')}</td>
              <td>${escapeHtml(os.cyl || '-')}</td>
              <td>${escapeHtml(os.axis ? `${os.axis}°` : '-')}</td>
              <td>${escapeHtml(os.add || '-')}</td>
            </tr>
          </tbody>
        </table>
        <div class="rx-meta">
          <span><strong>PD Distance:</strong> ${escapeHtml(rx.pdDistance || '-')}</span>
          <span><strong>PD Near:</strong> ${escapeHtml(rx.pdNear || '-')}</span>
          <span><strong>Lens Type:</strong> ${escapeHtml(rx.lensType || '-')}</span>
        </div>
        ${rx.remarks ? `<div class="rx-remarks"><strong>Remarks:</strong> ${escapeHtml(rx.remarks)}</div>` : ''}
      </div>
    `
    : '';

  const itemRows = (invoice.items || [])
    .map(
      (item, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
        </td>
        <td>${escapeHtml(item.category)}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-right">${formatMoneyHtml(item.rate)}</td>
        <td class="text-right"><strong>${formatMoneyHtml(item.amount)}</strong></td>
      </tr>
    `
    )
    .join('');

  const discountLabel =
    invoice.discountType === 'percentage' && invoice.discountValue > 0
      ? `Discount (${invoice.discountValue}%)`
      : 'Discount';

  const breakdownHtml =
    invoice.paymentMode === 'Mixed' &&
    invoice.paymentBreakdown &&
    (invoice.paymentBreakdown.cash > 0 ||
      invoice.paymentBreakdown.upi > 0 ||
      invoice.paymentBreakdown.card > 0)
      ? `<div class="meta-line"><strong>Split:</strong> Cash ${formatMoneyHtml(
          invoice.paymentBreakdown.cash
        )} | UPI ${formatMoneyHtml(invoice.paymentBreakdown.upi)} | Card ${formatMoneyHtml(
          invoice.paymentBreakdown.card
        )}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${escapeHtml(invoice.billNumber)} - ${escapeHtml(invoice.shop.shopName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      background: #F1F5F9;
      padding: 24px;
      line-height: 1.45;
      font-size: 13px;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn {
      padding: 9px 18px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary { background: #2563EB; color: #FFFFFF; }
    .btn-secondary { background: #0F172A; color: #FFFFFF; }
    .invoice-card {
      max-width: 820px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.07);
    }
    .header {
      background: #0F172A;
      color: #FFFFFF;
      padding: 24px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .shop-name { font-size: 24px; font-weight: 700; letter-spacing: 0.3px; }
    .shop-tagline { font-size: 12px; color: #94A3B8; margin-top: 2px; }
    .shop-contact { font-size: 12px; color: #CBD5E1; margin-top: 8px; }
    .invoice-title-box { text-align: right; }
    .invoice-label {
      font-size: 18px;
      font-weight: 700;
      color: #60A5FA;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .invoice-meta { font-size: 12px; color: #E2E8F0; margin-top: 6px; }
    .status-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: ${statusColor.bg};
      color: ${statusColor.text};
      border: 1px solid ${statusColor.border};
    }
    .body { padding: 24px 28px; }
    .info-grid {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding-bottom: 18px;
      border-bottom: 1px solid #E2E8F0;
      margin-bottom: 20px;
    }
    .info-col { flex: 1; }
    .info-heading {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748B;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .meta-line { font-size: 13px; color: #1E293B; margin-bottom: 3px; }
    .section { margin-bottom: 22px; }
    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #2563EB;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      background: #F8FAFC;
      color: #334155;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 9px 10px;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1px solid #CBD5E1;
      text-align: left;
    }
    .data-table td {
      padding: 9px 10px;
      border-bottom: 1px solid #F1F5F9;
      color: #0F172A;
    }
    .rx-table th, .rx-table td { text-align: center; border: 1px solid #E2E8F0; }
    .rx-table td:first-child, .rx-table th:first-child { text-align: left; }
    .rx-meta {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-top: 8px;
      padding: 8px 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      font-size: 12px;
    }
    .rx-remarks { margin-top: 6px; font-size: 12px; color: #475569; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .bottom-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 16px;
    }
    .notes-box {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 12px;
      color: #334155;
    }
    .totals-box { width: 320px; }
    .totals-table { width: 100%; border-collapse: collapse; }
    .totals-table td { padding: 5px 0; font-size: 13px; }
    .totals-table td:last-child { text-align: right; font-weight: 600; }
    .totals-divider td { border-top: 1px solid #CBD5E1; padding-top: 8px; }
    .grand-total td {
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
      border-top: 2px solid #0F172A;
      border-bottom: 1px solid #CBD5E1;
      padding: 8px 0;
    }
    .balance-due td { color: #B91C1C; font-weight: 700; }
    .balance-clear td { color: #15803D; font-weight: 700; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px dashed #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 12px;
      color: #64748B;
    }
    .signature { text-align: right; }
    .signature-line {
      width: 180px;
      border-top: 1px solid #334155;
      margin-bottom: 4px;
      margin-left: auto;
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .toolbar { display: none !important; }
      .invoice-card { box-shadow: none; border: none; border-radius: 0; max-width: 100%; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .status-badge, .data-table th, .rx-meta, .notes-box {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="window.print()">Print Invoice</button>
  </div>

  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="shop-name">${escapeHtml(invoice.shop.shopName)}</div>
        ${invoice.shop.tagline ? `<div class="shop-tagline">${escapeHtml(invoice.shop.tagline)}</div>` : ''}
        <div class="shop-contact">
          ${invoice.shop.address ? `<div>${escapeHtml(invoice.shop.address)}</div>` : ''}
          <div>
            ${invoice.shop.mobile ? `Phone: ${escapeHtml(invoice.shop.mobile)}` : ''}
            ${invoice.shop.email ? ` | Email: ${escapeHtml(invoice.shop.email)}` : ''}
          </div>
          ${invoice.shop.GSTIN ? `<div><strong>GSTIN:</strong> ${escapeHtml(invoice.shop.GSTIN)}</div>` : ''}
        </div>
      </div>
      <div class="invoice-title-box">
        <div class="invoice-label">Tax Invoice</div>
        <div class="invoice-meta">
          <div><strong>Bill No:</strong> ${escapeHtml(invoice.billNumber)}</div>
          <div><strong>Date:</strong> ${escapeHtml(formatDate(invoice.billDate))}</div>
        </div>
        <span class="status-badge">${escapeHtml(invoice.paymentStatus)}</span>
      </div>
    </div>

    <div class="body">
      <div class="info-grid">
        <div class="info-col">
          <div class="info-heading">Bill To (Customer)</div>
          <div class="meta-line"><strong>${escapeHtml(invoice.customer?.name || '-')}</strong></div>
          <div class="meta-line">Mobile: ${escapeHtml(invoice.customer?.mobile || '-')}</div>
          ${invoice.customer?.address ? `<div class="meta-line">Address: ${escapeHtml(invoice.customer.address)}</div>` : ''}
        </div>
        <div class="info-col" style="text-align:right;">
          <div class="info-heading">Payment Information</div>
          <div class="meta-line"><strong>Mode:</strong> ${escapeHtml(invoice.paymentMode)}</div>
          <div class="meta-line"><strong>Status:</strong> ${escapeHtml(invoice.paymentStatus)}</div>
          ${breakdownHtml}
        </div>
      </div>

      ${prescriptionSection}

      <div class="section">
        <div class="section-title">Product Details</div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width:42px;">#</th>
              <th>Product Name</th>
              <th>Category</th>
              <th class="text-center" style="width:64px;">Qty</th>
              <th class="text-right" style="width:110px;">Rate</th>
              <th class="text-right" style="width:120px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>

      <div class="bottom-grid">
        <div class="notes-box">
          <div class="info-heading">Notes</div>
          <div>${invoice.notes ? escapeHtml(invoice.notes) : 'Thank you for choosing Sahil Optical.'}</div>
        </div>
        <div class="totals-box">
          <table class="totals-table">
            <tr>
              <td>Subtotal</td>
              <td>${formatMoneyHtml(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td>${escapeHtml(discountLabel)}</td>
              <td>- ${formatMoneyHtml(invoice.discount)}</td>
            </tr>
            <tr>
              <td>Taxable Amount</td>
              <td>${formatMoneyHtml(invoice.taxableAmount)}</td>
            </tr>
            <tr>
              <td>GST (${invoice.gstRate}%)</td>
              <td>${formatMoneyHtml(invoice.GST)}</td>
            </tr>
            ${
              invoice.GST > 0
                ? `<tr style="font-size:11px;color:#64748B;">
                    <td>CGST (${roundCurrency(invoice.gstRate / 2)}%) + SGST (${roundCurrency(invoice.gstRate / 2)}%)</td>
                    <td>${formatMoneyHtml(invoice.cgst)} + ${formatMoneyHtml(invoice.sgst)}</td>
                  </tr>`
                : ''
            }
            <tr class="grand-total">
              <td>Grand Total</td>
              <td>${formatMoneyHtml(invoice.grandTotal)}</td>
            </tr>
            <tr class="totals-divider">
              <td>Advance Paid</td>
              <td>${formatMoneyHtml(invoice.advance)}</td>
            </tr>
            <tr class="${invoice.balance > 0 ? 'balance-due' : 'balance-clear'}">
              <td>Balance Due</td>
              <td>${formatMoneyHtml(invoice.balance)}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="footer">
        <div>
          <div>This is a computer-generated optical bill.</div>
        </div>
        <div class="signature">
          <div class="signature-line"></div>
          <div>For <strong>${escapeHtml(invoice.shop.shopName)}</strong></div>
          <div>Authorized Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const generateInvoicePdfBuffer = (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80; // 40 margin each side
      const leftX = 40;
      const rightEdge = 40 + pageWidth;

      // Top Header Bar
      doc.rect(leftX, 36, pageWidth, 86).fill('#0F172A');

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(invoice.shop.shopName || 'Sahil Optical', leftX + 16, 48, { width: 320 });

      if (invoice.shop.tagline) {
        doc
          .fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(9)
          .text(invoice.shop.tagline, leftX + 16, 72, { width: 320 });
      }

      const contactParts = [
        invoice.shop.address,
        [
          invoice.shop.mobile ? `Mob: ${invoice.shop.mobile}` : '',
          invoice.shop.email ? `Email: ${invoice.shop.email}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        invoice.shop.GSTIN ? `GSTIN: ${invoice.shop.GSTIN}` : '',
      ].filter(Boolean);

      doc
        .fillColor('#CBD5E1')
        .font('Helvetica')
        .fontSize(8.5)
        .text(contactParts.join('\n'), leftX + 16, 85, { width: 320, lineGap: 1.5 });

      // Right side of Header: Tax Invoice + Bill Meta
      doc
        .fillColor('#60A5FA')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('TAX INVOICE', rightEdge - 170, 48, { width: 154, align: 'right' });

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(`Bill No: ${invoice.billNumber}`, rightEdge - 170, 68, { width: 154, align: 'right' });

      doc
        .fillColor('#E2E8F0')
        .font('Helvetica')
        .fontSize(9)
        .text(`Date: ${formatDate(invoice.billDate)}`, rightEdge - 170, 82, {
          width: 154,
          align: 'right',
        });

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Status: ${invoice.paymentStatus.toUpperCase()}`, rightEdge - 170, 97, {
          width: 154,
          align: 'right',
        });

      let y = 138;

      // Customer & Payment Info Section
      doc
        .fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('BILL TO (CUSTOMER)', leftX, y)
        .text('PAYMENT INFORMATION', leftX + 300, y, { width: pageWidth - 300, align: 'right' });

      y += 14;
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(invoice.customer?.name || '-', leftX, y, { width: 280 });

      doc
        .fillColor('#0F172A')
        .font('Helvetica')
        .fontSize(9.5)
        .text(`Payment Mode: ${invoice.paymentMode}`, leftX + 300, y, {
          width: pageWidth - 300,
          align: 'right',
        });

      y += 15;
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(9.5)
        .text(`Mobile: ${invoice.customer?.mobile || '-'}`, leftX, y, { width: 280 });

      doc.text(`Payment Status: ${invoice.paymentStatus}`, leftX + 300, y, {
        width: pageWidth - 300,
        align: 'right',
      });

      y += 14;
      if (invoice.customer?.address) {
        doc.text(`Address: ${invoice.customer.address}`, leftX, y, { width: 280 });
      }

      if (
        invoice.paymentMode === 'Mixed' &&
        invoice.paymentBreakdown &&
        (invoice.paymentBreakdown.cash > 0 ||
          invoice.paymentBreakdown.upi > 0 ||
          invoice.paymentBreakdown.card > 0)
      ) {
        doc.fontSize(8.5).text(
          `Cash: ${formatMoneyPdf(invoice.paymentBreakdown.cash)} | UPI: ${formatMoneyPdf(
            invoice.paymentBreakdown.upi
          )} | Card: ${formatMoneyPdf(invoice.paymentBreakdown.card)}`,
          leftX + 260,
          y,
          { width: pageWidth - 260, align: 'right' }
        );
      }

      y += 22;
      doc.moveTo(leftX, y).lineTo(rightEdge, y).strokeColor('#CBD5E1').lineWidth(0.75).stroke();
      y += 14;

      // Eye Prescription Section (if present)
      if (invoice.hasPrescription) {
        const rx = invoice.prescription || {};
        const od = rx.rightEye || {};
        const os = rx.leftEye || {};

        doc
          .fillColor('#2563EB')
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .text('EYE PRESCRIPTION (Rx)', leftX, y);
        y += 14;

        const rxCols = [
          { label: 'Eye', x: leftX, w: 135 },
          { label: 'SPH', x: leftX + 135, w: 95 },
          { label: 'CYL', x: leftX + 230, w: 95 },
          { label: 'Axis', x: leftX + 325, w: 95 },
          { label: 'ADD', x: leftX + 420, w: 95 },
        ];

        doc.rect(leftX, y, pageWidth, 20).fill('#F8FAFC').stroke('#CBD5E1');
        doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
        rxCols.forEach((col, i) => {
          doc.text(col.label, col.x + 6, y + 6, {
            width: col.w - 12,
            align: i === 0 ? 'left' : 'center',
          });
        });
        y += 20;

        const rxRows = [
          ['Right Eye (OD)', od.sph || '-', od.cyl || '-', od.axis ? `${od.axis} deg` : '-', od.add || '-'],
          ['Left Eye (OS)', os.sph || '-', os.cyl || '-', os.axis ? `${os.axis} deg` : '-', os.add || '-'],
        ];

        rxRows.forEach((row) => {
          doc.rect(leftX, y, pageWidth, 20).stroke('#E2E8F0');
          doc.fillColor('#0F172A').font('Helvetica').fontSize(9);
          row.forEach((cell, i) => {
            if (i === 0) doc.font('Helvetica-Bold');
            else doc.font('Helvetica');
            doc.text(cell, rxCols[i].x + 6, y + 6, {
              width: rxCols[i].w - 12,
              align: i === 0 ? 'left' : 'center',
            });
          });
          y += 20;
        });

        y += 6;
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(8.5)
          .text(
            `PD Distance: ${rx.pdDistance || '-'}    |    PD Near: ${
              rx.pdNear || '-'
            }    |    Lens Type: ${rx.lensType || '-'}`,
            leftX,
            y
          );
        y += 14;

        if (rx.remarks) {
          doc.fillColor('#475569').text(`Remarks: ${rx.remarks}`, leftX, y, { width: pageWidth });
          y += 14;
        }

        y += 8;
      }

      // Product Details Table
      doc
        .fillColor('#2563EB')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('PRODUCT DETAILS', leftX, y);
      y += 14;

      const cols = [
        { label: '#', x: leftX, w: 28, align: 'center' },
        { label: 'Product Name', x: leftX + 28, w: 192, align: 'left' },
        { label: 'Category', x: leftX + 220, w: 95, align: 'left' },
        { label: 'Qty', x: leftX + 315, w: 40, align: 'center' },
        { label: 'Rate', x: leftX + 355, w: 80, align: 'right' },
        { label: 'Amount', x: leftX + 435, w: 80, align: 'right' },
      ];

      doc.rect(leftX, y, pageWidth, 22).fill('#F8FAFC').stroke('#CBD5E1');
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
      cols.forEach((col) => {
        doc.text(col.label, col.x + 4, y + 7, { width: col.w - 8, align: col.align });
      });
      y += 22;

      (invoice.items || []).forEach((item, idx) => {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }
        const rowHeight = 22;
        doc.moveTo(leftX, y + rowHeight).lineTo(rightEdge, y + rowHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

        doc.fillColor('#0F172A').font('Helvetica').fontSize(9);
        doc.text(String(idx + 1), cols[0].x + 4, y + 6, { width: cols[0].w - 8, align: 'center' });
        doc.font('Helvetica-Bold').text(item.name, cols[1].x + 4, y + 6, {
          width: cols[1].w - 8,
          ellipsis: true,
        });
        doc.font('Helvetica').text(item.category || 'Other', cols[2].x + 4, y + 6, {
          width: cols[2].w - 8,
        });
        doc.text(String(item.quantity), cols[3].x + 4, y + 6, {
          width: cols[3].w - 8,
          align: 'center',
        });
        doc.text(formatMoneyPdf(item.rate), cols[4].x + 4, y + 6, {
          width: cols[4].w - 8,
          align: 'right',
        });
        doc.font('Helvetica-Bold').text(formatMoneyPdf(item.amount), cols[5].x + 4, y + 6, {
          width: cols[5].w - 8,
          align: 'right',
        });

        y += rowHeight;
      });

      y += 18;

      if (y > 620) {
        doc.addPage();
        y = 40;
      }

      // Bottom Section: Notes (left) & Summary Totals (right)
      const notesY = y;
      doc
        .fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('NOTES', leftX, notesY);
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(9)
        .text(invoice.notes || 'Thank you for choosing Sahil Optical.', leftX, notesY + 14, {
          width: 230,
        });

      const summaryX = leftX + 265;
      const summaryLabelW = 140;
      const summaryValW = 110;
      let sy = notesY;

      const drawSummaryLine = (label, value, options = {}) => {
        const font = options.bold ? 'Helvetica-Bold' : 'Helvetica';
        const size = options.size || 9.5;
        const color = options.color || '#0F172A';
        doc.fillColor(color).font(font).fontSize(size);
        doc.text(label, summaryX, sy, { width: summaryLabelW, align: 'left' });
        doc.text(value, summaryX + summaryLabelW, sy, { width: summaryValW, align: 'right' });
        sy += options.gap || 16;
      };

      const discountLabel =
        invoice.discountType === 'percentage' && invoice.discountValue > 0
          ? `Discount (${invoice.discountValue}%)`
          : 'Discount';

      drawSummaryLine('Subtotal', formatMoneyPdf(invoice.subtotal));
      drawSummaryLine(discountLabel, `- ${formatMoneyPdf(invoice.discount)}`);
      drawSummaryLine('Taxable Amount', formatMoneyPdf(invoice.taxableAmount));
      drawSummaryLine(`GST (${invoice.gstRate}%)`, formatMoneyPdf(invoice.GST));

      if (invoice.GST > 0) {
        const halfRate = roundCurrency(invoice.gstRate / 2);
        drawSummaryLine(
          `CGST (${halfRate}%) + SGST (${halfRate}%)`,
          `${formatMoneyPdf(invoice.cgst)} + ${formatMoneyPdf(invoice.sgst)}`,
          { size: 8, color: '#64748B', gap: 14 }
        );
      }

      doc
        .moveTo(summaryX, sy - 2)
        .lineTo(rightEdge, sy - 2)
        .strokeColor('#0F172A')
        .lineWidth(1)
        .stroke();
      sy += 6;

      drawSummaryLine('Grand Total', formatMoneyPdf(invoice.grandTotal), {
        bold: true,
        size: 11,
        gap: 18,
      });

      drawSummaryLine('Advance Paid', formatMoneyPdf(invoice.advance), { bold: true });
      drawSummaryLine('Balance Due', formatMoneyPdf(invoice.balance), {
        bold: true,
        color: invoice.balance > 0 ? '#B91C1C' : '#15803D',
      });

      // Footer
      const footerY = Math.max(sy + 36, 750);
      doc
        .moveTo(leftX, footerY)
        .lineTo(rightEdge, footerY)
        .strokeColor('#CBD5E1')
        .lineWidth(0.75)
        .stroke();

      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8.5)
        .text('This is a computer-generated optical invoice.', leftX, footerY + 10);

      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`For ${invoice.shop.shopName || 'Sahil Optical'}`, rightEdge - 180, footerY + 10, {
          width: 180,
          align: 'right',
        });
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8.5)
        .text('Authorized Signatory', rightEdge - 180, footerY + 23, {
          width: 180,
          align: 'right',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

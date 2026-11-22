import assert from 'node:assert/strict';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { ensureDefaultAdmin } from './src/services/auth.service.js';
import Shop from './src/models/shop.model.js';
import Customer from './src/models/customer.model.js';
import Product from './src/models/product.model.js';
import Bill from './src/models/bill.model.js';

const TEST_PORT = 5056;

const runBillingWorkflowTests = async () => {
  await connectDB();
  await ensureDefaultAdmin();

  await Bill.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await Shop.deleteMany({});

  const server = app.listen(TEST_PORT, async () => {
    const baseUrl = `http://127.0.0.1:${TEST_PORT}/api`;
    console.log(`Billing Workflow Test Server running on ${baseUrl}`);

    try {
      const api = async (method, path, body = null, token = null, expectStatus = null) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
        });
        const data = await res.json();
        if (expectStatus !== null) {
          assert.equal(
            res.status,
            expectStatus,
            `Expected HTTP ${expectStatus} for ${method} ${path}, got ${res.status}: ${JSON.stringify(data)}`
          );
        } else if (!res.ok) {
          throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
        }
        return { status: res.status, body: data };
      };

      // Login & configure Shop
      const login = await api('POST', '/auth/login', {
        username: 'admin',
        password: 'password123',
      });
      const token = login.body.data.token;

      await api(
        'PUT',
        '/shop',
        {
          shopName: 'Sahil Optical',
          tagline: 'Precision Eye Care & Optical Showroom',
          address: 'Shop 14, FC Road, Pune - 411004',
          mobile: '9876543210',
          email: 'billing@sahiloptical.com',
          GSTIN: '27AABCS1429B1Z1',
        },
        token
      );

      // Verify all 7 supported optical categories
      const catRes = await api('GET', '/products/categories', null, token);
      assert.deepEqual(catRes.body.data, [
        'Eyeglasses',
        'Frames',
        'Lenses',
        'Sunglasses',
        'Contact Lenses',
        'Accessories',
        'Other',
      ]);
      console.log('PASS [Section 3]: All 7 product categories verified');

      // Seed catalogue items
      const frameProd = (
        await api(
          'POST',
          '/products',
          {
            name: 'Ray-Ban Clubmaster Frame',
            category: 'Frames',
            description: 'Black & gold half-rim optical frame',
            price: 3500,
          },
          token
        )
      ).body.data;

      const lensProd = (
        await api(
          'POST',
          '/products',
          {
            name: 'Essilor Crizal Prevencia Lens',
            category: 'Lenses',
            description: 'Blue-violet light filtering lens pair',
            price: 2500,
          },
          token
        )
      ).body.data;

      // SECTION 1: Mobile lookup before customer exists
      const lookupBefore = await api('GET', '/customers/mobile/9822011223', null, token);
      assert.equal(lookupBefore.body.data.found, false);
      assert.equal(lookupBefore.body.data.customer, null);
      console.log('PASS [Section 1]: Unknown mobile lookup returns found=false cleanly');

      // SECTION 4: Live backend calculation preview (Percentage discount + Mixed payment)
      const calcPreview = await api(
        'POST',
        '/bills/calculate',
        {
          items: [
            { product: frameProd._id, quantity: 1 }, // auto-fills 3500 from catalogue
            { product: lensProd._id, quantity: 1 }, // auto-fills 2500 from catalogue
            {
              // Manual item not in product catalogue
              name: 'Custom Anti-Fog Hard Case & Spray',
              category: 'Accessories',
              quantity: 2,
              rate: 250,
            },
          ],
          discountType: 'percentage',
          discountValue: 10, // 10% of 6500 = 650
          gstRate: 12, // 12% of 5850 = 702 -> Grand Total = 6552
          advance: 3000,
          paymentMode: 'Mixed',
          paymentBreakdown: { cash: 1000, upi: 1500, card: 500 },
        },
        token
      );
      const preview = calcPreview.body.data;
      assert.equal(preview.subtotal, 6500);
      assert.equal(preview.discountType, 'percentage');
      assert.equal(preview.discountValue, 10);
      assert.equal(preview.discount, 650);
      assert.equal(preview.taxableAmount, 5850);
      assert.equal(preview.gstRate, 12);
      assert.equal(preview.GST, 702);
      assert.equal(preview.cgst, 351);
      assert.equal(preview.sgst, 351);
      assert.equal(preview.grandTotal, 6552);
      assert.equal(preview.advance, 3000);
      assert.equal(preview.balance, 3552);
      assert.equal(preview.paymentStatus, 'Partial');
      assert.equal(preview.items[2].isManual, true);
      assert.equal(preview.items[0].isManual, false);
      console.log('PASS [Section 4]: Backend preview calculation (catalogue + manual + % discount + GST + Mixed) exact');

      // SECTION 1-7: Create Bill #1 (Full Prescription + Catalogue & Manual Items + Percentage Discount + Mixed Payment)
      // Also send tampered client totals to confirm backend ignores them!
      const bill1Res = await api(
        'POST',
        '/bills',
        {
          customer: {
            name: 'Amit Kulkarni',
            mobile: '9822011223',
            address: 'Kothrud, Pune',
          },
          prescription: {
            rightEye: { sph: '-1.75', cyl: '-0.50', axis: '90', add: '+1.50' },
            leftEye: { sph: '-1.50', cyl: '-0.25', axis: '85', add: '+1.50' },
            pdDistance: '63',
            pdNear: '60',
            lensType: 'Progressive',
            remarks: 'Blue cut anti-glare recommended',
          },
          items: [
            { product: frameProd._id, quantity: 1 },
            { product: lensProd._id, quantity: 1 },
            {
              name: 'Custom Anti-Fog Hard Case & Spray',
              category: 'Accessories',
              quantity: 2,
              rate: 250,
            },
          ],
          discountType: 'percentage',
          discountValue: 10,
          gstRate: 12,
          advance: 3000,
          paymentMode: 'Mixed',
          paymentBreakdown: { cash: 1000, upi: 1500, card: 500 },
          notes: 'Customer requested lens cleaning cloth',
          // Tampered fields (must be ignored by backend):
          subtotal: 1,
          grandTotal: 1,
          balance: 0,
          paymentStatus: 'Paid',
        },
        token,
        201
      );

      const inv1 = bill1Res.body.data;
      assert.match(inv1.billNumber, /^SO-\d{4}-0001$/);
      assert.equal(inv1.shop.shopName, 'Sahil Optical');
      assert.equal(inv1.shop.GSTIN, '27AABCS1429B1Z1');
      assert.equal(inv1.customer.name, 'Amit Kulkarni');
      assert.equal(inv1.customer.mobile, '9822011223');
      assert.equal(inv1.hasPrescription, true);
      assert.equal(inv1.prescription.rightEye.sph, '-1.75');
      assert.equal(inv1.prescription.leftEye.axis, '85');
      assert.equal(inv1.prescription.pdDistance, '63');
      assert.equal(inv1.prescription.pdNear, '60');
      assert.equal(inv1.prescription.lensType, 'Progressive');
      assert.equal(inv1.subtotal, 6500);
      assert.equal(inv1.discount, 650);
      assert.equal(inv1.taxableAmount, 5850);
      assert.equal(inv1.GST, 702);
      assert.equal(inv1.grandTotal, 6552);
      assert.equal(inv1.advance, 3000);
      assert.equal(inv1.balance, 3552);
      assert.equal(inv1.paymentMode, 'Mixed');
      assert.equal(inv1.paymentStatus, 'Partial');
      assert.equal(inv1.deliveryDate, undefined);
      assert.equal(inv1.orderStatus, undefined);
      console.log(`PASS [Sections 1-6]: Bill #1 (${inv1.billNumber}) saved & complete invoice returned`);

      // SECTION 1: Mobile autofill lookup now finds Amit Kulkarni + his latest prescription!
      const lookupAfter = await api('GET', '/customers/mobile/9822011223', null, token);
      assert.equal(lookupAfter.body.data.found, true);
      assert.equal(lookupAfter.body.data.customer.name, 'Amit Kulkarni');
      assert.equal(lookupAfter.body.data.customer.address, 'Kothrud, Pune');
      assert.equal(lookupAfter.body.data.latestPrescription.pdDistance, '63');
      assert.equal(lookupAfter.body.data.latestPrescription.pdNear, '60');
      assert.equal(lookupAfter.body.data.latestPrescription.lensType, 'Progressive');

      // Partial mobile search for autocomplete
      const mobileSearch = await api('GET', '/customers?mobile=98220', null, token);
      assert.equal(mobileSearch.body.data.length, 1);
      console.log('PASS [Section 1]: Existing customer mobile lookup & autofill (+ latest Rx) verified');

      // SECTION 2 & 5: Create Bill #2 WITHOUT prescription (optional), Fixed Discount, Cash Paid, Reusing existing customer & updating address
      const bill2Res = await api(
        'POST',
        '/bills',
        {
          customer: {
            name: 'Amit Kulkarni',
            mobile: '9822011223',
            address: 'Baner Road, Pune',
          },
          items: [
            {
              name: 'Polarized Aviator Sunglasses',
              category: 'Sunglasses',
              quantity: 1,
              rate: 2200,
            },
          ],
          discountType: 'fixed',
          discountValue: 200,
          gstRate: 18, // 18% of 2000 = 360 -> Grand Total = 2360
          advance: 2360,
          paymentMode: 'Cash',
        },
        token,
        201
      );
      const inv2 = bill2Res.body.data;
      assert.match(inv2.billNumber, /^SO-\d{4}-0002$/);
      assert.equal(inv2.customer._id, inv1.customer._id); // Reused existing customer!
      assert.equal(inv2.customer.address, 'Baner Road, Pune'); // Updated address!
      assert.equal(inv2.hasPrescription, false); // Prescription optional!
      assert.equal(inv2.subtotal, 2200);
      assert.equal(inv2.discount, 200);
      assert.equal(inv2.taxableAmount, 2000);
      assert.equal(inv2.GST, 360);
      assert.equal(inv2.grandTotal, 2360);
      assert.equal(inv2.balance, 0);
      assert.equal(inv2.paymentStatus, 'Paid');
      console.log(`PASS [Sections 2,4,5]: Bill #2 (${inv2.billNumber}) optional Rx, fixed discount, Cash Paid, customer reuse verified`);

      // SECTION 5: Create Bill #3 with Card & Pending payment (advance = 0)
      const bill3Res = await api(
        'POST',
        '/bills',
        {
          customer: {
            name: 'Sneha Joshi',
            mobile: '9811122334',
            address: 'Viman Nagar, Pune',
          },
          items: [
            {
              name: 'Bausch & Lomb Monthly Contact Lenses',
              category: 'Contact Lenses',
              quantity: 2,
              rate: 750,
            },
          ],
          discountType: 'fixed',
          discountValue: 0,
          gstRate: 12, // 12% of 1500 = 180 -> Grand Total = 1680
          advance: 0,
          paymentMode: 'Card',
        },
        token,
        201
      );
      const inv3 = bill3Res.body.data;
      assert.match(inv3.billNumber, /^SO-\d{4}-0003$/);
      assert.equal(inv3.grandTotal, 1680);
      assert.equal(inv3.balance, 1680);
      assert.equal(inv3.paymentStatus, 'Pending');
      console.log(`PASS [Section 5]: Bill #3 (${inv3.billNumber}) Pending payment status verified`);

      // VALIDATION TESTS (All monetary & optical guardrails must reject invalid inputs with 400)
      const invalidCases = [
        {
          label: 'Negative rate',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: -100 }],
          },
        },
        {
          label: 'Zero quantity',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 0, rate: 500 }],
          },
        },
        {
          label: 'Negative fixed discount',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: 500 }],
            discountType: 'fixed',
            discountValue: -50,
          },
        },
        {
          label: 'Fixed discount exceeding subtotal',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: 500 }],
            discountType: 'fixed',
            discountValue: 600,
          },
        },
        {
          label: 'Percentage discount > 100%',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: 500 }],
            discountType: 'percentage',
            discountValue: 120,
          },
        },
        {
          label: 'Advance exceeding grand total',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: 500 }],
            gstRate: 0,
            advance: 600,
          },
        },
        {
          label: 'Mismatched Mixed payment breakdown',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: 1000 }],
            advance: 500,
            paymentMode: 'Mixed',
            paymentBreakdown: { cash: 200, upi: 100, card: 0 },
          },
        },
        {
          label: 'Unsupported product category',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Widget', category: 'Electronics', quantity: 1, rate: 500 }],
          },
        },
        {
          label: 'Invalid prescription Axis > 180',
          payload: {
            customer: { name: 'Test', mobile: '9000000001' },
            items: [{ name: 'Frame', category: 'Frames', quantity: 1, rate: 500 }],
            prescription: { rightEye: { axis: '220' } },
          },
        },
      ];

      for (const tc of invalidCases) {
        await api('POST', '/bills', tc.payload, token, 400);
      }
      console.log(`PASS [Validation]: All ${invalidCases.length} invalid monetary/optical edge cases rejected with HTTP 400`);

      // SECTION 7: Invoice JSON, Print HTML, and PDF binary verification
      const invoiceJson = await api('GET', `/bills/${inv1._id}/invoice`, null, token);
      assert.equal(invoiceJson.body.data.billNumber, inv1.billNumber);
      assert.equal(invoiceJson.body.data.shop.shopName, 'Sahil Optical');
      assert.equal(invoiceJson.body.data.prescription.pdDistance, '63');

      const printRes = await fetch(`${baseUrl}/bills/${inv1._id}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(printRes.status, 200);
      assert.match(printRes.headers.get('content-type') || '', /text\/html/);
      const html = await printRes.text();
      assert.ok(html.includes('@media print'), 'Print HTML should include @media print CSS');
      assert.ok(html.includes('Sahil Optical'), 'Print HTML should include shop name');
      assert.ok(html.includes(inv1.billNumber), 'Print HTML should include bill number');
      assert.ok(html.includes('Amit Kulkarni'), 'Print HTML should include customer name');
      assert.ok(html.includes('Right Eye (OD)'), 'Print HTML should include OD prescription');
      assert.ok(html.includes('PD Distance:'), 'Print HTML should include PD Distance');
      assert.ok(html.includes('PD Near:'), 'Print HTML should include PD Near');
      assert.ok(html.includes('Progressive'), 'Print HTML should include Lens Type');
      assert.ok(html.includes('Custom Anti-Fog Hard Case'), 'Print HTML should include manual item');
      console.log('PASS [Section 7]: Print HTML invoice generated and verified');

      const pdfRes = await fetch(`${baseUrl}/bills/${inv1._id}/pdf?download=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(pdfRes.status, 200);
      assert.match(pdfRes.headers.get('content-type') || '', /application\/pdf/);
      assert.match(
        pdfRes.headers.get('content-disposition') || '',
        new RegExp(`attachment; filename="Invoice-${inv1.billNumber}\\.pdf"`)
      );
      const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
      assert.equal(pdfBytes.subarray(0, 5).toString('utf8'), '%PDF-', 'Output must be a valid PDF binary');
      assert.ok(pdfBytes.length > 2000, `PDF should be non-trivial (got ${pdfBytes.length} bytes)`);
      console.log(`PASS [Section 7]: PDF invoice generated and verified (${pdfBytes.length} bytes)`);

      console.log('\nALL COMPLETE BILLING WORKFLOW TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
      console.error('BILLING WORKFLOW TEST FAILED:', err);
      process.exitCode = 1;
    } finally {
      server.close();
      await disconnectDB();
    }
  });
};

runBillingWorkflowTests();

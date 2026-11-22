import assert from 'node:assert/strict';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { ensureDefaultAdmin } from './src/services/auth.service.js';
import Shop from './src/models/shop.model.js';
import Customer from './src/models/customer.model.js';
import Product from './src/models/product.model.js';
import Bill from './src/models/bill.model.js';

const PORT = 5058;

const runIntegrationSuite = async () => {
  await connectDB();
  await ensureDefaultAdmin();

  await Bill.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await Shop.deleteMany({});

  const server = app.listen(PORT, async () => {
    const baseUrl = `http://127.0.0.1:${PORT}/api`;
    console.log(`Integration Test Server listening on ${baseUrl}`);

    try {
      const api = async (method, path, body = null, token = null, expectedStatus = null) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
        });
        const json = await res.json();
        if (expectedStatus !== null) {
          assert.equal(res.status, expectedStatus, `Expected ${expectedStatus}, got ${res.status}`);
        } else if (!res.ok) {
          throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`);
        }
        return json;
      };

      // Verify Protected Routes block unauthenticated calls (401)
      await api('GET', '/dashboard', null, null, 401);
      await api('GET', '/bills', null, null, 401);
      await api('GET', '/customers', null, null, 401);
      console.log('PASS [Auth Guard]: Unauthenticated API requests properly rejected with 401');

      // 1. Login successfully
      const loginRes = await api('POST', '/auth/login', {
        username: 'admin',
        password: 'password123',
      });
      const token = loginRes.data.token;
      assert.ok(token, 'JWT token must be issued on login');
      const meRes = await api('GET', '/auth/me', null, token);
      assert.equal(meRes.data.username, 'admin');
      console.log('PASS [Workflow 1]: Login & JWT session verification (/auth/login, /auth/me)');

      // 2. Dashboard loads statistics (initial empty DB)
      const dashEmpty = await api('GET', '/dashboard', null, token);
      assert.equal(dashEmpty.data.totalBills, 0);
      assert.equal(dashEmpty.data.totalSales, 0);
      assert.equal(dashEmpty.data.statusCounts.paid, 0);
      assert.equal(dashEmpty.data.paymentModes.length, 4);
      console.log('PASS [Workflow 2]: Dashboard loads live empty-state statistics');

      // 3. Create a customer
      const custRes = await api(
        'POST',
        '/customers',
        {
          name: 'Aarav Deshmukh',
          mobile: '9822044120',
          address: 'Karve Road, Kothrud, Pune',
        },
        token,
        201
      );
      const customer = custRes.data;
      assert.equal(customer.name, 'Aarav Deshmukh');
      console.log('PASS [Workflow 3]: Created customer via POST /api/customers');

      // 4. Add products
      const p1 = (
        await api(
          'POST',
          '/products',
          {
            name: 'Ray-Ban Clubmaster Frame',
            category: 'Frames',
            description: 'Black & gold half-rim optical frame',
            price: 3500,
          },
          token,
          201
        )
      ).data;
      const p2 = (
        await api(
          'POST',
          '/products',
          {
            name: 'Essilor Crizal Blue Cut Lens',
            category: 'Lenses',
            description: 'Anti-glare UV400 blue cut lens pair',
            price: 2500,
          },
          token,
          201
        )
      ).data;
      const productsList = await api('GET', '/products', null, token);
      assert.equal(productsList.data.length, 2);
      console.log('PASS [Workflow 4]: Added and listed optical products via /api/products');

      // 5, 6, 7, 8. Backend Calculation Preview (Discount, GST, Advance, Remaining Balance)
      const billPayload = {
        customer: {
          name: customer.name,
          mobile: customer.mobile,
          address: customer.address,
        },
        prescription: {
          rightEye: { sph: '-1.75', cyl: '-0.50', axis: '90', add: '+1.50' },
          leftEye: { sph: '-1.50', cyl: '-0.25', axis: '85', add: '+1.50' },
          pdDistance: '63',
          pdNear: '60',
          lensType: 'Progressive',
          remarks: 'Blue cut coating',
        },
        items: [
          { product: p1._id, quantity: 1 },
          { product: p2._id, quantity: 1 },
          { name: 'Custom Cleaning Kit', category: 'Accessories', quantity: 2, rate: 250 },
        ],
        discountType: 'percentage',
        discountValue: 10, // 650 on 6500 -> taxable 5850
        gstRate: 12, // 702 -> grandTotal 6552
        advance: 3500, // balance 3052 -> Partial
        paymentMode: 'Mixed',
        paymentBreakdown: { cash: 1500, upi: 2000, card: 0 },
        notes: 'Include extra microfiber cloth',
      };

      const calcRes = await api('POST', '/bills/calculate', billPayload, token);
      assert.equal(calcRes.data.subtotal, 6500);
      assert.equal(calcRes.data.discount, 650);
      assert.equal(calcRes.data.taxableAmount, 5850);
      assert.equal(calcRes.data.GST, 702);
      assert.equal(calcRes.data.grandTotal, 6552);
      assert.equal(calcRes.data.advance, 3500);
      assert.equal(calcRes.data.balance, 3052);
      assert.equal(calcRes.data.paymentStatus, 'Partial');
      console.log('PASS [Workflows 6-8]: Backend calculation engine verified discount, GST, advance & balance');

      // 5 & 9. Save bill in MongoDB
      const createdBill = (await api('POST', '/bills', billPayload, token, 201)).data;
      assert.match(createdBill.billNumber, /^SO-\d{4}-0001$/);
      assert.equal(createdBill.grandTotal, 6552);
      assert.equal(createdBill.balance, 3052);
      assert.equal(createdBill.paymentStatus, 'Partial');
      console.log(`PASS [Workflows 5 & 9]: Bill ${createdBill.billNumber} persisted in MongoDB`);

      // Create a second Paid bill for richer reports & dashboard checks
      const bill2 = (
        await api(
          'POST',
          '/bills',
          {
            customer: { name: 'Priya Kulkarni', mobile: '9850178234', address: 'Baner, Pune' },
            items: [{ product: p1._id, quantity: 1 }],
            discountType: 'fixed',
            discountValue: 500,
            gstRate: 12, // taxable 3000, GST 360, grandTotal 3360
            advance: 3360,
            paymentMode: 'UPI',
          },
          token,
          201
        )
      ).data;
      assert.equal(bill2.paymentStatus, 'Paid');

      // 10 & 11. View all bills & Search bills
      const allBills = await api('GET', '/bills', null, token);
      assert.equal(allBills.data.length, 2);

      const searchByBillNo = await api('GET', `/bills?search=${createdBill.billNumber}`, null, token);
      assert.equal(searchByBillNo.data.length, 1);

      const searchByCustomer = await api('GET', '/bills?search=Priya', null, token);
      assert.equal(searchByCustomer.data.length, 1);

      // Verify special regex characters in search do not crash MongoDB regex queries
      const regexSafeSearch = await api(
        'GET',
        `/products?search=${encodeURIComponent('Ray-Ban (Pack+1)')}`,
        null,
        token
      );
      assert.ok(Array.isArray(regexSafeSearch.data));

      // Verify invalid date range (startDate > endDate) returns HTTP 400
      await api('GET', '/reports?startDate=2026-12-01&endDate=2026-11-01', null, token, 400);
      await api('GET', '/bills?startDate=not-a-date', null, token, 400);
      console.log('PASS [Workflows 10-11]: View all bills, search, regex safety & date validation');

      // 12. View customer history (plus enriched customer directory stats)
      const enrichedCustomers = await api('GET', '/customers', null, token);
      const aaravRow = enrichedCustomers.data.find((c) => c._id === customer._id);
      assert.equal(aaravRow.billCount, 1);
      assert.equal(aaravRow.totalSpent, 6552);
      assert.equal(aaravRow.pendingBalance, 3052);

      const custHistory = await api('GET', `/customers/${customer._id}/bills`, null, token);
      assert.equal(custHistory.data.summary.totalBills, 1);
      assert.equal(custHistory.data.summary.totalBalance, 3052);
      assert.equal(custHistory.data.latestPrescription.pdDistance, '63');
      console.log('PASS [Workflow 12]: Customer directory aggregates & billing history (+ latest Rx)');

      // 16. Update shop details (and confirm invoice reflects updated shop)
      const shopUpdate = await api(
        'PUT',
        '/shop',
        {
          shopName: 'Sahil Optical',
          tagline: 'Complete Eye Care & Designer Eyewear',
          address: 'Shop 14, FC Road, Pune - 411004',
          mobile: '9876543210',
          email: 'billing@sahiloptical.com',
          GSTIN: '27AABCS1429B1Z1',
        },
        token
      );
      assert.equal(shopUpdate.data.address, 'Shop 14, FC Road, Pune - 411004');
      console.log('PASS [Workflow 16]: Updated shop details in MongoDB');

      // 13, 14, 15. View invoice, Print HTML invoice, Download PDF invoice
      const invoiceRes = await api('GET', `/bills/${createdBill._id}`, null, token);
      assert.equal(invoiceRes.data.shop.address, 'Shop 14, FC Road, Pune - 411004');
      assert.equal(invoiceRes.data.prescription.lensType, 'Progressive');

      const printRes = await fetch(`${baseUrl}/bills/${createdBill._id}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(printRes.status, 200);
      const printHtml = await printRes.text();
      assert.ok(printHtml.includes('FC Road, Pune - 411004'));
      assert.ok(printHtml.includes(createdBill.billNumber));

      const pdfRes = await fetch(`${baseUrl}/bills/${createdBill._id}/pdf?download=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(pdfRes.status, 200);
      assert.match(pdfRes.headers.get('content-type') || '', /application\/pdf/);
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      assert.equal(pdfBuf.subarray(0, 5).toString('utf8'), '%PDF-');
      console.log(`PASS [Workflows 13-15]: Invoice JSON, Print HTML, and PDF binary (${pdfBuf.length} bytes) verified`);

      // 2 (re-check live dashboard) & 17. View daily and monthly reports
      const dashLive = await api('GET', '/dashboard', null, token);
      assert.equal(dashLive.data.totalBills, 2);
      assert.equal(dashLive.data.totalCustomers, 2);
      assert.equal(dashLive.data.totalSales, 9912);
      assert.equal(dashLive.data.pendingPayments, 3052);
      assert.equal(dashLive.data.statusCounts.paid, 1);
      assert.equal(dashLive.data.statusCounts.partial, 1);

      const reportsRes = await api('GET', '/reports', null, token);
      assert.equal(reportsRes.data.totalRevenue, 9912);
      assert.equal(reportsRes.data.paidAndPendingAmounts.paidAmount, 6860);
      assert.equal(reportsRes.data.paidAndPendingAmounts.pendingAmount, 3052);
      assert.ok(reportsRes.data.dailySales.length >= 1);
      assert.ok(reportsRes.data.monthlySales.length >= 1);
      assert.equal(reportsRes.data.paymentModeSummary.length, 2);
      console.log('PASS [Workflows 2 & 17]: Live Dashboard & Daily/Monthly Reports verified');

      console.log('\nALL 17 INTEGRATED WORKFLOWS VERIFIED SUCCESSFULLY!');
    } catch (err) {
      console.error('INTEGRATION TEST FAILED:', err);
      process.exitCode = 1;
    } finally {
      server.close();
      await disconnectDB();
    }
  });
};

runIntegrationSuite();

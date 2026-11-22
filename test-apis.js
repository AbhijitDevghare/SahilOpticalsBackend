import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { ensureDefaultAdmin } from './src/services/auth.service.js';
import User from './src/models/user.model.js';
import Shop from './src/models/shop.model.js';
import Customer from './src/models/customer.model.js';
import Product from './src/models/product.model.js';
import Bill from './src/models/bill.model.js';

const TEST_PORT = 5055;

const runApiTests = async () => {
  await connectDB();
  await ensureDefaultAdmin();

  // Clear previous test run data (except default admin & shop)
  await Bill.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await Shop.deleteMany({});

  const server = app.listen(TEST_PORT, async () => {
    const baseUrl = `http://127.0.0.1:${TEST_PORT}/api`;
    console.log(`Test server started on ${baseUrl}`);

    try {
      const request = async (method, path, body = null, token = null) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
        }
        return data;
      };

      // 0. Health check
      const health = await request('GET', '/health');
      console.log('0. Health Check:', health.data.status, health.data.database);

      // 1. Auth: Login & Get Current User
      const loginRes = await request('POST', '/auth/login', {
        username: 'admin',
        password: 'password123',
      });
      const token = loginRes.data.token;
      console.log('1a. Login Success - User:', loginRes.data.user.username);

      const meRes = await request('GET', '/auth/me', null, token);
      console.log('1b. Get Current User:', meRes.data.name, meRes.data.role);

      // 2. Shop Settings: Get & Update
      const shopGet = await request('GET', '/shop', null, token);
      console.log('2a. Get Shop:', shopGet.data.shopName);

      const shopUpdate = await request(
        'PUT',
        '/shop',
        {
          shopName: 'Sahil Optical',
          address: 'Shop No. 12, MG Road, Pune',
          mobile: '9876543210',
          email: 'info@sahiloptical.com',
          GSTIN: '27AABCS1429B1Z1',
          tagline: 'Precision Eye Care & Designer Eyewear',
        },
        token
      );
      console.log('2b. Update Shop:', shopUpdate.data.address);

      // 3. Products: Add, List, Search, Update, Delete
      const prod1 = await request(
        'POST',
        '/products',
        {
          name: 'Ray-Ban Aviator Metal Frame',
          category: 'Frames',
          description: 'Gold full-rim aviator frame',
          price: 3500,
        },
        token
      );
      const prod2 = await request(
        'POST',
        '/products',
        {
          name: 'Crizal Blue Cut Progressive Lens',
          category: 'Lenses',
          description: 'Anti-glare UV400 progressive lens pair',
          price: 2500,
        },
        token
      );
      const prod3 = await request(
        'POST',
        '/products',
        {
          name: 'Microfiber Cleaning Kit',
          category: 'Accessories',
          description: 'Lens spray and cloth',
          price: 250,
        },
        token
      );
      console.log('3a. Added 3 Products:', prod1.data.name, '|', prod2.data.name);

      const searchProd = await request('GET', '/products?search=Crizal', null, token);
      console.log('3b. Search Products ("Crizal") count:', searchProd.data.length);

      const updateProd = await request(
        'PUT',
        `/products/${prod3.data._id}`,
        { price: 300 },
        token
      );
      console.log('3c. Updated Product Price:', updateProd.data.price);

      const delProd = await request('DELETE', `/products/${prod3.data._id}`, null, token);
      console.log('3d. Deleted Product ID:', delProd.data.deletedId);

      // 4. Customers: Create, Reuse by mobile, Search, Update
      const cust1 = await request(
        'POST',
        '/customers',
        {
          name: 'Rahul Sharma',
          mobile: '9822011223',
          address: 'Kothrud, Pune',
        },
        token
      );
      console.log('4a. Created Customer:', cust1.data.name, cust1.data.mobile);

      const custReuse = await request(
        'POST',
        '/customers',
        {
          name: 'Rahul K. Sharma',
          mobile: '9822011223',
          address: 'Baner, Pune',
        },
        token
      );
      console.log(
        '4b. Reused Customer by Mobile (same ID):',
        String(custReuse.data._id) === String(cust1.data._id),
        custReuse.data.address
      );

      const custSearch = await request('GET', '/customers?search=98220', null, token);
      console.log('4c. Search Customers count:', custSearch.data.length);

      // 5. Bills: Create Bill 1 (Partial Payment, reusing Rahul by mobile) & Bill 2 (Full Paid, new inline customer)
      const bill1 = await request(
        'POST',
        '/bills',
        {
          customer: {
            name: 'Rahul K. Sharma',
            mobile: '9822011223',
            address: 'Baner, Pune',
          },
          items: [
            {
              product: prod1.data._id,
              name: prod1.data.name,
              category: prod1.data.category,
              quantity: 1,
              price: prod1.data.price,
            },
            {
              product: prod2.data._id,
              name: prod2.data.name,
              category: prod2.data.category,
              quantity: 1,
              price: prod2.data.price,
            },
          ],
          prescription: {
            rightEye: { sph: '-1.50', cyl: '-0.50', axis: '90', add: '+1.50', va: '6/6' },
            leftEye: { sph: '-1.25', cyl: '-0.25', axis: '85', add: '+1.50', va: '6/6' },
            pd: '63',
            lensType: 'Progressive',
            remarks: 'Constant wear with blue cut coating',
          },
          discount: 500,
          gstRate: 12,
          advance: 3000,
          paymentMode: 'UPI',
          notes: 'Balance on pickup',
        },
        token
      );
      console.log(
        '5a. Created Bill 1:',
        bill1.data.billNumber,
        '| Subtotal:',
        bill1.data.subtotal,
        '| Discount:',
        bill1.data.discount,
        '| GST:',
        bill1.data.GST,
        '| GrandTotal:',
        bill1.data.grandTotal,
        '| Advance:',
        bill1.data.advance,
        '| Balance:',
        bill1.data.balance,
        '| Status:',
        bill1.data.paymentStatus
      );

      const bill2 = await request(
        'POST',
        '/bills',
        {
          customer: {
            name: 'Priya Deshmukh',
            mobile: '9811122334',
            address: 'Deccan Gymkhana, Pune',
          },
          items: [
            {
              product: prod1.data._id,
              name: prod1.data.name,
              category: prod1.data.category,
              quantity: 1,
              price: 3500,
            },
          ],
          prescription: {
            rightEye: { sph: '-0.75', cyl: '0.00', axis: '', add: '', va: '6/6' },
            leftEye: { sph: '-0.75', cyl: '0.00', axis: '', add: '', va: '6/6' },
            pd: '61',
            lensType: 'Single Vision',
          },
          discount: 0,
          gstRate: 12,
          advance: 3920,
          paymentMode: 'Cash',
        },
        token
      );
      console.log(
        '5b. Created Bill 2:',
        bill2.data.billNumber,
        '| GrandTotal:',
        bill2.data.grandTotal,
        '| Status:',
        bill2.data.paymentStatus
      );

      // Search & Filter Bills
      const searchBill = await request('GET', '/bills?search=Rahul', null, token);
      console.log('5c. Search Bills ("Rahul") count:', searchBill.data.length);

      const todayStr = new Date().toISOString().split('T')[0];
      const filterBill = await request(
        'GET',
        `/bills?startDate=${todayStr}&endDate=${todayStr}`,
        null,
        token
      );
      console.log('5d. Filter Bills by Date count:', filterBill.data.length);

      // Customer Billing History
      const historyRes = await request(
        'GET',
        `/customers/${cust1.data._id}/bills`,
        null,
        token
      );
      console.log(
        '5e. Customer Billing History:',
        historyRes.data.summary.totalBills,
        'bill(s), Total Spent:',
        historyRes.data.summary.totalSpent
      );

      // 6. Dashboard
      const dashRes = await request('GET', '/dashboard', null, token);
      console.log(
        '6. Dashboard Stats:',
        'Total Bills:',
        dashRes.data.totalBills,
        '| Total Sales:',
        dashRes.data.totalSales,
        '| Total Customers:',
        dashRes.data.totalCustomers,
        '| Pending Payments:',
        dashRes.data.pendingPayments
      );

      // 7. Reports
      const repRes = await request('GET', '/reports', null, token);
      console.log(
        '7. Reports Summary:',
        'Total Revenue:',
        repRes.data.totalRevenue,
        '| Paid:',
        repRes.data.paidAndPendingAmounts.paidAmount,
        '| Pending:',
        repRes.data.paidAndPendingAmounts.pendingAmount,
        '| Modes:',
        repRes.data.paymentModeSummary.map((m) => `${m.paymentMode}:${m.totalRevenue}`).join(', ')
      );

      // 8. Logout
      const logoutRes = await request('POST', '/auth/logout', {}, token);
      console.log('8. Logout:', logoutRes.message);

      console.log('\nALL BACKEND API TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
      console.error('TEST FAILED:', err.message);
      process.exitCode = 1;
    } finally {
      server.close();
      await disconnectDB();
    }
  });
};

runApiTests();

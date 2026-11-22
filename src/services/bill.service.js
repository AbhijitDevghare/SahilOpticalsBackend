import mongoose from 'mongoose';
import Bill from '../models/bill.model.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import { createOrReuseCustomer } from './customer.service.js';
import { getShopDetails } from './shop.service.js';
import { calculateBillTotals, normalizePrescription } from '../utils/billCalculator.js';
import {
  formatInvoiceData,
  generateInvoiceHtml,
  generateInvoicePdfBuffer,
} from '../utils/invoiceGenerator.js';
import { buildDateRangeFilter, escapeRegex } from '../utils/queryHelpers.js';
import { ApiError } from '../utils/apiResponse.js';

export const generateUniqueBillNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;

  const existingBills = await Bill.find({ billNumber: { $regex: `^${prefix}` } })
    .select('billNumber')
    .lean();

  let maxSeq = 0;
  for (const b of existingBills) {
    const parts = String(b.billNumber).split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
};

const resolveBillItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one item is required to create a bill');
  }

  const productIds = items
    .map((item) => item.product || item.productId)
    .filter((id) => id !== undefined && id !== null && String(id).trim() !== '');

  const productMap = new Map();
  if (productIds.length > 0) {
    for (const id of productIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `Invalid product ID: ${id}`);
      }
    }

    const foundProducts = await Product.find({ _id: { $in: productIds } }).lean();
    for (const p of foundProducts) {
      productMap.set(String(p._id), p);
    }

    for (const id of productIds) {
      if (!productMap.has(String(id))) {
        throw new ApiError(404, `Referenced catalogue product not found: ${id}`);
      }
    }
  }

  return items.map((item) => {
    const rawProductId = item.product || item.productId;
    if (rawProductId && String(rawProductId).trim() !== '') {
      const prod = productMap.get(String(rawProductId));
      const providedRate = item.rate !== undefined ? item.rate : item.price;
      return {
        product: prod._id,
        isManual: false,
        name: item.name || item.productName || prod.name,
        category: item.category || prod.category,
        quantity: item.quantity !== undefined ? item.quantity : 1,
        rate: providedRate !== undefined && providedRate !== '' ? providedRate : prod.price,
      };
    }

    return {
      product: null,
      isManual: true,
      name: item.name !== undefined ? item.name : item.productName,
      category: item.category,
      quantity: item.quantity,
      rate: item.rate !== undefined ? item.rate : item.price,
    };
  });
};

export const previewBillCalculation = async (payload) => {
  const resolvedItems = await resolveBillItems(payload.items);
  return calculateBillTotals({
    items: resolvedItems,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    discount: payload.discount,
    gstRate: payload.gstRate,
    gstAmount: payload.GST !== undefined ? payload.GST : payload.gstAmount,
    advance: payload.advance,
    paymentMode: payload.paymentMode || 'Cash',
    paymentBreakdown: payload.paymentBreakdown,
  });
};

export const createBill = async (payload) => {
  let customerId = payload.customerId || payload.customer;

  // Section 1: Save or update customer details (reuses existing customer by mobile number)
  if (payload.customer && typeof payload.customer === 'object' && payload.customer.mobile) {
    const { customer } = await createOrReuseCustomer({
      name: payload.customer.name,
      mobile: payload.customer.mobile,
      address: payload.customer.address || '',
    });
    customerId = customer._id;
  } else if (payload.customerMobile && payload.customerName) {
    const { customer } = await createOrReuseCustomer({
      name: payload.customerName,
      mobile: payload.customerMobile,
      address: payload.customerAddress || '',
    });
    customerId = customer._id;
  } else if (customerId) {
    const existingCustomer = await Customer.findById(customerId);
    if (!existingCustomer) {
      throw new ApiError(404, 'Referenced customer not found');
    }
  } else {
    throw new ApiError(
      400,
      'Customer information is required (provide customer ID or customer name & mobile)'
    );
  }

  // Section 2: Normalize optional eye prescription (OD/OS, PD Distance, PD Near, Lens Type)
  const prescription = normalizePrescription(payload.prescription);

  // Section 3: Resolve catalogue and manually entered items
  const resolvedItems = await resolveBillItems(payload.items);

  // Sections 4 & 5: Backend financial calculations & payment validation
  const calculated = calculateBillTotals({
    items: resolvedItems,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    discount: payload.discount,
    gstRate: payload.gstRate,
    gstAmount: payload.GST !== undefined ? payload.GST : payload.gstAmount,
    advance: payload.advance,
    paymentMode: payload.paymentMode || 'Cash',
    paymentBreakdown: payload.paymentBreakdown,
  });

  // Section 6: Generate unique bill number and save bill in MongoDB
  const isCustomBillNumber = Boolean(payload.billNumber && String(payload.billNumber).trim());
  let bill = null;
  let attempts = 0;

  let parsedBillDate = new Date();
  if (payload.billDate) {
    parsedBillDate = new Date(payload.billDate);
    if (Number.isNaN(parsedBillDate.getTime())) {
      throw new ApiError(400, `Invalid bill date: ${payload.billDate}`);
    }
  }

  while (!bill && attempts < 3) {
    attempts += 1;
    const billNumber = isCustomBillNumber
      ? String(payload.billNumber).trim()
      : await generateUniqueBillNumber();

    try {
      bill = await Bill.create({
        billNumber,
        customer: customerId,
        billDate: parsedBillDate,
        items: calculated.items,
        prescription,
        subtotal: calculated.subtotal,
        discountType: calculated.discountType,
        discountValue: calculated.discountValue,
        discount: calculated.discount,
        taxableAmount: calculated.taxableAmount,
        gstRate: calculated.gstRate,
        GST: calculated.GST,
        cgst: calculated.cgst,
        sgst: calculated.sgst,
        grandTotal: calculated.grandTotal,
        advance: calculated.advance,
        balance: calculated.balance,
        paymentMode: calculated.paymentMode,
        paymentBreakdown: calculated.paymentBreakdown,
        paymentStatus: calculated.paymentStatus,
        notes: payload.notes ? String(payload.notes).trim() : '',
      });
    } catch (err) {
      if (err.code === 11000 && !isCustomBillNumber && attempts < 3) {
        continue;
      }
      throw err;
    }
  }

  // Section 7: Return complete invoice details including shop & customer details
  const [populatedBill, shop] = await Promise.all([
    Bill.findById(bill._id).populate('customer', 'name mobile address'),
    getShopDetails(),
  ]);

  return formatInvoiceData(populatedBill, shop);
};

export const getBills = async ({
  search = '',
  startDate = '',
  endDate = '',
  date = '',
  paymentStatus = '',
  paymentMode = '',
  customerId = '',
} = {}) => {
  const filter = {};

  if (paymentStatus && String(paymentStatus).trim()) {
    filter.paymentStatus = String(paymentStatus).trim();
  }

  if (paymentMode && String(paymentMode).trim()) {
    filter.paymentMode = String(paymentMode).trim();
  }

  if (customerId && String(customerId).trim()) {
    filter.customer = String(customerId).trim();
  }

  const dateRange = buildDateRangeFilter({ date, startDate, endDate });
  if (dateRange) {
    filter.billDate = dateRange;
  }

  if (search && String(search).trim()) {
    const safeQ = escapeRegex(String(search).trim());
    const matchingCustomers = await Customer.find({
      $or: [
        { name: { $regex: safeQ, $options: 'i' } },
        { mobile: { $regex: safeQ, $options: 'i' } },
      ],
    }).select('_id');

    const customerIds = matchingCustomers.map((c) => c._id);

    filter.$or = [
      { billNumber: { $regex: safeQ, $options: 'i' } },
      { customer: { $in: customerIds } },
      { 'items.name': { $regex: safeQ, $options: 'i' } },
    ];
  }

  return Bill.find(filter)
    .populate('customer', 'name mobile address')
    .sort({ billDate: -1, createdAt: -1 });
};

export const getBillById = async (id) => {
  const [bill, shop] = await Promise.all([
    Bill.findById(id).populate('customer', 'name mobile address'),
    getShopDetails(),
  ]);
  if (!bill) {
    throw new ApiError(404, 'Bill not found');
  }
  return formatInvoiceData(bill, shop);
};

export const getBillPrintHtml = async (id) => {
  const invoice = await getBillById(id);
  const html = generateInvoiceHtml(invoice);
  return { billNumber: invoice.billNumber, html };
};

export const getBillPdf = async (id) => {
  const invoice = await getBillById(id);
  const pdfBuffer = await generateInvoicePdfBuffer(invoice);
  return { billNumber: invoice.billNumber, pdfBuffer };
};

export const deleteBillById = async (id) => {
  const bill = await Bill.findById(id);
  if (!bill) {
    throw new ApiError(404, 'Bill not found');
  }
  await bill.deleteOne();
  return { deletedId: id, billNumber: bill.billNumber };
};

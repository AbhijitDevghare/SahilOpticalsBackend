import Customer from '../models/customer.model.js';
import Bill from '../models/bill.model.js';
import { ApiError } from '../utils/apiResponse.js';
import { hasPrescriptionData } from '../utils/billCalculator.js';
import { escapeRegex } from '../utils/queryHelpers.js';

export const createOrReuseCustomer = async ({ name, mobile, address = '' }) => {
  const cleanName = name ? String(name).trim() : '';
  const cleanMobile = mobile ? String(mobile).trim() : '';
  if (!cleanName || !cleanMobile) {
    throw new ApiError(400, 'Customer name and mobile are required');
  }

  const cleanAddress = address ? String(address).trim() : '';

  let customer = await Customer.findOne({ mobile: cleanMobile });
  if (customer) {
    customer.name = cleanName || customer.name;
    if (cleanAddress) customer.address = cleanAddress;
    await customer.save();
    return { customer, isNew: false };
  }

  customer = await Customer.create({
    name: cleanName,
    mobile: cleanMobile,
    address: cleanAddress,
  });

  return { customer, isNew: true };
};

export const getAllCustomers = async ({ search = '', mobile = '' } = {}) => {
  const filter = {};
  if (mobile && String(mobile).trim()) {
    filter.mobile = { $regex: escapeRegex(String(mobile).trim()), $options: 'i' };
  } else if (search && String(search).trim()) {
    const safeQ = escapeRegex(String(search).trim());
    filter.$or = [
      { name: { $regex: safeQ, $options: 'i' } },
      { mobile: { $regex: safeQ, $options: 'i' } },
      { address: { $regex: safeQ, $options: 'i' } },
    ];
  }

  const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();
  if (customers.length === 0) return [];

  const customerIds = customers.map((c) => c._id);
  const billStats = await Bill.aggregate([
    { $match: { customer: { $in: customerIds } } },
    {
      $group: {
        _id: '$customer',
        billCount: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' },
        pendingBalance: { $sum: '$balance' },
        lastVisit: { $max: '$billDate' },
      },
    },
  ]);

  const statsMap = new Map(billStats.map((s) => [String(s._id), s]));

  return customers.map((c) => {
    const s = statsMap.get(String(c._id));
    return {
      ...c,
      billCount: s ? s.billCount : 0,
      totalSpent: s ? Number(s.totalSpent.toFixed(2)) : 0,
      pendingBalance: s ? Number(s.pendingBalance.toFixed(2)) : 0,
      lastVisit: s ? s.lastVisit : null,
    };
  });
};

export const findCustomerByMobile = async (mobile) => {
  const cleanMobile = mobile ? String(mobile).trim() : '';
  if (!cleanMobile) {
    throw new ApiError(400, 'Mobile number is required');
  }

  const customer = await Customer.findOne({ mobile: cleanMobile });
  if (!customer) {
    return {
      found: false,
      customer: null,
      latestPrescription: null,
    };
  }

  const recentBills = await Bill.find({ customer: customer._id })
    .sort({ billDate: -1, createdAt: -1 })
    .limit(5)
    .select('prescription billNumber billDate');

  let latestPrescription = null;
  for (const b of recentBills) {
    if (hasPrescriptionData(b.prescription)) {
      latestPrescription = {
        ...b.prescription.toObject(),
        fromBillNumber: b.billNumber,
        fromBillDate: b.billDate,
      };
      break;
    }
  }

  return {
    found: true,
    customer,
    latestPrescription,
  };
};

export const getCustomerById = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  return customer;
};

export const updateCustomerById = async (id, payload) => {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  if (payload.mobile && String(payload.mobile).trim() !== customer.mobile) {
    const existing = await Customer.findOne({
      mobile: String(payload.mobile).trim(),
      _id: { $ne: id },
    });
    if (existing) {
      throw new ApiError(409, 'Another customer with this mobile number already exists');
    }
    customer.mobile = String(payload.mobile).trim();
  }

  if (payload.name !== undefined) customer.name = String(payload.name).trim();
  if (payload.address !== undefined) customer.address = String(payload.address).trim();

  await customer.save();
  return customer;
};

export const deleteCustomerById = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const linkedBills = await Bill.countDocuments({ customer: id });
  if (linkedBills > 0) {
    throw new ApiError(400, 'Cannot delete customer with existing billing history');
  }

  await customer.deleteOne();
  return { deletedId: id };
};

export const getCustomerBillingHistory = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const bills = await Bill.find({ customer: id })
    .populate('customer', 'name mobile address')
    .sort({ billDate: -1, createdAt: -1 });

  const totalSpent = Number(bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2));
  const totalPaid = Number(bills.reduce((sum, b) => sum + (b.advance || 0), 0).toFixed(2));
  const totalBalance = Number(bills.reduce((sum, b) => sum + (b.balance || 0), 0).toFixed(2));

  let latestPrescription = null;
  for (const b of bills) {
    if (hasPrescriptionData(b.prescription)) {
      latestPrescription = {
        ...b.prescription.toObject(),
        fromBillNumber: b.billNumber,
        fromBillDate: b.billDate,
      };
      break;
    }
  }

  return {
    customer,
    latestPrescription,
    summary: {
      totalBills: bills.length,
      totalSpent,
      totalPaid,
      totalBalance,
    },
    bills,
  };
};

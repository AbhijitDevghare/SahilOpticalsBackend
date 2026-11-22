import Bill from '../models/bill.model.js';
import { buildDateRangeFilter } from '../utils/queryHelpers.js';

export const getReportsSummary = async ({ startDate = '', endDate = '' } = {}) => {
  const matchFilter = {};
  const dateRange = buildDateRangeFilter({ startDate, endDate });
  if (dateRange) {
    matchFilter.billDate = dateRange;
  }

  const [overallAgg, dailySalesAgg, monthlySalesAgg, paymentModeAgg, paymentStatusAgg] =
    await Promise.all([
      Bill.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: '$grandTotal' },
            totalSubtotal: { $sum: '$subtotal' },
            totalDiscount: { $sum: '$discount' },
            totalGST: { $sum: '$GST' },
            paidAmount: { $sum: '$advance' },
            pendingAmount: { $sum: '$balance' },
          },
        },
      ]),
      Bill.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$billDate' },
            },
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: '$grandTotal' },
            paidAmount: { $sum: '$advance' },
            pendingAmount: { $sum: '$balance' },
          },
        },
        { $sort: { _id: -1 } },
      ]),
      Bill.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$billDate' },
            },
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: '$grandTotal' },
            paidAmount: { $sum: '$advance' },
            pendingAmount: { $sum: '$balance' },
          },
        },
        { $sort: { _id: -1 } },
      ]),
      Bill.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$paymentMode',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$grandTotal' },
            paidAmount: { $sum: '$advance' },
            pendingAmount: { $sum: '$balance' },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
      Bill.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$grandTotal' },
            paidAmount: { $sum: '$advance' },
            pendingAmount: { $sum: '$balance' },
          },
        },
      ]),
    ]);

  const overview = overallAgg[0] || {
    totalBills: 0,
    totalRevenue: 0,
    totalSubtotal: 0,
    totalDiscount: 0,
    totalGST: 0,
    paidAmount: 0,
    pendingAmount: 0,
  };

  return {
    totalRevenue: overview.totalRevenue,
    paidAndPendingAmounts: {
      totalRevenue: overview.totalRevenue,
      paidAmount: overview.paidAmount,
      pendingAmount: overview.pendingAmount,
      totalDiscount: overview.totalDiscount,
      totalGST: overview.totalGST,
      totalBills: overview.totalBills,
    },
    dailySales: dailySalesAgg.map((d) => ({
      date: d._id,
      totalBills: d.totalBills,
      totalRevenue: d.totalRevenue,
      paidAmount: d.paidAmount,
      pendingAmount: d.pendingAmount,
    })),
    monthlySales: monthlySalesAgg.map((m) => ({
      month: m._id,
      totalBills: m.totalBills,
      totalRevenue: m.totalRevenue,
      paidAmount: m.paidAmount,
      pendingAmount: m.pendingAmount,
    })),
    paymentModeSummary: paymentModeAgg.map((pm) => ({
      paymentMode: pm._id,
      count: pm.count,
      totalRevenue: pm.totalRevenue,
      paidAmount: pm.paidAmount,
      pendingAmount: pm.pendingAmount,
    })),
    paymentStatusSummary: paymentStatusAgg.map((ps) => ({
      paymentStatus: ps._id,
      count: ps.count,
      totalRevenue: ps.totalRevenue,
      paidAmount: ps.paidAmount,
      pendingAmount: ps.pendingAmount,
    })),
  };
};

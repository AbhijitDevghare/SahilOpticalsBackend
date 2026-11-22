import Bill from '../models/bill.model.js';
import Customer from '../models/customer.model.js';

export const getDashboardStats = async () => {
  const [
    totalBills,
    totalCustomers,
    recentBills,
    aggTotals,
    monthlySalesAgg,
    statusCountsAgg,
    paymentModesAgg,
  ] = await Promise.all([
    Bill.countDocuments(),
    Customer.countDocuments(),
    Bill.find()
      .populate('customer', 'name mobile address')
      .sort({ billDate: -1, createdAt: -1 })
      .limit(7),
    Bill.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalAdvanceReceived: { $sum: '$advance' },
          pendingPayments: { $sum: '$balance' },
        },
      },
    ]),
    Bill.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$billDate' },
            month: { $month: '$billDate' },
          },
          totalBills: { $sum: 1 },
          totalSales: { $sum: '$grandTotal' },
          receivedAmount: { $sum: '$advance' },
          pendingAmount: { $sum: '$balance' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]),
    Bill.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
        },
      },
    ]),
    Bill.aggregate([
      {
        $group: {
          _id: '$paymentMode',
          count: { $sum: 1 },
          amount: { $sum: '$grandTotal' },
        },
      },
    ]),
  ]);

  const totals = aggTotals[0] || {
    totalSales: 0,
    totalAdvanceReceived: 0,
    pendingPayments: 0,
  };

  const statusMap = { Paid: 0, Partial: 0, Pending: 0 };
  for (const row of statusCountsAgg) {
    if (row._id in statusMap) statusMap[row._id] = row.count;
  }

  const modeMap = new Map(paymentModesAgg.map((row) => [row._id, row]));
  const paymentModes = ['UPI', 'Cash', 'Card', 'Mixed'].map((mode) => {
    const entry = modeMap.get(mode);
    const amount = entry ? Number(entry.amount.toFixed(2)) : 0;
    const count = entry ? entry.count : 0;
    const percentage =
      totals.totalSales > 0 ? Math.round((amount / totals.totalSales) * 100) : 0;
    return { mode, amount, count, percentage };
  });

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const fullMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const monthlySalesSummary = monthlySalesAgg
    .map((item) => ({
      year: item._id.year,
      month: item._id.month,
      label: `${monthNames[item._id.month - 1]} ${String(item._id.year).slice(-2)}`,
      fullLabel: `${fullMonthNames[item._id.month - 1]} ${item._id.year}`,
      totalBills: item.totalBills,
      totalSales: Number(item.totalSales.toFixed(2)),
      receivedAmount: Number(item.receivedAmount.toFixed(2)),
      pendingAmount: Number(item.pendingAmount.toFixed(2)),
    }))
    .reverse();

  return {
    totalBills,
    totalSales: Number(totals.totalSales.toFixed(2)),
    totalReceived: Number(totals.totalAdvanceReceived.toFixed(2)),
    avgBillValue: totalBills > 0 ? Math.round(totals.totalSales / totalBills) : 0,
    totalCustomers,
    pendingPayments: Number(totals.pendingPayments.toFixed(2)),
    statusCounts: {
      paid: statusMap.Paid,
      partial: statusMap.Partial,
      pending: statusMap.Pending,
    },
    paymentModes,
    recentBills,
    monthlySalesSummary,
  };
};

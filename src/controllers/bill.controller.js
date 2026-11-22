import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import {
  createBill,
  previewBillCalculation,
  getBills,
  getBillById,
  getBillPrintHtml,
  getBillPdf,
  deleteBillById,
  generateUniqueBillNumber,
} from '../services/bill.service.js';

export const getNextBillNumber = asyncHandler(async (req, res) => {
  const billNumber = await generateUniqueBillNumber();
  return sendResponse(res, 200, { billNumber }, 'Next bill number generated');
});

export const calculateBillPreview = asyncHandler(async (req, res) => {
  const summary = await previewBillCalculation(req.body);
  return sendResponse(res, 200, summary, 'Bill calculation computed successfully');
});

export const addBill = asyncHandler(async (req, res) => {
  const invoice = await createBill(req.body);
  return sendResponse(res, 201, invoice, 'Bill created successfully');
});

export const listBills = asyncHandler(async (req, res) => {
  const bills = await getBills({
    search: req.query.search || req.query.q,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    date: req.query.date,
    paymentStatus: req.query.paymentStatus,
    paymentMode: req.query.paymentMode,
    customerId: req.query.customerId,
  });
  return sendResponse(res, 200, bills, 'Bills fetched successfully');
});

export const getBill = asyncHandler(async (req, res) => {
  const invoice = await getBillById(req.params.id);
  return sendResponse(res, 200, invoice, 'Invoice fetched successfully');
});

export const printBillInvoice = asyncHandler(async (req, res) => {
  const { html } = await getBillPrintHtml(req.params.id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
});

export const downloadBillPdf = asyncHandler(async (req, res) => {
  const { billNumber, pdfBuffer } = await getBillPdf(req.params.id);
  const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="Invoice-${billNumber}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.status(200).send(pdfBuffer);
});

export const removeBill = asyncHandler(async (req, res) => {
  const result = await deleteBillById(req.params.id);
  return sendResponse(res, 200, result, 'Bill deleted successfully');
});

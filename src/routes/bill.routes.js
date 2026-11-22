import { Router } from 'express';
import {
  addBill,
  calculateBillPreview,
  listBills,
  getBill,
  printBillInvoice,
  downloadBillPdf,
  removeBill,
  getNextBillNumber,
} from '../controllers/bill.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateRequiredFields } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protect);
router.get('/next-number', getNextBillNumber);
router.post('/calculate', validateRequiredFields(['items']), calculateBillPreview);
router.post('/', validateRequiredFields(['items']), addBill);
router.get('/', listBills);
router.get('/search', listBills);
router.get('/filter', listBills);
router.get('/:id/invoice', getBill);
router.get('/:id/print', printBillInvoice);
router.get('/:id/pdf', downloadBillPdf);
router.get('/:id', getBill);
router.delete('/:id', removeBill);

export default router;

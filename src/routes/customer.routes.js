import { Router } from 'express';
import {
  createCustomer,
  listCustomers,
  lookupCustomerByMobile,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerHistory,
} from '../controllers/customer.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateRequiredFields } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protect);
router.post('/', validateRequiredFields(['name', 'mobile']), createCustomer);
router.get('/', listCustomers);
router.get('/search', listCustomers);
router.get('/mobile/:mobile', lookupCustomerByMobile);
router.get('/:id/bills', getCustomerHistory);
router.get('/:id/history', getCustomerHistory);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;

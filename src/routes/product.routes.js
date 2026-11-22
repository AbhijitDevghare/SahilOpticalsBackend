import { Router } from 'express';
import {
  addProduct,
  listProducts,
  listProductCategories,
  getProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateRequiredFields } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protect);
router.post('/', validateRequiredFields(['name', 'category', 'price']), addProduct);
router.get('/categories', listProductCategories);
router.get('/', listProducts);
router.get('/search', listProducts);
router.get('/:id', getProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;

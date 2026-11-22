import { Router } from 'express';
import { getShop, updateShop } from '../controllers/shop.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);
router.get('/', getShop);
router.put('/', updateShop);

export default router;

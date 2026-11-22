import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller.js';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import shopRoutes from './shop.routes.js';
import customerRoutes from './customer.routes.js';
import productRoutes from './product.routes.js';
import billRoutes from './bill.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

router.get('/health', checkHealth);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/shop', shopRoutes);
router.use('/settings', shopRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/bills', billRoutes);
router.use('/reports', reportRoutes);

export default router;

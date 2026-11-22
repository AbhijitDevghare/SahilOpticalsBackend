import { Router } from 'express';
import {
  login,
  getCurrentUser,
  updateCredentials,
  logout,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateRequiredFields } from '../middleware/validate.middleware.js';

const router = Router();

router.post('/login', validateRequiredFields(['username', 'password']), login);
router.get('/me', protect, getCurrentUser);
router.put(
  '/credentials',
  protect,
  validateRequiredFields(['currentPassword']),
  updateCredentials
);
router.post('/logout', protect, logout);

export default router;

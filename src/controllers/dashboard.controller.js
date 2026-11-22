import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import { getDashboardStats } from '../services/dashboard.service.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const stats = await getDashboardStats();
  return sendResponse(res, 200, stats, 'Dashboard statistics fetched successfully');
});

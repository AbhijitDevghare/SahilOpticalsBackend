import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import { getSystemHealth } from '../services/health.service.js';

export const checkHealth = asyncHandler(async (req, res) => {
  const health = getSystemHealth();
  return sendResponse(res, 200, health, 'Server is running');
});

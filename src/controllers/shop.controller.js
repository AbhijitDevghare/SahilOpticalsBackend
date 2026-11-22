import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import { getShopDetails, updateShopDetails } from '../services/shop.service.js';

export const getShop = asyncHandler(async (req, res) => {
  const shop = await getShopDetails();
  return sendResponse(res, 200, shop, 'Shop details fetched successfully');
});

export const updateShop = asyncHandler(async (req, res) => {
  const shop = await updateShopDetails(req.body);
  return sendResponse(res, 200, shop, 'Shop details updated successfully');
});

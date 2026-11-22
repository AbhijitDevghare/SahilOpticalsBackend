import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import {
  createProduct,
  getProducts,
  getProductCategories,
  getProductById,
  updateProductById,
  deleteProductById,
} from '../services/product.service.js';

export const listProductCategories = asyncHandler(async (req, res) => {
  const categories = getProductCategories();
  return sendResponse(res, 200, categories, 'Product categories fetched successfully');
});

export const addProduct = asyncHandler(async (req, res) => {
  const product = await createProduct(req.body);
  return sendResponse(res, 201, product, 'Product added successfully');
});

export const listProducts = asyncHandler(async (req, res) => {
  const products = await getProducts({
    search: req.query.search || req.query.q,
    category: req.query.category,
  });
  return sendResponse(res, 200, products, 'Products fetched successfully');
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await getProductById(req.params.id);
  return sendResponse(res, 200, product, 'Product fetched successfully');
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await updateProductById(req.params.id, req.body);
  return sendResponse(res, 200, product, 'Product updated successfully');
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const result = await deleteProductById(req.params.id);
  return sendResponse(res, 200, result, 'Product deleted successfully');
});

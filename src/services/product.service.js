import Product, { PRODUCT_CATEGORIES } from '../models/product.model.js';
import { ApiError } from '../utils/apiResponse.js';
import { normalizeCategory } from '../utils/billCalculator.js';
import { escapeRegex } from '../utils/queryHelpers.js';

export const getProductCategories = () => PRODUCT_CATEGORIES;

export const createProduct = async ({ name, category, description = '', price }) => {
  if (!name || !category || price === undefined || price === null) {
    throw new ApiError(400, 'Product name, category, and price are required');
  }

  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    throw new ApiError(400, 'Product price must be a non-negative number');
  }

  const normalizedCategory = normalizeCategory(category);

  const product = await Product.create({
    name: String(name).trim(),
    category: normalizedCategory,
    description: description ? String(description).trim() : '',
    price: parsedPrice,
  });

  return product;
};

export const getProducts = async ({ search = '', category = '' } = {}) => {
  const filter = {};
  if (category && String(category).trim()) {
    filter.category = { $regex: `^${escapeRegex(String(category).trim())}$`, $options: 'i' };
  }
  if (search && String(search).trim()) {
    const safeQ = escapeRegex(String(search).trim());
    filter.$or = [
      { name: { $regex: safeQ, $options: 'i' } },
      { category: { $regex: safeQ, $options: 'i' } },
      { description: { $regex: safeQ, $options: 'i' } },
    ];
  }

  return Product.find(filter).sort({ createdAt: -1 });
};

export const getProductById = async (id) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  return product;
};

export const updateProductById = async (id, payload) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (payload.name !== undefined) {
    const cleanName = String(payload.name).trim();
    if (!cleanName) throw new ApiError(400, 'Product name cannot be empty');
    product.name = cleanName;
  }

  if (payload.category !== undefined) {
    const cleanCategory = String(payload.category).trim();
    if (!cleanCategory) throw new ApiError(400, 'Product category cannot be empty');
    product.category = normalizeCategory(cleanCategory);
  }

  if (payload.description !== undefined) {
    product.description = String(payload.description).trim();
  }

  if (payload.price !== undefined) {
    const parsedPrice = Number(payload.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      throw new ApiError(400, 'Product price must be a non-negative number');
    }
    product.price = parsedPrice;
  }

  await product.save();
  return product;
};

export const deleteProductById = async (id) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  await product.deleteOne();
  return { deletedId: id };
};

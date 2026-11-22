import mongoose from 'mongoose';

export const PRODUCT_CATEGORIES = [
  'Eyeglasses',
  'Frames',
  'Lenses',
  'Sunglasses',
  'Contact Lenses',
  'Accessories',
  'Other',
];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      enum: {
        values: PRODUCT_CATEGORIES,
        message: `Category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`,
      },
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

export default Product;

import mongoose from 'mongoose';
import { PRODUCT_CATEGORIES } from './product.model.js';

const billItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Item category is required'],
      enum: {
        values: PRODUCT_CATEGORIES,
        message: `Category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`,
      },
      trim: true,
      default: 'Other',
    },
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    rate: {
      type: Number,
      required: [true, 'Item rate is required'],
      min: [0, 'Rate cannot be negative'],
    },
    price: {
      type: Number,
      required: [true, 'Item price is required'],
      min: [0, 'Price cannot be negative'],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const eyePowerSchema = new mongoose.Schema(
  {
    sph: { type: String, trim: true, default: '' },
    cyl: { type: String, trim: true, default: '' },
    axis: { type: String, trim: true, default: '' },
    add: { type: String, trim: true, default: '' },
    va: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    rightEye: { type: eyePowerSchema, default: () => ({}) },
    leftEye: { type: eyePowerSchema, default: () => ({}) },
    pdDistance: { type: String, trim: true, default: '' },
    pdNear: { type: String, trim: true, default: '' },
    lensType: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const paymentBreakdownSchema = new mongoose.Schema(
  {
    cash: { type: Number, min: 0, default: 0 },
    upi: { type: Number, min: 0, default: 0 },
    card: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: [true, 'Bill number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    billDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    items: {
      type: [billItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one item is required in a bill',
      },
    },
    prescription: {
      type: prescriptionSchema,
      default: () => ({}),
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    gstRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    GST: {
      type: Number,
      min: 0,
      default: 0,
    },
    cgst: {
      type: Number,
      min: 0,
      default: 0,
    },
    sgst: {
      type: Number,
      min: 0,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    advance: {
      type: Number,
      min: 0,
      default: 0,
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', 'Card', 'Mixed'],
      default: 'Cash',
      required: true,
    },
    paymentBreakdown: {
      type: paymentBreakdownSchema,
      default: () => ({ cash: 0, upi: 0, card: 0 }),
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Pending'],
      default: 'Pending',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Bill = mongoose.model('Bill', billSchema);

export default Bill;

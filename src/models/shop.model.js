import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      default: 'Sahil Optical',
    },
    address: {
      type: String,
      required: [true, 'Shop address is required'],
      trim: true,
      default: '',
    },
    mobile: {
      type: String,
      required: [true, 'Shop mobile is required'],
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    GSTIN: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    tagline: {
      type: String,
      trim: true,
      default: 'Complete Eye Care & Optical Showroom',
    },
  },
  {
    timestamps: true,
  }
);

const Shop = mongoose.model('Shop', shopSchema);

export default Shop;

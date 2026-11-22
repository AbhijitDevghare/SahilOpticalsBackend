import Shop from '../models/shop.model.js';

const DEFAULT_SHOP = {
  shopName: 'Sahil Optical',
  address: 'Main Market Road, Near City Center',
  mobile: '9876543210',
  email: 'contact@sahiloptical.com',
  GSTIN: '27AABCS1429B1Z1',
  tagline: 'Complete Eye Care & Optical Showroom',
};

export const getShopDetails = async () => {
  let shop = await Shop.findOne();
  if (!shop) {
    shop = await Shop.create(DEFAULT_SHOP);
  }
  return shop;
};

export const updateShopDetails = async (payload) => {
  let shop = await Shop.findOne();
  if (!shop) {
    shop = await Shop.create({ ...DEFAULT_SHOP, ...payload });
    return shop;
  }

  const allowedFields = ['shopName', 'address', 'mobile', 'email', 'GSTIN', 'tagline'];
  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      shop[field] = payload[field];
    }
  });

  await shop.save();
  return shop;
};

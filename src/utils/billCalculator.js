import { ApiError } from './apiResponse.js';
import { PRODUCT_CATEGORIES } from '../models/product.model.js';

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Mixed'];

export const roundCurrency = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

export const normalizeCategory = (rawCategory) => {
  if (rawCategory === undefined || rawCategory === null || String(rawCategory).trim() === '') {
    return 'Other';
  }
  const input = String(rawCategory).trim().toLowerCase();
  const matched = PRODUCT_CATEGORIES.find((cat) => cat.toLowerCase() === input);
  if (!matched) {
    throw new ApiError(
      400,
      `Invalid category "${rawCategory}". Supported categories: ${PRODUCT_CATEGORIES.join(', ')}`
    );
  }
  return matched;
};

const normalizeEyePower = (eye, eyeLabel) => {
  if (!eye || typeof eye !== 'object') {
    return { sph: '', cyl: '', axis: '', add: '', va: '' };
  }

  const pick = (a, b) => {
    const val = eye[a] !== undefined ? eye[a] : eye[b];
    return val !== undefined && val !== null ? String(val).trim() : '';
  };

  const sph = pick('sph', 'SPH');
  const cyl = pick('cyl', 'CYL');
  const rawAxis = pick('axis', 'Axis');
  const add = pick('add', 'ADD');
  const va = pick('va', 'VA');

  let axis = rawAxis;
  if (rawAxis !== '') {
    const cleanedAxis = rawAxis.replace(/°$/, '').trim();
    const axisNum = Number(cleanedAxis);
    if (!Number.isFinite(axisNum) || axisNum < 0 || axisNum > 180) {
      throw new ApiError(400, `${eyeLabel} Axis must be a number between 0 and 180`);
    }
    axis = String(axisNum);
  }

  return { sph, cyl, axis, add, va };
};

export const normalizePrescription = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return {
      rightEye: { sph: '', cyl: '', axis: '', add: '', va: '' },
      leftEye: { sph: '', cyl: '', axis: '', add: '', va: '' },
      pdDistance: '',
      pdNear: '',
      lensType: '',
      remarks: '',
    };
  }

  const rightInput = raw.rightEye || raw.od || raw.OD || {};
  const leftInput = raw.leftEye || raw.os || raw.OS || {};

  const pdDistanceRaw =
    raw.pdDistance !== undefined ? raw.pdDistance : raw.pd !== undefined ? raw.pd : '';
  const pdNearRaw = raw.pdNear !== undefined ? raw.pdNear : '';
  const lensTypeRaw = raw.lensType !== undefined ? raw.lensType : '';
  const remarksRaw =
    raw.remarks !== undefined ? raw.remarks : raw.notes !== undefined ? raw.notes : '';

  return {
    rightEye: normalizeEyePower(rightInput, 'Right Eye (OD)'),
    leftEye: normalizeEyePower(leftInput, 'Left Eye (OS)'),
    pdDistance: pdDistanceRaw !== null ? String(pdDistanceRaw).trim() : '',
    pdNear: pdNearRaw !== null ? String(pdNearRaw).trim() : '',
    lensType: lensTypeRaw !== null ? String(lensTypeRaw).trim() : '',
    remarks: remarksRaw !== null ? String(remarksRaw).trim() : '',
  };
};

export const hasPrescriptionData = (prescription) => {
  if (!prescription || typeof prescription !== 'object') return false;
  const checkEye = (eye) =>
    Boolean(eye && (eye.sph || eye.cyl || eye.axis || eye.add || eye.va));
  return Boolean(
    checkEye(prescription.rightEye) ||
      checkEye(prescription.leftEye) ||
      prescription.pdDistance ||
      prescription.pdNear ||
      prescription.lensType ||
      prescription.remarks
  );
};

const resolveDiscountInput = ({ discountType, discountValue, discount }) => {
  let type = discountType;
  let value = discountValue;

  if (discount && typeof discount === 'object') {
    type = discount.type !== undefined ? discount.type : type;
    value = discount.value !== undefined ? discount.value : value;
  } else if (value === undefined && discount !== undefined && discount !== null && discount !== '') {
    value = discount;
  }

  const rawType = type ? String(type).trim().toLowerCase() : 'fixed';
  let normalizedType = 'fixed';
  if (rawType === 'fixed' || rawType === 'flat' || rawType === 'amount') {
    normalizedType = 'fixed';
  } else if (rawType === 'percentage' || rawType === 'percent' || rawType === '%') {
    normalizedType = 'percentage';
  } else {
    throw new ApiError(400, 'Discount type must be either "fixed" or "percentage"');
  }

  const parsedValue = value === undefined || value === null || value === '' ? 0 : Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new ApiError(400, 'Discount value must be a non-negative number');
  }

  return { discountType: normalizedType, discountValue: parsedValue };
};

export const calculateBillTotals = ({
  items = [],
  discountType,
  discountValue,
  discount = 0,
  gstRate = 0,
  gstAmount,
  advance = 0,
  paymentMode = 'Cash',
  paymentBreakdown,
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one item is required to create a bill');
  }

  let subtotal = 0;
  const processedItems = items.map((item, idx) => {
    const rawName = item.name !== undefined ? item.name : item.productName;
    const name = rawName ? String(rawName).trim() : '';
    if (!name) {
      throw new ApiError(400, `Item #${idx + 1}: product name is required`);
    }

    const category = normalizeCategory(item.category);

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, `Item "${name}": quantity must be a whole number of at least 1`);
    }

    const rawRate = item.rate !== undefined ? item.rate : item.price;
    if (rawRate === undefined || rawRate === null || rawRate === '') {
      throw new ApiError(400, `Item "${name}": rate is required`);
    }

    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate < 0) {
      throw new ApiError(400, `Item "${name}": rate must be a non-negative number`);
    }

    const roundedRate = roundCurrency(rate);
    const amount = roundCurrency(quantity * roundedRate);
    subtotal += amount;

    const productId = item.product || item.productId || null;

    return {
      product: productId,
      isManual: item.isManual !== undefined ? Boolean(item.isManual) : !productId,
      name,
      category,
      quantity,
      rate: roundedRate,
      price: roundedRate,
      amount,
    };
  });

  subtotal = roundCurrency(subtotal);

  // Discount: Fixed amount or Percentage
  const { discountType: resolvedDiscountType, discountValue: resolvedDiscountValue } =
    resolveDiscountInput({ discountType, discountValue, discount });

  let discountAmount = 0;
  if (resolvedDiscountType === 'percentage') {
    if (resolvedDiscountValue > 100) {
      throw new ApiError(400, 'Percentage discount cannot exceed 100%');
    }
    discountAmount = roundCurrency((subtotal * resolvedDiscountValue) / 100);
  } else {
    if (resolvedDiscountValue > subtotal) {
      throw new ApiError(400, 'Fixed discount cannot exceed subtotal');
    }
    discountAmount = roundCurrency(resolvedDiscountValue);
  }

  // Taxable Amount = Subtotal - Discount
  const taxableAmount = Math.max(0, roundCurrency(subtotal - discountAmount));

  // GST Amount = Taxable Amount * GST Rate / 100
  let resolvedGstRate = 0;
  let computedGST = 0;

  if (gstRate !== undefined && gstRate !== null && gstRate !== '') {
    resolvedGstRate = Number(gstRate);
    if (!Number.isFinite(resolvedGstRate) || resolvedGstRate < 0 || resolvedGstRate > 100) {
      throw new ApiError(400, 'GST rate must be between 0 and 100');
    }
    computedGST = roundCurrency((taxableAmount * resolvedGstRate) / 100);
  } else if (gstAmount !== undefined && gstAmount !== null && gstAmount !== '') {
    computedGST = Number(gstAmount);
    if (!Number.isFinite(computedGST) || computedGST < 0) {
      throw new ApiError(400, 'GST amount must be a non-negative number');
    }
    computedGST = roundCurrency(computedGST);
    resolvedGstRate =
      taxableAmount > 0 ? roundCurrency((computedGST / taxableAmount) * 100) : 0;
  }

  const cgst = roundCurrency(computedGST / 2);
  const sgst = roundCurrency(computedGST - cgst);

  // Grand Total = Taxable Amount + GST Amount
  const grandTotal = roundCurrency(taxableAmount + computedGST);

  // Advance & Balance validation
  const parsedAdvance =
    advance === undefined || advance === null || advance === '' ? 0 : Number(advance);
  if (!Number.isFinite(parsedAdvance) || parsedAdvance < 0) {
    throw new ApiError(400, 'Advance payment must be a non-negative number');
  }
  const roundedAdvance = roundCurrency(parsedAdvance);

  if (roundedAdvance > grandTotal) {
    throw new ApiError(400, 'Advance payment cannot exceed grand total');
  }

  const balance = Math.max(0, roundCurrency(grandTotal - roundedAdvance));

  // Payment mode validation
  if (!PAYMENT_MODES.includes(paymentMode)) {
    throw new ApiError(400, `Invalid payment mode. Allowed: ${PAYMENT_MODES.join(', ')}`);
  }

  // Optional Mixed payment breakdown validation
  const normalizedBreakdown = { cash: 0, upi: 0, card: 0 };
  if (paymentMode === 'Mixed' && paymentBreakdown && typeof paymentBreakdown === 'object') {
    for (const key of ['cash', 'upi', 'card']) {
      const val =
        paymentBreakdown[key] === undefined ||
        paymentBreakdown[key] === null ||
        paymentBreakdown[key] === ''
          ? 0
          : Number(paymentBreakdown[key]);
      if (!Number.isFinite(val) || val < 0) {
        throw new ApiError(400, `Payment breakdown "${key}" must be a non-negative number`);
      }
      normalizedBreakdown[key] = roundCurrency(val);
    }

    const breakdownSum = roundCurrency(
      normalizedBreakdown.cash + normalizedBreakdown.upi + normalizedBreakdown.card
    );
    if (breakdownSum > 0 && Math.abs(breakdownSum - roundedAdvance) > 0.01) {
      throw new ApiError(
        400,
        `Mixed payment breakdown total (${breakdownSum}) must match advance paid (${roundedAdvance})`
      );
    }
  }

  // Auto-derived Payment Status
  let paymentStatus = 'Pending';
  if (balance === 0) {
    paymentStatus = 'Paid';
  } else if (roundedAdvance > 0 && balance > 0) {
    paymentStatus = 'Partial';
  } else {
    paymentStatus = 'Pending';
  }

  return {
    items: processedItems,
    subtotal,
    discountType: resolvedDiscountType,
    discountValue: roundCurrency(resolvedDiscountValue),
    discount: discountAmount,
    taxableAmount,
    gstRate: roundCurrency(resolvedGstRate),
    GST: computedGST,
    cgst,
    sgst,
    grandTotal,
    advance: roundedAdvance,
    balance,
    paymentMode,
    paymentBreakdown: normalizedBreakdown,
    paymentStatus,
  };
};

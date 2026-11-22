import { ApiError } from './apiResponse.js';

export const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseIsoDayBoundary = (dateStr, boundary = 'start') => {
  const clean = String(dateStr).trim();
  const isoDayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);

  if (isoDayMatch) {
    const [, y, m, d] = isoDayMatch.map(Number);
    const dt =
      boundary === 'end'
        ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
        : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    if (Number.isNaN(dt.getTime())) {
      throw new ApiError(400, `Invalid date value: ${dateStr}`);
    }
    return dt;
  }

  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `Invalid date value: ${dateStr}`);
  }
  if (boundary === 'end') {
    parsed.setUTCHours(23, 59, 59, 999);
  } else {
    parsed.setUTCHours(0, 0, 0, 0);
  }
  return parsed;
};

export const buildDateRangeFilter = ({ date = '', startDate = '', endDate = '' } = {}) => {
  if (date && String(date).trim()) {
    return {
      $gte: parseIsoDayBoundary(date, 'start'),
      $lte: parseIsoDayBoundary(date, 'end'),
    };
  }

  if (startDate || endDate) {
    const range = {};
    if (startDate && String(startDate).trim()) {
      range.$gte = parseIsoDayBoundary(startDate, 'start');
    }
    if (endDate && String(endDate).trim()) {
      range.$lte = parseIsoDayBoundary(endDate, 'end');
    }
    if (range.$gte && range.$lte && range.$gte > range.$lte) {
      throw new ApiError(400, 'Start date cannot be after end date');
    }
    return Object.keys(range).length > 0 ? range : null;
  }

  return null;
};

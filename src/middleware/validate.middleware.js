import { ApiError } from '../utils/apiResponse.js';

export const validateRequiredFields = (requiredFields = [], source = 'body') => {
  return (req, res, next) => {
    const data = req[source] || {};
    const missing = requiredFields.filter(
      (field) => data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missing.length > 0) {
      return next(
        new ApiError(
          400,
          `Missing required fields: ${missing.join(', ')}`,
          missing.map((field) => `${field} is required`)
        )
      );
    }

    next();
  };
};

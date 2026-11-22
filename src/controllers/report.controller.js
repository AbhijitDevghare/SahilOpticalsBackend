import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import { getReportsSummary } from '../services/report.service.js';

export const getReports = asyncHandler(async (req, res) => {
  const reports = await getReportsSummary({
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  return sendResponse(res, 200, reports, 'Reports generated successfully');
});

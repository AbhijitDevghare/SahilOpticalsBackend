import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import {
  createOrReuseCustomer,
  getAllCustomers,
  findCustomerByMobile,
  getCustomerById,
  updateCustomerById,
  deleteCustomerById,
  getCustomerBillingHistory,
} from '../services/customer.service.js';

export const createCustomer = asyncHandler(async (req, res) => {
  const { customer, isNew } = await createOrReuseCustomer(req.body);
  const statusCode = isNew ? 201 : 200;
  const message = isNew
    ? 'Customer created successfully'
    : 'Existing customer found by mobile and updated';
  return sendResponse(res, statusCode, customer, message);
});

export const listCustomers = asyncHandler(async (req, res) => {
  const customers = await getAllCustomers({
    search: req.query.search || req.query.q,
    mobile: req.query.mobile,
  });
  return sendResponse(res, 200, customers, 'Customers fetched successfully');
});

export const lookupCustomerByMobile = asyncHandler(async (req, res) => {
  const result = await findCustomerByMobile(req.params.mobile);
  const message = result.found
    ? 'Existing customer found for autofill'
    : 'No existing customer found with this mobile number';
  return sendResponse(res, 200, result, message);
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await getCustomerById(req.params.id);
  return sendResponse(res, 200, customer, 'Customer fetched successfully');
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await updateCustomerById(req.params.id, req.body);
  return sendResponse(res, 200, customer, 'Customer updated successfully');
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const result = await deleteCustomerById(req.params.id);
  return sendResponse(res, 200, result, 'Customer deleted successfully');
});

export const getCustomerHistory = asyncHandler(async (req, res) => {
  const history = await getCustomerBillingHistory(req.params.id);
  return sendResponse(res, 200, history, 'Customer billing history fetched successfully');
});

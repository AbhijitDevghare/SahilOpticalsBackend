import { asyncHandler, sendResponse } from '../utils/apiResponse.js';
import {
  loginUser,
  getCurrentUserById,
  updateUserCredentials,
} from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await loginUser({ username, password });

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('token', result.token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return sendResponse(res, 200, result, 'Login successful');
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await getCurrentUserById(req.user._id);
  return sendResponse(res, 200, user, 'Current user fetched successfully');
});

export const updateCredentials = asyncHandler(async (req, res) => {
  const result = await updateUserCredentials(req.user._id, req.body);

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('token', result.token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return sendResponse(res, 200, result, 'Account credentials updated successfully');
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  return sendResponse(res, 200, null, 'Logged out successfully');
});
